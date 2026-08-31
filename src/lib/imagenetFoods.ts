import type { DatabaseFood } from './foodDatabase';

/**
 * MobileNet (trained on the standard 1000-class ImageNet set) returns class
 * labels like "hotdog, hot dog, red hot" — we key this map on the first,
 * primary synonym, lowercased, so lookups just need `className.split(',')[0]`.
 * Only ImageNet's ~40 food-related classes are listed here; everything else
 * the model might say ("dining table", "wok", "menu"...) has no nutrition
 * entry and is treated as "not food" by the classifier.
 */
export const IMAGENET_FOOD_MAP: Record<string, DatabaseFood> = {
  guacamole: { name: 'Guacamole', gramsPerServing: 60, kcal: 100, protein: 1, carbs: 6, fat: 9, fiber: 4, sugar: 1, sodium: 200 },
  consomme: { name: 'Consommé', gramsPerServing: 300, kcal: 60, protein: 6, carbs: 4, fat: 2, fiber: 0, sugar: 1, sodium: 900 },
  'hot pot': { name: 'Hot pot', gramsPerServing: 500, kcal: 620, protein: 38, carbs: 40, fat: 32, fiber: 5, sugar: 6, sodium: 1600 },
  trifle: { name: 'Trifle', gramsPerServing: 200, kcal: 400, protein: 5, carbs: 55, fat: 17, fiber: 1, sugar: 40, sodium: 150 },
  'ice cream': { name: 'Ice cream', gramsPerServing: 100, kcal: 210, protein: 4, carbs: 24, fat: 11, fiber: 0, sugar: 21, sodium: 80 },
  'ice lolly': { name: 'Ice lolly', gramsPerServing: 70, kcal: 60, protein: 0, carbs: 15, fat: 0, fiber: 0, sugar: 13, sodium: 5 },
  'french loaf': { name: 'French bread', gramsPerServing: 60, kcal: 160, protein: 6, carbs: 31, fat: 1, fiber: 2, sugar: 2, sodium: 320 },
  bagel: { name: 'Bagel', gramsPerServing: 100, kcal: 270, protein: 10, carbs: 53, fat: 2, fiber: 2, sugar: 6, sodium: 490 },
  pretzel: { name: 'Pretzel', gramsPerServing: 60, kcal: 210, protein: 5, carbs: 44, fat: 2, fiber: 2, sugar: 2, sodium: 490 },
  cheeseburger: { name: 'Cheeseburger', gramsPerServing: 250, kcal: 560, protein: 29, carbs: 40, fat: 31, fiber: 2, sugar: 7, sodium: 1040 },
  hotdog: { name: 'Hot dog', gramsPerServing: 150, kcal: 340, protein: 12, carbs: 26, fat: 21, fiber: 1, sugar: 5, sodium: 970 },
  'mashed potato': { name: 'Mashed potato', gramsPerServing: 200, kcal: 220, protein: 4, carbs: 35, fat: 8, fiber: 3, sugar: 3, sodium: 470 },
  'head cabbage': { name: 'Cabbage', gramsPerServing: 150, kcal: 35, protein: 2, carbs: 8, fat: 0, fiber: 3, sugar: 4, sodium: 25 },
  broccoli: { name: 'Broccoli', gramsPerServing: 150, kcal: 51, protein: 4, carbs: 10, fat: 0, fiber: 4, sugar: 2, sodium: 50 },
  cauliflower: { name: 'Cauliflower', gramsPerServing: 150, kcal: 38, protein: 3, carbs: 8, fat: 0, fiber: 3, sugar: 3, sodium: 45 },
  zucchini: { name: 'Zucchini', gramsPerServing: 150, kcal: 26, protein: 2, carbs: 5, fat: 0, fiber: 2, sugar: 4, sodium: 15 },
  'spaghetti squash': { name: 'Spaghetti squash', gramsPerServing: 200, kcal: 62, protein: 1, carbs: 14, fat: 1, fiber: 3, sugar: 6, sodium: 35 },
  'acorn squash': { name: 'Acorn squash', gramsPerServing: 200, kcal: 115, protein: 2, carbs: 30, fat: 0, fiber: 4, sugar: 0, sodium: 8 },
  'butternut squash': { name: 'Butternut squash', gramsPerServing: 200, kcal: 82, protein: 2, carbs: 22, fat: 0, fiber: 4, sugar: 4, sodium: 8 },
  cucumber: { name: 'Cucumber', gramsPerServing: 150, kcal: 24, protein: 1, carbs: 6, fat: 0, fiber: 1, sugar: 3, sodium: 3 },
  artichoke: { name: 'Artichoke', gramsPerServing: 120, kcal: 60, protein: 4, carbs: 13, fat: 0, fiber: 7, sugar: 1, sodium: 120 },
  'bell pepper': { name: 'Bell pepper', gramsPerServing: 120, kcal: 31, protein: 1, carbs: 7, fat: 0, fiber: 2, sugar: 4, sodium: 4 },
  mushroom: { name: 'Mushroom', gramsPerServing: 100, kcal: 22, protein: 3, carbs: 3, fat: 0, fiber: 1, sugar: 2, sodium: 5 },
  'granny smith': { name: 'Apple', gramsPerServing: 180, kcal: 95, protein: 0, carbs: 25, fat: 0, fiber: 4, sugar: 19, sodium: 2 },
  strawberry: { name: 'Strawberries', gramsPerServing: 150, kcal: 48, protein: 1, carbs: 11, fat: 0, fiber: 3, sugar: 7, sodium: 2 },
  orange: { name: 'Orange', gramsPerServing: 150, kcal: 70, protein: 1, carbs: 18, fat: 0, fiber: 3, sugar: 14, sodium: 0 },
  lemon: { name: 'Lemon', gramsPerServing: 60, kcal: 17, protein: 1, carbs: 5, fat: 0, fiber: 2, sugar: 1, sodium: 1 },
  fig: { name: 'Figs', gramsPerServing: 100, kcal: 74, protein: 1, carbs: 19, fat: 0, fiber: 3, sugar: 16, sodium: 1 },
  pineapple: { name: 'Pineapple', gramsPerServing: 150, kcal: 75, protein: 1, carbs: 20, fat: 0, fiber: 2, sugar: 15, sodium: 2 },
  banana: { name: 'Banana', gramsPerServing: 120, kcal: 105, protein: 1, carbs: 27, fat: 0, fiber: 3, sugar: 14, sodium: 1 },
  jackfruit: { name: 'Jackfruit', gramsPerServing: 150, kcal: 143, protein: 2, carbs: 35, fat: 0, fiber: 2, sugar: 27, sodium: 2 },
  'custard apple': { name: 'Custard apple', gramsPerServing: 150, kcal: 130, protein: 2, carbs: 32, fat: 1, fiber: 5, sugar: 26, sodium: 10 },
  pomegranate: { name: 'Pomegranate', gramsPerServing: 150, kcal: 105, protein: 2, carbs: 24, fat: 1, fiber: 5, sugar: 17, sodium: 4 },
  carbonara: { name: 'Carbonara', gramsPerServing: 350, kcal: 620, protein: 24, carbs: 66, fat: 28, fiber: 3, sugar: 3, sodium: 850 },
  'chocolate sauce': { name: 'Chocolate sauce', gramsPerServing: 40, kcal: 130, protein: 1, carbs: 24, fat: 4, fiber: 1, sugar: 20, sodium: 30 },
  dough: { name: 'Dough / baked bread', gramsPerServing: 100, kcal: 265, protein: 9, carbs: 49, fat: 3, fiber: 2, sugar: 5, sodium: 480 },
  'meat loaf': { name: 'Meatloaf', gramsPerServing: 200, kcal: 380, protein: 30, carbs: 12, fat: 24, fiber: 1, sugar: 4, sodium: 780 },
  pizza: { name: 'Pizza', gramsPerServing: 120, kcal: 285, protein: 12, carbs: 36, fat: 10, fiber: 2, sugar: 4, sodium: 640 },
  potpie: { name: 'Pot pie', gramsPerServing: 250, kcal: 540, protein: 17, carbs: 42, fat: 34, fiber: 3, sugar: 5, sodium: 950 },
  burrito: { name: 'Burrito', gramsPerServing: 350, kcal: 550, protein: 24, carbs: 68, fat: 20, fiber: 8, sugar: 4, sodium: 1080 },
  'red wine': { name: 'Red wine', gramsPerServing: 150, kcal: 125, protein: 0, carbs: 4, fat: 0, fiber: 0, sugar: 1, sodium: 6 },
  espresso: { name: 'Espresso', gramsPerServing: 30, kcal: 3, protein: 0, carbs: 1, fat: 0, fiber: 0, sugar: 0, sodium: 3 },
  eggnog: { name: 'Eggnog', gramsPerServing: 240, kcal: 220, protein: 7, carbs: 18, fat: 13, fiber: 0, sugar: 17, sodium: 90 },
};

/** True for any ImageNet class this map has no nutrition entry for. */
export function primaryLabel(className: string): string {
  return className.split(',')[0].trim().toLowerCase();
}
