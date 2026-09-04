import type { Macros } from '../types';
import { FOOD_LABEL_MAP } from './foodLabels';

export interface DatabaseFood extends Macros {
  name: string;
  /** default grams to seed a new log with — just a starting guess, not part
   * of the nutrition math (Macros above is always per 100g) */
  typicalGrams: number;
}

/**
 * Generic starter meals — multi-ingredient "what I actually ate" combos not
 * covered by a single labeled entry in foodLabels.ts. Rough estimates.
 */
const GENERIC_FOODS: DatabaseFood[] = [
  { name: 'Chicken burrito bowl', typicalGrams: 450, kcal: 137.8, protein: 9.8, carbs: 13.6, fat: 4.7, fiber: 2, sugar: 1.3, sodium: 217.8 },
  { name: 'Turkey club sandwich', typicalGrams: 280, kcal: 192.9, protein: 11.4, carbs: 15, fat: 9.3, fiber: 1.1, sugar: 2.1, sodium: 421.4 },
  { name: 'Beef stir-fry with rice', typicalGrams: 480, kcal: 137.5, protein: 7.9, carbs: 15, fat: 4.6, fiber: 0.8, sugar: 1.9, sodium: 279.2 },
  { name: 'Greek yogurt + berries', typicalGrams: 250, kcal: 88, protein: 7.2, carbs: 10.4, fat: 2, fiber: 1.6, sugar: 7.2, sodium: 26 },
  { name: 'Veggie stir-fry with tofu', typicalGrams: 400, kcal: 95, protein: 5, carbs: 10, fat: 4, fiber: 2, sugar: 2, sodium: 205 },
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
