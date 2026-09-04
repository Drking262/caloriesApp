# Live global nutrition lookup + working food correction

Date: 2026-09-04
Status: Approved, moving to implementation plan

## Problem

The user wants recognition to feel like Gemini/Samsung picture search: point at food, get an identification, see real calorie data, and be able to correct it if wrong.

Today:

- On-device CLIP (`src/lib/foodClassifier.ts`) already does open-vocabulary recognition, but only against a **fixed, hand-typed list of ~90 labels** (`src/lib/foodLabels.ts`), each mapped to hardcoded, partly-estimated nutrition data.
- If CLIP has no confident match, the app logs a literal random guess (`randomDatabaseFood()`), honestly labeled as a placeholder.
- A correction flow already exists (`DetailScreen.tsx`'s "Not the right food? Fix it" → `SearchSheet.tsx` → `reassignToDatabaseFood`), but `SearchSheet`'s search only searches that **same closed 90-item local list**. If the true food isn't one of those 90 labels, it can't be found there either — which is the real mechanism behind "you cannot change the item."

## Constraints discovered during design

This app is a static site with no backend (GitHub Pages, no server, no `.env`) — confirmed via `vite.config.ts` and `package.json`. Any data source must either need no secret key, or accept a key that's fine to expose publicly.

Verified directly against live endpoints (see session transcript for raw requests/responses):

- **Open Food Facts** was the initially preferred source (free, no key) but doesn't work for this architecture: its legacy full-text search (`cgi/search.pl`) returned `503` on every attempt; its current `/api/v2/search` endpoint has open CORS (`Access-Control-Allow-Origin: *`) but **silently ignores `search_terms`** (confirmed: "banana" and "pizza" queries returned identical, unrelated products); its real full-text search service (`search.openfoodfacts.org`, relevant results) **omits `Access-Control-Allow-Origin`**, so a browser blocks direct cross-origin reads of it.
- **USDA FoodData Central** (`api.nal.usda.gov/fdc/v1/foods/search`) was verified working end-to-end from a cross-origin request: real relevant results, `Access-Control-Allow-Origin: *`, no backend required. Its `Survey (FNDDS)` dataset in particular covers prepared/mixed dishes (e.g. "Pizza, cheese, regular crust"), not just raw ingredients or packaged products.
- USDA has no coverage for Czech dishes (US-centric survey/reference data) — confirmed by domain knowledge and consistent with FDC's scope. The existing locally-sourced Czech data remains the only source for those dishes and stays in place unchanged.
- `DEMO_KEY` rate limit: 30 requests/hour + 50/day per IP. A free personal key (1-minute signup, no cost/card, at api.data.gov) raises this to 1,000/hour per IP. Limits are per calling IP — in this client-only architecture, that's per end-user device, not a shared bottleneck.

## Decisions

1. **Recognition mechanism is unchanged.** On-device CLIP stays exactly as implemented — free, private, offline-capable. No cloud vision API, no backend.
2. **Nutrition/search data source: USDA FoodData Central.** Swaps in for the originally-considered Open Food Facts, same role in the architecture.
3. **Correction UX is unchanged in shape.** Capture still auto-logs instantly ("shoot first, nothing to confirm" stays as-is). The fix is entirely inside the existing "Fix it" → `SearchSheet` flow: give it access to the live global database instead of only the closed local list.

## Design

### New module: `src/lib/nutritionApi.ts`

One exported async function:

```ts
searchNutrition(query: string, limit?: number): Promise<DatabaseFood[]>
```

- Calls `GET https://api.nal.usda.gov/fdc/v1/foods/search?query=<q>&pageSize=<limit>&api_key=<key>`.
- `api_key` = `import.meta.env.VITE_FDC_API_KEY ?? 'DEMO_KEY'` — works out of the box with zero setup, upgradeable via a `.env` var.
- `AbortController` timeout (~6s) so a slow/hung request never blocks the caller.
- Never throws. Any failure (network, timeout, non-2xx, rate limit, parse error) resolves to `[]`.
- In-memory `Map` cache keyed by normalized query text, process-lifetime only (no persistence — the common repeat case is the same CLIP label recurring within a session; cross-session persistence isn't worth the complexity yet).
- Internally, response mapping is a **separate pure function** (`mapFdcFoodToDatabaseFood(raw): DatabaseFood | null`) so it's testable without a network call: reads USDA's standard nutrient numbers (208 kcal, 203 protein, 205 carbs, 204 fat, 291 fiber, 269 sugars, 307 sodium), defaults missing macros to 0, converts units defensively (checks `unitName` rather than assuming), returns `null` (filtered out) if kcal is missing entirely, and dedupes by lowercased description.
- `typicalGrams` defaults to 100 (USDA doesn't supply a "typical logged portion" the way the curated local map does).

### `src/lib/foodClassifier.ts` (modified)

After CLIP picks a label and its local fallback `DatabaseFood`, call `searchNutrition(label, 1)`. If a usable result comes back, keep the local entry's `name`/`typicalGrams` (curated display quality, especially for Czech dishes) but override the macro fields with the live result. On empty/failure, behavior is byte-for-byte what it is today. **`classifyFood`'s exported signature and return type don't change** — this is invisible to every caller.

### `src/components/SearchSheet.tsx` (modified)

- New debounced effect: query changes → wait ~500ms idle → if trimmed length ≥ 3 → call `searchNutrition(query)` with an `AbortController` that cancels on the next keystroke or unmount.
- New "Global database" result section, rendered with the exact same list-item markup and `onPickDatabase` callback already used for local "Generic results" — no changes needed to the picking/reassignment logic, which is already generic over any `DatabaseFood`.
- Loading state while a search is in flight; a small inline note ("Global search unavailable — check your connection") when offline or the call fails, so it reads as "unavailable," not "no results."

### Explicitly unchanged

`CameraScreen.tsx`'s instant-log flow, `store.tsx`, `types.ts`, `foodDatabase.ts`'s local list (still the only source for Czech dishes, generic combo meals, and the offline/no-match fallback), the CLIP model and its label vocabulary.

### Config

`.env.example` documenting `VITE_FDC_API_KEY=` and a one-line pointer to the free signup page. README gets a small correction: it currently claims "no backend, no accounts, no API keys" and "not a network call," both already slightly stale (CLIP fetches model weights over the network) and more so after this change — update to describe the actual behavior (still no backend/accounts; nutrition lookups are a direct client-to-USDA network call with a keyless-by-default, freely-upgradable key).

## Error handling

Every failure mode (offline, timeout, HTTP error, rate limit, malformed/incomplete result) degrades to "no global results shown" — never blocks capture, logging, or the rest of the correction flow, and never throws past `nutritionApi.ts`'s boundary.

## Testing

No test framework exists in this repo today (no `vitest`/`jest` in `package.json`) and this change doesn't warrant adding one. The one genuinely error-prone piece — USDA's response shape → `DatabaseFood` mapping (unit handling, missing fields) — is a pure function, checked by a small standalone Node script (plain `assert`, run via `node`) against a real captured sample response. Everything else (debouncing, UI wiring) is straightforward enough to verify by running the app.

## Non-goals

- No pre-log confirmation/candidate-picker screen (user explicitly chose to keep instant auto-log).
- No cloud vision API / no backend.
- No expansion of the CLIP label vocabulary.
- No persistence of the nutrition-lookup cache across sessions.
