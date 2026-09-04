import type { DatabaseFood } from './foodDatabase';
import { FOOD_LABEL_MAP } from './foodLabels.ts';
import { searchNutrition, GENERIC_FOOD_DATA_TYPES } from './nutritionApi.ts';

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
 * threshold is still real defense against genuinely ambiguous photos.
 *
 * Model weights are fetched from the Hugging Face Hub CDN on first use and
 * then cached (see the PWA workbox runtime-caching rule in vite.config.ts),
 * so it works offline after that.
 */

export interface FoodPrediction {
  food: DatabaseFood;
  label: string;
  probability: number;
}

const MODEL_ID = 'Xenova/mobileclip_s0';
const HYPOTHESIS_TEMPLATE = (label: string) => `a photo of ${label}, a type of food`;
const MIN_PROBABILITY = 0.3;

const LABELS = Object.keys(FOOD_LABEL_MAP);

interface Session {
  tokenizer: import('@huggingface/transformers').PreTrainedTokenizer;
  visionModel: import('@huggingface/transformers').PreTrainedModel;
  processor: import('@huggingface/transformers').Processor;
  normalizedTextEmbeds: number[][];
  dot: (a: number[], b: number[]) => number;
  softmax: (arr: number[]) => number[];
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

      // Label embeddings never change — compute them once, not per capture.
      const textInputs = tokenizer(LABELS.map(HYPOTHESIS_TEMPLATE), { padding: 'max_length', truncation: true });
      const { text_embeds } = await textModel(textInputs);
      const normalizedTextEmbeds = text_embeds.normalize().tolist() as number[][];

      return { tokenizer, visionModel, processor, normalizedTextEmbeds, dot, softmax };
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

export async function classifyFood(frame: HTMLCanvasElement): Promise<FoodPrediction | null> {
  try {
    const { visionModel, processor, normalizedTextEmbeds, dot, softmax } = await getSession();
    const { RawImage } = await import('@huggingface/transformers');

    const image = RawImage.fromCanvas(frame);
    const imageInputs = await processor(image);
    const { image_embeds } = await visionModel(imageInputs);
    const [normalizedImageEmbed] = image_embeds.normalize().tolist() as number[][];

    const scores = softmax(normalizedTextEmbeds.map((labelEmbed) => 100 * dot(normalizedImageEmbed, labelEmbed)));
    const ranked = LABELS.map((label, i) => ({ label, score: scores[i] })).sort((a, b) => b.score - a.score);

    const top = ranked[0];
    if (top && top.score >= MIN_PROBABILITY) {
      const localFood = FOOD_LABEL_MAP[top.label];
      if (localFood) {
        const food = shouldSkipLiveEnrichment(top.label) ? localFood : await withLiveNutrition(localFood, top.label);
        return { food, label: top.label, probability: top.score };
      }
    }
    return null;
  } catch {
    // model failed to load, or the backend is unavailable — caller falls
    // back to the plain random-database guess, app stays usable either way
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
  return /[^\x00-\x7F]/.test(label) || label.includes('(');
}

/** Keeps the local entry's curated name/typicalGrams (especially important
 * for Czech dishes, which USDA has no coverage for) but prefers live,
 * sourced macros when USDA has a confident generic-food match. Never
 * throws — searchNutrition already resolves to [] on any failure. */
async function withLiveNutrition(local: DatabaseFood, label: string): Promise<DatabaseFood> {
  const [live] = await searchNutrition(label, { limit: 1, dataTypes: GENERIC_FOOD_DATA_TYPES });
  if (!live) return local;
  return {
    ...local,
    kcal: live.kcal,
    protein: live.protein,
    carbs: live.carbs,
    fat: live.fat,
    fiber: live.fiber,
    sugar: live.sugar,
    sodium: live.sodium,
  };
}
