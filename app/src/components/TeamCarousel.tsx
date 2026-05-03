import { spriteUrl } from '@/data/sprites';
import { useStore } from '@/store';

interface CarouselProps {
  vertical?: boolean;
  /**
   * Called when the user taps an empty slot. Caller is expected to open a
   * species picker bound to the active team. When omitted, taps on empty
   * slots fall back to routing to the Teams tab so the user can create or
   * activate a team.
   */
  onAddMon?: (slotIndex: number) => void;
}

export function TeamCarousel({ vertical = false, onAddMon }: CarouselProps) {
  const team = useStore((s) => s.teams.find((t) => t.id === s.activeTeamId));
  const activeIndex = useStore((s) => s.activeMonIndex);
  const setActiveMonIndex = useStore((s) => s.setActiveMonIndex);
  const setTab = useStore((s) => s.setTab);

  if (!team) return null;
  const slots: Array<(typeof team.mons)[number] | null> = [...team.mons, ...Array(Math.max(0, 6 - team.mons.length)).fill(null)];

  const containerCls = vertical ? 'flex flex-col gap-1.5' : 'flex gap-1.5 mb-3.5';
  const slotBaseCls = vertical ? 'w-full aspect-square' : 'flex-1 aspect-square';

  return (
    <div className={containerCls}>
      {slots.map((mon, i) => {
        const active = !!mon && i === activeIndex;
        if (!mon) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => (onAddMon ? onAddMon(i) : setTab('teams'))}
              aria-label={`Add Pokémon to slot ${i + 1}`}
              data-testid={`carousel-slot-empty-${i}`}
              className={`${slotBaseCls} bg-surface border border-surface-hi rounded-xl flex items-center justify-center opacity-50 text-xs hover:opacity-100`}
            >
              ＋
            </button>
          );
        }
        const cur = mon.currentHp;
        const fainted = cur === 0;
        return (
          <button
            key={i}
            onClick={() => setActiveMonIndex(i)}
            className={`${slotBaseCls} rounded-xl flex items-center justify-center relative ${
              active ? 'bg-accent/20 border-1.5 border-accent shadow-[0_0_20px_rgba(124,92,255,0.3)]' : 'bg-surface border border-surface-hi'
            } ${fainted ? 'opacity-30' : ''}`}
          >
            <img src={spriteUrl(mon.species)} alt={mon.species} className="w-3/4 h-3/4 object-contain" />
          </button>
        );
      })}
    </div>
  );
}
