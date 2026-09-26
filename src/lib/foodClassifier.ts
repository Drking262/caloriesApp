import type { DatabaseFood } from './foodDatabase';
import { FOOD_LABEL_MAP } from './foodLabels.ts';
import { searchNutrition, GENERIC_FOOD_DATA_TYPES, isRelevantToQuery } from './nutritionApi.ts';
import { COARSE_CATEGORIES } from './foodData/coarse.ts';

/**
 * Real, on-device food recognition — not a random guess, and not capped at
 * a fixed pretrained class list. MobileCLIP-S0 (Apple's mobile-optimized
 * CLIP, via transformers.js/ONNX Runtime Web) is an *open-vocabulary* image
 * classifier: instead of a fixed set of classes baked in at training time,
 * it embeds the photo and a list of text labels into the same space and
 * scores by similarity — see foodLabels.ts for that list. Variety is bounded
 * by the label list, not the model, so recognizing a new dish is just
 * adding a labeled entry, not retraining.
 *
 * Chosen over the larger openai/clip-vit-base-patch32: tested against real
 * photos (see git history), MobileCLIP-S0 was *more* accurate (99.9% vs
 * 97.5% on a clear cheeseburger photo; 93.8% vs 51.9% on a broccoli macro
 * shot that confused both the original MobileNet and full CLIP) while its
 * quantized weights are ~55MB combined vs. full CLIP's ~150MB+.
 *
 * MIN_PROBABILITY is calibrated against those same real photos. Confidence
 * separation here is healthy (99.9% vs the next-best 0.0%; 93.8% vs 2.0%),
 * unlike the full-CLIP baseline, which was 80% confident and *wrong* on an
 * ambiguous bean-salad photo before the label list was broadened — a
 * reminder that the label list matters more than the threshold, but the
 * threshold (now together with the top-1-vs-top-2 margin check in
 * isConfident) is still real defense against genuinely ambiguous photos.
 *
 * Model weights are fetched from the Hugging Face Hub CDN on first use and
 * then cached (see the PWA workbox runtime-caching rule in vite.config.ts),
 * so it works offline after that.
 */

export interface FoodPrediction {
  food: DatabaseFood;
  label: string;
  probability: number;
  /** top 3 labels after softmax — lets the caller show "or did you
   * mean…" alternatives when the user corrects a guess */
  topK: { label: string; score: number }[];
  /** true only when the live USDA enrichment ran and its hit was
   * accepted. False when the label was Czech-guarded, no relevant hit
   * was found, or the lookup failed — the macro source (curated local
   * vs live USDA) collapses into `food` either way, so the reporting
   * path can tell enrichment attempts from accepted enrichments. */
  liveEnriched: boolean;
}

const MODEL_ID = 'Xenova/mobileclip_s0';

/** Prompt-averaging: several CLIP hypothesis templates per label, averaged
 * into one embedding. Free accuracy for zero-shot classification — and
 * crucially, every template positions the subject as food in a photo: an
 * unqualified "a photo of X, a type of food" lets a keyboard, a watch, or a
 * desk drift up to 0.48 because those are technically "photos", while the
 * "… on a plate / being eaten" framing pushes them back under 0.2 (measured
 * on scripts/eval/data). This is the not-food defense — a photo of nothing
 * edible must not invent a lunch. */
const HYPOTHESIS_TEMPLATES = [
  (label: string) => `a photo of ${label}, a type of food`,
  (label: string) => `${label} on a plate`,
  (label: string) => `a dish of ${label} being eaten`,
];

const MIN_PROBABILITY = 0.3;
/** Ambiguity defenses on top of the absolute threshold: the runner-up
 * must be beaten by a clear additive margin OR by ratio, else the photo
 * is genuinely between two labels and guessing is wrong too often. */
const MIN_MARGIN = 0.2;
const MIN_TOP1_RATIO = 2;

const LABELS = Object.keys(FOOD_LABEL_MAP);
const COARSE_LABELS = COARSE_CATEGORIES.map((c) => c.label);

