import type { FoodMemoryEntry } from '../types';
import { hammingDistance, HASH_BITS } from './perceptualHash';

/** Below this distance we trust the match enough to auto-log silently.
 * Calibrated against real food photos put through hashVariantsFromSource's
 * rotation trials: reliably catches ~5° of handheld tilt between two shots
 * of the same plate while staying clear of the distance seen between
 * genuinely different foods (see perceptualHash.ts for the reasoning). */
export const AUTO_MATCH_THRESHOLD = 19;

export interface RankedMatch {
  entry: FoodMemoryEntry;
  distance: number;
  confidence: number;
}

/**
 * Rank memory entries against a freshly captured photo, tried at a few
 * rotation corrections (`hashes`, from hashVariantsFromSource) — a single
 * hash comparison is fragile to camera tilt, so each candidate's distance
 * is the *best* (minimum) across all variants. Distance is primary; among
 * close ties, food logged more often wins — "most likely" combines visual
 * similarity with how often you actually eat it.
 */
export function rankMatches(hashes: string[], memory: FoodMemoryEntry[]): RankedMatch[] {
  return memory
    .filter((m) => m.photoHash)
    .map((entry) => {
      const distance = Math.min(...hashes.map((h) => hammingDistance(h, entry.photoHash as string)));
      return { entry, distance, confidence: 1 - distance / HASH_BITS };
    })
    .sort((a, b) => a.distance - b.distance || b.entry.timesLogged - a.entry.timesLogged);
}

export function bestMatch(hashes: string[], memory: FoodMemoryEntry[]): RankedMatch | null {
  const [top] = rankMatches(hashes, memory);
  return top ?? null;
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
