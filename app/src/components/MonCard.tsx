import { useState } from 'react';
import { Generations, toID } from '@smogon/calc';

import type { ComputedStats } from '@/calc/adapter';
import { AbilityDetailSheet } from '@/components/AbilityDetailSheet';
import { HpBar } from '@/components/HpBar';
import { MegaToggle } from '@/components/MegaToggle';
import { AbilityPicker } from '@/components/pickers/AbilityPicker';
import { BoostPicker } from '@/components/pickers/BoostPicker';
import { StatusPicker } from '@/components/pickers/StatusPicker';
import { StatChip } from '@/components/StatChip';
import { TypeBadge } from '@/components/TypeBadge';
import { spriteUrl } from '@/data/sprites';
import type { MegaState, SavedMon, StatID, StatIDExceptHP, StatusName } from '@/types';

const GEN_FOR_NATURE = Generations.get(0);

function natureMods(nature: string): { plus?: StatID; minus?: StatID } {
  const n = GEN_FOR_NATURE.natures.get(toID(nature) as any);
  if (!n) return {};
  return { plus: n.plus as StatID | undefined, minus: n.minus as StatID | undefined };
}

const GEN = Generations.get(0);

interface Props {
  mon: SavedMon;
  maxHp: number;
  /** Computed stats (post-nature/SPs/mega) for the row across the top of the card. */
  stats?: ComputedStats;
  side: 'you' | 'opp';
  onEdit: () => void;
  onChangeHp: (hp: number | undefined) => void;
  onChangeMega: (mega: MegaState) => void;
  onChangeStatus?: (status: StatusName | undefined) => void;
  onChangeBoosts?: (boosts: Partial<Record<StatIDExceptHP, number>>) => void;
  /**
   * Optional ability mutator. When provided, the AbilityDetailSheet shows
   * a "Change ability" button that opens the AbilityPicker inline (no
   * round-trip through MonEditor).
   */
  onChangeAbility?: (ability: string) => void;
  /**
   * When provided, the outer card surface is clickable and triggers a swap
   * (e.g. opens the species picker for the opponent). Sprite/name still route
   * to onEdit; chips and other controls stop propagation so they don't bubble
   * up to the card surface.
   */
  onSwap?: () => void;
}

