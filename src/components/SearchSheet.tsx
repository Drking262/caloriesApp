import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { byFrecency } from '../lib/match';
import { searchDatabase, type DatabaseFood } from '../lib/foodDatabase';
import { searchNutrition } from '../lib/nutritionApi';
import type { FoodMemoryEntry } from '../types';

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 500;

interface SearchSheetProps {
  onClose: () => void;
  onPickMemory: (entry: FoodMemoryEntry) => void;
  onPickDatabase: (food: DatabaseFood) => void;
}

export function SearchSheet({ onClose, onPickMemory, onPickDatabase }: SearchSheetProps) {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [apiHits, setApiHits] = useState<DatabaseFood[]>([]);
  const [apiOffline, setApiOffline] = useState(false);

  const memoryHits = useMemo(() => {
    const ranked = byFrecency(state.memory);
    const q = query.trim().toLowerCase();
    return (q ? ranked.filter((m) => m.name.toLowerCase().includes(q)) : ranked).slice(0, 8);
  }, [state.memory, query]);

  const memoryNames = useMemo(() => new Set(state.memory.map((m) => m.name.toLowerCase())), [state.memory]);

  const databaseHits = useMemo(
    () => searchDatabase(query).filter((f) => !memoryNames.has(f.name.toLowerCase())).slice(0, 8),
    [query, memoryNames],
  );

  // Live global search: debounced so typing doesn't hammer USDA's rate
  // limit (30 req/hour on the shared demo key), cancels a stale request
  // when the query changes again before it resolves, and skips the network
  // call entirely when offline rather than firing a request doomed to fail.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LENGTH) {
      setApiHits([]);
      setApiOffline(false);
      return;
    }
    if (!navigator.onLine) {
      setApiHits([]);
      setApiOffline(true);
      return;
    }
    setApiOffline(false);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchNutrition(q, { signal: controller.signal }).then((results) => {
        if (!controller.signal.aborted) setApiHits(results);
      });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const excludeFromGlobal = useMemo(
    () => new Set([...memoryNames, ...databaseHits.map((f) => f.name.toLowerCase())]),
    [memoryNames, databaseHits],
  );
  const globalHits = useMemo(
    () => apiHits.filter((f) => !excludeFromGlobal.has(f.name.toLowerCase())),
    [apiHits, excludeFromGlobal],
  );

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <input
          autoFocus
          className="sheet-input"
          placeholder="Search food…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="sheet-list">
          {memoryHits.length > 0 && <div className="sheet-section">FROM YOUR MEMORY — MOST LIKELY</div>}
          {memoryHits.map((m) => (
            <button
              key={m.id}
              type="button"
              className="list-item"
              onClick={() => {
                onPickMemory(m);
                onClose();
              }}
            >
              <div className="list-thumb" style={m.thumbnail ? { backgroundImage: `url(${m.thumbnail})` } : undefined} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{m.name}</div>
                <div className="sub">Logged {m.timesLogged}× · {m.grade}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="kcal">{m.kcal}</div>
                <div className="sub" style={{ marginTop: 2 }}>kcal/100g</div>
              </div>
            </button>
          ))}

          {databaseHits.length > 0 && <div className="sheet-section">GENERIC RESULTS</div>}
          {databaseHits.map((f) => (
            <button
              key={f.name}
              type="button"
              className="list-item"
              onClick={() => {
                onPickDatabase(f);
                onClose();
              }}
            >
              <div className="list-thumb" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{f.name}</div>
                <div className="sub">not in your memory yet</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="kcal">{f.kcal}</div>
                <div className="sub" style={{ marginTop: 2 }}>kcal/100g</div>
              </div>
            </button>
          ))}

          {apiOffline && (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '12px 4px' }}>
              Global search unavailable — check your connection.
            </div>
          )}
          {globalHits.length > 0 && <div className="sheet-section">GLOBAL DATABASE</div>}
          {globalHits.map((f) => (
            <button
              key={`global-${f.name}`}
              type="button"
              className="list-item"
              onClick={() => {
                onPickDatabase(f);
                onClose();
              }}
            >
              <div className="list-thumb" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{f.name}</div>
                <div className="sub">from USDA FoodData Central</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="kcal">{f.kcal}</div>
                <div className="sub" style={{ marginTop: 2 }}>kcal/100g</div>
              </div>
            </button>
          ))}

          {memoryHits.length === 0 && databaseHits.length === 0 && globalHits.length === 0 && !apiOffline && (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '12px 4px' }}>No matches.</div>
          )}
        </div>
      </div>
    </div>
  );
}
