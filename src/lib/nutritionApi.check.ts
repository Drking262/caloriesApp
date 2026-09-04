import { mapFdcFoodToDatabaseFood } from './nutritionApi.ts';

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

console.log('nutritionApi.check.ts: all checks passed');
