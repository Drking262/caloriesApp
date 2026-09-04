import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { AppState, FoodMemoryEntry, Goal, LogEntry } from '../types';
import { loadState, saveState } from '../lib/storage';
import { gradeFor } from '../lib/grade';
import { makeId } from '../lib/id';
import { bestMatch, AUTO_MATCH_THRESHOLD } from '../lib/match';
import { randomDatabaseFood, type DatabaseFood } from '../lib/foodDatabase';
import { classifyFood } from '../lib/foodClassifier';

type Action =
  | { type: 'UPSERT_LOG_AND_MEMORY'; log: LogEntry; memory: FoodMemoryEntry }
  | { type: 'REASSIGN_LOG'; log: LogEntry; memory: FoodMemoryEntry; removeMemoryId?: string }
  | { type: 'SET_GRAMS'; logId: string; grams: number }
  | { type: 'DELETE_LOG'; logId: string }
  | { type: 'SET_GOAL'; goal: Partial<Goal> };

function upsertMemory(memory: FoodMemoryEntry[], entry: FoodMemoryEntry): FoodMemoryEntry[] {
  const exists = memory.some((m) => m.id === entry.id);
  return exists ? memory.map((m) => (m.id === entry.id ? entry : m)) : [...memory, entry];
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'UPSERT_LOG_AND_MEMORY':
      return { ...state, memory: upsertMemory(state.memory, action.memory), logs: [...state.logs, action.log] };
    case 'REASSIGN_LOG': {
      let memory = upsertMemory(state.memory, action.memory);
      if (action.removeMemoryId && action.removeMemoryId !== action.memory.id) {
        memory = memory.filter((m) => m.id !== action.removeMemoryId);
      }
      return { ...state, memory, logs: state.logs.map((l) => (l.id === action.log.id ? action.log : l)) };
    }
    case 'SET_GRAMS':
      return {
        ...state,
        logs: state.logs.map((l) => (l.id === action.logId ? { ...l, grams: Math.max(1, action.grams) } : l)),
      };
    case 'DELETE_LOG':
      return { ...state, logs: state.logs.filter((l) => l.id !== action.logId) };
    case 'SET_GOAL':
      return { ...state, goal: { ...state.goal, ...action.goal } };
    default:
      return state;
  }
}

