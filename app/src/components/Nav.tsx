import { useStore } from '../store';
import type { Tab } from '../types';

const ITEMS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'battle', icon: '⚔', label: 'Battle' },
  { id: 'teams', icon: '👥', label: 'Teams' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
];

export function Nav() {
  const { tab, setTab } = useStore();
  return (
    <>
      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-3 left-3.5 right-3.5 bg-black/80 backdrop-blur border border-surface-hi rounded-2xl p-2 flex justify-around text-xxs z-20">
        {ITEMS.map(it => (
          <button key={it.id} onClick={() => setTab(it.id)}
                  className={`flex flex-col items-center gap-0.5 ${tab === it.id ? 'text-accent' : 'opacity-55'}`}>
            <span className="text-base">{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
      {/* Desktop top tabs */}
      <nav className="hidden md:flex gap-1 mb-4">
        {ITEMS.map(it => (
          <button key={it.id} onClick={() => setTab(it.id)}
                  className={`px-4 py-2 rounded-lg text-sm ${tab === it.id ? 'bg-accent-gradient text-white' : 'bg-surface border border-surface-hi opacity-70'}`}>
            <span className="mr-1.5">{it.icon}</span>{it.label}
          </button>
        ))}
      </nav>
    </>
  );
}
