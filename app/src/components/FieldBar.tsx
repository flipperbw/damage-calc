import { useMemo, useState } from 'react';

import { FieldDrawer } from '@/components/FieldDrawer';
import { applyPinToggle, isPinActive, isValidPinKey, pinChipLabel } from '@/data/field-pins';
import { useStore } from '@/store';
import { emptyField } from '@/store/factories';
import type { FieldState } from '@/types';

export function FieldBar() {
  const field = useStore((s) => s.field);
  const setField = useStore((s) => s.setField);
  const pinnedKeys = useStore((s) => s.pinnedFieldKeys);
  const [open, setOpen] = useState(false);

  // Compact summary chips inside the Field button. We list the active flags
  // in a stable order so the row doesn't shuffle as the user toggles things.
  const activeChips = useMemo(() => collectActive(field), [field]);
  const hasActive = activeChips.length > 0;

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation();
    // Reset to a fresh empty FieldState - drops weather, terrain, every room,
    // both side-state objects.
    const fresh = emptyField();
    setField({
      weather: undefined,
      terrain: undefined,
      isMagicRoom: false,
      isWonderRoom: false,
      isTrickRoom: false,
      isGravity: false,
      yourSide: fresh.yourSide,
      oppSide: fresh.oppSide,
    });
  }

  function clearChip(key: string) {
    const fresh = emptyField();
    switch (key) {
      case 'weather':
        return setField({ weather: undefined });
      case 'terrain':
        return setField({ terrain: undefined });
      case 'tr':
        return setField({ isTrickRoom: false });
      case 'mr':
        return setField({ isMagicRoom: false });
      case 'wr':
        return setField({ isWonderRoom: false });
      case 'g':
        return setField({ isGravity: false });
      case 'your-side':
        return setField({ yourSide: fresh.yourSide });
      case 'opp-side':
        return setField({ oppSide: fresh.oppSide });
    }
  }

  // Pinned chips render above the main "+ Field" row. Each chip is a
  // one-tap toggle for its specific value (e.g. ★ Trick Room flips
  // isTrickRoom). Invalid keys (e.g. from a future format we don't
  // recognise) are filtered out defensively.
  const validPins = useMemo(() => pinnedKeys.filter(isValidPinKey), [pinnedKeys]);

  return (
    <>
      {validPins.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2" data-testid="pinned-field-bar">
          {validPins.map((k) => {
            const active = isPinActive(field, k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => setField(applyPinToggle(field, k))}
                aria-pressed={active}
                data-testid={`pinned-field-${k}`}
                style={{ touchAction: 'manipulation' }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                  active
                    ? 'bg-warn/25 text-warn border-warn'
                    : 'bg-surface border-surface-hi opacity-70 hover:opacity-100'
                }`}
              >
                <span aria-hidden>★</span>
                <span>{pinChipLabel(k)}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-stretch gap-1.5 mb-3.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Edit field state"
          data-testid="field-toggle"
          style={{ touchAction: 'manipulation' }}
          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border ${
            hasActive ? 'bg-warn/10 border-warn/40 text-warn' : 'bg-surface border-surface-hi opacity-80 hover:opacity-100'
          }`}
        >
          <span className="text-base font-semibold">＋ Field</span>
          {hasActive ? (
            <div className="flex items-center gap-1 flex-wrap flex-1">
              {activeChips.map((c) => (
                <span
                  key={c.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Clear ${c.label}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearChip(c.key);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      clearChip(c.key);
                    }
                  }}
                  className="inline-flex items-center gap-1 text-[10px] font-semibold pl-1.5 pr-1 py-0.5 rounded bg-warn/20 border border-warn/40 text-warn cursor-pointer hover:bg-warn/30"
                >
                  <span>{c.label}</span>
                  <span aria-hidden className="opacity-70">×</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-[11px] opacity-70">Weather, terrain, hazards…</span>
          )}
        </button>
        {hasActive && (
          <button
            type="button"
            onClick={clearAll}
            aria-label="Clear all field state"
            title="Clear field state"
            data-testid="field-clear"
            style={{ touchAction: 'manipulation' }}
            className="px-3 rounded-lg border bg-danger/10 border-danger/30 text-danger hover:bg-danger/20"
          >
            ✕
          </button>
        )}
      </div>
      <FieldDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface ActiveChip {
  key: string;
  label: string;
}

function collectActive(field: FieldState): ActiveChip[] {
  const out: ActiveChip[] = [];
  if (field.weather) out.push({ key: 'weather', label: `${weatherIcon(field.weather)} ${field.weather}` });
  if (field.terrain) out.push({ key: 'terrain', label: `⚡ ${field.terrain}` });
  if (field.isTrickRoom) out.push({ key: 'tr', label: '⏱ Trick Room' });
  if (field.isMagicRoom) out.push({ key: 'mr', label: 'Magic Room' });
  if (field.isWonderRoom) out.push({ key: 'wr', label: 'Wonder Room' });
  if (field.isGravity) out.push({ key: 'g', label: 'Gravity' });
  // Side flags: count how many distinct hazards/screens are up so the bar
  // doesn't sprawl. Spikes counted as one regardless of layer count.
  const yourCount = countSideFlags(field.yourSide);
  const oppCount = countSideFlags(field.oppSide);
  if (yourCount > 0) out.push({ key: 'your-side', label: `Your side · ${yourCount}` });
  if (oppCount > 0) out.push({ key: 'opp-side', label: `Opp side · ${oppCount}` });
  return out;
}

function countSideFlags(s: import('@/types').SideState): number {
  let n = 0;
  if (s.stealthRock) n++;
  if (s.spikes && s.spikes > 0) n++;
  if (s.reflect) n++;
  if (s.lightScreen) n++;
  if (s.auroraVeil) n++;
  if (s.tailwind) n++;
  if (s.protect) n++;
  if (s.leechSeed) n++;
  if (s.saltCure) n++;
  if (s.helpingHand) n++;
  if (s.isPowerTrick) n++;
  if (s.friendGuard) n++;
  if (s.isSwitching) n++;
  return n;
}

function weatherIcon(w: string) {
  return ({ Sun: '☀', Rain: '🌧', Sand: '🟫', Snow: '❄' } as Record<string, string>)[w] ?? '';
}
