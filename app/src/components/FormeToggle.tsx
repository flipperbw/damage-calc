import type { InBattleForme } from '@/types';

interface Props {
  species: string;
  value: InBattleForme;
  onChange: (next: InBattleForme) => void;
}

/**
 * Segmented toggle for species whose in-battle forme is a state, not a
 * separate pickable species:
 *
 *   - Palafin → [Zero | Hero]. Zero is the realistic battle-start state
 *     (Zero → Hero is a one-way switch triggered by switching out and
 *     back in). Hero models the post-switch sweep state.
 *   - Aegislash → [Auto | Shield | Blade]. Auto models Stance Change
 *     accurately (Blade attacking, Shield defending). Shield forces the
 *     defensive forme (turn-1 / after a King's Shield). Blade forces the
 *     offensive forme (after attacking, before next K. Shield).
 *   - Mimikyu → [Disguise | Busted]. Disguise blocks the first damaging
 *     hit; Busted means the disguise has been broken and Mimikyu takes
 *     normal damage now.
 *   - Morpeko → [Full Belly | Hangry]. Hunger Switch alternates each
 *     turn, swapping Aura Wheel's type between Electric (Full Belly) and
 *     Dark (Hangry).
 *
 * Renders nothing for any other species so callers can drop this
 * component into the MonCard header unconditionally.
 */
export function FormeToggle({ species, value, onChange }: Props) {
  const kind = formeFamily(species);
  if (!kind) return null;

  if (kind === 'palafin') {
    return (
      <Segmented
        ariaPrefix="Palafin form"
        options={[
          { id: '', label: 'Zero' },
          { id: 'palafin-hero', label: 'Hero' },
        ]}
        value={value}
        onChange={onChange}
      />
    );
  }
  if (kind === 'aegislash') {
    return (
      <Segmented
        ariaPrefix="Aegislash stance"
        options={[
          { id: '', label: 'Auto' },
          { id: 'aegislash-shield', label: 'Shield' },
          { id: 'aegislash-blade', label: 'Blade' },
        ]}
        value={value}
        onChange={onChange}
      />
    );
  }
  if (kind === 'mimikyu') {
    return (
      <Segmented
        ariaPrefix="Mimikyu disguise"
        options={[
          { id: '', label: 'Disguise' },
          { id: 'mimikyu-busted', label: 'Busted' },
        ]}
        value={value}
        onChange={onChange}
      />
    );
  }
  // Morpeko
  return (
    <Segmented
      ariaPrefix="Morpeko mode"
      options={[
        { id: '', label: 'Full' },
        { id: 'morpeko-hangry', label: 'Hangry' },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}

function formeFamily(species: string): 'palafin' | 'aegislash' | 'mimikyu' | 'morpeko' | null {
  if (species === 'Palafin' || species === 'Palafin-Hero') return 'palafin';
  if (species === 'Aegislash' || species === 'Aegislash-Shield' || species === 'Aegislash-Blade') return 'aegislash';
  if (species === 'Mimikyu' || species === 'Mimikyu-Busted') return 'mimikyu';
  if (species === 'Morpeko' || species === 'Morpeko-Hangry') return 'morpeko';
  return null;
}

interface SegOption {
  id: InBattleForme;
  label: string;
}

interface SegProps {
  ariaPrefix: string;
  options: SegOption[];
  value: InBattleForme;
  onChange: (next: InBattleForme) => void;
}

function Segmented({ ariaPrefix, options, value, onChange }: SegProps) {
  return (
    <div className="inline-flex rounded-lg border border-surface-hi overflow-hidden text-[11px] font-bold uppercase tracking-wider">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id || 'default'}
            type="button"
            onClick={() => onChange(o.id)}
            aria-label={`${ariaPrefix}: ${o.label}`}
            aria-pressed={active}
            style={{ touchAction: 'manipulation' }}
            className={`min-w-9 min-h-9 px-2 transition ${active ? 'bg-accent-gradient text-white' : 'bg-surface opacity-70 hover:opacity-100 hover:bg-surface-hi'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
