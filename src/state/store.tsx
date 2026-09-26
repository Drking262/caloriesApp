import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type { AppState, FoodMemoryEntry, Goal, LogEntry } from '../types';
import { loadState, saveState } from '../lib/storage';
import { gradeFor } from '../lib/grade';
import { makeId } from '../lib/id';
import {
  bestMatch,
  AUTO_MATCH_THRESHOLD,
  AUTO_ACCEPT_DISTANCE,
  UNCERTAIN_REJECT_DISTANCE,
  shouldLearnHashVariant,
} from '../lib/match';
import { HASH_VARIANTS_PER_ENTRY } from '../lib/perceptualHash';
import { FOOD_LABEL_MAP } from '../lib/foodLabels';
import { coarseForFineLabel } from '../lib/foodData/coarse';
import type { DatabaseFood } from '../lib/foodDatabase';
import { classifyFood, classifyCoarseFood } from '../lib/foodClassifier';

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

export type DetectionRoute = 'memory-auto' | 'memory-confirm' | 'clip' | 'clip-coarse' | 'unknown';

export interface Alternative {
  label: string;
  displayName: string;
  score: number;
}

export interface CaptureVerification {
  entryId: string;
  confidence: number;
  distance: number;
}

export interface CaptureResultInfo {
  logId: string;
  route: DetectionRoute;
  confidence: number | null;
  alternatives: Alternative[];
  needsConfirm: boolean;
  undoLogId: string | null;
  /** same-photoHinted memory match in the 14–26 "not sure" band — LoggedScreen
   * offers a one-tap "Same as {name}?" instead of silently trusting it */
  verification?: CaptureVerification;
}

interface StoreApi {
  state: AppState;
  logFromCapture: (
    hashes: string[],
    thumbnail: string,
    frame: HTMLCanvasElement,
  ) => Promise<CaptureResultInfo>;
  confirmCaptureMatch: (logId: string) => void;
  /** Re-point a log at a CLIP runner-up without the search detour — the
   *  alternative is already known to be in FOOD_LABEL_MAP, and the photo
   *  hash the wrong guess held transfers so the now-correct food matches
   *  this same plate next time (the whole point of the memory). */
  reassignToLabel: (logId: string, label: string) => void;
  undoLog: (logId: string) => void;
  logFromMemory: (memoryId: string) => string;
  logFromDatabaseFood: (food: DatabaseFood) => string;
  reassignToMemory: (logId: string, entry: FoodMemoryEntry) => void;
  reassignToDatabaseFood: (logId: string, food: DatabaseFood) => void;
  setGrams: (logId: string, grams: number) => void;
  deleteLog: (logId: string) => void;
  setGoal: (patch: Partial<Goal>) => void;
}

/** Coarse-category fallbacks: a photo that scores fine-label as "food" but
 * clears no specific dish is more honestly logged as the category than force-
 * fitted to the nearest specific dish. */
