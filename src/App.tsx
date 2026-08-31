import { useCallback, useState } from 'react';
import { StoreProvider } from './state/store';
import { BottomTabs } from './components/BottomTabs';
import { CameraScreen } from './screens/CameraScreen';
import { LoggedScreen } from './screens/LoggedScreen';
import { TodayScreen } from './screens/TodayScreen';
import { DetailScreen } from './screens/DetailScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import type { Screen } from './types';

function Shell() {
  const [screen, setScreen] = useState<Screen>('camera');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const openLog = useCallback((logId: string, next: Screen = 'detail') => {
    setSelectedLogId(logId);
    setScreen(next);
  }, []);

  const onCameraLogged = useCallback((logId: string) => openLog(logId, 'logged'), [openLog]);
  const onOpenLog = useCallback((logId: string) => openLog(logId, 'detail'), [openLog]);
  const onFixIt = useCallback(() => setScreen('detail'), []);
  const onUndo = useCallback(() => setScreen('camera'), []);
  const onDone = useCallback(() => setScreen('today'), []);
  const onBackToToday = useCallback(() => setScreen('today'), []);

  return (
    <div className="app-shell">
      <div className="screen" style={{ padding: 0 }}>
        {screen === 'camera' && <CameraScreen onLogged={onCameraLogged} onNavigate={setScreen} />}
        {screen === 'logged' && selectedLogId && (
          <LoggedScreen logId={selectedLogId} onFixIt={onFixIt} onUndo={onUndo} onDone={onDone} />
        )}
        {screen === 'today' && <TodayScreen onOpenLog={onOpenLog} />}
        {screen === 'detail' && selectedLogId && <DetailScreen logId={selectedLogId} onBack={onBackToToday} />}
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
