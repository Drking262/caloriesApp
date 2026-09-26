import { useState } from 'react';
import { useStore } from '../state/store';
import { scaledMacros } from '../lib/nutrition';
import { formatTime } from '../lib/date';
import { SearchSheet } from '../components/SearchSheet';

const STEP = 10;
const MIN_GRAMS = 10;
const MAX_GRAMS = 2000;

/** A runner-up food suggestion shown for one-tap correction — what the
 * classifier thought this might have been instead (FoodPrediction.topK,
 * minus the label that already won) when the logged food looks wrong. */
export interface DetailAlternative {
  /** display-ready food name — e.g. what FOOD_LABEL_MAP resolves the raw
   * CLIP label into ("Svíčková", not "svickova (Czech dish)") */
  label: string;
  /** classifier probability 0–1; displayed small so the user can tell a
   * confident runner-up from a long shot */
  score: number;
}

export function DetailScreen({
  logId,
  onBack,
  alternatives,
}: {
  logId: string;
  onBack: () => void;
  /** INTEGRATION: the main thread passes the classifier's runner-up labels
   * into here (via App.tsx / the logged-detail handoff) in this shape. */
  alternatives?: DetailAlternative[];
}) {
  const { state, setGrams, reassignToMemory, reassignToDatabaseFood, deleteLog } = useStore();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gramsInput, setGramsInput] = useState<string | null>(null);

  const log = state.logs.find((l) => l.id === logId);
  if (!log) return null;
  const m = scaledMacros(log);

  function clamp(n: number) {
    return Math.min(MAX_GRAMS, Math.max(MIN_GRAMS, Math.round(n)));
  }

  function nudge(delta: number) {
    setGrams(logId, clamp(log!.grams + delta));
  }

  function commitGramsInput() {
    if (gramsInput !== null) {
      const n = parseInt(gramsInput, 10);
      if (Number.isFinite(n)) setGrams(logId, clamp(n));
    }
    setGramsInput(null);
  }

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: 'var(--bg)', paddingBottom: 96 }}>
      <div className="hero-photo short" style={log.thumbnail ? { backgroundImage: `url(${log.thumbnail})` } : undefined}>
        <button type="button" className="back-btn" onClick={onBack}>←</button>
      </div>

      <div style={{ padding: '18px 20px' }}>
        <div style={{ fontWeight: 700, fontSize: 22, lineHeight: 1.15 }}>{log.name}</div>
        <div className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-faint)', marginTop: 8 }}>
          {log.matchConfidence == null ? 'Manually added' : `Matched from memory · ${Math.round(log.matchConfidence * 100)}%`} · {formatTime(log.loggedAt)}
        </div>

        <div className="card" style={{ marginTop: 22, borderRadius: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="stat-label">AMOUNT EATEN</div>
            <div className="mono" style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-dim)' }}>
              {log.kcal} kcal / 100g
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <button type="button" className="portion-btn" style={{ flex: 'none', width: 44 }} onClick={() => nudge(-STEP)}>−</button>
            <input
              className="sheet-input mono"
              style={{ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 700 }}
              inputMode="numeric"
              value={gramsInput ?? log.grams}
              onChange={(e) => setGramsInput(e.target.value.replace(/[^0-9]/g, ''))}
              onBlur={commitGramsInput}
              onKeyDown={(e) => e.key === 'Enter' && commitGramsInput()}
            />
            <div style={{ color: 'var(--text-dim)', fontWeight: 600, fontSize: 13 }}>g</div>
            <button type="button" className="portion-btn" style={{ flex: 'none', width: 44 }} onClick={() => nudge(STEP)}>+</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 18 }}>
            <div className="mono" style={{ fontWeight: 800, fontSize: 44, lineHeight: 0.9, letterSpacing: '-0.03em' }}>{m.kcal}</div>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-dim)', paddingBottom: 5 }}>kcal</div>
          </div>
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <MacroRow label="Protein" value={`${m.protein} g`} />
          <MacroRow label="Carbs" value={`${m.carbs} g`} />
          <MacroRow label="Fat" value={`${m.fat} g`} />
          <MacroRow label="Fiber" value={`${m.fiber} g`} />
          <MacroRow label="Sugar" value={`${m.sugar} g`} />
          <MacroRow label="Sodium" value={`${m.sodium} mg`} />
          <MacroRow label="Quality score" value={log.grade} />
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-faint)', lineHeight: 1.5 }}>
          Calculated from this food's nutrition per 100g × grams eaten ÷ 100. Adjust the amount above — everything else follows.
        </div>

        <button type="button" className="btn btn-primary" style={{ marginTop: 18, display: 'block', width: '100%' }} onClick={() => setShowSearch(true)}>
          Not the right food? Fix it
        </button>

        {/* Runner-up suggestions from the classifier, when they were passed
            in. A chip intentionally does NOT reassign the log directly —
            there is no label→memory resolution path short of SearchSheet's
            layering (memory → local DB → live USDA) — but it opens the sheet
            pre-filled with the suggestion, so the correction is one tap. */}
        {alternatives && alternatives.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="stat-label" style={{ marginBottom: 8 }}>OR WAS IT</div>
            <div className="chip-row">
              {alternatives.map((alt) => (
                <button key={alt.label} type="button" className="chip" onClick={() => { setSearchQuery(alt.label); setShowSearch(true); }}>
                  {alt.label}
                  <span className="mono" style={{ marginLeft: 6, fontWeight: 500, fontSize: 10, color: 'var(--text-faint)' }}>
                    {Math.round(alt.score * 100)}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          style={{ marginTop: 10, padding: 14, width: '100%', textAlign: 'center', fontWeight: 600, fontSize: 13, color: 'var(--text-faint)' }}
          onClick={() => { deleteLog(logId); onBack(); }}
        >
          Delete this log
        </button>
      </div>

      {showSearch && (
        <SearchSheet
          initialQuery={searchQuery}
          onClose={() => { setShowSearch(false); setSearchQuery(''); }}
          onPickMemory={(entry) => reassignToMemory(logId, entry)}
          onPickDatabase={(food) => reassignToDatabaseFood(logId, food)}
        />
      )}
    </div>
  );
}

function MacroRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="field-row">
      <div className="k">{label}</div>
      <div className="v">{value}</div>
    </div>
  );
}
