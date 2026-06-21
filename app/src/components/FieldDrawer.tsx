import { useEffect, useState } from 'react';

import { PickerShell } from '@/components/pickers/PickerShell';
import { useStore } from '@/store';
import type { FieldState, SideState } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const WEATHERS = ['', 'Sun', 'Rain', 'Sand', 'Snow'] as const;
const TERRAINS = ['', 'Electric', 'Grassy', 'Misty', 'Psychic'] as const;

// Common per-side flags surfaced by default. The remainder live in the
// "Advanced" disclosure below.
const SIDE_FLAGS_COMMON: { key: keyof SideState; label: string }[] = [
  { key: 'reflect', label: 'Reflect' },
  { key: 'lightScreen', label: 'Light Screen' },
  { key: 'auroraVeil', label: 'Aurora Veil' },
];

const SIDE_FLAGS_ADVANCED: { key: keyof SideState; label: string }[] = [
  { key: 'stealthRock', label: 'Stealth Rock' },
  { key: 'tailwind', label: 'Tailwind' },
  { key: 'protect', label: 'Protect' },
  { key: 'leechSeed', label: 'Leech Seed' },
  // Salt Cure: kept in the toggle list for note-keeping, but calc's
  // Champions mechanics doesn't read isSaltCured anywhere - the per-turn
  // damage tick isn't modelled. Setting this has zero effect on damage
  // numbers; it just lets the user record battle state.
  { key: 'saltCure', label: 'Salt Cure' },
  { key: 'helpingHand', label: 'Helping Hand' },
  { key: 'isPowerTrick', label: 'Power Trick' },
  { key: 'friendGuard', label: 'Friend Guard' },
  { key: 'isSwitching', label: 'Switching Out' },
];