interface Session {
  tokenizer: import('@huggingface/transformers').PreTrainedTokenizer;
  visionModel: import('@huggingface/transformers').PreTrainedModel;
  processor: import('@huggingface/transformers').Processor;
  /** per-label text embeddings, templates averaged and renormalized —
   * same (labels × dims) shape as before so the dot-product loop is
   * identical to the single-template version */
  normalizedTextEmbeds: number[][];
  /** same construction for the coarse categories (far fewer rows) */
  normalizedCoarseEmbeds: number[][];
  dot: (a: number[], b: number[]) => number;
  softmax: (arr: number[]) => number[];
}

/** Fold (labels × templates) × dims embeddings into labels × dims by
 * averaging each label's template rows, then re-normalizing to unit L2
 * norm (the dot-product scoring loop assumes unit vectors). Exported,
 * pure and model-free so foodClassifier.check.ts can assert it. */
export function foldTemplates(embeds: number[][], labelCount: number, templateCount: number): number[][] {
  const folded: number[][] = [];
  for (let label = 0; label < labelCount; label++) {
    const dims = embeds[label * templateCount].length;
    const avg = new Array<number>(dims).fill(0);
    for (let t = 0; t < templateCount; t++) {
      const row = embeds[label * templateCount + t];
      for (let d = 0; d < dims; d++) avg[d] += row[d];
    }
    let norm = 0;
    for (let d = 0; d < dims; d++) norm += avg[d] * avg[d];
    norm = Math.sqrt(norm) || 1;
    folded.push(avg.map((v) => v / norm));
  }
  return folded;
}

/** Confidence gate on softmaxed scores, sorted best-first: the top label
 * must clear the absolute threshold AND beat the runner-up by a clear
 * margin or ratio — otherwise the photo sits between two labels and any
 * pick is a coin flip. Exported and pure for foodClassifier.check.ts. */
export function isConfident(scores: number[]): boolean {
  if (scores.length === 0) return false;
  const top1 = scores[0];
  const top2 = scores.length > 1 ? scores[1] : 0;
  return top1 >= MIN_PROBABILITY && (top1 - top2 >= MIN_MARGIN || top1 / Math.max(top2, 1e-9) >= MIN_TOP1_RATIO);
}

let sessionPromise: Promise<Session> | null = null;

function getSession(): Promise<Session> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const { AutoTokenizer, CLIPTextModelWithProjection, AutoProcessor, CLIPVisionModelWithProjection, dot, softmax } =
        await import('@huggingface/transformers');

      const [tokenizer, textModel, processor, visionModel] = await Promise.all([
        AutoTokenizer.from_pretrained(MODEL_ID),
        CLIPTextModelWithProjection.from_pretrained(MODEL_ID),
        AutoProcessor.from_pretrained(MODEL_ID),
        CLIPVisionModelWithProjection.from_pretrained(MODEL_ID),
      ]);

      // Label embeddings never change — compute them once, not per
      // capture. Every label is embedded under every hypothesis template
      // (flat labels-major layout), then folded back to one row per label.
      const prompts = LABELS.flatMap((label) => HYPOTHESIS_TEMPLATES.map((t) => t(label)));
      // max_length pads every prompt to the model's context width so the
      // batch is rectangular; truncation silently drops a runaway label's
      // tail rather than throwing — acceptable for these short prompts.
      const textInputs = tokenizer(prompts, { padding: 'max_length', truncation: true });
      const { text_embeds } = await textModel(textInputs);
      const normalizedTextEmbeds = foldTemplates(
        text_embeds.normalize().tolist() as number[][],
        LABELS.length,
        HYPOTHESIS_TEMPLATES.length,
      );

      // Coarse layer, fine-grained hierarchical classification's stage 1 —
      // computed in the same session so a capture embeds once and scores
      // against both tables.
      const coarsePrompts = COARSE_CATEGORIES.flatMap((c) => HYPOTHESIS_TEMPLATES.map((t) => t(c.label)));
      const coarseInputs = tokenizer(coarsePrompts, { padding: 'max_length', truncation: true });
      const { text_embeds: coarseEmbeds } = await textModel(coarseInputs);
      const normalizedCoarseEmbeds = foldTemplates(
        coarseEmbeds.normalize().tolist() as number[][],
        COARSE_CATEGORIES.length,
        HYPOTHESIS_TEMPLATES.length,
      );

      return { tokenizer, visionModel, processor, normalizedTextEmbeds, normalizedCoarseEmbeds, dot, softmax };
    })();
  }
  return sessionPromise;
}