interface StoreApi {
  state: AppState;
  logFromCapture: (
    hashes: string[],
    thumbnail: string,
    frame: HTMLCanvasElement,
  ) => Promise<{ logId: string; matched: boolean; confidence: number | null }>;
  logFromMemory: (memoryId: string) => string;
  logFromDatabaseFood: (food: DatabaseFood) => string;
  reassignToMemory: (logId: string, entry: FoodMemoryEntry) => void;
  reassignToDatabaseFood: (logId: string, food: DatabaseFood) => void;
  setGrams: (logId: string, grams: number) => void;
  deleteLog: (logId: string) => void;
  setGoal: (patch: Partial<Goal>) => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => saveState(state), [state]);

  const api = useMemo<Omit<StoreApi, 'state'>>(() => {
    async function logFromCapture(hashes: string[], thumbnail: string, frame: HTMLCanvasElement) {
      const top = bestMatch(hashes, state.memory);
      const now = Date.now();
      const canonicalHash = hashes[0]; // unrotated — what gets stored as a memory's reference photo

      if (top && top.distance <= AUTO_MATCH_THRESHOLD) {
        const entry = top.entry;
        const memory: FoodMemoryEntry = { ...entry, timesLogged: entry.timesLogged + 1, lastLoggedAt: now };
        const log: LogEntry = {
          id: makeId(),
          memoryId: entry.id,
          name: entry.name,
          grams: entry.typicalGrams,
          kcal: entry.kcal,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          fiber: entry.fiber,
          sugar: entry.sugar,
          sodium: entry.sodium,
          grade: entry.grade,
          loggedAt: now,
          note: `Matched from your food memory · ${Math.round(top.confidence * 100)}% match.`,
          thumbnail,
          photoHash: canonicalHash,
          matchConfidence: top.confidence,
        };
        dispatch({ type: 'UPSERT_LOG_AND_MEMORY', log, memory });
        return { logId: log.id, matched: true, confidence: top.confidence };
      }

      // No confident memory match — ask the on-device model to identify it
      // instead of guessing randomly. Falls back to a random guess only if
      // the model has nothing confident to say.
      const prediction = await classifyFood(frame);
      const guess: DatabaseFood = prediction?.food ?? randomDatabaseFood();
      const memoryId = makeId();
      const grade = gradeFor(guess);
      const memory: FoodMemoryEntry = {
        id: memoryId,
        ...guess,
        grade,
        photoHash: canonicalHash,
        thumbnail,
        timesLogged: 1,
        lastLoggedAt: now,
        createdAt: now,
        source: prediction ? 'photo' : 'database',
        confirmed: false,
      };
      const log: LogEntry = {
        id: makeId(),
        memoryId,
        name: guess.name,
        grams: guess.typicalGrams,
        kcal: guess.kcal,
        protein: guess.protein,
        carbs: guess.carbs,
        fat: guess.fat,
        fiber: guess.fiber,
        sugar: guess.sugar,
        sodium: guess.sodium,
        grade,
        loggedAt: now,
        note: prediction
          ? `Recognized as ${guess.name} by the on-device model (${Math.round(prediction.probability * 100)}% confidence) — not in your memory yet, tap Fix it if it's wrong.`
          : "New food — the model wasn't confident either. This is a placeholder guess, tap Fix it if it's wrong.",
        thumbnail,
        photoHash: canonicalHash,
        matchConfidence: null,
      };
      dispatch({ type: 'UPSERT_LOG_AND_MEMORY', log, memory });
      return { logId: log.id, matched: false, confidence: null };
    }

    function logFromMemory(memoryId: string) {
      const entry = state.memory.find((m) => m.id === memoryId);
      if (!entry) throw new Error('unknown memory entry');
      const now = Date.now();
      const memory: FoodMemoryEntry = { ...entry, timesLogged: entry.timesLogged + 1, lastLoggedAt: now };
      const log: LogEntry = {
        id: makeId(),
        memoryId: entry.id,
        name: entry.name,
        grams: entry.typicalGrams,
        kcal: entry.kcal,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        fiber: entry.fiber,
        sugar: entry.sugar,
        sodium: entry.sodium,
        grade: entry.grade,
        loggedAt: now,
        note: 'Logged from your food memory.',
        thumbnail: entry.thumbnail,
        photoHash: null,
        matchConfidence: 1,
      };
      dispatch({ type: 'UPSERT_LOG_AND_MEMORY', log, memory });
      return log.id;
    }

    function logFromDatabaseFood(food: DatabaseFood) {
      const now = Date.now();
      const memoryId = makeId();
      const grade = gradeFor(food);
      const memory: FoodMemoryEntry = {
        id: memoryId,
        ...food,
        grade,
        photoHash: null,
        thumbnail: null,
        timesLogged: 1,
        lastLoggedAt: now,
        createdAt: now,
        source: 'manual',
        confirmed: true,
      };
      const log: LogEntry = {
        id: makeId(),
        memoryId,
        name: food.name,
        grams: food.typicalGrams,
        kcal: food.kcal,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        sugar: food.sugar,
        sodium: food.sodium,
        grade,
        loggedAt: now,
        note: 'Added from search.',
        thumbnail: null,
        photoHash: null,
        matchConfidence: null,
      };
      dispatch({ type: 'UPSERT_LOG_AND_MEMORY', log, memory });
      return log.id;
    }

    /** If the log's current food was an unconfirmed, never-reused guess,
     * it's clutter once the log is reassigned elsewhere — drop it, but keep
     * its photo hash so the replacement food recognizes this same photo. */
    function staleGuessId(log: LogEntry): { id: string; photoHash: string | null; thumbnail: string | null } | null {
      const old = state.memory.find((m) => m.id === log.memoryId);
      if (old && !old.confirmed && old.timesLogged <= 1) {
        return { id: old.id, photoHash: old.photoHash, thumbnail: old.thumbnail };
      }
      return null;
    }

    function reassignToMemory(logId: string, entry: FoodMemoryEntry) {
      const log = state.logs.find((l) => l.id === logId);
      if (!log) return;
      const now = Date.now();
      const stale = staleGuessId(log);
      const memory: FoodMemoryEntry = {
        ...entry,
        timesLogged: entry.timesLogged + 1,
        lastLoggedAt: now,
        photoHash: entry.photoHash ?? stale?.photoHash ?? null,
        thumbnail: entry.thumbnail ?? stale?.thumbnail ?? null,
      };
      const newLog: LogEntry = {
        ...log,
        memoryId: entry.id,
        name: entry.name,
        kcal: entry.kcal,
        protein: entry.protein,
        carbs: entry.carbs,
        fat: entry.fat,
        fiber: entry.fiber,
        sugar: entry.sugar,
        sodium: entry.sodium,
        grade: entry.grade,
        note: 'Corrected from your food memory.',
        matchConfidence: 1,
      };
      dispatch({ type: 'REASSIGN_LOG', log: newLog, memory, removeMemoryId: stale?.id });
    }

    function reassignToDatabaseFood(logId: string, food: DatabaseFood) {
      const log = state.logs.find((l) => l.id === logId);
      if (!log) return;
      const now = Date.now();
      const stale = staleGuessId(log);
      const grade = gradeFor(food);
      const memoryId = stale?.id ?? makeId();
      const memory: FoodMemoryEntry = {
        id: memoryId,
        ...food,
        grade,
        photoHash: stale?.photoHash ?? null,
        thumbnail: stale?.thumbnail ?? log.thumbnail,
        timesLogged: 1,
        lastLoggedAt: now,
        createdAt: now,
        source: 'manual',
        confirmed: true,
      };
      const newLog: LogEntry = {
        ...log,
        memoryId,
        name: food.name,
        kcal: food.kcal,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        fiber: food.fiber,
        sugar: food.sugar,
        sodium: food.sodium,
        grade,
        note: 'Corrected via search.',
        matchConfidence: null,
      };
      dispatch({ type: 'REASSIGN_LOG', log: newLog, memory });
    }

    return {
      logFromCapture,
      logFromMemory,
      logFromDatabaseFood,
      reassignToMemory,
      reassignToDatabaseFood,
      setGrams: (logId: string, grams: number) => dispatch({ type: 'SET_GRAMS', logId, grams }),
      deleteLog: (logId: string) => dispatch({ type: 'DELETE_LOG', logId }),
      setGoal: (goal: Partial<Goal>) => dispatch({ type: 'SET_GOAL', goal }),
    };
  }, [state]);

  return <StoreContext.Provider value={{ state, ...api }}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
