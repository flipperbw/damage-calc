import { useState } from 'react';

import { categoryBadge, priorityFlag } from '@/calc/format';
import { GEN, toID } from '@/calc/gen';
import { MoveDetailSheet } from '@/components/MoveDetailSheet';
import { MovePicker } from '@/components/pickers/MovePicker';
import { TypeBadge } from '@/components/TypeBadge';
import { moveAccuracy, priorityOverride } from '@/data/pkmn';

interface MoveSummary {
  type: string;
  bp: number;
  category: 'Physical' | 'Special' | 'Status';
  accuracy: number | true | null;
  priority: number;
}

function moveSummary(name: string): MoveSummary {
  if (!name) return { type: '???', bp: 0, category: 'Status', accuracy: null, priority: 0 };
  // calc's data is keyed by id ("earthquake"), not display name. Without
  // toID() the lookup silently fails and we render '???'.
  const m = GEN.moves.get(toID(name) as any) as any;
  const bp = (m?.bp ?? m?.basePower ?? 0) as number;
  const rawCat = m?.category as 'Physical' | 'Special' | 'Status' | undefined;
  const category: 'Physical' | 'Special' | 'Status' = rawCat ?? (bp === 0 ? 'Status' : 'Physical');
  const accuracy = moveAccuracy(name);
  // Same priority fallback as the picker/adapter: trust @pkmn/data when
  // calc's gen-0 reports 0 but the move (Trick Room, etc.) really has it.
  const calcPrio = (m?.priority ?? 0) as number;
  const pkmnPrio = priorityOverride(name);
  const priority = calcPrio === 0 && pkmnPrio !== null ? pkmnPrio : calcPrio;
  return { type: (m?.type as string) ?? '???', bp, category, accuracy, priority };
}

interface Props {
  moves: [string, string, string, string];
  onChange: (moves: [string, string, string, string]) => void;
  species?: string;
  /**
   * Forwarded to MovePicker. No longer drives a default filter — every
   * filter starts off regardless — but kept on the API surface so the
   * picker can use it later if a context-specific behavior is added.
   */
  isForOpponent?: boolean;
}

export function MoveSlots({ moves, onChange, species, isForOpponent }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  // Tap-info target: opens MoveDetailSheet for the chosen move without
  // routing through MovePicker, so the user can read the full description
  // / mechanics for a slot they already filled.
  const [detailMove, setDetailMove] = useState<string | null>(null);
  return (
    <div>
      {moves.map((m, i) => {
        if (!m) {
          return (
            <div
              key={i}
              onClick={() => setEditing(i)}
              className="flex justify-between items-center bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-1.5 cursor-pointer"
            >
              <span className="text-text-mute">- empty -</span>
              <span className="opacity-40">▾</span>
            </div>
          );
        }
        const s = moveSummary(m);
        const prioLabel = s.priority === 0 ? null : priorityFlag(s.priority) ?? null;
        const isStatus = s.category === 'Status' || s.bp === 0;
        const accLabel = typeof s.accuracy === 'number' && s.accuracy < 100 ? `${s.accuracy}%` : null;
        const cat = categoryBadge(s.category);
        // Group the stats into one tonal pill so the right side reads as a
        // single visual unit. Order: accuracy · BP · category. Category
        // sets the pill's color and anchors the right edge so every row
        // ends with the same uppercase label position.
        const pillParts: React.ReactNode[] = [];
        if (accLabel) {
          pillParts.push(<span key="acc" className="tabular-nums">{accLabel}</span>);
          pillParts.push(<span key="dot1" aria-hidden className="opacity-50">·</span>);
        }
        if (!isStatus && s.bp > 0) {
          pillParts.push(<span key="bp" className="tabular-nums">BP {s.bp}</span>);
          pillParts.push(<span key="dot2" aria-hidden className="opacity-50">·</span>);
        }
        pillParts.push(<span key="cat" className="font-bold">{cat.label.toUpperCase()}</span>);
        return (
          <div
            key={i}
            onClick={() => setEditing(i)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-surface-hi mb-1.5 cursor-pointer hover:bg-white/[0.02]"
          >
            {/* Info icon — opens MoveDetailSheet without changing the slot.
                Matches the (i) pattern used in MovePicker rows so users
                already learned the affordance. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDetailMove(m);
              }}
              aria-label={`${m} details`}
              data-testid={`move-slot-info-${i}`}
              className="w-6 h-6 shrink-0 flex items-center justify-center rounded-full bg-white/[0.04] border border-surface-hi text-[11px] opacity-70 hover:opacity-100 hover:border-accent hover:text-accent"
            >
              i
            </button>
            <TypeBadge type={s.type} fixedWidth />
            <span className="font-semibold text-[13px] truncate flex-1">{m}</span>
            {prioLabel && <span className="text-priority text-[10px] font-bold shrink-0">{prioLabel}</span>}
            <span className={`inline-flex items-center gap-1.5 text-[10px] px-1.5 py-0.5 rounded border shrink-0 ${cat.cls}`}>
              {pillParts}
            </span>
            <span className="opacity-40 shrink-0">▾</span>
          </div>
        );
      })}
      <MovePicker
        open={editing !== null}
        onClose={() => setEditing(null)}
        species={species}
        isForOpponent={isForOpponent}
        // Exclude the moves already on this Pokemon (other slots only — the
        // slot being edited can re-pick its own move without disappearing).
        excludeMoves={editing === null ? undefined : moves.filter((_, idx) => idx !== editing)}
        onPick={(name) => {
          if (editing === null) return;
          const next = [...moves] as [string, string, string, string];
          next[editing] = name;
          onChange(next);
        }}
      />
      <MoveDetailSheet open={detailMove !== null} moveName={detailMove} onClose={() => setDetailMove(null)} />
    </div>
  );
}
