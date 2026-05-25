import { GEN, toID } from '@/calc/gen';
import { isMegaStone } from '@/calc/helpers';
import type { MegaState } from '@/types';

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
  const opts: MegaOptions = {
    hasPlain: has(`${baseName}-Mega`),
    hasX: has(`${baseName}-Mega-X`),
    hasY: has(`${baseName}-Mega-Y`),
  };
  // Also catch mega formes whose name doesn't follow the `{base}-Mega(-X|-Y)?`
  // pattern but link back via calc's `baseSpecies` field. Floette-Eternal is
  // the live example: its mega forme is `Floette-Mega` (not
  // `Floette-Eternal-Mega`), so the name-based check above misses it.
  for (const sp of GEN.species) {
    const linkedBase = (sp as unknown as { baseSpecies?: string }).baseSpecies;
    if (linkedBase !== baseName) continue;
    const n = sp.name;
    if (n.endsWith('-Mega-X')) opts.hasX = true;
    else if (n.endsWith('-Mega-Y')) opts.hasY = true;
    else if (n.endsWith('-Mega')) opts.hasPlain = true;
  }
  return opts;
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
  // X/Y forms (Charizard, Mewtwo): show 3-state segmented [Off | X | Y].
  // Short labels keep the cluster compact so the species name beside it
  // doesn't truncate; min-w/min-h + touch-action manipulation make each
  // segment a comfortable tap target on mobile (was ~24px tall).
  if (opts.hasX && opts.hasY) {
    return (
      <div className="inline-flex rounded-lg border border-surface-hi overflow-hidden text-[11px] font-bold uppercase tracking-wider">
        <SegBtn active={mega === ''} onClick={() => onChange('')} ariaLabel="Mega off">
          Off
        </SegBtn>
        <SegBtn active={mega === 'mega-x'} onClick={() => onChange('mega-x')} ariaLabel="Mega X">
          X
        </SegBtn>
        <SegBtn active={mega === 'mega-y'} onClick={() => onChange('mega-y')} ariaLabel="Mega Y">
          Y
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
        aria-label="Mega Evolve"
        aria-pressed={isMega}
        data-testid="mega-toggle"
        style={{ touchAction: 'manipulation' }}
        className={`min-h-9 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
          isMega ? 'bg-accent-gradient text-white border-accent' : 'bg-surface border-surface-hi opacity-70'
        }`}
      >
        {/* Short single-word labels: the accent-gradient fill + sparkle on the
            active state carries the "is it on" signal, so we don't need the
            "Active" / "Evolve" suffix that was crowding the species name
            beside it (Floette-Eternal was truncating to "Floette-Et..."). */}
        {isMega ? '✦ Mega' : 'Mega'}
      </button>
    );
  }
  return null;
}

function SegBtn({ active, onClick, ariaLabel, children }: { active: boolean; onClick: () => void; ariaLabel: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      style={{ touchAction: 'manipulation' }}
      className={`min-w-9 min-h-9 px-2 ${active ? 'bg-accent-gradient text-white' : 'bg-surface opacity-70'}`}
    >
      {children}
    </button>
  );
}
