import type { AppState, FoodMemoryEntry, LogEntry } from '../types';
import { gradeFor } from './grade';
import { makeId } from './id';

const STORAGE_KEY = 'calorie-camera:v2';

function todayAt(hours: number, minutes: number): number {
  const d = new Date();
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

/** First-run demo data, so Today isn't an empty void and History has one
 * point to plot. Real usage overwrites this immediately. */
function seedState(): AppState {
  const oat: FoodMemoryEntry = {
    id: makeId(),
    name: 'Oat bowl, banana',
    gramsPerServing: 350,
    kcal: 430,
    protein: 16,
    carbs: 68,
    fat: 11,
    fiber: 8,
    sugar: 22,
    sodium: 120,
    grade: gradeFor({ kcal: 430, protein: 16, fiber: 8, sugar: 22, sodium: 120 }),
    photoHash: null,
    thumbnail: null,
    timesLogged: 6,
    lastLoggedAt: todayAt(8, 12),
    createdAt: todayAt(8, 12) - 12 * 86_400_000,
    source: 'database',
    confirmed: true,
  };
  const croissant: FoodMemoryEntry = {
    id: makeId(),
    name: 'Flat white + almond croissant',
    gramsPerServing: 180,
    kcal: 480,
    protein: 9,
    carbs: 47,
    fat: 28,
    fiber: 2,
    sugar: 18,
    sodium: 340,
    grade: gradeFor({ kcal: 480, protein: 9, fiber: 2, sugar: 18, sodium: 340 }),
    photoHash: null,
    thumbnail: null,
    timesLogged: 2,
    lastLoggedAt: todayAt(10, 45),
    createdAt: todayAt(10, 45) - 5 * 86_400_000,
    source: 'database',
    confirmed: true,
  };

  const logs: LogEntry[] = [
    {
      id: makeId(),
      memoryId: oat.id,
      name: oat.name,
      gramsPerServing: oat.gramsPerServing,
      grams: oat.gramsPerServing,
      kcal: oat.kcal,
      protein: oat.protein,
      carbs: oat.carbs,
      fat: oat.fat,
      fiber: oat.fiber,
      sugar: oat.sugar,
      sodium: oat.sodium,
      grade: oat.grade,
      loggedAt: todayAt(8, 12),
      note: 'Rolled oats, whole milk, banana, honey.',
      thumbnail: null,
      photoHash: null,
      matchConfidence: null,
    },
    {
      id: makeId(),
      memoryId: croissant.id,
      name: croissant.name,
      gramsPerServing: croissant.gramsPerServing,
      grams: croissant.gramsPerServing,
      kcal: croissant.kcal,
      protein: croissant.protein,
      carbs: croissant.carbs,
      fat: croissant.fat,
      fiber: croissant.fiber,
      sugar: croissant.sugar,
      sodium: croissant.sodium,
      grade: croissant.grade,
      loggedAt: todayAt(10, 45),
      note: 'The croissant is most of this.',
      thumbnail: null,
      photoHash: null,
      matchConfidence: null,
    },
  ];

  return {
    goal: { kcal: 2200, protein: 150, carbs: 250, fat: 75 },
    memory: [oat, croissant],
    logs,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.goal || !Array.isArray(parsed.memory) || !Array.isArray(parsed.logs)) {
      return seedState();
    }
    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable — app still works for the session
  }
}
