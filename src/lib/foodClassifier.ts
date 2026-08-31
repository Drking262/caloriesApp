import type { DatabaseFood } from './foodDatabase';
import { IMAGENET_FOOD_MAP, primaryLabel } from './imagenetFoods';

/**
 * Real, on-device food recognition — not a random guess. MobileNet V1
 * (alpha 0.25, the smallest variant: ~1.9M params, a few MB of weights) runs
 * entirely in the browser via TensorFlow.js. It's a general 1000-class
 * ImageNet classifier, not a food-specific model, but ~40 of those classes
 * are dishes/produce (pizza, cheeseburger, guacamole, broccoli, banana...) —
 * see imagenetFoods.ts. We take its top-K predictions and use the
 * highest-ranked one that lands on a food class we have nutrition data for.
 *
 * Model weights are fetched from Google's CDN on first use and then cached
 * (see the PWA workbox runtime-caching rule in vite.config.ts), so it works
 * offline after that.
 *
 * MIN_PROBABILITY is calibrated against real photos, not guessed: run
 * against an actual cheeseburger photo, the model was 98% confident and
 * correct. But at a low threshold (originally 5%) it also confidently
 * mislabeled a broccoli macro shot as "guacamole" (18% vs. broccoli's own
 * 17% — a coin flip) and a bean salad as "carbonara" (13%, an unrelated
 * class that just happened to clear the bar). A wrong specific label with
 * wrong macros is worse for a nutrition app than an honest "not sure" that
 * falls through to a correctable placeholder, so the bar is set high enough
 * to reject those two cases while still keeping the confident, correct one.
 */

export interface FoodPrediction {
  food: DatabaseFood;
  label: string;
  probability: number;
}

const TOP_K = 10;
const MIN_PROBABILITY = 0.2;

type MobileNetModel = import('@tensorflow-models/mobilenet').MobileNet;

let modelPromise: Promise<MobileNetModel> | null = null;

function getModel(): Promise<MobileNetModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const [tf, mobilenet] = await Promise.all([import('@tensorflow/tfjs'), import('@tensorflow-models/mobilenet')]);
      await tf.ready();
      return mobilenet.load({ version: 1, alpha: 0.25 });
    })();
  }
  return modelPromise;
}

/** Call early (e.g. when the camera screen mounts) so the model is likely
 * warm by the time the user actually taps the shutter. Safe to ignore the
 * result; errors are swallowed since classification always has a fallback. */
export function warmUpClassifier(): void {
  getModel().catch(() => {});
}

export async function classifyFood(source: CanvasImageSource & (HTMLCanvasElement | HTMLVideoElement | HTMLImageElement)): Promise<FoodPrediction | null> {
  try {
    const model = await getModel();
    const predictions = await model.classify(source, TOP_K);
    for (const p of predictions) {
      const label = primaryLabel(p.className);
      const food = IMAGENET_FOOD_MAP[label];
      if (food && p.probability >= MIN_PROBABILITY) {
        return { food, label, probability: p.probability };
      }
    }
    return null;
  } catch {
    // model failed to load, or WebGL/CPU backend unavailable — caller falls
    // back to the plain random-database guess, app stays usable either way
    return null;
  }
}
