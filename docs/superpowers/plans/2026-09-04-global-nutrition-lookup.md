# Live Global Nutrition Lookup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the closed, hand-typed local nutrition table with live lookups against USDA FoodData Central, and make the existing "Fix it" food-correction flow able to find and select any food from that global database — not just the ~90 labels the camera already recognizes.

**Architecture:** One new leaf module, `src/lib/nutritionApi.ts`, wraps USDA's free, CORS-open, keyless-by-default search API behind a single function (`searchNutrition`) that never throws and always resolves to `DatabaseFood[]` — empty on any failure. `foodClassifier.ts` calls it to enrich a CLIP-recognized label with live macros (keeping the curated local name/typicalGrams). `SearchSheet.tsx` calls it directly to power a new "global database" section in the existing correction UI. Nothing else changes: recognition mechanism, instant auto-log flow, and local Czech-dish data all stay exactly as they are.

**Tech Stack:** TypeScript, React 19, Vite (`import.meta.env` for config), native `fetch`/`AbortController` — no new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-04-global-nutrition-lookup-design.md`

## Global Constraints

- No new npm dependencies, no backend, no test framework — this repo has none today and the change doesn't warrant adding one.
- `searchNutrition` must never throw. Every failure (offline, timeout, non-2xx, rate limit, malformed data) resolves to `[]`.
- USDA's `api_key` param defaults to `'DEMO_KEY'` via `import.meta.env.VITE_FDC_API_KEY` — the app must work with zero setup.
- USDA already reports sodium in mg — matching this app's `Macros.sodium` convention exactly. Do not scale it.
- CLIP-label enrichment (`foodClassifier.ts`) must restrict USDA results to `GENERIC_FOOD_DATA_TYPES = ['Foundation', 'SR Legacy', 'Survey (FNDDS)']` (excludes `Branded`) — verified live that Branded entries for a generic query like "banana" can be an unrelated fortified/branded product, not the plain food. The free-text correction search (`SearchSheet.tsx`) must NOT apply this restriction — a user typing an exact food name may genuinely mean a branded product.
- `CameraScreen.tsx`, `store.tsx`, `types.ts`, and the data inside `foodLabels.ts`/`foodDatabase.ts` are out of scope — do not modify them.

---

### Task 1: USDA nutrition client + its one runnable check

**Files:**
- Create: `src/lib/nutritionApi.ts`
- Create: `src/lib/nutritionApi.check.ts`
- Create: `.env.example`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `searchNutrition(query: string, options?: NutritionSearchOptions): Promise<DatabaseFood[]>`, `GENERIC_FOOD_DATA_TYPES: string[]`, `mapFdcFoodToDatabaseFood` (internal, exported only for the check script), `NutritionSearchOptions { limit?: number; dataTypes?: string[]; signal?: AbortSignal }` — all consumed by Task 2 and Task 3.

This repo has no test framework (no `vitest`/`jest` in `package.json`), and this change doesn't warrant adding one. Node 22 here runs `.ts` files with erasable syntax directly (verified: `node some-file.ts` works with no flags, and `allowImportingTsExtensions` is already on in `tsconfig.app.json`), so the check script is a plain script run with `node`, importing the real module by its explicit `.ts` extension — no build step, no framework.

- [ ] **Step 1: Write the check script**

Create `src/lib/nutritionApi.check.ts`:

```ts
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

console.log('nutritionApi.check.ts: all checks passed');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node src/lib/nutritionApi.check.ts`
Expected: FAIL — `Cannot find module './nutritionApi.ts'` (the module doesn't exist yet).

- [ ] **Step 3: Implement `src/lib/nutritionApi.ts`**

```ts
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
```

- [ ] **Step 4: Run the check to confirm it passes**

Run: `node src/lib/nutritionApi.check.ts`
Expected: four `ok - ...` lines and `nutritionApi.check.ts: all checks passed`, exit code 0.

- [ ] **Step 5: Typecheck the whole project**

Run: `npm run build`
Expected: succeeds (runs `tsc -b && vite build`) — confirms `nutritionApi.ts` and `nutritionApi.check.ts` satisfy the project's strict `tsconfig.app.json` (`erasableSyntaxOnly`, `verbatimModuleSyntax`, `noUnusedLocals`) with no errors. `import.meta.env.VITE_FDC_API_KEY` needs no type declaration — this project's `ImportMetaEnv` isn't narrowed (confirmed in `node_modules/vite/types/importMeta.d.ts`: it extends `Record<string, any>` by default), so arbitrary `VITE_*` keys already typecheck.

- [ ] **Step 6: Document the optional API key**

Create `.env.example`:

```
# Optional. The app works with zero setup on USDA's shared demo key
# (30 requests/hour, 50/day). For your own device, get a free personal key
# (no cost, no credit card, ~1 minute) at https://api.data.gov/signup/ for
# 1,000 requests/hour, then put it here as .env (not .env.example):
VITE_FDC_API_KEY=
```

- [ ] **Step 7: Keep a real `.env` out of git**

Modify `.gitignore` — add a line after the existing `*.local` line (line 13):

```
*.local

