import type { FieldState, SideState } from '../types';
import { useStore } from '../store';
import { PickerShell } from './pickers/PickerShell';

interface Props {
  open: boolean;
  onClose: () => void;
}

const WEATHERS = ['', 'Sun', 'Rain', 'Sand', 'Snow'] as const;
const TERRAINS = ['', 'Electric', 'Grassy', 'Misty', 'Psychic'] as const;

const SIDE_FLAGS: { key: keyof SideState; label: string }[] = [
  { key: 'stealthRock', label: 'Stealth Rock' },
  { key: 'reflect', label: 'Reflect' },
  { key: 'lightScreen', label: 'Light Screen' },
  { key: 'auroraVeil', label: 'Aurora Veil' },
  { key: 'tailwind', label: 'Tailwind' },
  { key: 'protect', label: 'Protect' },
  { key: 'leechSeed', label: 'Leech Seed' },
  { key: 'saltCure', label: 'Salt Cure' },
  { key: 'helpingHand', label: 'Helping Hand' },
  { key: 'isPowerTrick', label: 'Power Trick' },
  { key: 'friendGuard', label: 'Friend Guard' },
  { key: 'isStatBoost', label: '+1 All Stats' },
  { key: 'isSwitching', label: 'Switching Out' },
];

export function FieldDrawer({ open, onClose }: Props) {
  const field = useStore(s => s.field);
  const setField = useStore(s => s.setField);

  function setSide(side: 'yourSide' | 'oppSide', key: keyof SideState, value: unknown) {
    setField({ [side]: { ...field[side], [key]: value } } as Partial<FieldState>);
  }

  return (
    <PickerShell open={open} onClose={onClose} title="Field state">
      <div className="overflow-y-auto flex-1 px-1">
        <Group label="Weather">
          {WEATHERS.map(w => (
            <Toggle
              key={w || 'none'}
              active={field.weather === (w || undefined)}
              onClick={() =>
                setField({ weather: (w || undefined) as FieldState['weather'] })
              }
            >
              {w || 'None'}
            </Toggle>
          ))}
        </Group>

        <Group label="Terrain">
          {TERRAINS.map(t => (
            <Toggle
              key={t || 'none'}
              active={field.terrain === (t || undefined)}
              onClick={() =>
                setField({ terrain: (t || undefined) as FieldState['terrain'] })
              }
            >
              {t || 'None'}
            </Toggle>
          ))}
        </Group>

        <Group label="Room / Gravity">
          <Toggle active={!!field.isTrickRoom} onClick={() => setField({ isTrickRoom: !field.isTrickRoom })}>
            Trick Room
          </Toggle>
          <Toggle active={!!field.isMagicRoom} onClick={() => setField({ isMagicRoom: !field.isMagicRoom })}>
            Magic Room
          </Toggle>
          <Toggle active={!!field.isWonderRoom} onClick={() => setField({ isWonderRoom: !field.isWonderRoom })}>
            Wonder Room
          </Toggle>
          <Toggle active={!!field.isGravity} onClick={() => setField({ isGravity: !field.isGravity })}>
            Gravity
          </Toggle>
        </Group>

        <SideBlock label="Your side" side="yourSide" state={field.yourSide} onSet={setSide} />
        <SideBlock label="Opponent side" side="oppSide" state={field.oppSide} onSet={setSide} />
      </div>
    </PickerShell>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs border ${
        active
          ? 'bg-accent-gradient text-white border-accent'
          : 'bg-surface border-surface-hi opacity-70'
      }`}
    >
      {children}
    </button>
  );
}

function SideBlock({
  label,
  side,
  state,
  onSet,
}: {
  label: string;
  side: 'yourSide' | 'oppSide';
  state: SideState;
  onSet: (side: 'yourSide' | 'oppSide', key: keyof SideState, value: unknown) => void;
}) {
  return (
    <div className="mb-4">
      <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {SIDE_FLAGS.map(f => (
          <Toggle
            key={f.key}
            active={!!state[f.key]}
            onClick={() => onSet(side, f.key, !state[f.key])}
          >
            {f.label}
          </Toggle>
        ))}
        {/* Spikes 0-3 */}
        <div className="flex gap-1 items-center text-xs">
          <span className="opacity-55 mr-1">Spikes</span>
          {[0, 1, 2, 3].map(n => (
            <Toggle
              key={n}
              active={(state.spikes ?? 0) === n}
              onClick={() => onSet(side, 'spikes', n)}
            >
              {n}
            </Toggle>
          ))}
        </div>
      </div>
    </div>
  );
}
