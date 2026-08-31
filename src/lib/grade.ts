import type { Grade, Macros } from '../types';

/**
 * Simple, transparent quality heuristic — not medical advice. Rewards protein
 * density and fiber, penalizes sodium and sugar density relative to calories.
 * Kept deterministic so the same macros always grade the same way.
 */
export function gradeFor(m: Pick<Macros, 'kcal' | 'protein' | 'fiber' | 'sugar' | 'sodium'>): Grade {
  const kcal = Math.max(m.kcal, 1);
  const proteinScore = clamp((m.protein * 4) / kcal, 0, 0.4) * 100; // up to 40
  const fiberScore = clamp((m.fiber / kcal) * 1000, 0, 20); // up to 20
  const sodiumPenalty = clamp((m.sodium / kcal) * 8, 0, 30); // up to -30
  const sugarPenalty = clamp((m.sugar / kcal) * 400, 0, 20); // up to -20

  const score = 50 + proteinScore + fiberScore - sodiumPenalty - sugarPenalty;

  if (score >= 85) return 'A';
  if (score >= 75) return 'A-';
  if (score >= 68) return 'B+';
  if (score >= 60) return 'B';
  if (score >= 52) return 'B-';
  if (score >= 44) return 'C+';
  if (score >= 35) return 'C';
  if (score >= 25) return 'C-';
  return 'D';
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