# API keys for local development (see .env.example)
.env
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/nutritionApi.ts src/lib/nutritionApi.check.ts .env.example .gitignore
git commit -m "Add USDA FoodData Central client for live nutrition lookup"
```

---

### Task 2: Enrich CLIP recognition with live nutrition

**Files:**
- Modify: `src/lib/foodClassifier.ts:1-2` (imports), `:99-104` (the `if (top && ...)` block inside `classifyFood`)

**Interfaces:**
- Consumes (from Task 1): `searchNutrition(query: string, options?: NutritionSearchOptions): Promise<DatabaseFood[]>`, `GENERIC_FOOD_DATA_TYPES: string[]`
- Produces: no change to `classifyFood`'s signature (`(frame: HTMLCanvasElement) => Promise<FoodPrediction | null>`) or to `FoodPrediction` — this task is invisible to every existing caller (`store.tsx`).

- [ ] **Step 1: Add the import**

In `src/lib/foodClassifier.ts`, change line 1-2 from:

```ts
import type { DatabaseFood } from './foodDatabase';
import { FOOD_LABEL_MAP } from './foodLabels';
```

to:

```ts
import type { DatabaseFood } from './foodDatabase';
import { FOOD_LABEL_MAP } from './foodLabels';
import { searchNutrition, GENERIC_FOOD_DATA_TYPES } from './nutritionApi';
```

- [ ] **Step 2: Wire in live enrichment**

Replace this block (currently lines 99-103):

```ts
    const top = ranked[0];
    if (top && top.score >= MIN_PROBABILITY) {
      const food = FOOD_LABEL_MAP[top.label];
      if (food) return { food, label: top.label, probability: top.score };
    }
    return null;
```

with:

```ts
    const top = ranked[0];
    if (top && top.score >= MIN_PROBABILITY) {
      const localFood = FOOD_LABEL_MAP[top.label];
      if (localFood) {
        const food = await withLiveNutrition(localFood, top.label);
        return { food, label: top.label, probability: top.score };
      }
    }
    return null;
```

Then add this function after `classifyFood` (after its closing `}`, i.e. after the current final line of the file):

```ts

/** Keeps the local entry's curated name/typicalGrams (especially important
 * for Czech dishes, which USDA has no coverage for) but prefers live,
 * sourced macros when USDA has a confident generic-food match. Never
 * throws — searchNutrition already resolves to [] on any failure. */
