import { useMemo } from 'react';
import { useStore } from '../state/store';
import { sumMacros } from '../lib/nutrition';
import { logsForDay } from '../lib/selectors';
import { daysAgo, weekdayLabel } from '../lib/date';

const CHART_MAX_KCAL = 3000;

export function HistoryScreen() {
  const { state } = useStore();

  const week = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => daysAgo(6 - i));
    const todayTs = days[days.length - 1];
    return days.map((ts) => {
      const kcal = sumMacros(logsForDay(state.logs, ts)).kcal;
      return { ts, kcal, day: weekdayLabel(ts), isToday: ts === todayTs };
    });
  }, [state.logs]);

  const loggedDays = week.filter((d) => d.kcal > 0);
  const avgKcal = loggedDays.length ? Math.round(loggedDays.reduce((s, d) => s + d.kcal, 0) / loggedDays.length) : 0;

  const streak = useMemo(() => {
    let n = 0;
    for (let i = 0; i < 60; i++) {
      const ts = daysAgo(i);
      if (sumMacros(logsForDay(state.logs, ts)).kcal > 0) n++;
      else break;
    }
    return n;
  }, [state.logs]);

  const proteinShortDays = useMemo(
    () => week.filter((d) => sumMacros(logsForDay(state.logs, d.ts)).protein < state.goal.protein && d.kcal > 0).length,
    [week, state.logs, state.goal.protein],
  );

  return (
    <div style={{ padding: '18px 20px 96px' }}>
      <div style={{ fontWeight: 700, fontSize: 20 }}>Last 7 days</div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 18 }}>
        <div className="mono" style={{ fontWeight: 800, fontSize: 56, lineHeight: 0.85, letterSpacing: '-0.03em' }}>{avgKcal}</div>
        <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.3, color: 'var(--text-dim)' }}>
          daily avg
          <br />
          across {loggedDays.length || 0} logged day{loggedDays.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="week-bars" style={{ marginTop: 26 }}>
        {week.map((d) => (
          <div className="week-bar-col" key={d.ts}>
            <div className="mono" style={{ fontWeight: 600, fontSize: 10, color: 'var(--text-faint)' }}>{d.kcal || ''}</div>
            <div
              className={`week-bar${d.isToday ? ' today' : ''}`}
              style={{ height: `${Math.max(4, Math.round((d.kcal / CHART_MAX_KCAL) * 150))}px` }}
            />
            <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--text-faint)' }}>{d.day}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 26, display: 'flex', gap: 8 }}>
        <div className="card">
          <div className="mono" style={{ fontWeight: 700, fontSize: 20, color: 'var(--accent)' }}>{streak}</div>
          <div style={{ fontWeight: 500, fontSize: 11, lineHeight: 1.3, color: 'var(--text-dim)', marginTop: 8 }}>day logging streak</div>
        </div>
        <div className="card">
          <div className="mono" style={{ fontWeight: 700, fontSize: 20 }}>{state.memory.length}</div>
          <div style={{ fontWeight: 500, fontSize: 11, lineHeight: 1.3, color: 'var(--text-dim)', marginTop: 8 }}>foods in your memory</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, color: '#a9aeb6', fontSize: 13, lineHeight: 1.55 }}>
        {loggedDays.length === 0
          ? 'Log a few days to start seeing trends here.'
          : proteinShortDays > 0
            ? `Protein is short ${proteinShortDays} day${proteinShortDays === 1 ? '' : 's'} out of ${loggedDays.length}.`
            : 'Protein target hit on every logged day this week.'}
      </div>
    </div>
  );
}
