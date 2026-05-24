import { Logo } from '@/components/Logo';
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
      {/* Mobile: icon-only brand + label-only tabs (no leading emoji) so
          each tab gets the full available width for its name and the row
          doesn't feel cramped. Tab labels are short enough that this
          works at iPhone-SE widths too. */}
      <div className="md:hidden flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={() => setTab('battle')}
          aria-label="FutureSight — home"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center select-none shrink-0"
          style={{ touchAction: 'manipulation' }}
        >
          <Logo className="w-7 h-7" />
        </button>
        <nav aria-label="Primary" className="mobile-nav flex-1 grid grid-cols-4 gap-1.5">
          {ITEMS.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setTab(it.id)}
              aria-label={it.label}
              style={{ touchAction: 'manipulation' }}
              className={`min-h-[40px] flex items-center justify-center rounded-lg text-[13px] font-semibold select-none transition-colors ${
                tab === it.id
                  ? 'bg-accent-gradient text-white shadow-[0_2px_10px_rgba(124,92,255,0.35)]'
                  : 'bg-surface border border-surface-hi text-text-mute hover:text-text'
              }`}
            >
              <span style={{ pointerEvents: 'none' }}>{it.label}</span>
            </button>
          ))}
        </nav>
      </div>
      {/* Desktop: brand + name visible inline before the tabs. Wordmark
          weight (font-semibold) and size (text-sm) match the tab labels so
          the brand reads as part of the same nav strip, not a separate
          heading floating beside it. */}
      <div className="hidden md:flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => setTab('battle')}
          aria-label="FutureSight — home"
          className="flex items-center gap-2 px-1 py-1 rounded-lg hover:opacity-90"
        >
          <Logo className="w-7 h-7" />
          <span className="font-semibold tracking-tight text-sm">FutureSight</span>
        </button>
        <nav className="flex gap-1">
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
      </div>
    </>
  );
}
