export type Grade = 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D';

/** Macro values per 100g of this food — the standard nutrition-label basis.
 * Scale by grams/100 to get the amount for an actual portion. */
export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number; // mg
}

export type FoodSource = 'photo' | 'manual' | 'database';

/** A food the user has logged before. This is the app's "memory" — new
 * captures are matched against it before ever falling back to a generic
 * database guess. */
export interface FoodMemoryEntry extends Macros {
  id: string;
  name: string;
  grade: Grade;
  /** default grams to seed a new log with — just a starting guess, not part
   * of the nutrition math (Macros above is always per 100g) */
  typicalGrams: number;
  /** canonical stored hash: the unrotated hash of the first photo this entry
   * was learned from. Kept as the single-hash back-compat field — old saved
   * data only has this one, and readers that carry one hash forward
   * (stale-guess migration in the store) keep using it. */
  photoHash: string | null;
  /** additional accepted hash variants from other plating sessions of the
   * same food (a plate rearranged shifts the dHash even when it is the same
   * dish). Matching takes the min distance across photoHash + photoHashes;
   * the list is capped (HASH_VARIANTS_PER_ENTRY in lib/perceptualHash) so a
   * frequently-logged entry does not accumulate unbounded variants — the
   * store owns adding/capping, this is just the shape. */
  photoHashes: string[];
  thumbnail: string | null;
  timesLogged: number;
  lastLoggedAt: number;
  createdAt: number;
  source: FoodSource;
  /** false = created from an unmatched capture or generic guess and never corrected */
  confirmed: boolean;
}

export interface LogEntry extends Macros {
  id: string;
  memoryId: string;
  name: string;
  grade: Grade;
  /** actual amount eaten, in grams — the only thing a user adjusts directly.
   * Macros above are per 100g, so actual amounts are kcal * grams / 100, etc. */
  grams: number;
  loggedAt: number;
  note: string;
  thumbnail: string | null;
  photoHash: string | null;
  /** 0-1 hash-match confidence, null when logged without a photo */
  matchConfidence: number | null;
}

export interface Goal {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface AppState {
  goal: Goal;
  memory: FoodMemoryEntry[];
  logs: LogEntry[];
}

export type Screen = 'camera' | 'logged' | 'today' | 'detail' | 'history';
