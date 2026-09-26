import { useCallback, useState } from 'react';
import { StoreProvider, useStore, type CaptureResultInfo, type Alternative } from './state/store';
import { BottomTabs } from './components/BottomTabs';
import { CameraScreen } from './screens/CameraScreen';
import { LoggedScreen } from './screens/LoggedScreen';
import { TodayScreen } from './screens/TodayScreen';
import { DetailScreen } from './screens/DetailScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import type { Screen } from './types';

function Shell() {
  const { undoLog, reassignToLabel } = useStore();
  const [screen, setScreen] = useState<Screen>('camera');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [captureInfo, setCaptureInfo] = useState<CaptureResultInfo | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);

  const openLog = useCallback((logId: string, next: Screen = 'detail') => {
    setSelectedLogId(logId);
    setScreen(next);
  }, []);

  const onCameraLogged = useCallback(
    (logId: string, info: CaptureResultInfo) => {
      setCaptureInfo(info);
      setAlternatives(info.alternatives);
      openLog(logId, 'logged');
    },
    [openLog],
  );
  const onOpenLog = useCallback((logId: string) => openLog(logId, 'detail'), [openLog]);
  const onFixIt = useCallback(() => setScreen('detail'), []);
  const onUndo = useCallback(() => {
    // Route back to camera; actual deletion is the store's business (the
    // LoggedScreen's undo toast exists so a mid-band mis-log isn't silently
    // persisted while the user hesitates).
    setScreen('camera');
  }, []);
  const onDone = useCallback(() => {
    setCaptureInfo(null);
    setAlternatives([]);
    setScreen('today');
  }, []);
  const onBackToToday = useCallback(() => setScreen('today'), []);

  return (
    <div className="app-shell">
      <div className="screen" style={{ padding: 0 }}>
        {screen === 'camera' && <CameraScreen onLogged={onCameraLogged} onNavigate={setScreen} />}
        {screen === 'logged' && selectedLogId && (
          <LoggedScreen
            logId={selectedLogId}
            info={captureInfo}
            alternatives={alternatives}
            onFixIt={onFixIt}
            onFixItToAlternative={(alt) => {
              reassignToLabel(selectedLogId, alt.label);
              onDone();
            }}
            onUndo={() => {
              if (captureInfo?.undoLogId) undoLog(captureInfo.undoLogId);
              onUndo();
            }}
            onDone={onDone}
          />
        )}
        {screen === 'today' && <TodayScreen onOpenLog={onOpenLog} />}
        {screen === 'detail' && selectedLogId && (
          <DetailScreen
            logId={selectedLogId}
            alternatives={alternatives.map((a) => ({ label: a.displayName, score: a.score }))}
            onBack={onBackToToday}
          />
        )}
        {screen === 'history' && <HistoryScreen />}
      </div>
      {screen !== 'logged' && <BottomTabs active={screen} onNavigate={setScreen} />}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
