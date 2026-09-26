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
    typicalGrams: 350,
    kcal: 123,
    protein: 4.6,
    carbs: 19.4,
    fat: 3.1,
    fiber: 2.3,
    sugar: 6.3,
    sodium: 34,
    grade: gradeFor({ kcal: 123, protein: 4.6, fiber: 2.3, sugar: 6.3, sodium: 34 }),
    photoHash: null,
    photoHashes: [],
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
    typicalGrams: 180,
    kcal: 266.7,
    protein: 5,
    carbs: 26.1,
    fat: 15.6,
    fiber: 1.1,
    sugar: 10,
    sodium: 188.9,
    grade: gradeFor({ kcal: 266.7, protein: 5, fiber: 1.1, sugar: 10, sodium: 188.9 }),
    photoHash: null,
    photoHashes: [],
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
      grams: oat.typicalGrams,
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
      grams: croissant.typicalGrams,
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
    // Migration: photoHashes was added with multi-reference memory (fix #6) —
    // pre-upgrade entries carry only photoHash. Default the new list rather
    // than wiping the user's food memory.
    return {
      ...parsed,
      memory: parsed.memory.map((m) => ({ ...m, photoHashes: m.photoHashes ?? [] })),
    };
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
