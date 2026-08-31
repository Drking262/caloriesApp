import type { Screen } from '../types';

const TABS: { id: Screen; label: string }[] = [
  { id: 'camera', label: 'Camera' },
  { id: 'today', label: 'Today' },
  { id: 'history', label: 'History' },
];

export function BottomTabs({ active, onNavigate }: { active: Screen; onNavigate: (s: Screen) => void }) {
  return (
    <nav className="bottom-tabs">
      {TABS.map((t) => {
        const isActive = active === t.id || (t.id === 'today' && active === 'detail');
        return (
          <button
            key={t.id}
            type="button"
            className={`tab-btn${isActive ? ' active' : ''}`}
            onClick={() => onNavigate(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
