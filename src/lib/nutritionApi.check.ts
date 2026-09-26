import { mapFdcFoodToDatabaseFood, isRelevantToQuery } from './nutritionApi.ts';

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`FAIL ${label}\n  actual:   ${a}\n  expected: ${e}`);
  console.log(`ok - ${label}`);
}

// Real shape/values captured live from USDA FoodData Central
// (query=banana, dataType=Foundation,SR Legacy,Survey (FNDDS)) — see the
// design spec for the raw request. Confirms full-field mapping and that
// sodium passes through unconverted (USDA already reports it in mg).
assertEqual(
  mapFdcFoodToDatabaseFood({
    description: 'Banana, raw',
    foodNutrients: [
      { nutrientNumber: '208', value: 97 },
      { nutrientNumber: '203', value: 0.74 },
      { nutrientNumber: '205', value: 22.71 },
      { nutrientNumber: '204', value: 0.28 },
      { nutrientNumber: '291', value: 1.7 },
      { nutrientNumber: '269', value: 15.8 },
      { nutrientNumber: '307', value: 0 },
    ],
  }),
  { name: 'Banana, raw', typicalGrams: 100, kcal: 97, protein: 0.74, carbs: 22.71, fat: 0.28, fiber: 1.7, sugar: 15.8, sodium: 0 },
  'full nutrient set maps correctly',
);

// USDA entries frequently omit some macros (e.g. many Branded items lack
// fiber/sugar) — missing macros must default to 0, not crash or produce NaN.
assertEqual(
  mapFdcFoodToDatabaseFood({
    description: 'Test Food, missing fiber and sugar',
    foodNutrients: [
      { nutrientNumber: '208', value: 200 },
      { nutrientNumber: '203', value: 5 },
      { nutrientNumber: '205', value: 20 },
      { nutrientNumber: '204', value: 8 },
      { nutrientNumber: '307', value: 100 },
    ],
  }),
  { name: 'Test Food, missing fiber and sugar', typicalGrams: 100, kcal: 200, protein: 5, carbs: 20, fat: 8, fiber: 0, sugar: 0, sodium: 100 },
  'missing macros default to 0',
);

// No energy-kcal entry at all (seen on incomplete records) — unusable
// without a calorie count, must be filtered out (null), not given a
// fabricated 0 kcal.
assertEqual(
  mapFdcFoodToDatabaseFood({
    description: 'Test Food, no kcal',
    foodNutrients: [{ nutrientNumber: '203', value: 5 }],
  }),
  null,
  'missing kcal is filtered out entirely',
);

// A record with no description isn't a usable search result either.
assertEqual(
  mapFdcFoodToDatabaseFood({
    description: '',
    foodNutrients: [{ nutrientNumber: '208', value: 100 }],
  }),
  null,
  'missing description is filtered out entirely',
);

// Branded results get the brand folded into the display name so a row
// like "MANGO" doesn't read as a plain fruit when it's actually one
// company's dried-snack product (verified live: a branded dried mango at
// 325 kcal/100g topped an unrestricted "mango" search).
assertEqual(
  mapFdcFoodToDatabaseFood({
    description: 'MANGO',
    brandOwner: 'Sol Simple',
    foodNutrients: [{ nutrientNumber: '208', value: 325 }],
  }),
  { name: 'MANGO (Sol Simple)', typicalGrams: 100, kcal: 325, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 },
  'branded result folds brandOwner into the display name',
);

// --- isRelevantToQuery: gate between a USDA hit's name and the query.
// Every significant (non-stop-word) query word must appear among the
// description words after normalization, or the whole normalized query
// must appear as a substring of the normalized description.

// The canonical case: hyphens/commas/case stripped, "raw" is a stop word.
assertEqual(isRelevantToQuery('Banana, raw', 'banana'), true, "'Banana, raw' is relevant to 'banana'");

// The regression this gate exists for: "cheese" appears, but "fried"
// doesn't, and the Czech words don't either — not relevant.
assertEqual(
  isRelevantToQuery('Potato, french fries, with cheese', 'smažený sýr (fried cheese)'),
  false,
  "unrelated fries-with-cheese hit is NOT relevant to 'smažený sýr (fried cheese)'",
);

// Brand fold-in ("MANGO (Sol Simple)") never breaks relevance: 'sol' and
// 'simple' are extra description words, the query word still appears.
assertEqual(isRelevantToQuery('MANGO (Sol Simple)', 'mango'), true, 'brand-folded name still matches plain query');

// Multi-word query: every significant word must be present.
assertEqual(isRelevantToQuery('Chicken curry with rice', 'curry chicken'), true, 'multi-word query matches superset description');
assertEqual(isRelevantToQuery('Chicken curry with rice', 'curry'), true, 'single query word contained in description');
assertEqual(isRelevantToQuery('Chicken curry with rice', 'chicken rice soup'), false, 'missing query word rejects the hit');

// Substring matching is deliberately NOT done per word: 'apple' must not
// match 'pineapple'.
assertEqual(isRelevantToQuery('Pineapple, raw', 'apple'), false, "substring hit ('pineapple' ~ 'apple') is rejected");

// ...but the WHOLE normalized query string as a substring of the
// normalized description is allowed (USDA's multi-word phrasing safety
// net — punctuation-stripped order, helper words intact).
assertEqual(isRelevantToQuery('Rice with chicken curry', 'chicken curry'), true, 'normalized-phrase substring matches USDA multi-word phrasing');
// If the words are there but in NO matching order, the word-set rule
// still carries it.
assertEqual(isRelevantToQuery('Curry, chicken, with rice', 'chicken curry'), true, 'word-set rule handles reordered multi-word phrasing');
// Singular/plural near-duplicates fold via naive singularization.
assertEqual(isRelevantToQuery('Mashed potatoes, home-prepared', 'mashed potato'), true, 'word-set rule folds singular/plural near-duplicates');

// Prompt-template words leaking in from a query must not change the verdict.
assertEqual(isRelevantToQuery('Banana, raw', 'a photo of banana, a type of food'), true, 'stop words (a/of/type/food/photo) are ignored');

// A query with no significant words at all can never be relevant.
assertEqual(isRelevantToQuery('Banana, raw', 'a photo of food'), false, 'query reduced to only stop words is not relevant');

console.log('nutritionApi.check.ts: all checks passed');
