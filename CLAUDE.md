# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Camera-first calorie tracker PWA ("Calorie Camera"). Shoot your plate, it logs instantly, and it remembers foods you've logged before. No backend, no account — all state lives in `localStorage`. Deployed as a static site to GitHub Pages; pushing to `main` auto-deploys via `.github/workflows/deploy.yml`.

## Commands

```bash
npm install
npm run dev      # Vite dev server, http://localhost:5173
npm run build    # tsc -b && vite build → dist/
npm run lint     # oxlint
npm run preview  # serve the production build locally
```

There is **no test framework** (no vitest/jest — intentionally, per `docs/superpowers/plans/`). Instead, `src/lib/*.check.ts` files are plain assertion scripts run directly with Node (Node 22 runs type-strippable `.ts` natively):

```bash
node src/lib/nutritionApi.check.ts
node src/lib/foodClassifier.check.ts
node src/lib/foodLabels.check.ts
```

A measurement harness for the detection pipeline lives in `scripts/eval/` (see its README):

```bash
npm run eval          # hash-layer report on synthetic + any real photos in scripts/eval/data/
npm run eval -- --sweep
node scripts/eval/index.ts --clip --data DIR   # also run the real CLIP model
```

## Architecture

### Data model (`src/types.ts`)

All macro values (`Macros`) are stored **per 100g** everywhere — `FoodMemoryEntry`, `LogEntry`, `DatabaseFood`. The user's actual portion is only `LogEntry.grams`; `scaledMacros()` in `src/lib/nutrition.ts` multiplies by `grams/100`. Don't introduce any other basis. Sodium is in mg.

### State (`src/state/store.tsx`)

Single React context + `useReducer`, persisted to `localStorage` on every change (`src/lib/storage.ts`, key `calorie-camera:v2`, seeds demo data on first run). The store holds almost all app logic — screens are thin renderers:

- `AppState.memory: FoodMemoryEntry[]` — the app's "memory" of foods it has seen (name, macros, grade, multiple `photoHash` references, thumbnail). Entries carry one canonical `photoHash` plus a bounded `photoHashes[]` of absorbed variants (plating drift), kept ≤ `HASH_VARIANTS_PER_ENTRY` and only appended when `shouldLearnHashVariant` judges the sighting semantically backed (CLIP agreement or a confirmed entry).
- `AppState.logs: LogEntry[]` — each meal logged, pointing at a `memoryId`.

Navigation is a `useState` screen switch in `src/App.tsx` (no router).

### The capture pipeline — the core flow to understand

`CameraScreen` → `store.logFromCapture(hashes, thumbnail, frame)` decides what a photo is, in banded stages (constants in `src/lib/match.ts`):

1. **Perceptual-hash match against memory** (`src/lib/perceptualHash.ts` + `src/lib/match.ts`): a 64-bit dHash of the frame, hashed at small rotation corrections (`ROTATION_TRIALS_DEG`), min-distance over every stored `photoHash`/`photoHashes` on every memory entry. The 64-bit space is banded:
   - `≤ AUTO_ACCEPT_DISTANCE (14)`: trusted — auto-log silently.
   - `14 – AUTO_MATCH_THRESHOLD (19)`: a plausible match, but the log is written pending confirmation (`route: 'memory-confirm'`) and the `LoggedScreen` explicitly asks yes/no before the match hardens.
   - `19 – UNCERTAIN_REJECT_DISTANCE (26)`: too weak to log alone — carried as a `verification` hint ("Same as {name}?") instead.
   - `> 26`: a different food entirely; fall through.