/** Call early (e.g. when the camera screen mounts) so the model is likely
 * warm by the time the user actually taps the shutter. Safe to ignore the
 * result; errors are swallowed since classification always has a fallback. */
export function warmUpClassifier(): void {
  getSession().catch(() => {});
}

// TEMP debug shim. Lets a Node-side measurement harness (no DOM canvas)
// feed a Blob/URL/canvas for RawImage to read. Null = use the camera
// canvas normally. Remove once classifyFood accepts a RawImage directly.
type RawImageInput = Blob | string | HTMLCanvasElement;
let debugImageLoader: ((canvas: HTMLCanvasElement) => RawImageInput) | null = null;
export function _setDebugImageLoader(fn: ((canvas: HTMLCanvasElement) => RawImageInput) | null): void {
  debugImageLoader = fn;
}

// Colocated with the TEMP shim above: it exists only so the debug loader
// can short-circuit the canvas path.
async function loadImage(
  RawImage: typeof import('@huggingface/transformers').RawImage,
  frame: HTMLCanvasElement,
): Promise<import('@huggingface/transformers').RawImage> {
  const override = debugImageLoader?.(frame);
  return override !== undefined ? RawImage.read(override) : RawImage.fromCanvas(frame);
}

export interface CoarsePrediction {
  category: string;
  probability: number;
}

export async function classifyFood(frame: HTMLCanvasElement): Promise<FoodPrediction | null> {
  // Inference errors (session load, processor, vision model) discard the
  // prediction: the caller falls back to the plain random-database guess,
  // app stays usable either way. The live-nutrition enrichment is
  // deliberately OUTSIDE this catch, so a USDA hiccup can never collapse
  // an otherwise-correct CLIP prediction to null.
  let ranked: { label: string; score: number }[];
  try {
    const { visionModel, processor, normalizedTextEmbeds, dot, softmax } = await getSession();
    const { RawImage } = await import('@huggingface/transformers');

    const image = await loadImage(RawImage, frame);
    const imageInputs = await processor(image);
    const { image_embeds } = await visionModel(imageInputs);
    const [normalizedImageEmbed] = image_embeds.normalize().tolist() as number[][];

    const scores = softmax(normalizedTextEmbeds.map((labelEmbed) => 100 * dot(normalizedImageEmbed, labelEmbed)));
    ranked = LABELS.map((label, i) => ({ label, score: scores[i] })).sort((a, b) => b.score - a.score);
  } catch {
    return null;
  }

  const top = ranked[0];
  const localFood = top ? FOOD_LABEL_MAP[top.label] : undefined;
  if (!top || !localFood || !isConfident(ranked.map((r) => r.score))) return null;

  const enriched = shouldSkipLiveEnrichment(top.label)
    ? { food: localFood, liveEnriched: false }
    : await withLiveNutrition(localFood, top.label);
  return { ...enriched, label: top.label, probability: top.score, topK: ranked.slice(0, 3) };
}

/** Stage 1 of hierarchical classification: is this photo of any broad food
 * category at all? Cheaper to trust than the fine layer — 'stew' and
 * 'salad' separate much more cleanly than 'goulash' vs 'curry' do — and it
 * backs the caller's "this is roughly an X" fallback when no fine label
 * clears isConfident. */
