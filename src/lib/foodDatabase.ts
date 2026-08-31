import type { Macros } from '../types';

export interface DatabaseFood extends Macros {
  name: string;
  /** typical weight in grams that the macros above describe */
  gramsPerServing: number;
}

/**
 * Generic starter database — "some random food." Used only as a fallback:
 * for the very first capture of a new dish (before it has a photo hash of
 * its own) and as generic search results alongside the user's personal
 * memory. Every value here is a rough, typical-serving estimate.
 */
export const FOOD_DATABASE: DatabaseFood[] = [
  { name: 'Chicken burrito bowl', gramsPerServing: 450, kcal: 620, protein: 44, carbs: 61, fat: 21, fiber: 9, sugar: 6, sodium: 980 },
  { name: 'Ramen, pork', gramsPerServing: 550, kcal: 780, protein: 34, carbs: 88, fat: 30, fiber: 4, sugar: 5, sodium: 2100 },
  { name: 'Greek salad + bread', gramsPerServing: 380, kcal: 410, protein: 14, carbs: 38, fat: 23, fiber: 6, sugar: 7, sodium: 760 },
  { name: 'Oat bowl, banana', gramsPerServing: 350, kcal: 430, protein: 16, carbs: 68, fat: 11, fiber: 8, sugar: 22, sodium: 120 },
  { name: 'Flat white + almond croissant', gramsPerServing: 180, kcal: 480, protein: 9, carbs: 47, fat: 28, fiber: 2, sugar: 18, sodium: 340 },
  { name: 'Grilled salmon + greens', gramsPerServing: 320, kcal: 520, protein: 41, carbs: 12, fat: 34, fiber: 5, sugar: 3, sodium: 480 },
  { name: 'Margherita pizza slice', gramsPerServing: 120, kcal: 285, protein: 12, carbs: 36, fat: 10, fiber: 2, sugar: 4, sodium: 640 },
  { name: 'Turkey club sandwich', gramsPerServing: 280, kcal: 540, protein: 32, carbs: 42, fat: 26, fiber: 3, sugar: 6, sodium: 1180 },
  { name: 'Beef stir-fry with rice', gramsPerServing: 480, kcal: 660, protein: 38, carbs: 72, fat: 22, fiber: 4, sugar: 9, sodium: 1340 },
  { name: 'Falafel wrap', gramsPerServing: 320, kcal: 550, protein: 17, carbs: 66, fat: 24, fiber: 9, sugar: 5, sodium: 890 },
  { name: 'Protein shake', gramsPerServing: 400, kcal: 210, protein: 30, carbs: 12, fat: 4, fiber: 2, sugar: 8, sodium: 210 },
  { name: 'Scrambled eggs + toast', gramsPerServing: 220, kcal: 390, protein: 22, carbs: 28, fat: 20, fiber: 3, sugar: 3, sodium: 560 },
  { name: 'Caesar salad with chicken', gramsPerServing: 350, kcal: 470, protein: 36, carbs: 14, fat: 30, fiber: 3, sugar: 3, sodium: 980 },
  { name: 'Pad thai', gramsPerServing: 420, kcal: 690, protein: 24, carbs: 84, fat: 24, fiber: 3, sugar: 14, sodium: 1420 },
  { name: 'Banana', gramsPerServing: 120, kcal: 105, protein: 1, carbs: 27, fat: 0, fiber: 3, sugar: 14, sodium: 1 },
  { name: 'Greek yogurt + berries', gramsPerServing: 250, kcal: 220, protein: 18, carbs: 26, fat: 5, fiber: 4, sugar: 18, sodium: 65 },
  { name: 'Cheeseburger', gramsPerServing: 250, kcal: 560, protein: 29, carbs: 40, fat: 31, fiber: 2, sugar: 7, sodium: 1040 },
  { name: 'Veggie stir-fry with tofu', gramsPerServing: 400, kcal: 380, protein: 20, carbs: 40, fat: 16, fiber: 8, sugar: 8, sodium: 820 },
  { name: 'Steak + sweet potato', gramsPerServing: 400, kcal: 610, protein: 46, carbs: 38, fat: 28, fiber: 5, sugar: 9, sodium: 520 },
  { name: 'Peanut butter toast', gramsPerServing: 110, kcal: 340, protein: 12, carbs: 32, fat: 18, fiber: 4, sugar: 8, sodium: 300 },
];

export function randomDatabaseFood(): DatabaseFood {
  return FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
}

export function searchDatabase(query: string): DatabaseFood[] {
  const q = query.trim().toLowerCase();
  if (!q) return FOOD_DATABASE;
  return FOOD_DATABASE.filter((f) => f.name.toLowerCase().includes(q));
}
