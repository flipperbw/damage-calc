import { Generations, MEGA_STONES, toID } from '@smogon/calc';

import type { MegaState } from '@/types';

const GEN = Generations.get(0);

interface MegaOptions {
  hasPlain: boolean;
  hasX: boolean;
  hasY: boolean;
}

function has(species: string): boolean {
  return !!GEN.species.get(toID(species) as any);
}

function megaOptions(species: string): MegaOptions {
  const baseName = species.replace(/-Mega(-X|-Y)?$/, '');
  return {
    hasPlain: has(`${baseName}-Mega`),
    hasX: has(`${baseName}-Mega-X`),
    hasY: has(`${baseName}-Mega-Y`),
  };
}

export function hasMegaForme(species: string): boolean {
  const o = megaOptions(species);
  return o.hasPlain || o.hasX || o.hasY;
}

/** True iff the item is a mega stone in the calc's MEGA_STONES table. */
export function isMegaStone(item: string | undefined): boolean {
  if (!item) return false;
  return Object.prototype.hasOwnProperty.call(MEGA_STONES, item);
}

interface Props {
  mega: MegaState;
  onChange: (next: MegaState) => void;
  species: string;
  /**
   * Held item. The toggle is only rendered when this is a mega stone, so a
   * mon without the right stone can't accidentally enter mega state. When
   * undefined, the toggle is hidden entirely.
   */
  item?: string;
}

export function MegaToggle({ mega, onChange, species, item }: Props) {
  // Mega is an in-battle event tied to the held mega stone. Without a stone,
  // there's nothing to toggle and we render nothing.
  if (!isMegaStone(item)) return null;
  const opts = megaOptions(species);
  // X/Y forms (Charizard, Mewtwo): show 3-state segmented [Off | X | Y]
  if (opts.hasX && opts.hasY) {
    return (
      <div className="inline-flex rounded-lg border border-surface-hi overflow-hidden text-xs font-bold uppercase tracking-wider">
        <SegBtn active={mega === ''} onClick={() => onChange('')}>
          Off
        </SegBtn>
        <SegBtn active={mega === 'mega-x'} onClick={() => onChange('mega-x')}>
          Mega X
        </SegBtn>
        <SegBtn active={mega === 'mega-y'} onClick={() => onChange('mega-y')}>
          Mega Y
        </SegBtn>
      </div>
    );
  }
  // Plain mega only: 2-state toggle
  if (opts.hasPlain) {
    const isMega = mega === 'mega';
    return (
      <button
        onClick={() => onChange(isMega ? '' : 'mega')}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
          isMega ? 'bg-accent-gradient text-white border-accent' : 'bg-surface border-surface-hi opacity-70'
        }`}
      >
        {isMega ? '✦ Mega Active' : 'Mega Evolve'}
      </button>
    );
  }
  return null;
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-2.5 py-1.5 ${active ? 'bg-accent-gradient text-white' : 'bg-surface opacity-70'}`}>
      {children}
    </button>
  );
}
