import type { DatabaseFood } from './foodDatabase';

/**
 * Live, free, keyless-by-default nutrition lookup against USDA FoodData
 * Central. Recognized/searched foods can carry real sourced macros instead
 * of only the hand-curated local list in foodLabels.ts — see
 * docs/superpowers/specs/2026-09-04-global-nutrition-lookup-design.md.
 *
 * Verified directly (not just from docs) that this endpoint sends
 * `Access-Control-Allow-Origin: *`, so it's safe to call straight from the
 * browser with no backend. Open Food Facts was tried first and ruled out:
 * its real full-text search (search.openfoodfacts.org) omits that header,
 * and its CORS-open endpoint (world.openfoodfacts.org/api/v2/search)
 * silently ignores the search_terms param entirely.
 */

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const TIMEOUT_MS = 6000;

/** Reference/survey data only — excludes 'Branded', whose generically-named
 * entries (a "BANANA" branded product turned out, live, to be some
 * fortified snack at 312 kcal/100g, not a plain banana) are unreliable for
 * a label like "banana" or "pizza" coming out of the CLIP classifier. The
 * free-text search in SearchSheet does NOT use this filter — there, the
 * user typed the exact food themselves, so a branded product can be
 * exactly what they mean. */
export const GENERIC_FOOD_DATA_TYPES = ['Foundation', 'SR Legacy', 'Survey (FNDDS)'];

/** USDA's stable, long-standing nutrient numbers for the macros this app
 * tracks. Sodium is already reported in mg, matching this app's Macros
 * convention — no unit conversion needed (verified against live responses). */
const NUTRIENT_NUMBERS = {
  kcal: '208',
  protein: '203',
  carbs: '205',
  fat: '204',
  fiber: '291',
  sugar: '269',
  sodium: '307',
} as const;

interface FdcNutrient {
  nutrientNumber?: string;
  value?: number | string;
}

interface FdcFood {
  description?: string;
  foodNutrients?: FdcNutrient[];
}

interface FdcSearchResponse {
  foods?: FdcFood[];
}

function nutrientValue(nutrients: FdcNutrient[], number: string): number {
  const match = nutrients.find((n) => n.nutrientNumber === number);
  const value = Number(match?.value);
  return Number.isFinite(value) ? value : 0;
}

/** Pure and network-free on purpose — see nutritionApi.check.ts, the one
 * runnable check for this module's only genuinely error-prone logic. */
export function mapFdcFoodToDatabaseFood(food: FdcFood): DatabaseFood | null {
  const nutrients = food.foodNutrients ?? [];
  const kcal = nutrients.find((n) => n.nutrientNumber === NUTRIENT_NUMBERS.kcal);
  if (!kcal || !Number.isFinite(Number(kcal.value))) return null;

  const name = (food.description ?? '').trim();
  if (!name) return null;

  return {
    name,
    typicalGrams: 100,
    kcal: Number(kcal.value),
    protein: nutrientValue(nutrients, NUTRIENT_NUMBERS.protein),
    carbs: nutrientValue(nutrients, NUTRIENT_NUMBERS.carbs),
    fat: nutrientValue(nutrients, NUTRIENT_NUMBERS.fat),
    fiber: nutrientValue(nutrients, NUTRIENT_NUMBERS.fiber),
    sugar: nutrientValue(nutrients, NUTRIENT_NUMBERS.sugar),
    sodium: nutrientValue(nutrients, NUTRIENT_NUMBERS.sodium),
  };
}

function dedupeByName(foods: DatabaseFood[]): DatabaseFood[] {
  const seen = new Set<string>();
  const out: DatabaseFood[] = [];
  for (const food of foods) {
    const key = food.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(food);
  }
  return out;
}

const cache = new Map<string, DatabaseFood[]>();

export interface NutritionSearchOptions {
  /** max results to return, default 8 */
  limit?: number;
  /** restrict to these USDA dataTypes; omit for unrestricted */
  dataTypes?: string[];
  /** lets a caller (e.g. a debounced search box) cancel a stale request */
  signal?: AbortSignal;
}

/** Never throws — any failure (offline, timeout, rate limit, bad response)
 * resolves to [], so callers can always treat "no live data" the same way
 * as "nothing found" and fall back to local data. */
export async function searchNutrition(query: string, options: NutritionSearchOptions = {}): Promise<DatabaseFood[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const limit = options.limit ?? 8;
  const cacheKey = `${trimmed.toLowerCase()}::${(options.dataTypes ?? []).join(',')}::${limit}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    query: trimmed,
    pageSize: String(limit),
    api_key: import.meta.env.VITE_FDC_API_KEY || 'DEMO_KEY',
  });
  if (options.dataTypes?.length) params.set('dataType', options.dataTypes.join(','));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    const res = await fetch(`${BASE_URL}?${params}`, { signal: controller.signal });
    if (!res.ok) return [];
    const data: FdcSearchResponse = await res.json();
    const mapped = (data.foods ?? [])
      .map(mapFdcFoodToDatabaseFood)
      .filter((f): f is DatabaseFood => f !== null);
    const results = dedupeByName(mapped).slice(0, limit);
    cache.set(cacheKey, results);
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}