2. **On-device CLIP zero-shot classification** (`src/lib/foodClassifier.ts`): MobileCLIP-S0 via `@huggingface/transformers` (ONNX Runtime Web), loaded once lazily and pre-warmed when the camera mounts. Open-vocabulary — the recognizable vocabulary is the label list in `src/lib/foodLabels.ts` → `src/lib/foodData/` (split into `czech.ts` / `international.ts` / `coarse.ts`, re-exported as `FOOD_LABEL_MAP`); "add a label" = "recognize a new food". Per capture the image is embedded once and softmaxed against the folded per-label text embeddings (averaged over multiple hypothesis templates — free CLIP accuracy); a prediction only surfaces when it clears `MIN_PROBABILITY` **and** beats the runner-up by a margin (`isConfident`), because pure softmax picks confident-sounding wrong labels on ambiguous shots. Model weights come from the Hugging Face CDN on first use and are then cached by the service worker (`vite.config.ts` workbox rule) so it works offline.
3. **Coarse fallback** (`classifyCoarseFood`, `src/lib/foodData/coarse.ts`): when no fine label clears the margin, the photo is scored against 15 broad categories ('stew', 'salad', 'pasta', …). A coarse hit logs "looks like a {category}" with category-average placeholder macros — honest where a fine guess would be force-fit wrong. Never silently picks a random dish.
4. **Unknown**: when even coarse fails, the log is written as `Unidentified dish` (`COARSE_UNKNOWN_FOOD` in the store) with note prompting Fix it — no random-guess pollution of the food memory.

`logFromCapture` returns a `CaptureResultInfo` (route, alternatives, needsConfirm, verification hint, undoLogId) that `CameraScreen` and `LoggedScreen` use to drive the confirmation/undo/alternatives UI. Every capture **also adds a `FoodMemoryEntry`** (unconfirmed guesses included). Corrections via `reassignToMemory` / `reassignToDatabaseFood` replace the log's food and garbage-collect stale unconfirmed guesses, keeping the photo hash(es) so the corrected food recognizes the same photo next time.

### Nutrition data: local vs. live (`src/lib/nutritionApi.ts`)

- Local source of truth: `src/lib/foodLabels.ts` (label → curated food; Czech dishes are SOURCED from kaloricketabulky.cz, rest are estimates) + `src/lib/foodDatabase.ts` (a few generic combo meals + re-exports the labels list for search).
- Live source: USDA FoodData Central `/foods/search` API (`searchNutrition`). **Never throws** — any failure resolves `[]` so callers can always fall back to local data; callers that need to distinguish "API down" from "no results" use the `onFailure` option. In-memory result cache; `VITE_FDC_API_KEY` env var, falling back to `DEMO_KEY` (30 req/hr, 50/day).
- **Czech-dish guard**: `shouldSkipLiveEnrichment()` in `foodClassifier.ts` skips the live USDA lookup for Czech-dish labels (USDA has no Czech coverage and returns wrong matches — see that function's comment). It distinguishes by heuristic (non-ASCII / gloss parens in the label) plus an explicit set. **If you add a new Czech dish with a plain-English label, also add it to `CZECH_DISH_LABELS_WITHOUT_SCRIPT_SIGNAL`.**
- The classifier restricts live search to `GENERIC_FOOD_DATA_TYPES` (excludes `Branded` — unreliable for generic labels); the free-text `SearchSheet` deliberately does **not**, because a user typing an exact food may want a branded product. Branded results get `(brandOwner)` folded into the display name (see `mapFdcFoodToDatabaseFood`).
- `SearchSheet` search results are layered: memory (frecency-ranked, `byFrecency`) → local database → live global results, deduped by name across layers; the live layer is debounced (500ms), cancellable, and skipped when offline to protect the USDA rate limit.

### Food grade

`gradeFor()` in `src/lib/grade.ts` is a deterministic heuristic (protein/fiber reward, sodium/sugar penalty on a 50-point base) computed at memory-entry creation — grades are stored, not recomputed.

## Gotchas

- Built for GitHub Pages under `/caloriesApp/` — `base` in `vite.config.ts` switches on build command; keep manifest `start_url`/`scope` consistent with it.
- The USDA API key is compiled into the public bundle like any `VITE_*` var — acceptable here (rate-limit identity only), per README.
- `docs/superpowers/` contains the design spec/plan for the live-nutrition feature — useful history for why API choices (e.g. USDA over Open Food Facts, which fails CORS) were made.
