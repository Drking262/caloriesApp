import { useEffect, useMemo, useState } from 'react';
import { useCamera } from '../hooks/useCamera';
import { useStore } from '../state/store';
import { sumMacros } from '../lib/nutrition';
import { todaysLogs } from '../lib/selectors';
import { byFrecency } from '../lib/match';
import { SearchSheet } from '../components/SearchSheet';
import type { FoodMemoryEntry, Screen } from '../types';

const SCAN_MS = 550;

export function CameraScreen({
  onLogged,
  onNavigate,
}: {
  onLogged: (logId: string) => void;
  onNavigate: (screen: Screen) => void;
}) {
  const { videoRef, status, start, stop, capture } = useCamera();
  const { state, logFromCapture, logFromMemory, logFromDatabaseFood } = useStore();
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [scanning, setScanning] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    start(facing);
    return stop;
  }, [facing, start, stop]);

  const todays = useMemo(() => todaysLogs(state.logs), [state.logs]);
  const totals = useMemo(() => sumMacros(todays), [todays]);
  const remain = Math.max(0, state.goal.kcal - totals.kcal);

  const topMemory: FoodMemoryEntry | undefined = useMemo(() => byFrecency(state.memory)[0], [state.memory]);
  const lastLog = todays[todays.length - 1];

  function handleShutter() {
    if (scanning) return;
    const shot = capture();
    if (!shot) return;
    setScanning(true);
    window.setTimeout(() => {
      setScanning(false);
      const result = logFromCapture(shot.hashes, shot.thumbnail);
      onLogged(result.logId);
    }, SCAN_MS);
  }

  function handleRepeat() {
    if (!topMemory) return;
    onLogged(logFromMemory(topMemory.id));
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div className="viewfinder">
        {status === 'ready' && <video ref={videoRef} muted playsInline />}
        {status !== 'ready' && (
          <div className="viewfinder-hint">
            {status === 'unsupported' && <>CAMERA NOT AVAILABLE<br />on this device/browser</>}
            {status === 'denied' && <>CAMERA ACCESS DENIED<br />allow it in browser settings</>}
            {(status === 'idle' || status === 'starting') && <>STARTING CAMERA…</>}
            {status === 'error' && <>CAMERA ERROR<br />try again</>}
          </div>
        )}
        <div className="viewfinder-vignette" />
      </div>

      <div style={{ position: 'relative', padding: '14px 16px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="pill" style={{ flex: 1 }}>
          <span className="mono" style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent)' }}>{remain}</span>
          <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-dim)' }}>kcal left today</span>
        </div>
        <button type="button" className="side-btn" onClick={() => onNavigate('history')} title="Streak & history">
          ⚡
        </button>
      </div>

      {scanning && (
        <div className="scan-box">
          <div className="scan-line" />
        </div>
      )}

      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 88, padding: '0 16px 8px' }}>
        <div className="chip-row">
          {topMemory && (
            <button type="button" className="chip" onClick={handleRepeat}>
              Repeat: {topMemory.name}
            </button>
          )}
          <button type="button" className="chip muted" onClick={() => setShowSearch(true)}>
            Search food
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 34, paddingBottom: 18, marginTop: 14 }}>
          <button
            type="button"
            className="side-btn"
            style={lastLog?.thumbnail ? { backgroundImage: `url(${lastLog.thumbnail})`, backgroundSize: 'cover' } : undefined}
            onClick={() => onNavigate('today')}
            title="Today's log"
          >
            {!lastLog?.thumbnail && '☰'}
          </button>
          <button type="button" className="shutter" onClick={handleShutter} disabled={status !== 'ready'}>
            <span>{scanning ? '···' : 'LOG'}</span>
            <div className="shutter-ring" />
          </button>
          <button type="button" className="side-btn" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} title="Flip camera">
            ↺
          </button>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, color: 'var(--text-faint)' }}>
          Shoot first. Nothing to confirm.
        </div>
      </div>

      {showSearch && (
        <SearchSheet
          onClose={() => setShowSearch(false)}
          onPickMemory={(entry) => onLogged(logFromMemory(entry.id))}
          onPickDatabase={(food) => onLogged(logFromDatabaseFood(food))}
        />
      )}
    </div>
  );
}