export function FieldDrawer({ open, onClose }: Props) {
  const field = useStore((s) => s.field);
  const setField = useStore((s) => s.setField);
  const pinned = useStore((s) => s.pinnedFieldKeys);
  const togglePin = useStore((s) => s.togglePinnedFieldKey);
  const [advancedOpen, setAdvancedOpen] = useState(true);
  // Pin-edit mode: in this mode, taps on toggles pin/unpin the value
  // rather than flipping it. The drawer header swaps to "Tap to pin" +
  // Done. Pinned toggles get a ★ overlay so state is unambiguous.
  const [pinMode, setPinMode] = useState(false);
  // Reset pin mode when the drawer closes so reopening it lands in
  // normal mode regardless of how the user dismissed last time.
  useEffect(() => {
    if (!open) setPinMode(false);
  }, [open]);

  const pinnedSet = new Set(pinned);

  function setSide(side: 'yourSide' | 'oppSide', key: keyof SideState, value: unknown) {
    // Read the freshest side state from the store rather than the render-time
    // `field` snapshot, so two rapid taps in the same React batch don't clobber
    // each other.
    const current = useStore.getState().field[side];
    setField({ [side]: { ...current, [key]: value } } as Partial<FieldState>);
  }

  return (
    <PickerShell open={open} onClose={onClose}>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="text-base font-bold flex-1">
          {pinMode ? 'Tap to pin' : 'Field state'}
        </h3>
        {pinMode ? (
          <button
            type="button"
            onClick={() => setPinMode(false)}
            aria-label="Done editing pins"
            data-testid="field-pin-done"
            style={{ touchAction: 'manipulation' }}
            className="min-h-[36px] px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-accent-gradient text-white transition hover:brightness-110"
          >
            Done
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setPinMode(true)}
              aria-label="Edit pinned field shortcuts"
              data-testid="field-pin-edit"
              style={{ touchAction: 'manipulation' }}
              className="min-h-[36px] px-2.5 rounded-lg text-xs font-semibold bg-surface border border-surface-hi opacity-80 hover:opacity-100"
            >
              ★ Edit pins
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close field state"
              data-testid="field-close"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,255,255,0.15)' }}
              className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center text-lg opacity-70 hover:opacity-100 select-none cursor-pointer"
            >
              ✕
            </button>
          </>
        )}
      </div>
      <div className="overflow-y-auto flex-1 px-1">
        <Group label="Weather">
          {WEATHERS.map((w) => (
            <Toggle
              key={w || 'none'}
              active={field.weather === (w || undefined)}
              onClick={() => setField({ weather: (w || undefined) as FieldState['weather'] })}
              pinMode={pinMode}
              pinKey={w ? `weather:${w}` : undefined}
              pinned={w ? pinnedSet.has(`weather:${w}`) : false}
              onPinClick={togglePin}
            >
              {w || 'None'}
            </Toggle>
          ))}
        </Group>

        <Group label="Terrain">
          {TERRAINS.map((t) => (
            <Toggle
              key={t || 'none'}
              active={field.terrain === (t || undefined)}
              onClick={() => setField({ terrain: (t || undefined) as FieldState['terrain'] })}
              pinMode={pinMode}
              pinKey={t ? `terrain:${t}` : undefined}
              pinned={t ? pinnedSet.has(`terrain:${t}`) : false}
              onPinClick={togglePin}
            >
              {t || 'None'}
            </Toggle>
          ))}
        </Group>

        <SideScreensBlock label="Your screens" side="yourSide" state={field.yourSide} onSet={setSide} pinMode={pinMode} pinnedSet={pinnedSet} onPinClick={togglePin} />
        <SideScreensBlock label="Opponent screens" side="oppSide" state={field.oppSide} onSet={setSide} pinMode={pinMode} pinnedSet={pinnedSet} onPinClick={togglePin} />

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
          data-testid="field-advanced-toggle"
          className="w-full flex items-center justify-between py-2 px-1 text-xs uppercase tracking-wider opacity-70 hover:opacity-100"
        >
          <span>Advanced</span>
          <span className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`}>▾</span>
        </button>

        {advancedOpen && (
          <div data-testid="field-advanced-section">
            <Group label="Room / Gravity / Aura">
              <Toggle
                active={!!field.isTrickRoom}
                onClick={() => setField({ isTrickRoom: !field.isTrickRoom })}
                pinMode={pinMode}
                pinKey="tr"
                pinned={pinnedSet.has('tr')}
                onPinClick={togglePin}
              >
                Trick Room
              </Toggle>
              <Toggle
                active={!!field.isMagicRoom}
                onClick={() => setField({ isMagicRoom: !field.isMagicRoom })}
                pinMode={pinMode}
                pinKey="mr"
                pinned={pinnedSet.has('mr')}
                onPinClick={togglePin}
              >
                Magic Room
              </Toggle>
              <Toggle
                active={!!field.isWonderRoom}
                onClick={() => setField({ isWonderRoom: !field.isWonderRoom })}
                pinMode={pinMode}
                pinKey="wr"
                pinned={pinnedSet.has('wr')}
                onPinClick={togglePin}
              >
                Wonder Room
              </Toggle>
              <Toggle
                active={!!field.isGravity}
                onClick={() => setField({ isGravity: !field.isGravity })}
                pinMode={pinMode}
                pinKey="gravity"
                pinned={pinnedSet.has('gravity')}
                onPinClick={togglePin}
              >
                Gravity
              </Toggle>
              {/* Fairy Aura: represents a non-active ally on the field with
                  the Fairy Aura ability. Calc applies a 4/3 BP boost on
                  Fairy moves when set. Champions ability allowlist includes
                  Fairy Aura but not Dark Aura, so only Fairy is exposed. */}
              <Toggle
                active={!!field.isFairyAura}
                onClick={() => setField({ isFairyAura: !field.isFairyAura })}
                pinMode={pinMode}
                pinKey="fairyAura"
                pinned={pinnedSet.has('fairyAura')}
                onPinClick={togglePin}
              >
                Fairy Aura
              </Toggle>
            </Group>

            <SideAdvancedBlock label="Your side" side="yourSide" state={field.yourSide} onSet={setSide} pinMode={pinMode} pinnedSet={pinnedSet} onPinClick={togglePin} />
            <SideAdvancedBlock label="Opponent side" side="oppSide" state={field.oppSide} onSet={setSide} pinMode={pinMode} pinnedSet={pinnedSet} onPinClick={togglePin} />
          </div>
        )}
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

/**
 * Toggle button used throughout FieldDrawer. In normal mode, `onClick`
 * flips the underlying field-state value. When `pinMode` is true AND
 * `pinKey` is supplied, the click pins/unpins instead — `onPinClick`
 * gets called with `pinKey`, and the chip shows a ★ when pinned. Toggles
 * without a `pinKey` (None buttons, individual Spike layers) become
 * non-interactive in pin mode.
 */
function Toggle({
  active,
  onClick,
  children,
  pinMode,
  pinKey,
  pinned,
  onPinClick,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  pinMode?: boolean;
  pinKey?: string;
  pinned?: boolean;
  onPinClick?: (key: string) => void;
}) {
  const inPinMode = !!pinMode;
  const isPinnable = inPinMode && !!pinKey;
  const handle = () => {
    if (inPinMode) {
      if (pinKey && onPinClick) onPinClick(pinKey);
      return;
    }
    onClick();
  };
  let cls: string;
  if (inPinMode) {
    cls = isPinnable
      ? pinned
        ? 'bg-warn/25 text-warn border-warn'
        : 'bg-surface border-surface-hi opacity-80 hover:opacity-100'
      : 'bg-surface border-surface-hi opacity-30 cursor-not-allowed';
  } else {
    cls = active ? 'bg-accent-gradient text-white border-accent' : 'bg-surface border-surface-hi opacity-70';
  }
  return (
    <button
      onClick={handle}
      disabled={inPinMode && !isPinnable}
      aria-pressed={inPinMode ? !!pinned : active}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition enabled:hover:brightness-110 ${cls}`}
    >
      {isPinnable && pinned && <span aria-hidden>★</span>}
      {children}
    </button>
  );
}

