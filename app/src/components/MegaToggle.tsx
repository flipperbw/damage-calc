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

// Which mega forme the held stone implies. X/Y mons (Charizard, Mewtwo) are
// disambiguated by the stone - Charizardite X → Mega X, Charizardite Y →
// Mega Y - NOT by a free toggle: holding the Y stone means Mega Y, full stop.
// Single-stone mons are always 'mega'.
function stoneVariant(item: string | undefined, opts: MegaOptions): MegaState {
  if (opts.hasX || opts.hasY) {
    if (/(?:\s|-)X$/i.test(item ?? '')) return 'mega-x';
    if (/(?:\s|-)Y$/i.test(item ?? '')) return 'mega-y';
    return opts.hasPlain ? 'mega' : opts.hasX ? 'mega-x' : 'mega-y';
  }
  return 'mega';
}

export function MegaToggle({ mega, onChange, species, item }: Props) {
  // Mega is an in-battle event tied to the held mega stone. Without a stone,
  // there's nothing to toggle and we render nothing.
  if (!isMegaStone(item)) return null;
  const opts = megaOptions(species);
  if (!opts.hasPlain && !opts.hasX && !opts.hasY) return null;

  // The forme is decided by the stone, so this is always a 2-state Off/Mega
  // toggle - even for X/Y mons. To switch X↔Y you change the stone (item) or
  // pick the matching profile; the toggle never offers a forme the held stone
  // can't produce.
  const variant = stoneVariant(item, opts);
  const isMega = mega !== '';
  // When on, label the actual forme; when off, label what turning on yields.
  const shown = isMega ? mega : variant;
  const label = shown === 'mega-x' ? 'Mega X' : shown === 'mega-y' ? 'Mega Y' : 'Mega';

  return (
    <button
      onClick={() => onChange(isMega ? '' : variant)}
      aria-label="Mega Evolve"
      aria-pressed={isMega}
      data-testid="mega-toggle"
      style={{ touchAction: 'manipulation' }}
      className={`min-h-9 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
        isMega ? 'bg-accent-gradient text-white border-accent' : 'bg-surface border-surface-hi opacity-70'
      }`}
    >
      {isMega ? `✦ ${label}` : label}
    </button>
  );
}
