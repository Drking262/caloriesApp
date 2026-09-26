import type { DatabaseFood } from '../foodDatabase.ts';
import { CZECH_FOOD_LABELS } from './czech.ts';
import { INTERNATIONAL_FOOD_LABELS } from './international.ts';

/**
 * Coarse layer above the fine FOOD_LABEL_MAP entries — for hierarchical
 * classification: first bucket the photo into one of these broad
 * categories, then pick the fine label inside it, or fall back to
 * `typicalFood` when no fine label matches with confidence.
 *
 * The fine→coarse mapping below is explicit per-category lists of fine
 * labels, not a string heuristic — that makes coverage auditable, and
 * src/lib/foodLabels.check.ts asserts every key of FOOD_LABEL_MAP is
 * covered exactly once, so adding a label to czech.ts or
 * international.ts without adding it to exactly one list here fails the
 * check on the next run.
 *
 * typicalFood values are per-100g rough averages of the category's
 * members — a fallback placeholder only, never curated nutrition.
 */
export interface CoarseCategory {
  /** single-token-ish CLIP-friendly label, e.g. 'soup', 'salad', 'pastry', 'fruit', 'vegetable', 'meat dish', 'pasta', 'dessert', 'drink' */
  label: string;
  /** display name if the coarse guess is all we have */
  name: string;
  /** fallback nutrition (per 100g) when no fine label matched — rough averages of the members */
  typicalFood: DatabaseFood;
}

const CATEGORY_BY_FINE_LABEL = new Map<string, CoarseCategory>();

function category(label: string, name: string, typicalFood: DatabaseFood, fineLabels: string[]): CoarseCategory {
  const coarse: CoarseCategory = { label, name, typicalFood };
  for (const fine of fineLabels) {
    if (!CZECH_FOOD_LABELS[fine] && !INTERNATIONAL_FOOD_LABELS[fine]) {
      throw new Error(`coarse.ts: '${coarse.label}' lists '${fine}', which is not a fine label in czech.ts or international.ts`);
    }
    if (CATEGORY_BY_FINE_LABEL.has(fine)) {
      throw new Error(`coarse.ts: fine label '${fine}' is mapped to more than one coarse category`);
    }
    CATEGORY_BY_FINE_LABEL.set(fine, coarse);
  }
  return coarse;
}