export const COARSE_UNKNOWN_FOOD: DatabaseFood = {
  name: 'Unidentified dish',
  typicalGrams: 300,
  kcal: 150,
  protein: 6,
  carbs: 15,
  fat: 7,
  fiber: 1.5,
  sugar: 3,
  sodium: 250,
};

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => saveState(state), [state]);

  const api = useMemo<Omit<StoreApi, 'state'>>(() => {
    function toAlternatives(prediction: { topK: { label: string; score: number }[] } | null): Alternative[] {
      if (!prediction) return [];
      return prediction.topK.slice(1, 4).map((t) => ({
        label: t.label,
        displayName: FOOD_LABEL_MAP[t.label]?.name ?? t.label,
        score: t.score,
      }));
    }

    async function logFromCapture(hashes: string[], thumbnail: string, frame: HTMLCanvasElement): Promise<CaptureResultInfo> {
      const top = bestMatch(hashes, state.memory);
      const now = Date.now();
      const canonicalHash = hashes[0]; // unrotated — what gets stored as a memory's reference photo

      // ---- Memory layer: confident shape match within a trusted band --------
      if (top && top.distance <= AUTO_MATCH_THRESHOLD) {
        const entry = top.entry;
        const memoryBase: FoodMemoryEntry = { ...entry, timesLogged: entry.timesLogged + 1, lastLoggedAt: now };

        // Fix #7: mid-band (14–19) matches log immediately (camera-fast UX is
        // the point) but flag for explicit confirmation; far-band (19–26)
        // carries a verification hint for the Logged screen.
        const needsConfirm = top.distance > AUTO_ACCEPT_DISTANCE;
        const verification: CaptureVerification | undefined =
          !needsConfirm && top.distance <= UNCERTAIN_REJECT_DISTANCE
            ? { entryId: entry.id, confidence: top.confidence, distance: top.distance }
            : undefined;

        // Fix #6: absorb this sighting's hash as an additional reference when
        // CLIP also judged it to be the same food (or when CLIP is offline and
        // this entry was previously confirmed) — fixes plating drift without
        // letting a striped tablecloth teach the memory new shapes.
        let memory = memoryBase;
        if (
          !needsConfirm &&
          shouldLearnHashVariant(top.distance, null, entry.confirmed) &&
          entry.photoHashes.length < HASH_VARIANTS_PER_ENTRY &&
          !entry.photoHashes.includes(canonicalHash) &&
          canonicalHash !== entry.photoHash
        ) {
          memory = { ...memoryBase, photoHashes: [...entry.photoHashes, canonicalHash] };
        }

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
          note:
            `Matched from your food memory · ${Math.round(top.confidence * 100)}% match.` +
            (needsConfirm ? ' · pending your confirmation' : ''),
          thumbnail,
          photoHash: canonicalHash,
          matchConfidence: top.confidence,
        };

        dispatch({ type: 'UPSERT_LOG_AND_MEMORY', log, memory });
        return {
          logId: log.id,
          route: needsConfirm ? 'memory-confirm' : 'memory-auto',
          confidence: top.confidence,
          alternatives: [],
          needsConfirm,
          undoLogId: log.id,
          verification,
        };
      }

      // ---- CLIP layer: both score calls run on every photo ------------------
      // Coarse runs alongside so an ambiguous fine prediction still tells us
      // "this is food of category X" instead of falling straight to unknown.
      const [prediction, coarse] = await Promise.all([
        classifyFood(frame),
        classifyCoarseFood(frame).catch(() => null),
      ]);

      if (prediction) {
        const guess: DatabaseFood = prediction.food;
        const memoryId = makeId();
        const grade = gradeFor(guess);
        const enriched = prediction.liveEnriched
          ? ' Macros verified against USDA FoodData Central.'
          : '';
        const memory: FoodMemoryEntry = {
          id: memoryId,
          ...guess,
          grade,
          photoHash: canonicalHash,
          photoHashes: [],
          thumbnail,
          timesLogged: 1,
          lastLoggedAt: now,
          createdAt: now,
          source: 'photo',
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
          note: `Recognized as ${guess.name} by the on-device model (${Math.round(
            prediction.probability * 100,
          )}%)${enriched} — not in your memory yet, tap Fix it if it's wrong.`,
          thumbnail,
          photoHash: canonicalHash,
          matchConfidence: null,
        };
        dispatch({ type: 'UPSERT_LOG_AND_MEMORY', log, memory });
        return {
          logId: log.id,
          route: 'clip',
          confidence: prediction.probability,
          alternatives: toAlternatives(prediction),
          needsConfirm: false,
          undoLogId: null,
        };
      }

      // ---- Coarse fallback: say "something food-like of category X" ---------
      // rather than a confidently wrong specific dish (the old behavior).
      if (coarse) {
        const category = coarseForFineLabel(coarse.category);
        const guess: DatabaseFood = category?.typicalFood ?? COARSE_UNKNOWN_FOOD;
        const memoryId = makeId();
        const grade = gradeFor(guess);
        const memory: FoodMemoryEntry = {
          id: memoryId,
          ...guess,
          grade,
          photoHash: canonicalHash,
          photoHashes: [],
          thumbnail,
          timesLogged: 1,
          lastLoggedAt: now,
          createdAt: now,
          source: 'photo',
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
          note: `Couldn't pin it down — looks like a ${coarse.category} (${Math.round(
            coarse.probability * 100,
          )}%). Estimate based on a typical ${coarse.category}; tap Fix it to correct.`,
          thumbnail,
          photoHash: canonicalHash,
          matchConfidence: null,
        };
        dispatch({ type: 'UPSERT_LOG_AND_MEMORY', log, memory });
        return { logId: log.id, route: 'clip-coarse', confidence: coarse.probability, alternatives: [], needsConfirm: false, undoLogId: null };
      }

      // ---- Unknown: honest placeholder, opens the correction flow -----------
      // A random dish (the old fallback) teaches nothing and pollutes memory
      // with garbage entries the frecency ranking then amplifies.
      const memoryId = makeId();
      const grade = gradeFor(COARSE_UNKNOWN_FOOD);
      const memory: FoodMemoryEntry = {
        id: memoryId,
        ...COARSE_UNKNOWN_FOOD,
        grade,
        photoHash: canonicalHash,
        photoHashes: [],
        thumbnail,
        timesLogged: 1,
        lastLoggedAt: now,
        createdAt: now,
        source: 'photo',
        confirmed: false,
      };
      const log: LogEntry = {
        id: makeId(),
        memoryId,
        ...COARSE_UNKNOWN_FOOD,
        grams: COARSE_UNKNOWN_FOOD.typicalGrams,
        grade,
        loggedAt: now,
        note: "Couldn't identify this dish — macros are a rough placeholder until you correct it. Tap Fix it to pick the right food.",
        thumbnail,
        photoHash: canonicalHash,
        matchConfidence: null,
      };
      dispatch({ type: 'UPSERT_LOG_AND_MEMORY', log, memory });
      return { logId: log.id, route: 'unknown', confidence: null, alternatives: [], needsConfirm: false, undoLogId: null };
    }

    function confirmCaptureMatch(logId: string) {
      const log = state.logs.find((l) => l.id === logId);
      if (!log || log.matchConfidence == null) return;
      const memory = state.memory.find((m) => m.id === log.memoryId);
      if (!memory) return;
      const now = Date.now();
      const newLog: LogEntry = {
        ...log,
        note: log.note.replace(/ · pending your confirmation$/, '') + ' · confirmed by you.',
      };
      dispatch({ type: 'REASSIGN_LOG', log: newLog, memory: { ...memory, lastLoggedAt: now, confirmed: true } });
    }

    function reassignToLabel(logId: string, label: string) {
      const log = state.logs.find((l) => l.id === logId);
      if (!log) return;
      const food = FOOD_LABEL_MAP[label];
      if (!food) return;
      const now = Date.now();
      const stale = staleGuessId(log);
      const grade = gradeFor(food);
      const memoryId = stale?.id ?? makeId();
      const memory: FoodMemoryEntry = {
        id: memoryId,
        ...food,
        grade,
        // The wrong guess held this photo's hashes — the now-correct food
        // gets them, so it recognizes this same plate next time.
        photoHash: stale?.photoHash ?? log.photoHash,
        photoHashes: stale?.photoHashes ?? [],
        thumbnail: stale?.thumbnail ?? log.thumbnail,
        timesLogged: 1,
        lastLoggedAt: now,
        createdAt: now,
        source: 'photo',
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
        note: `Corrected to ${food.name} from the model's suggestions.`,
        matchConfidence: null,
      };
      dispatch({ type: 'REASSIGN_LOG', log: newLog, memory });
    }

    function undoLog(logId: string) {
      dispatch({ type: 'DELETE_LOG', logId });
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
        photoHashes: [],
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
    function staleGuessId(log: LogEntry): { id: string; photoHash: string | null; photoHashes: string[]; thumbnail: string | null } | null {
      const old = state.memory.find((m) => m.id === log.memoryId);
      if (old && !old.confirmed && old.timesLogged <= 1) {
        return { id: old.id, photoHash: old.photoHash, photoHashes: old.photoHashes, thumbnail: old.thumbnail };
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
        photoHashes: (entry.photoHashes?.length ?? 0) > 0 ? entry.photoHashes : stale?.photoHashes ?? [],
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
        photoHashes: stale?.photoHashes ?? [],
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
      confirmCaptureMatch,
      reassignToLabel,
      undoLog,
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
