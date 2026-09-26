import type { DatabaseFood } from '../foodDatabase.ts';

/**
 * Czech dishes split out of foodLabels.ts (see that file for the overall
 * design note). Labels stay English-glossed/non-ASCII just as before —
 * foodClassifier's Czech-dish guard (shouldSkipLiveEnrichment) keys on
 * exactly these label strings, so renaming a label without updating
 * CZECH_DISH_LABELS_WITHOUT_SCRIPT_SIGNAL there silently re-enables USDA
 * enrichment for a dish USDA has no coverage for.
 *
 * SOURCED entries are real values read from individual pages on
 * kaloricketabulky.cz (their sitemap-listed /potraviny/ and /recepty/
 * pages, never their disallowed search endpoint) — see git history for
 * the extraction. Entries marked estimated are reasonable typical-serving
 * estimates instead.
 */
export const CZECH_FOOD_LABELS: Record<string, DatabaseFood> = {
  // ---- Czech dishes — SOURCED (kaloricketabulky.cz) ----
  'svíčková na smetaně': { name: 'Svíčková na smetaně s knedlíkem', typicalGrams: 100, kcal: 214, protein: 7.7, carbs: 27, fat: 8.2, fiber: 1.5, sugar: 5.6, sodium: 350 },
  'kuřecí řízek': { name: 'Kuřecí řízek', typicalGrams: 100, kcal: 175, protein: 23, carbs: 0, fat: 12, fiber: 0, sugar: 0, sodium: 350 },
  'hovězí guláš': { name: 'Hovězí guláš', typicalGrams: 100, kcal: 103, protein: 6, carbs: 4.6, fat: 6.5, fiber: 1, sugar: 0.2, sodium: 200 },
  'houskový knedlík': { name: 'Houskový knedlík', typicalGrams: 100, kcal: 245, protein: 7.8, carbs: 44, fat: 3.6, fiber: 2, sugar: 0.6, sodium: 400 },
  bramborák: { name: 'Bramborák', typicalGrams: 100, kcal: 155, protein: 4, carbs: 18, fat: 7, fiber: 2, sugar: 2, sodium: 400 },
  palačinky: { name: 'Palačinky', typicalGrams: 100, kcal: 285, protein: 7.8, carbs: 36.1, fat: 8.3, fiber: 1.6, sugar: 8.6, sodium: 150 },
  'kuře à la svíčková': { name: 'Kuře à la svíčková', typicalGrams: 320, kcal: 115, protein: 10, carbs: 5, fat: 5.9, fiber: 2.2, sugar: 3.1, sodium: 203.1 },
  'schnitzel with potato salad': { name: 'Řízek s bramborem', typicalGrams: 450, kcal: 145.3, protein: 10.9, carbs: 13.8, fat: 5.1, fiber: 0.8, sugar: 0.3, sodium: 68.9 },
  'pork goulash': { name: 'Vepřový guláš', typicalGrams: 250, kcal: 52.8, protein: 3.8, carbs: 1.4, fat: 3.6, fiber: 0.2, sugar: 0.5, sodium: 136 },
  'mushroom omelette': { name: 'Vaječná omeleta se žampiony', typicalGrams: 200, kcal: 151.5, protein: 8, carbs: 2.8, fat: 11.8, fiber: 1.6, sugar: 0.3, sodium: 98 },

  // ---- Czech dishes — estimated (not in the site's catalogue) ----
  'vepřo knedlo zelo (roast pork, dumpling, sauerkraut)': { name: 'Vepřo knedlo zelo', typicalGrams: 400, kcal: 155, protein: 8, carbs: 13.8, fat: 7.5, fiber: 1.5, sugar: 1.5, sodium: 225 },
  'smažený sýr (fried cheese)': { name: 'Smažený sýr', typicalGrams: 250, kcal: 260, protein: 9.6, carbs: 16, fat: 16.8, fiber: 0.8, sugar: 1.2, sodium: 360 },
  'trdelník': { name: 'Trdelník', typicalGrams: 100, kcal: 350, protein: 6, carbs: 55, fat: 11, fiber: 1, sugar: 25, sodium: 150 },
  'tatarák (beef tartare)': { name: 'Tatarák', typicalGrams: 150, kcal: 186.7, protein: 17.3, carbs: 13.3, fat: 6.7, fiber: 0.7, sugar: 1.3, sodium: 466.7 },
  buchty: { name: 'Buchty', typicalGrams: 90, kcal: 300, protein: 6.7, carbs: 46.7, fat: 10, fiber: 2.2, sugar: 17.8, sodium: 133.3 },
  utopenci: { name: 'Utopenci', typicalGrams: 100, kcal: 220, protein: 10, carbs: 4, fat: 18, fiber: 1, sugar: 2, sodium: 850 },
};