export const COARSE_CATEGORIES: CoarseCategory[] = [
  // plated mains built around meat/fish (incl. sauce toppings like
  // svíčková) — the eggs/breakfast and fried-food variants live in their
  // own categories below
  category(
    'meat dish',
    'Meat dish',
    { name: 'Meat dish', typicalGrams: 280, kcal: 165, protein: 13, carbs: 8, fat: 9, fiber: 1, sugar: 2, sodium: 230 },
    [
      'svíčková na smetaně',
      'kuřecí řízek',
      'schnitzel with potato salad',
      'kuře à la svíčková',
      'vepřo knedlo zelo (roast pork, dumpling, sauerkraut)',
      'tatarák (beef tartare)',
      'steak',
      'grilled salmon',
      'kebab',
    ],
  ),
  // the visually-similar brown stews — one bucket here, with the Czech
  // curated variants staying as fine labels and 'curry' as the single
  // international one (see the note by 'curry' in international.ts)
  category(
    'stew',
    'Stew / goulash / curry',
    { name: 'Stew / goulash / curry', typicalGrams: 300, kcal: 115, protein: 6.5, carbs: 6, fat: 6.8, fiber: 1, sugar: 1.5, sodium: 220 },
    [
      'hovězí guláš',
      'pork goulash',
      'curry',
    ],
  ),
  // deep-fried / battered items + fast food — visually crisp or wrapped
  category(
    'fried food',
    'Fried / fast food',
    { name: 'Fried / fast food', typicalGrams: 200, kcal: 250, protein: 8.5, carbs: 20, fat: 14, fiber: 1.5, sugar: 2, sodium: 520 },
    [
      'cheeseburger',
      'hot dog',
      'french fries',
      'fried chicken',
      'smažený sýr (fried cheese)',
      'bramborák',
      'utopenci',
      'falafel',
    ],
  ),
  category(
    'pizza',
    'Pizza / flatbread',
    { name: 'Pizza / flatbread', typicalGrams: 200, kcal: 197, protein: 8.9, carbs: 20.9, fat: 8.4, fiber: 2.2, sugar: 2.1, sodium: 360 },
    [
      'pizza',
      'tacos',
    ],
  ),
  category(
    'pasta',
    'Pasta / noodles',
    { name: 'Pasta / noodles', typicalGrams: 400, kcal: 160, protein: 7, carbs: 18, fat: 6.4, fiber: 0.9, sugar: 1.9, sodium: 288 },
    [
      'spaghetti bolognese',
      'lasagna',
      'carbonara',
      'pad thai',
      'ramen',
    ],
  ),
  // rice-based plates + the rolled/wrapped rice-flour lookalikes
  category(
    'rice dish',
    'Rice dish / wrap',
    { name: 'Rice dish / wrap', typicalGrams: 325, kcal: 152, protein: 6.8, carbs: 20.4, fat: 4.4, fiber: 1.6, sugar: 1.8, sodium: 270 },
    [
      'risotto',
      'paella',
      'biryani',
      'sushi',
      'burrito',
    ],
  ),
  category(
    'salad',
    'Salad / dip',
    { name: 'Salad / dip', typicalGrams: 250, kcal: 135, protein: 5.5, carbs: 10, fat: 8.7, fiber: 2.7, sugar: 1.5, sodium: 243 },
    [
      'caesar salad',
      'greek salad',
      'bean salad',
      'guacamole',
      'hummus',
    ],
  ),
  category(
    'eggs',
    'Eggs / breakfast bowl',
    { name: 'Eggs / breakfast bowl', typicalGrams: 240, kcal: 155, protein: 9.4, carbs: 9, fat: 9.4, fiber: 1, sugar: 2.3, sodium: 195 },
    [
      'omelette',
      'mushroom omelette',
      'scrambled eggs',
      'toast',
      'oatmeal',
    ],
  ),
  // baked/flaky carbs — plain (croissant, bagel) next to filled (trdelník, buchty)
  category(
    'pastry',
    'Pastry',
    { name: 'Pastry', typicalGrams: 80, kcal: 355, protein: 7, carbs: 50, fat: 13.4, fiber: 1.5, sugar: 14.5, sodium: 264 },
    [
      'croissant',
      'bagel',
      'trdelník',
      'buchty',
    ],
  ),
  category(
    'soup',
    'Soup',
    { name: 'Soup', typicalGrams: 350, kcal: 63, protein: 3.2, carbs: 6.1, fat: 1.8, fiber: 0.5, sugar: 0.8, sodium: 340 },
    [
      'chicken broth',
      'a bowl of soup',
      'pho soup',
    ],
  ),
  // sweet finishes, incl. the sweetened pancake/waffle family
  category(
    'dessert',
    'Dessert',
    { name: 'Dessert', typicalGrams: 120, kcal: 294, protein: 5.5, carbs: 39, fat: 12.6, fiber: 1.4, sugar: 18, sodium: 199 },
    [
      'palačinky',
      'pancakes',
      'waffles',
      'donut',
      'ice cream',
      'chocolate cake',
      'cheesecake',
      'apple pie',
    ],
  ),
  category(
    'fruit',
    'Fruit',
    { name: 'Fruit', typicalGrams: 100, kcal: 56, protein: 0.8, carbs: 12.4, fat: 0.3, fiber: 2.3, sugar: 10, sodium: 1.4 },
    [
      'banana',
      'orange',
      'strawberries',
      'apple',
      'pineapple',
    ],
  ),
  category(
    'vegetable',
    'Vegetable',
    { name: 'Vegetable', typicalGrams: 100, kcal: 30.6, protein: 2.1, carbs: 4, fat: 0.3, fiber: 2, sugar: 1.9, sodium: 12.4 },
    [
      'broccoli',
      'cauliflower',
      'mushrooms',
      'bell pepper',
      'cucumber',
    ],
  ),
  // starchy accompaniments visually close to each other (white sliced
  // dumplings, mashed mounds, filled dumplings)
  category(
    'side dish',
    'Side dish / dumpling',
    { name: 'Side dish / dumpling', typicalGrams: 150, kcal: 183, protein: 6, carbs: 27, fat: 5.2, fiber: 1.7, sugar: 0.8, sodium: 350 },
    [
      'houskový knedlík',
      'dumplings',
      'mashed potatoes',
    ],
  ),
  category(
    'drink',
    'Drink',
    { name: 'Drink', typicalGrams: 250, kcal: 50, protein: 2.5, carbs: 2, fat: 0.4, fiber: 0.2, sugar: 1, sodium: 20 },
    [
      'a cup of coffee',
      'a glass of red wine',
      'a protein shake',
    ],
  ),
];

/** Coarse bucket for a fine FOOD_LABEL_MAP label, or null if the label
 * isn't mapped — foodLabels.check.ts treats null as a sync bug, so it
 * should never reach a caller unnoticed. */
export function coarseForFineLabel(fineLabel: string): CoarseCategory | null {
  return CATEGORY_BY_FINE_LABEL.get(fineLabel) ?? null;
}