async function withLiveNutrition(local: DatabaseFood, label: string): Promise<DatabaseFood> {
  const [live] = await searchNutrition(label, { limit: 1, dataTypes: GENERIC_FOOD_DATA_TYPES });
  if (!live) return local;
  return {
    ...local,
    kcal: live.kcal,
    protein: live.protein,
    carbs: live.carbs,
    fat: live.fat,
    fiber: live.fiber,
    sugar: live.sugar,
    sodium: live.sodium,
  };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 4: Verify live, in the running app**

Run: `npm run dev`, open the printed local URL in a browser with a webcam (or a phone on the same network).

1. Open the browser's DevTools Network tab and filter by `nal.usda.gov`.
2. Point the camera at a banana, apple, or a slice of pizza (printed photo or screen image works) and tap the shutter.
3. Confirm a request to `api.nal.usda.gov/fdc/v1/foods/search` appears and returns `200`.
4. Open the logged item's detail screen and confirm the kcal/protein/carbs/fat shown are plausible live values (e.g. a banana should land near 90-100 kcal/100g, not exactly `94` — the old hardcoded value in `foodLabels.ts`) rather than the exact old hardcoded numbers.
5. Turn off WiFi/network, capture the same food again, and confirm it still logs successfully (falls back to the local hardcoded value, no crash, no hang).

- [ ] **Step 5: Commit**

```bash
git add src/lib/foodClassifier.ts
git commit -m "Enrich CLIP-recognized foods with live USDA nutrition data"
```

---

### Task 3: Live global search in the food-correction flow

**Files:**
- Modify: `src/components/SearchSheet.tsx` (full file)

**Interfaces:**
- Consumes (from Task 1): `searchNutrition(query: string, options?: NutritionSearchOptions): Promise<DatabaseFood[]>`
- Produces: no change to `SearchSheetProps` — `onPickDatabase: (food: DatabaseFood) => void` already accepts any `DatabaseFood`, so `DetailScreen.tsx` and `CameraScreen.tsx` (its two callers) need no changes.

- [ ] **Step 1: Replace `src/components/SearchSheet.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { byFrecency } from '../lib/match';
import { searchDatabase, type DatabaseFood } from '../lib/foodDatabase';
import { searchNutrition } from '../lib/nutritionApi';
import type { FoodMemoryEntry } from '../types';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 500;

interface SearchSheetProps {
  onClose: () => void;
  onPickMemory: (entry: FoodMemoryEntry) => void;
  onPickDatabase: (food: DatabaseFood) => void;
}

export function SearchSheet({ onClose, onPickMemory, onPickDatabase }: SearchSheetProps) {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [apiHits, setApiHits] = useState<DatabaseFood[]>([]);
  const [apiOffline, setApiOffline] = useState(false);

  const memoryHits = useMemo(() => {
    const ranked = byFrecency(state.memory);
    const q = query.trim().toLowerCase();
    return (q ? ranked.filter((m) => m.name.toLowerCase().includes(q)) : ranked).slice(0, 8);
  }, [state.memory, query]);

  const memoryNames = useMemo(() => new Set(state.memory.map((m) => m.name.toLowerCase())), [state.memory]);

  const databaseHits = useMemo(
    () => searchDatabase(query).filter((f) => !memoryNames.has(f.name.toLowerCase())).slice(0, 8),
    [query, memoryNames],
  );

  // Live global search: debounced so typing doesn't hammer USDA's rate
  // limit (30 req/hour on the shared demo key), cancels a stale request
  // when the query changes again before it resolves, and skips the network
  // call entirely when offline rather than firing a request doomed to fail.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setApiHits([]);
      setApiOffline(false);
      return;
    }
    if (!navigator.onLine) {
      setApiHits([]);
      setApiOffline(true);
      return;
    }
    setApiOffline(false);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchNutrition(q, { signal: controller.signal }).then((results) => {
        if (!controller.signal.aborted) setApiHits(results);
      });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const excludeFromGlobal = useMemo(
    () => new Set([...memoryNames, ...databaseHits.map((f) => f.name.toLowerCase())]),
    [memoryNames, databaseHits],
  );
  const globalHits = useMemo(
    () => apiHits.filter((f) => !excludeFromGlobal.has(f.name.toLowerCase())),
    [apiHits, excludeFromGlobal],
  );

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="sheet-input"
          placeholder="Search food…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="sheet-list">
          {memoryHits.length > 0 && <div className="sheet-section">FROM YOUR MEMORY — MOST LIKELY</div>}
          {memoryHits.map((m) => (
            <button
              key={m.id}
              type="button"
              className="list-item"
              onClick={() => {
                onPickMemory(m);
                onClose();
              }}
            >
              <div className="list-thumb" style={m.thumbnail ? { backgroundImage: `url(${m.thumbnail})` } : undefined} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{m.name}</div>
                <div className="sub">Logged {m.timesLogged}× · {m.grade}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="kcal">{m.kcal}</div>
                <div className="sub" style={{ marginTop: 2 }}>kcal/100g</div>
              </div>
            </button>
          ))}

          {databaseHits.length > 0 && <div className="sheet-section">GENERIC RESULTS</div>}
          {databaseHits.map((f) => (
            <button
              key={f.name}
              type="button"
              className="list-item"
              onClick={() => {
                onPickDatabase(f);
                onClose();
              }}
            >
              <div className="list-thumb" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{f.name}</div>
                <div className="sub">not in your memory yet</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="kcal">{f.kcal}</div>
                <div className="sub" style={{ marginTop: 2 }}>kcal/100g</div>
              </div>
            </button>
          ))}

          {apiOffline && (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '12px 4px' }}>
              Global search unavailable — check your connection.
            </div>
          )}
          {globalHits.length > 0 && <div className="sheet-section">GLOBAL DATABASE</div>}
          {globalHits.map((f) => (
            <button
              key={`global-${f.name}`}
              type="button"
              className="list-item"
              onClick={() => {
                onPickDatabase(f);
                onClose();
              }}
            >
              <div className="list-thumb" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{f.name}</div>
                <div className="sub">from USDA FoodData Central</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="kcal">{f.kcal}</div>
                <div className="sub" style={{ marginTop: 2 }}>kcal/100g</div>
              </div>
            </button>
          ))}

          {memoryHits.length === 0 && databaseHits.length === 0 && globalHits.length === 0 && !apiOffline && (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '12px 4px' }}>No matches.</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: succeeds with no errors.

- [ ] **Step 3: Verify live, in the running app**

Run: `npm run dev` (or reuse the dev server from Task 2), open the app.

1. Log any food (or open an existing log), then tap "Not the right food? Fix it" (from `DetailScreen`) — or tap "Search food" directly from the camera screen.
2. Type a food that is NOT one of the ~90 local labels — e.g. `mango` or `salmon teriyaki` (check it's absent from `src/lib/foodLabels.ts` first).
3. Confirm nothing appears for the first two characters, then after the third character and a ~500ms pause, a "GLOBAL DATABASE" section appears with real results.
4. Tap one of them and confirm the log/detail screen updates to that food's real macros.
5. In DevTools, throttle the network to "Offline", repeat step 2, and confirm the "Global search unavailable — check your connection." note appears instead of a silent empty list.
6. Type a 1-2 character query and confirm no network request fires (Network tab stays quiet) — the rate limit matters here.

- [ ] **Step 4: Commit**

```bash
git add src/components/SearchSheet.tsx
git commit -m "Search USDA's global database in the food-correction flow"
```

---

### Task 4: Correct the README's now-stale claims

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the description and add a Configuration section**

Replace:

```markdown
All data stays on your device (`localStorage`) — no backend, no accounts, no API keys. Food "recognition" is a client-side perceptual image hash (see `src/lib/perceptualHash.ts`), not a network call.
```

with:

```markdown
All data stays on your device (`localStorage`) — no backend, no accounts required. Food recognition runs on-device (see `src/lib/foodClassifier.ts`); nutrition data for a recognized or searched food is looked up live against USDA's free FoodData Central API (see `src/lib/nutritionApi.ts`), with a local fallback for dishes it doesn't cover (e.g. Czech traditional dishes).

## Configuration

Nutrition lookups work out of the box on USDA's shared demo key (30 requests/hour, 50/day). For a much higher limit on your own device, get a free personal key (no cost, no credit card, ~1 minute) at https://api.data.gov/signup/, then create a `.env` file (see `.env.example`):

\`\`\`
VITE_FDC_API_KEY=your-key-here
\`\`\`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "Correct README claims about network calls and API keys"
```

---

## Self-Review

**Spec coverage:** `nutritionApi.ts` module (Task 1) ✓; CLIP enrichment with local-name/live-macros merge and `GENERIC_FOOD_DATA_TYPES` filter (Task 2) ✓; `SearchSheet` debounced global search + offline note + reused `onPickDatabase` (Task 3) ✓; `.env.example` + README correction (Task 1 Step 6, Task 4) ✓; explicitly-unchanged files (`CameraScreen.tsx`, `store.tsx`, `types.ts`, `foodDatabase.ts`) are untouched by every task ✓.

**Placeholder scan:** no TBD/TODO; every step has literal, complete code (not descriptions); no "add appropriate error handling"-style vagueness — every error path (timeout, offline, non-2xx, missing kcal, missing description) is spelled out in the actual code.

**Type consistency:** `NutritionSearchOptions { limit?, dataTypes?, signal? }` defined once in Task 1, used identically (named fields, no positional args) in Task 2 (`{ limit: 1, dataTypes: GENERIC_FOOD_DATA_TYPES }`) and Task 3 (`{ signal: controller.signal }`). `DatabaseFood` fields (`name, typicalGrams, kcal, protein, carbs, fat, fiber, sugar, sodium`) match the existing interface in `foodDatabase.ts` exactly in every task that constructs one. `searchNutrition`'s return type (`Promise<DatabaseFood[]>`) is treated consistently as "always an array, never null/undefined" everywhere it's called.

Plan complete and saved to `docs/superpowers/plans/2026-09-04-global-nutrition-lookup.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
