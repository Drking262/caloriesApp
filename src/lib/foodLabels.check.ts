import { FOOD_LABEL_MAP } from './foodLabels.ts';
import { COARSE_CATEGORIES, coarseForFineLabel } from './foodData/coarse.ts';

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(`FAIL ${label}`);
  console.log(`ok - ${label}`);
}

// Every fine label (the camera's whole vocabulary) must map to exactly one
// coarse category — coarse.ts's explicit per-category lists are the only
// mapping, so a label added to czech.ts/international.ts without updating
// coarse.ts surfaces here, not in a silent null at classification time.
for (const fineLabel of Object.keys(FOOD_LABEL_MAP)) {
  assert(coarseForFineLabel(fineLabel) !== null, `fine label maps to a coarse category: '${fineLabel}'`);
}

// A coarse category with no fine labels is dead weight — it can win the
// coarse softmax yet never lead anywhere finer. And its fallback nutrition
// must be a real (per-100g) food, not an empty placeholder.
for (const category of COARSE_CATEGORIES) {
  const count = Object.keys(FOOD_LABEL_MAP).filter((fineLabel) => coarseForFineLabel(fineLabel) === category).length;
  assert(count >= 1, `coarse category '${category.label}' has at least one fine label (${count})`);
  assert(
    typeof category.label === 'string' && category.label.length > 0,
    `coarse category '${category.label}' has a non-empty CLIP label`,
  );
  const food = category.typicalFood;
  assert(
    typeof food.name === 'string' && food.name.length > 0 && Number.isFinite(food.kcal) && food.kcal > 0 &&
      Number.isFinite(food.typicalGrams) && food.typicalGrams > 0 &&
      Number.isFinite(food.protein) && Number.isFinite(food.carbs) && Number.isFinite(food.fat) &&
      Number.isFinite(food.fiber) && Number.isFinite(food.sugar) && Number.isFinite(food.sodium),
    `coarse category '${category.label}' has a valid typicalFood (kcal > 0, all macros finite)`,
  );
}

// Duplicate keys between czech.ts and international.ts can't survive the
// object spread in foodLabels.ts, but duplicates *inside the coarse lists*
// would leave the fine→coarse mapping ambiguous — coarse.ts also guards
// this at module init; assert it here via round-trip uniqueness.
const coarseLabels = COARSE_CATEGORIES.map((c) => c.label);
assert(new Set(coarseLabels).size === coarseLabels.length, 'coarse category labels are unique');

console.log(`foodLabels.check.ts: all checks passed (${Object.keys(FOOD_LABEL_MAP).length} fine labels, ${COARSE_CATEGORIES.length} coarse categories)`);
