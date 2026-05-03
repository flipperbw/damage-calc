import { useStore } from '@/store';
import type { Tab } from '@/types';

const ITEMS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: 'battle', icon: '⚔', label: 'Battle' },
  { id: 'teams', icon: '👥', label: 'Teams' },
  { id: 'builder', icon: '🧪', label: 'Builder' },
  { id: 'settings', icon: '⚙', label: 'Settings' },
];

export function Nav() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  return (
    <>
      {/* Mobile top nav - matches the desktop placement now to recover the
          ~100px the bottom nav used to consume. Uses class `mobile-nav` for
          legacy selectors but the CSS rule no longer applies a fixed-bottom
          offset (see globals.css). */}
      <nav aria-label="Primary" className="mobile-nav md:hidden flex gap-1 mb-3">
        {ITEMS.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setTab(it.id)}
            aria-label={it.label}
            style={{ touchAction: 'manipulation' }}
            className={`flex-1 min-h-[44px] flex items-center justify-center gap-1 rounded-lg text-sm select-none ${tab === it.id ? 'bg-accent text-white font-semibold' : 'bg-surface border border-surface-hi opacity-75'}`}
          >
            <span aria-hidden style={{ pointerEvents: 'none' }}>
              {it.icon}
            </span>
            <span style={{ pointerEvents: 'none' }}>{it.label}</span>
          </button>
        ))}
      </nav>
      {/* Desktop top tabs */}
      <nav className="hidden md:flex gap-1 mb-4">
        {ITEMS.map((it) => (
          <button
            key={it.id}
            onClick={() => setTab(it.id)}
            className={`px-4 py-2 rounded-lg text-sm ${tab === it.id ? 'bg-accent-gradient text-white' : 'bg-surface border border-surface-hi opacity-70'}`}
          >
            <span className="mr-1.5">{it.icon}</span>
            {it.label}
          </button>
        ))}
      </nav>
    </>
  );
}