interface SideBlockExtras {
  pinMode: boolean;
  pinnedSet: Set<string>;
  onPinClick: (key: string) => void;
}

function SideScreensBlock({
  label,
  side,
  state,
  onSet,
  pinMode,
  pinnedSet,
  onPinClick,
}: {
  label: string;
  side: 'yourSide' | 'oppSide';
  state: SideState;
  onSet: (side: 'yourSide' | 'oppSide', key: keyof SideState, value: unknown) => void;
} & SideBlockExtras) {
  return (
    <div className="mb-4">
      <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {SIDE_FLAGS_COMMON.map((f) => {
          const pinKey = `${side}:${f.key}`;
          return (
            <Toggle
              key={f.key}
              active={!!state[f.key]}
              onClick={() => onSet(side, f.key, !state[f.key])}
              pinMode={pinMode}
              pinKey={pinKey}
              pinned={pinnedSet.has(pinKey)}
              onPinClick={onPinClick}
            >
              {f.label}
            </Toggle>
          );
        })}
      </div>
    </div>
  );
}

function SideAdvancedBlock({
  label,
  side,
  state,
  onSet,
  pinMode,
  pinnedSet,
  onPinClick,
}: {
  label: string;
  side: 'yourSide' | 'oppSide';
  state: SideState;
  onSet: (side: 'yourSide' | 'oppSide', key: keyof SideState, value: unknown) => void;
} & SideBlockExtras) {
  return (
    <div className="mb-4">
      <div className="text-xxs uppercase tracking-wider opacity-55 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {SIDE_FLAGS_ADVANCED.map((f) => {
          const pinKey = `${side}:${f.key}`;
          return (
            <Toggle
              key={f.key}
              active={!!state[f.key]}
              onClick={() => onSet(side, f.key, !state[f.key])}
              pinMode={pinMode}
              pinKey={pinKey}
              pinned={pinnedSet.has(pinKey)}
              onPinClick={onPinClick}
            >
              {f.label}
            </Toggle>
          );
        })}
        {/* Spikes 0-3. Pin is binary so only the "1" layer carries a pin
            key (`<side>:spikes`); 0/2/3 stay unpinnable in pin mode. */}
        <div className="flex gap-1 items-center text-xs">
          <span className="opacity-55 mr-1">Spikes</span>
          {[0, 1, 2, 3].map((n) => {
            const pinKey = n === 1 ? `${side}:spikes` : undefined;
            return (
              <Toggle
                key={n}
                active={(state.spikes ?? 0) === n}
                onClick={() => onSet(side, 'spikes', n)}
                pinMode={pinMode}
                pinKey={pinKey}
                pinned={pinKey ? pinnedSet.has(pinKey) : false}
                onPinClick={onPinClick}
              >
                {n}
              </Toggle>
            );
          })}
        </div>
      </div>
    </div>
  );
}
