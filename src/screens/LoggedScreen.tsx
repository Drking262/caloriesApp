import { useEffect, useMemo, useState } from 'react';
import { useStore, type CaptureResultInfo, type Alternative } from '../state/store';
import { scaledMacros, sumMacros } from '../lib/nutrition';
import { todaysLogs } from '../lib/selectors';

const AUTO_CLOSE_MS = 6000;
const UNDO_TOAST_MS = 6000;

export function LoggedScreen({
  logId,
  info,
  alternatives,
  onFixIt,
  onFixItToAlternative,
  onUndo,
  onDone,
}: {
  logId: string;
  info: CaptureResultInfo | null;
  /** CLIP runner-up labels, shown as one-tap alternatives */
  alternatives: Alternative[];
  onFixIt: () => void;
  /** immediate reassignment to a classifier runner-up — no search detour */
  onFixItToAlternative: (alt: Alternative) => void;
  onUndo: () => void;
  onDone: () => void;
}) {
  const { state, confirmCaptureMatch } = useStore();
  const log = state.logs.find((l) => l.id === logId);
  const [showUndoToast, setShowUndoToast] = useState(false);

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
    onUndo(); // App.routes back to camera; the store keeps the log until confirmed elsewhere
    setShowUndoToast(true);
    window.setTimeout(() => setShowUndoToast(false), UNDO_TOAST_MS);
  }

  const needsConfirm = info?.needsConfirm ?? false;
  const verification = info?.verification;
  const pct = info?.confidence != null ? Math.round(info.confidence * 100) : null;

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

        {/* Mid-band memory matches (fix #7): logged already, but needs a yes/no
            so a similar-plated wrong dish doesn't silently teach the memory. */}
        {needsConfirm && (
          <div className="toast visible" role="alert" style={{ position: 'static', margin: '14px 0 0', transform: 'none' }}>
            <div className="toast-title">Is this {log.name}?</div>
            <div className="toast-body">Matched from memory{pct != null ? ` · ${pct}%` : ''} — not sure enough to keep it without asking.</div>
            <div className="toast-actions">
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={() => confirmCaptureMatch(logId)}>
                Yes, that's it
              </button>
              <button type="button" className="btn" style={{ flex: 1 }} onClick={onFixIt}>
                Not this
              </button>
            </div>
          </div>
        )}

        {/* Weak far-band hint (19–26): one-tap "Same as X?" offered without
            having committed the match. */}
        {!needsConfirm && verification && (
          <div className="toast visible" style={{ position: 'static', margin: '14px 0 0', transform: 'none' }}>
            <div className="toast-body">Same as {log.name}?</div>
            <div className="toast-actions">
              <button type="button" className="btn" style={{ flex: 1 }} onClick={() => confirmCaptureMatch(logId)}>
                Yes
              </button>
              <button type="button" className="btn" style={{ flex: 1 }} onClick={onFixIt}>
                No
              </button>
            </div>
          </div>
        )}

        {/* Couldn't classify at all → go straight to the correction flow
            instead of leaving a placeholder in memory. */}
        {info?.route === 'unknown' && (
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={onFixIt}>
              Tell me what this is
            </button>
          </div>
        )}

        {/* CLIP runner-up labels (fix #5): if the top pick was wrong, the
            correct food is usually second or third — one tap opens search
            pre-focused instead of making the user type. */}
        {alternatives.length > 0 && !needsConfirm && info?.route === 'clip' && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-faint)', marginBottom: 6, letterSpacing: '0.05em' }}>
              OR WAS IT
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {alternatives.map((alt) => (
                <button key={alt.label} type="button" className="chip" onClick={() => onFixItToAlternative(alt)}>
                  {alt.displayName}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={onFixIt}>Fix it</button>
          <button type="button" className="btn btn-muted" onClick={handleUndo}>Undo</button>
          <button type="button" className="btn btn-primary" style={{ flex: 1.3 }} onClick={onDone}>Done</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, fontWeight: 500, color: 'var(--text-faint)' }}>
          {remain} kcal left. Auto-closing.
        </div>
      </div>

      {/* Undo affordance (fix #7's correction path): deleting the wrong log
          immediately is destructive — toast keeps a way back for a few seconds. */}
      {showUndoToast && (
        <div className="toast visible" style={{ position: 'absolute', left: 16, right: 16, bottom: 24 }}>
          <div className="toast-body">Log removed.</div>
          <div className="toast-actions">
            <button type="button" className="toast-undo" onClick={() => { setShowUndoToast(false); onDone(); }}>
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