export async function classifyCoarseFood(frame: HTMLCanvasElement): Promise<CoarsePrediction | null> {
  try {
    const { visionModel, processor, normalizedCoarseEmbeds, dot, softmax } = await getSession();
    const { RawImage } = await import('@huggingface/transformers');

    const image = await loadImage(RawImage, frame);
    const imageInputs = await processor(image);
    const { image_embeds } = await visionModel(imageInputs);
    const [normalizedImageEmbed] = image_embeds.normalize().tolist() as number[][];

    const scores = softmax(normalizedCoarseEmbeds.map((labelEmbed) => 100 * dot(normalizedImageEmbed, labelEmbed)));
    const ranked = COARSE_LABELS.map((label, i) => ({ label, score: scores[i] })).sort((a, b) => b.score - a.score);

    const top = ranked[0];
    if (!top || !isConfident(ranked.map((r) => r.score))) return null;
    return { category: top.label, probability: top.score };
  } catch {
    return null;
  }
}

/** Labels whose curated local dish has no Czech-script/gloss signal of its
 * own (so the pattern check below wouldn't catch them) but is still a
 * Czech dish with no real USDA coverage — enumerated explicitly rather
 * than guessed at. */
const CZECH_DISH_LABELS_WITHOUT_SCRIPT_SIGNAL = new Set([
  'schnitzel with potato salad',
  'pork goulash',
  'mushroom omelette',
  'buchty',
  'utopenci',
]);

/** Does this label carry a Czech-specific signal? USDA has no Czech
 * coverage and matches loosely (verified live: requireAllWords is false),
 * so a Czech dish's English gloss words alone can pull in a
 * confidently-scored but unrelated match — e.g. "smažený sýr (fried
 * cheese)" returned "Potato, french fries, with cheese" at 260 kcal/100g.
 * Skipping live enrichment for these keeps USDA to what it's actually good
 * at (foods it has real coverage for) and leaves curated local data in
 * charge of the rest.
 *
 * ponytail: this is a heuristic, not a data-model guarantee — it checks
 * only the label (never the curated display name, since several
 * genuinely-international foods like "banana" have Czech display names
 * too, and must keep enriching live). If foodLabels.ts ever adds a new
 * Czech dish with a plain-English label and no diacritics anywhere, it
 * needs adding to the explicit set above. A proper fix would tag
 * Czech-sourced entries in the data model directly. */
export function shouldSkipLiveEnrichment(label: string): boolean {
  if (CZECH_DISH_LABELS_WITHOUT_SCRIPT_SIGNAL.has(label)) return true;
  return hasNonAscii(label) || label.includes('(');
}

function hasNonAscii(text: string): boolean {
  return [...text].some((ch) => (ch.codePointAt(0) ?? 0) > 0x7f);
}

/** Keeps the local entry's curated name and Czech/specific curated
 * portions, but prefers live, sourced macros when USDA has a *relevant*
 * generic-food match (see isRelevantToQuery — unmatched hits like
 * "Potato, french fries, with cheese" for "smažený sýr" get rejected).
 * Never throws and never loses the local food — searchNutrition already
 * resolves to [] on any failure, and this catch is belt-and-braces so a
 * live-lookup error falls back to the curated local macros while keeping
 * the CLIP prediction intact. */
async function withLiveNutrition(local: DatabaseFood, label: string): Promise<{ food: DatabaseFood; liveEnriched: boolean }> {
  try {
    const hits = await searchNutrition(label, { limit: 5, dataTypes: GENERIC_FOOD_DATA_TYPES });
    const relevant = hits.find((h) => isRelevantToQuery(h.name, label));
    if (!relevant) return { food: local, liveEnriched: false };
    return {
      food: {
        ...local,
        kcal: relevant.kcal,
        protein: relevant.protein,
        carbs: relevant.carbs,
        fat: relevant.fat,
        fiber: relevant.fiber,
        sugar: relevant.sugar,
        sodium: relevant.sodium,
        // generic local entries (typicalGrams 100) adopt the USDA
        // portion; curated Czech/specific portions always win
        typicalGrams: local.typicalGrams === 100 ? relevant.typicalGrams : local.typicalGrams,
      },
      liveEnriched: true,
    };
  } catch {
    return { food: local, liveEnriched: false };
  }
}
