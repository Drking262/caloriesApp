import type { LogEntry, Macros } from '../types';

const ZERO: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };

/** LogEntry macros are stored for `gramsPerServing` grams; this scales them
 * to the actual `grams` eaten — the only value a user edits directly. */
export function scaledMacros(log: LogEntry): Macros {
  const scale = log.gramsPerServing > 0 ? log.grams / log.gramsPerServing : 0;
  return {
    kcal: Math.round(log.kcal * scale),
    protein: Math.round(log.protein * scale),
    carbs: Math.round(log.carbs * scale),
    fat: Math.round(log.fat * scale),
    fiber: Math.round(log.fiber * scale),
    sugar: Math.round(log.sugar * scale),
    sodium: Math.round(log.sodium * scale),
  };
}

export function sumMacros(logs: LogEntry[]): Macros {
  return logs.reduce((acc, log) => {
    const m = scaledMacros(log);
    return {
      kcal: acc.kcal + m.kcal,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fat: acc.fat + m.fat,
      fiber: acc.fiber + m.fiber,
      sugar: acc.sugar + m.sugar,
      sodium: acc.sodium + m.sodium,
    };
  }, ZERO);
}

export function pct(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((value / target) * 100));
}
