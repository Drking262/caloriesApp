import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { pct, scaledMacros, sumMacros } from '../lib/nutrition';
import { todaysLogs } from '../lib/selectors';
import { formatTime } from '../lib/date';

export function TodayScreen({ onOpenLog }: { onOpenLog: (logId: string) => void }) {
  const { state, setGoal } = useStore();
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(String(state.goal.kcal));

  const todays = useMemo(() => todaysLogs(state.logs), [state.logs]);
  const totals = useMemo(() => sumMacros(todays), [todays]);
  const remain = Math.max(0, state.goal.kcal - totals.kcal);
  const eatenPct = pct(totals.kcal, state.goal.kcal);

  const avgGradeScore = useMemo(() => {
    if (todays.length === 0) return null;
    const order = ['D', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A'];
    const avgIdx = todays.reduce((sum, l) => sum + order.indexOf(l.grade), 0) / todays.length;
    return order[Math.round(avgIdx)];
  }, [todays]);

  function saveGoal() {
    const n = parseInt(goalInput, 10);
    if (Number.isFinite(n) && n > 0) setGoal({ kcal: n });
    setEditingGoal(false);
  }

  return (
    <div style={{ padding: '18px 20px 96px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 700, fontSize: 20 }}>Today</div>
        <div className="mono" style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-dim)' }}>{todays.length} logs</div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div className="big-number">{remain}</div>
        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, color: 'var(--text-dim)', paddingBottom: 8 }}>
          kcal left
          <br />
          of{' '}
          {editingGoal ? (
            <input
              autoFocus
              className="mono"
              style={{ width: 64, background: 'var(--surface-2)', border: '1px solid var(--border-strong)', borderRadius: 6, color: 'var(--text)', padding: '2px 6px' }}
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              onBlur={saveGoal}
              onKeyDown={(e) => e.key === 'Enter' && saveGoal()}
            />
          ) : (
            <button type="button" onClick={() => { setGoalInput(String(state.goal.kcal)); setEditingGoal(true); }} style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>
              {state.goal.kcal}
            </button>
          )}
        </div>
      </div>

      <div className="track" style={{ height: 10, marginTop: 16 }}>
        <span style={{ width: `${eatenPct}%` }} />
      </div>

      <div className="macro-grid" style={{ marginTop: 18 }}>
        <div className="macro-tile">
          <div className="stat-label">PROTEIN</div>
          <div className="value">{totals.protein}g</div>
          <div className="track"><span style={{ width: `${pct(totals.protein, state.goal.protein)}%` }} /></div>
        </div>
        <div className="macro-tile">
          <div className="stat-label">CARBS</div>
          <div className="value">{totals.carbs}g</div>
          <div className="track"><span style={{ width: `${pct(totals.carbs, state.goal.carbs)}%`, background: 'var(--amber)' }} /></div>
        </div>
        <div className="macro-tile">
          <div className="stat-label">FAT</div>
          <div className="value">{totals.fat}g</div>
          <div className="track"><span style={{ width: `${pct(totals.fat, state.goal.fat)}%`, background: 'var(--text-dim)' }} /></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="stat-label">MICROS WORTH WATCHING</div>
          {avgGradeScore && <div className="mono" style={{ fontWeight: 700, fontSize: 11, color: 'var(--accent)' }}>{avgGradeScore}</div>}
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
          <MicroStat label="Fiber" value={`${totals.fiber}g`} />
          <MicroStat label="Sodium" value={`${totals.sodium}mg`} color="var(--amber)" />
          <MicroStat label="Sugar" value={`${totals.sugar}g`} />
        </div>
      </div>

      <div style={{ marginTop: 22 }} className="stat-label">LOGGED</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {todays.length === 0 && (
          <div style={{ color: 'var(--text-faint)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
            Nothing logged yet. Shoot your first plate.
          </div>
        )}
        {[...todays].reverse().map((log) => {
          const m = scaledMacros(log);
          return (
            <button key={log.id} type="button" className="list-item" onClick={() => onOpenLog(log.id)}>
              <div className="list-thumb" style={log.thumbnail ? { backgroundImage: `url(${log.thumbnail})` } : undefined} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="name">{log.name}</div>
                <div className="sub">{formatTime(log.loggedAt)} · P{m.protein} C{m.carbs} F{m.fat} · {log.grade}</div>
              </div>
              <div className="kcal">{m.kcal}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MicroStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="mono" style={{ fontWeight: 700, fontSize: 15, color: color ?? 'var(--text)' }}>{value}</div>
      <div style={{ fontWeight: 500, fontSize: 10, color: 'var(--text-faint)', marginTop: 5 }}>{label}</div>
    </div>
  );
}
