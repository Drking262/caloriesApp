import type { FoodMemoryEntry } from '../types.ts';
import { hammingDistance, HASH_BITS } from './perceptualHash.ts';

/** Calibrated against real food photos put through hashVariantsFromSource's
 * rotation trials (see perceptualHash.ts for the reasoning). The 64-bit
 * hash space falls into bands:
 *   distance < AUTO_ACCEPT_DISTANCE (14)  — confident: auto-log silently.
 *   14–AUTO_MATCH_THRESHOLD (19)          — a match, but show it and get an
 *                                           explicit user confirmation.
 *   19–UNCERTAIN_REJECT_DISTANCE (26)     — weak: treat as "maybe", not a
 *                                           match; the band boundary is
 *                                           exported so the UI can present
 *                                           runner-ups instead of trusting it.
 *   above 26                              — a different food entirely.
 * AUTO_MATCH_THRESHOLD stays the store's decision line for now; the tighter
 * bands are what the main thread wires into the confirm-first flow. */
export const AUTO_ACCEPT_DISTANCE = 14;
export const AUTO_MATCH_THRESHOLD = 19;
export const UNCERTAIN_REJECT_DISTANCE = 26;

/** The learning band: only absorb a new hash variant when a capture is close
 * enough to be plausibly the same dish on a changed plate (>= MIN), but
 * different enough to actually teach the entry something new (<= MAX; exact
 * re-matches below MIN add nothing), AND the pairing is semantically backed
 * (see shouldLearnHashVariant) — so "a striped t-shirt kept showing up near
 * your lunch" never accumulates into the entry's hashes. */
export const HASH_LEARN_MIN_DISTANCE = 12;
export const HASH_LEARN_MAX_DISTANCE = 24;

export interface RankedMatch {
  entry: FoodMemoryEntry;
  distance: number;
  confidence: number;
  /** minimum distance across this entry's stored hashes (photoHash +
   * photoHashes) — identical to `distance` today, kept as a separate field
   * because per-hash breakdowns belong here when debug UI or band decisions
   * start consuming them. */
  bestDistance: number;
}

/** Every stored hash of an entry, canonical first, de-duplicated (the single
 * photoHash is also the first learned variant, so an entry that grew via
 * hash-variance learning would otherwise list it twice). */
export function entryHashes(entry: FoodMemoryEntry): string[] {
  const out: string[] = [];
  if (entry.photoHash) out.push(entry.photoHash);
  for (let i = 0; i < entry.photoHashes.length; i++) {
    const h = entry.photoHashes[i];
    if (h && !out.includes(h)) out.push(h);
  }
  return out;
}

/**
 * Rank memory entries against a freshly captured photo, tried at a few
 * rotation corrections (`hashes`, from hashVariantsFromSource) — a single
 * hash comparison is fragile to camera tilt, so each candidate's distance
 * is the *best* (minimum) across all capture variants × all of the entry's
 * stored hash variants. Distance is primary; among close ties, food logged
 * more often wins — "most likely" combines visual similarity with how often
 * you actually eat it.
 */
export function rankMatches(hashes: string[], memory: FoodMemoryEntry[]): RankedMatch[] {
  return memory
    .map((entry) => ({ entry, hashes: entryHashes(entry) }))
    .filter((c) => c.hashes.length > 0)
    .map(({ entry, hashes: stored }) => {
      let distance = HASH_BITS;
      for (const h of hashes) {
        for (const s of stored) {
          const d = hammingDistance(h, s);
          if (d < distance) distance = d;
        }
      }
      return { entry, distance, confidence: 1 - distance / HASH_BITS, bestDistance: distance };
    })
    .sort((a, b) => a.distance - b.distance || b.entry.timesLogged - a.entry.timesLogged);
}

export function bestMatch(hashes: string[], memory: FoodMemoryEntry[]): RankedMatch | null {
  const [top] = rankMatches(hashes, memory);
  return top ?? null;
}

/** Whether to absorb a capture's hash as a new variant on a memory entry.
 * Hash distance alone says "same shape"; CLIP's label (when classification
 * also ran) says "this is dish X". Only learn when they agree — a strictly
 * visual band would slowly glue unrelated-but-similar-looking plates to an
 * entry over months of logging.
 *
 *   labelMatch === true            CLIP ran and agrees → learn within band.
 *   labelMatch === null            CLIP didn't run / no classification →
 *                                  learn only if the user confirmed the entry.
 *   labelMatch === false           CLIP disagrees → never learn.
 */
export function shouldLearnHashVariant(
  distance: number,
  labelMatch: boolean | null,
  memoryEntryConfirmed: boolean,
): boolean {
  return (
    distance >= HASH_LEARN_MIN_DISTANCE &&
    distance <= HASH_LEARN_MAX_DISTANCE &&
    (labelMatch === true || (labelMatch === null && memoryEntryConfirmed))
  );
}

/** Frecency ranking used for the "Repeat" quick-chip and search results. */
export function byFrecency(memory: FoodMemoryEntry[]): FoodMemoryEntry[] {
  const now = Date.now();
  return [...memory].sort((a, b) => {
    const scoreA = a.timesLogged / Math.sqrt((now - a.lastLoggedAt) / 86_400_000 + 1);
    const scoreB = b.timesLogged / Math.sqrt((now - b.lastLoggedAt) / 86_400_000 + 1);
    return scoreB - scoreA;
  });
}
