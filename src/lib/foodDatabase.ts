import type { Macros } from '../types';
import { FOOD_LABEL_MAP } from './foodLabels';

export interface DatabaseFood extends Macros {
  name: string;
  /** typical weight in grams that the macros above describe */
  gramsPerServing: number;
}

/**
 * Generic starter meals — multi-ingredient "what I actually ate" combos not
 * covered by a single labeled entry in foodLabels.ts. Rough estimates.
 */
const GENERIC_FOODS: DatabaseFood[] = [
  { name: 'Chicken burrito bowl', gramsPerServing: 450, kcal: 620, protein: 44, carbs: 61, fat: 21, fiber: 9, sugar: 6, sodium: 980 },
  { name: 'Turkey club sandwich', gramsPerServing: 280, kcal: 540, protein: 32, carbs: 42, fat: 26, fiber: 3, sugar: 6, sodium: 1180 },
  { name: 'Beef stir-fry with rice', gramsPerServing: 480, kcal: 660, protein: 38, carbs: 72, fat: 22, fiber: 4, sugar: 9, sodium: 1340 },
  { name: 'Greek yogurt + berries', gramsPerServing: 250, kcal: 220, protein: 18, carbs: 26, fat: 5, fiber: 4, sugar: 18, sodium: 65 },
  { name: 'Veggie stir-fry with tofu', gramsPerServing: 400, kcal: 380, protein: 20, carbs: 40, fat: 16, fiber: 8, sugar: 8, sodium: 820 },
];

/** foodLabels.ts entries (the camera's recognizable vocabulary) also serve
 * as search results and the random fallback guess — same data, one source
 * of truth, so a search hit always matches what a photo would have found. */
const MAPPED_FOODS: DatabaseFood[] = Object.values(FOOD_LABEL_MAP);

export const FOOD_DATABASE: DatabaseFood[] = (() => {
  const seen = new Set<string>();
  const all: DatabaseFood[] = [];
  for (const food of [...MAPPED_FOODS, ...GENERIC_FOODS]) {
    const key = food.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    all.push(food);
  }
  return all;
})();

export function randomDatabaseFood(): DatabaseFood {
  return FOOD_DATABASE[Math.floor(Math.random() * FOOD_DATABASE.length)];
}

export function searchDatabase(query: string): DatabaseFood[] {
  const q = query.trim().toLowerCase();
  if (!q) return FOOD_DATABASE;
  return FOOD_DATABASE.filter((f) => f.name.toLowerCase().includes(q));
}