export function MonCard({
  mon,
  maxHp,
  stats,
  side,
  onEdit,
  onChangeHp,
  onChangeMega,
  onChangeStatus,
  onChangeBoosts,
  onChangeAbility,
  onSwap,
}: Props) {
  const sp = GEN.species.get(toID(mon.species) as any);
  const types = sp?.types ?? [];
  const dashed = side === 'opp' ? 'border-dashed border-danger/25' : 'border-surface-hi';

  const [picker, setPicker] = useState<'status' | 'boosts' | 'ability' | null>(null);
  const [abilityDetailOpen, setAbilityDetailOpen] = useState(false);

  const hasStatus = mon.status && mon.status !== 'Healthy';
  const hasBoosts = Object.values(mon.boosts).some((v) => typeof v === 'number' && v !== 0);

  // The outer card surface is interactive: opponent-side opens the swap
  // picker; your-side opens the editor. Inner controls (sprite/name/chips)
  // each route to their own handlers and stop propagation. We use
  // role="button" + a div so we can nest buttons without invalid DOM.
  const surfaceAction = onSwap ?? (side === 'you' ? onEdit : undefined);
  const surfaceLabel = onSwap ? `Swap ${mon.species}` : `Edit ${mon.species}`;
  const surfaceTestId = onSwap ? `swap-${side}` : `surface-${side}`;
  const swapProps = surfaceAction
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': surfaceLabel,
        'data-testid': surfaceTestId,
        onClick: surfaceAction,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            surfaceAction();
          }
        },
        className: `bg-surface border ${dashed} rounded-card p-3 mb-2.5 cursor-pointer`,
      }
    : { className: `bg-surface border ${dashed} rounded-card p-3 mb-2.5` };

  const { plus: naturePlus, minus: natureMinus } = natureMods(mon.nature);

  function stop<E extends React.SyntheticEvent>(e: E, fn?: () => void) {
    e.stopPropagation();
    fn?.();
  }

  function statLabel(k: 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe'): string {
    const map = { hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe' } as const;
    return map[k];
  }

  return (
    <div {...swapProps}>
      <div className="flex gap-2.5 items-start mb-2">
        <button onClick={(e) => stop(e, onEdit)} data-testid={`edit-sprite-${side}`}>
          <img src={spriteUrl(mon.species)} alt={mon.species} className="w-13 h-13 rounded-xl" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start gap-2">
            <button onClick={(e) => stop(e, onEdit)} data-testid={`edit-name-${side}`} className="font-bold text-base text-left truncate">
              {mon.species}
            </button>
            {/* Top-right cluster: Mega toggle (when species supports it AND
                the held item is a mega stone) sits above the small L50 label. */}
            <div className="flex flex-col items-end gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <MegaToggle mega={mon.mega} species={mon.species} item={mon.item} onChange={onChangeMega} />
              <span className="text-[10px] opacity-50">L50</span>
            </div>
          </div>
          <div className="flex gap-1 mt-1">
            {types.map((t) => (
              <TypeBadge key={t} type={t as string} />
            ))}
          </div>
        </div>
      </div>

      {/* Stats row - six cells, hp/atk/def/spa/spd/spe. Each cell shows the
          stat value with a small indicator line for nature (▲/▼) and EV
          allocation ("+N SP"). Tabular numerals so values line up. */}
      {stats && (
        <div className="grid grid-cols-6 gap-1 mb-2 text-center">
          {(['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const).map((k) => {
            const sp = mon.sps[k] ?? 0;
            const isPlus = k === naturePlus && naturePlus !== natureMinus;
            const isMinus = k === natureMinus && naturePlus !== natureMinus;
            const valCls = isPlus ? 'text-ok' : isMinus ? 'text-danger' : sp > 0 ? 'text-accent' : '';
            return (
              <div
                key={k}
                className={`rounded-md py-1 px-0.5 ${sp > 0 ? 'bg-accent/[0.07]' : 'bg-white/[0.03]'}`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-[8px] uppercase tracking-wider opacity-55 leading-none flex items-center justify-center gap-0.5">
                  <span>{statLabel(k)}</span>
                  {isPlus && <span className="text-ok">▲</span>}
                  {isMinus && <span className="text-danger">▼</span>}
                </div>
                <div className={`text-[12px] font-semibold tabular-nums leading-tight mt-0.5 ${valCls}`}>{stats[k]}</div>
                <div className={`text-[8px] tabular-nums leading-none mt-0.5 ${sp > 0 ? 'text-accent/80' : 'opacity-30'}`}>
                  {sp > 0 ? `+${sp}` : '·'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/*
        Stop click/keydown bubbling for inner controls when the card surface is
        a swap target - chips, HpBar, and MegaToggle each route to their own
        handlers, not the swap.
      */}
      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <HpBar current={mon.currentHp} max={maxHp} showRaw={side === 'you'} onChange={onChangeHp} />

        <div className="flex gap-1.5 mt-2 flex-wrap">
          {mon.ability && (
            // Tapping the ability chip opens the read-only detail sheet -
            // not the editor. The sheet's "Change ability" button (rendered
            // only when onChangeAbility is wired) routes to AbilityPicker.
            <StatChip icon="🩸" label={mon.ability} editable={!!onChangeAbility} onClick={() => setAbilityDetailOpen(true)} />
          )}
          {mon.item && <StatChip icon="🎒" label={mon.item} editable={side === 'opp'} onClick={onEdit} />}
          <StatChip icon="🌿" label={mon.nature} editable={side === 'opp'} onClick={onEdit} />

          {/* Status: chip when set, "Status" pill when not. */}
          {hasStatus ? (
            <StatChip label={mon.status!} tone="warn" editable={!!onChangeStatus} onClick={onChangeStatus ? () => setPicker('status') : undefined} />
          ) : onChangeStatus ? (
            <StatChip label="+ Status" onClick={() => setPicker('status')} />
          ) : null}

          {/* Boosts: one chip per non-zero boost. Tapping the chip opens the
              BoostPicker - one modal handles all stat boosts at once. */}
          {(Object.entries(mon.boosts) as [StatIDExceptHP, number][]).map(([k, v]) =>
            v !== 0 ? (
              <StatChip
                key={k}
                label={`${v > 0 ? '+' : ''}${v} ${k}`}
                tone="boost"
                editable={!!onChangeBoosts}
                onClick={onChangeBoosts ? () => setPicker('boosts') : undefined}
              />
            ) : null,
          )}
          {!hasBoosts && onChangeBoosts && <StatChip label="+ Boost" onClick={() => setPicker('boosts')} />}
        </div>
      </div>

      {onChangeStatus && (
        <StatusPicker
          open={picker === 'status'}
          current={mon.status}
          onClose={() => setPicker(null)}
          onPick={(status) => onChangeStatus(status === 'Healthy' ? undefined : status)}
        />
      )}
      {onChangeBoosts && <BoostPicker open={picker === 'boosts'} boosts={mon.boosts} onClose={() => setPicker(null)} onSave={onChangeBoosts} />}
      <AbilityDetailSheet
        open={abilityDetailOpen}
        abilityName={mon.ability ?? null}
        canChange={!!onChangeAbility}
        onClose={() => setAbilityDetailOpen(false)}
        onChangeRequest={onChangeAbility ? () => setPicker('ability') : undefined}
      />
      {onChangeAbility && (
        <AbilityPicker
          open={picker === 'ability'}
          species={mon.species}
          onClose={() => setPicker(null)}
          onPick={(a) => {
            onChangeAbility(a);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

