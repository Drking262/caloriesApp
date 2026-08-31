import { useEffect, useMemo } from 'react';
import { useStore } from '../state/store';
import { scaledMacros, sumMacros } from '../lib/nutrition';
import { todaysLogs } from '../lib/selectors';

const AUTO_CLOSE_MS = 4500;

export function LoggedScreen({
  logId,
  onFixIt,
  onUndo,
  onDone,
}: {
  logId: string;
  onFixIt: () => void;
  onUndo: () => void;
  onDone: () => void;
}) {
  const { state, deleteLog } = useStore();
  const log = state.logs.find((l) => l.id === logId);

  useEffect(() => {
    const t = window.setTimeout(onDone, AUTO_CLOSE_MS);
    return () => window.clearTimeout(t);
  }, [logId, onDone]);

  const todays = useMemo(() => todaysLogs(state.logs), [state.logs]);
  const totals = useMemo(() => sumMacros(todays), [todays]);
  const remain = Math.max(0, state.goal.kcal - totals.kcal);

  if (!log) return null;
  const m = scaledMacros(log);

  function handleUndo() {
    deleteLog(logId);
    onUndo();
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div className="hero-photo" style={log.thumbnail ? { backgroundImage: `url(${log.thumbnail})` } : undefined}>
        <div className="hero-badge">LOGGED</div>
      </div>
      <div className="popin" style={{ flex: 1, padding: '0 20px', marginTop: -26, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div className="mono" style={{ fontWeight: 800, fontSize: 62, lineHeight: 0.88, letterSpacing: '-0.03em' }}>
            {m.kcal}
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-dim)', paddingBottom: 8 }}>kcal · {log.name}</div>
        </div>

        <div className="macro-row" style={{ marginTop: 16 }}>
          <div className="macro-cell">
            <div className="value">{m.protein}g</div>
            <div className="label">PROTEIN</div>
          </div>
          <div className="macro-cell">
            <div className="value">{m.carbs}g</div>
            <div className="label">CARBS</div>
          </div>
          <div className="macro-cell">
            <div className="value">{m.fat}g</div>
            <div className="label">FAT</div>
          </div>
          <div className="macro-cell grade">
            <div className="value">{log.grade}</div>
            <div className="label">QUAL</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 14, color: '#a9aeb6', fontSize: 13, lineHeight: 1.5 }}>{log.note}</div>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={onFixIt}>Fix it</button>
          <button type="button" className="btn btn-muted" onClick={handleUndo}>Undo</button>
          <button type="button" className="btn btn-primary" style={{ flex: 1.3 }} onClick={onDone}>Done</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, fontWeight: 500, color: 'var(--text-faint)' }}>
          {remain} kcal left. Auto-closing.
        </div>
      </div>
    </div>
  );
}
