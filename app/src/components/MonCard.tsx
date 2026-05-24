import { useState } from 'react';

import type { ComputedStats } from '@/calc/adapter';
import { GEN, toID } from '@/calc/gen';
import { effectiveAbility, megaFormeName, natureMods } from '@/calc/helpers';
import { AbilityDetailSheet } from '@/components/AbilityDetailSheet';
import { HpBar } from '@/components/HpBar';
import { MegaToggle } from '@/components/MegaToggle';
import { AbilityPicker } from '@/components/pickers/AbilityPicker';
import { BoostPicker } from '@/components/pickers/BoostPicker';
import { StatusPicker } from '@/components/pickers/StatusPicker';
import { StatChip } from '@/components/StatChip';
import { Sprite } from '@/components/Sprite';
import { TypeBadge } from '@/components/TypeBadge';
import { STAT_LABEL, STAT_ORDER, type MegaState, type SavedMon, type StatIDExceptHP, type StatusName } from '@/types';

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
  // When a mega is active, look up the mega forme's species so types
  // reflect the transform (Mega Charizard X is Fire/Dragon; Mega Gyarados
  // is Water/Dark; etc.). Falls back to base when calc lacks the forme.
  const effectiveSpecies = mon.mega ? megaFormeName(mon.species, mon.mega) : mon.species;
  const sp = GEN.species.get(toID(effectiveSpecies) as any) ?? GEN.species.get(toID(mon.species) as any);
  const types = sp?.types ?? [];
  // Mega evolution overrides the user's base ability (Mega Charizard X is
  // Tough Claws; Mega Gyarados is Mold Breaker). Display the in-effect
  // ability so the chip matches what calc actually uses.
  const displayAbility = effectiveAbility(mon.species, mon.mega, mon.ability);
  const abilityFromMega = !!mon.mega && displayAbility !== mon.ability;
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

  return (
    <div {...swapProps}>
      {/* Card header: sprite on the left, then a middle column with two
          rows — row 1 holds the species name + the Mega/Swap cluster
          side-by-side; row 2 holds the type badges. Keeping Mega/Swap in
          the name row (not floating across the full middle-column
          height) avoids the visual overlap where MEGA ACTIVE's bottom
          edge would land at the same Y as the badge row. */}
      <div className="flex gap-2.5 items-center mb-2">
        <button onClick={(e) => stop(e, onEdit)} data-testid={`edit-sprite-${side}`}>
          {/* Use the effective species so a mega-evolved mon shows the mega
              forme's sprite (Charizard-Mega-X, Gardevoir-Mega, …) rather
              than the base. */}
          <Sprite species={effectiveSpecies} alt={mon.species} className="w-13 h-13 rounded-xl" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <button onClick={(e) => stop(e, onEdit)} data-testid={`edit-name-${side}`} className="font-bold text-base text-left truncate">
              {mon.species}
            </button>
            <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <MegaToggle mega={mon.mega} species={mon.species} item={mon.item} onChange={onChangeMega} />
              {onSwap ? (
                <button
                  type="button"
                  onClick={(e) => stop(e, onSwap)}
                  data-testid={`swap-btn-${side}`}
                  aria-label={`Swap ${mon.species}`}
                  title="Swap"
                  style={{ touchAction: 'manipulation' }}
                  className="w-9 h-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-surface-hi text-text-mute opacity-80 hover:opacity-100 hover:border-accent hover:text-accent"
                >
                  <span aria-hidden className="text-base leading-none" style={{ pointerEvents: 'none' }}>
                    ⇄
                  </span>
                </button>
              ) : null}
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
          {STAT_ORDER.map((k) => {
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
                  <span>{STAT_LABEL[k]}</span>
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
          {displayAbility && (
            // Tapping the ability chip opens the read-only detail sheet -
            // not the editor. The sheet's "Change ability" button (rendered
            // only when onChangeAbility is wired) routes to AbilityPicker.
            // The ✦ prefix flags an ability that was overridden by mega
            // evolution (so the user knows the chip isn't the base form's
            // ability and editing it would have no effect right now).
            <StatChip
              icon={abilityFromMega ? '✦' : '🩸'}
              label={displayAbility}
              editable={!!onChangeAbility && !abilityFromMega}
              onClick={() => setAbilityDetailOpen(true)}
            />
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
        abilityName={displayAbility ?? null}
        canChange={!!onChangeAbility}
        onClose={() => setAbilityDetailOpen(false)}
        onChangeRequest={onChangeAbility ? () => setPicker('ability') : undefined}
      />
      {onChangeAbility && (
        <AbilityPicker
          open={picker === 'ability'}
          species={mon.species}
          currentAbility={mon.ability}
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
