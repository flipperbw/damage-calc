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
  // Aegislash
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

function formeFamily(species: string): 'palafin' | 'aegislash' | null {
  if (species === 'Palafin' || species === 'Palafin-Hero') return 'palafin';
  if (species === 'Aegislash' || species === 'Aegislash-Shield' || species === 'Aegislash-Blade') return 'aegislash';
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
            className={`min-w-9 min-h-9 px-2 ${active ? 'bg-accent-gradient text-white' : 'bg-surface opacity-70'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
