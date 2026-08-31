export type Grade = 'A' | 'A-' | 'B+' | 'B' | 'B-' | 'C+' | 'C' | 'C-' | 'D';

/** Macro values as they'd apply to a food's whole reference serving
 * (gramsPerServing grams) — not per-gram. Scale by grams/gramsPerServing
 * to get the amount for an actual portion. */
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
  /** weight, in grams, that the Macros above describe */
  gramsPerServing: number;
  photoHash: string | null;
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
  /** weight, in grams, that the Macros above describe (copied from the food at log time) */
  gramsPerServing: number;
  /** actual amount eaten, in grams — the only thing a user adjusts directly */
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
