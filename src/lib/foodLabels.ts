import type { DatabaseFood } from './foodDatabase.ts';
import { CZECH_FOOD_LABELS } from './foodData/czech.ts';
import { INTERNATIONAL_FOOD_LABELS } from './foodData/international.ts';

/**
 * Candidate labels for the CLIP zero-shot classifier (foodClassifier.ts).
 * Unlike a fixed-class model, recognizable variety here is bounded only by
 * this list — add a label with nutrition data and the camera can recognize
 * it. Keys are the exact strings passed as `candidate_labels` and returned
 * in `className`, lowercase, used as-is in the hypothesis template ("a
 * photo of {}, a type of food").
 *
 * The list used to live inline here; it now lives split by domain under
 * foodData/ and this file only aggregates it (key order: international
 * first, then Czech):
 *
 * - foodData/czech.ts — Czech dishes. SOURCED entries are real values read
 *   from individual pages on kaloricketabulky.cz (their sitemap-listed
 *   /potraviny/ and /recepty/ pages, never their disallowed search
 *   endpoint) — see git history for the extraction; the rest are reasonable
 *   typical-serving estimates, as are almost all international labels.
 * - foodData/international.ts — everything else (international mains,
 *   breakfast/bakery, desserts, fruits, vegetables, soups, drinks).
 * - foodData/coarse.ts — coarse categories for hierarchical classification
 *   (imported directly from there, not re-exported here): every fine label
 *   maps to exactly one coarse bucket with fallback nutrition.
 *
 * When adding a label, add it to czech.ts or international.ts AND to its
 * coarse bucket in foodData/coarse.ts — then run
 * `node src/lib/foodLabels.check.ts`, which fails if any key lacks a
 * coarse mapping.
 */
export const FOOD_LABEL_MAP: Record<string, DatabaseFood> = { ...INTERNATIONAL_FOOD_LABELS, ...CZECH_FOOD_LABELS };
