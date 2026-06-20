import { useState } from 'react';

import { type ComputedStats, withBoostStage } from '@/calc/adapter';
import { GEN, toID } from '@/calc/gen';
import { effectiveAbility, megaFormeName, natureMods } from '@/calc/helpers';
import { AbilityDetailSheet } from '@/components/AbilityDetailSheet';
import { ChipDetailSheet } from '@/components/ChipDetailSheet';
import { FormeToggle } from '@/components/FormeToggle';
import { HpBar } from '@/components/HpBar';
import { MegaToggle } from '@/components/MegaToggle';
import { AbilityPicker } from '@/components/pickers/AbilityPicker';
import { ItemPicker } from '@/components/pickers/ItemPicker';
import { NaturePicker } from '@/components/pickers/NaturePicker';
import { StatusPicker } from '@/components/pickers/StatusPicker';
import { StatChip } from '@/components/StatChip';
import { Sprite } from '@/components/Sprite';
import { TypeBadge } from '@/components/TypeBadge';
import { STAT_LABEL, STAT_ORDER_NO_HP, type InBattleForme, type MegaState, type SavedMon, type StatIDExceptHP, type StatusName } from '@/types';

interface Props {
  mon: SavedMon;
  maxHp: number;
  /** Computed stats (post-nature/SPs/mega) for the row across the top of the card. */
  stats?: ComputedStats;
  side: 'you' | 'opp';
  onEdit: () => void;
  onChangeHp: (hp: number | undefined) => void;
  onChangeMega: (mega: MegaState) => void;
  /**
   * Optional in-battle forme mutator. Wired for Palafin (Zero / Hero)
   * and Aegislash (Auto / Shield / Blade); the FormeToggle below renders
   * nothing for any other species so the prop is harmless to pass through
   * unconditionally.
   */
  onChangeInBattleForme?: (next: InBattleForme) => void;
  onChangeStatus?: (status: StatusName | undefined) => void;
  onChangeBoosts?: (boosts: Partial<Record<StatIDExceptHP, number>>) => void;
  /**
   * Optional ability mutator. When provided, the AbilityDetailSheet shows
   * a "Change ability" button that opens the AbilityPicker inline (no
   * round-trip through MonEditor).
   */
  onChangeAbility?: (ability: string) => void;
  /**
   * Optional item / nature mutators. When provided, the chip detail
   * sheet's "Change …" button opens the matching inline picker instead
   * of routing to onEdit. Mirrors onChangeAbility for parity across
   * build-state chips on the opp card.
   */
  onChangeItem?: (item: string | undefined) => void;
  onChangeNature?: (nature: string) => void;
  /**
   * When provided, the outer card surface is clickable and triggers a swap
   * (e.g. opens the species picker for the opponent). Sprite/name still route
   * to onEdit; chips and other controls stop propagation so they don't bubble
   * up to the card surface.
   */
  onSwap?: () => void;
  /**
   * Mobile-only collapse. When `collapsed` is true the card body (HP, stat
   * grid, chips) is hidden and only the identity header shows; the toggle
   * (rendered only when `onToggleCollapse` is provided) flips it. State lives
   * in the parent so it can also hide that side's move rows. Collapse never
   * applies at md+ - the toggle is `md:hidden` and the body uses
   * `hidden md:block`, so desktop always shows the full card.
   */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /**
   * Reset ephemeral battle state (HP + boosts + status) in one shot. The
   * parent applies all three in a single store update; doing it here as three
   * separate onChange* calls would clobber, since each spreads the same stale
   * mon snapshot.
   */
  onResetBattle?: () => void;
}

export function MonCard({
  mon,
  maxHp,
  stats,
  side,
  onEdit,
  onChangeHp,
  onChangeMega,
  onChangeInBattleForme,
  onChangeStatus,
  onChangeBoosts,
  onChangeAbility,
  onChangeItem,
  onChangeNature,
  onSwap,
  collapsed = false,
  onToggleCollapse,
  onResetBattle,
}: Props) {
  // Resolve the displayed species name, used for both the sprite and the
  // calc's stat lookup. Priority:
  //   1. In-battle forme override (Palafin → Hero, Aegislash → Blade /
  //      Shield) so the toggle's effect is visible in the sprite. For
  //      Auto Aegislash the override is empty and we fall through.
  //   2. Mega state (Charizard-Mega-X, Floette-Mega, …).
  //   3. Otherwise the user's picked species.
  const formeOverride =
    mon.inBattleForme === 'palafin-hero'
      ? 'Palafin-Hero'
      : mon.inBattleForme === 'aegislash-shield'
        ? 'Aegislash-Shield'
        : mon.inBattleForme === 'aegislash-blade'
          ? 'Aegislash-Blade'
          : mon.inBattleForme === 'mimikyu-busted'
            ? 'Mimikyu-Busted'
            : mon.inBattleForme === 'morpeko-hangry'
              ? 'Morpeko-Hangry'
              : null;
  const effectiveSpecies = formeOverride ?? (mon.mega ? megaFormeName(mon.species, mon.mega, mon.item) : mon.species);
  const sp = GEN.species.get(toID(effectiveSpecies) as any) ?? GEN.species.get(toID(mon.species) as any);
  const types = sp?.types ?? [];
  // Mega evolution overrides the user's base ability (Mega Charizard X is
  // Tough Claws; Mega Gyarados is Mold Breaker). Display the in-effect
  // ability so the chip matches what calc actually uses.
  const displayAbility = effectiveAbility(mon.species, mon.mega, mon.ability, mon.item);
  const abilityFromMega = !!mon.mega && displayAbility !== mon.ability;
  const dashed = side === 'opp' ? 'border-dashed border-danger/25' : 'border-surface-hi';

  const [picker, setPicker] = useState<'status' | 'ability' | 'item' | 'nature' | null>(null);
  const [abilityDetailOpen, setAbilityDetailOpen] = useState(false);
  // Detail sheet for build-state chips (item, nature) only. Battle-state
  // chips (status, boosts) skip the detail step and jump straight to
  // their picker — those are transient edits and the extra screen would
  // be friction. The ability chip has its own dedicated AbilityDetailSheet.
  const [chipDetail, setChipDetail] = useState<'item' | 'nature' | null>(null);

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
        className: `relative bg-surface border ${dashed} rounded-card p-3 mb-3 cursor-pointer`,
      }
    : { className: `relative bg-surface border ${dashed} rounded-card p-3 mb-3` };

  const { plus: naturePlus, minus: natureMinus } = natureMods(mon.nature);

  function stop<E extends React.SyntheticEvent>(e: E, fn?: () => void) {
    e.stopPropagation();
    fn?.();
  }

  // Step a single stat's boost stage by ±1, clamped to -6..+6. Emits the
  // whole boosts object (the only shape onChangeBoosts accepts); a stage of
  // 0 is deleted so the model stays in the canonical "absent = neutral" form
  // the rest of the app expects.
  function stepBoost(stat: StatIDExceptHP, delta: number) {
    if (!onChangeBoosts) return;
    const cur = mon.boosts[stat] ?? 0;
    const next = Math.max(-6, Math.min(6, cur + delta));
    const out = { ...mon.boosts };
    if (next === 0) delete out[stat];
    else out[stat] = next;
    onChangeBoosts(out);
  }

  // Ephemeral battle state - HP, boosts, status - varies game to game, so a
  // one-tap reset clears all three back to "fresh". The reset affordance only
  // appears when at least one of them is dirty.
  const battleDirty = (mon.currentHp != null && mon.currentHp < maxHp) || hasBoosts || !!hasStatus;
  function resetBattleState() {
    // Prefer the parent's atomic reset (single store update). Fall back to the
    // three separate calls only if it's not wired - note that fallback can
    // clobber (each onChange* spreads the same stale mon), so callers should
    // pass onResetBattle.
    if (onResetBattle) {
      onResetBattle();
      return;
    }
    onChangeHp(undefined);
    onChangeBoosts?.({});
    onChangeStatus?.(undefined);
  }

  return (
    <div {...swapProps}>
      {/* Edit pencil — corner badge pinned to the top-left of the card,
          floating off the surface as a discrete affordance. Solid
          background so it stands clear of the card border underneath;
          stopPropagation prevents the underlying card's swap-on-tap
          surface from catching badge taps. Swap stays in the header
          cluster below (alongside MEGA) since the two often pair. */}
      <button
        type="button"
        onClick={(e) => stop(e, onEdit)}
        data-testid={`edit-btn-${side}`}
        aria-label={`Edit ${mon.species} build`}
        title="Edit build"
        style={{ touchAction: 'manipulation' }}
        className="absolute -top-3 -left-3 w-7 h-7 z-10 flex items-center justify-center rounded-full bg-surface-solid border border-surface-hi text-text-mute shadow-md hover:border-accent hover:text-accent"
      >
        <span aria-hidden className="text-xs leading-none" style={{ pointerEvents: 'none' }}>
          ✎
        </span>
      </button>

      {/* Collapse toggle - floating top-right badge, mirroring the edit pencil
          at top-left. Lives in the corner (not the header cluster) because the
          cluster gets crowded with the forme/mega toggles. Mobile only: on
          desktop the two cards already sit side by side. */}
      {onToggleCollapse && (
        <button
          type="button"
          onClick={(e) => stop(e, onToggleCollapse)}
          data-testid={`collapse-${side}`}
          aria-label={collapsed ? `Expand ${mon.species} card` : `Collapse ${mon.species} card`}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand' : 'Collapse'}
          style={{ touchAction: 'manipulation' }}
          className="md:hidden absolute -top-3 -right-3 w-7 h-7 z-10 flex items-center justify-center rounded-full bg-surface-solid border border-surface-hi text-text-mute shadow-md hover:border-accent hover:text-accent"
        >
          {/* SVG chevron centers cleanly (the unicode glyphs sit off-center).
              Down = expand (when collapsed), up = collapse (when expanded). */}
          <svg
            aria-hidden
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: 'none' }}
          >
            <path d={collapsed ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'} />
          </svg>
        </button>
      )}

      {/* Card header: sprite on the left, species name + Mega/Swap
          cluster to the right. */}
      <div className="flex gap-2.5 items-center mb-4">
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
              {onChangeInBattleForme && (
                <FormeToggle species={mon.species} value={mon.inBattleForme ?? ''} onChange={onChangeInBattleForme} />
              )}
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

      {/* Card body - HP, stat+boost grid, build/status chips. Collapsed on
          mobile hides this whole block (md+ always shows it via md:block, so
          collapse stays a mobile-only affordance). */}
      <div className={collapsed ? 'hidden md:block' : ''}>
        {/* HP gauge + reset. The slider thumb is the most-touched control so
            it stays near the top. The reset clears ephemeral battle state -
            HP, boosts, status - and only shows when one of them is dirty. */}
        <div className="mb-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <div className="flex-1 min-w-0">
            <HpBar current={mon.currentHp} max={maxHp} onChange={onChangeHp} />
          </div>
          {/* Always rendered (disabled when nothing's dirty) so the HP bar's
              width - and the row - don't jump as battle state changes. */}
          <button
            type="button"
            onClick={resetBattleState}
            disabled={!battleDirty}
            data-testid={`reset-battle-${side}`}
            aria-label="Reset HP, boosts and status"
            title="Reset HP, boosts & status"
            style={{ touchAction: 'manipulation' }}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-white/[0.04] border border-surface-hi text-text-mute hover:border-warn hover:text-warn disabled:opacity-30 disabled:hover:border-surface-hi disabled:hover:text-text-mute"
          >
            <span aria-hidden className="text-sm leading-none" style={{ pointerEvents: 'none' }}>
              ↺
            </span>
          </button>
        </div>

        {/* Stat + boost grid - five cells, atk/spa/def/spd/spe. HP lives in
              the HpBar above (max value baked into the "HP N" label) so we
              don't render two competing HP indicators. Each cell shows the
              live (boost-applied) stat value, a nature ▲/▼ mark, a badge line
              (boost stage when boosted, else the SP allocation), and ± steppers.
              The grid is the primary boost control now - stepping a stage
              recomputes the displayed value immediately. Full stat / EV editing
              still lives behind the edit pencil + sprite/name. */}
          {stats && (
            <div className="grid grid-cols-5 gap-1 mb-3 text-center" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
              {STAT_ORDER_NO_HP.map((k) => {
                const sp = mon.sps[k] ?? 0;
                const stage = mon.boosts[k] ?? 0;
                const isPlus = k === naturePlus && naturePlus !== natureMinus;
                const isMinus = k === natureMinus && naturePlus !== natureMinus;
                const shownVal = stage !== 0 ? withBoostStage(stats[k], stage) : stats[k];
                // Boost direction dominates the value color (it's the live
                // battle state); nature / SP coloring applies only at neutral.
                const valCls = stage > 0 ? 'text-ok' : stage < 0 ? 'text-danger' : isPlus ? 'text-ok' : isMinus ? 'text-danger' : sp > 0 ? 'text-accent' : '';
                const cellBg = stage > 0 ? 'bg-ok/[0.1]' : stage < 0 ? 'bg-danger/[0.1]' : sp > 0 ? 'bg-accent/[0.07]' : 'bg-white/[0.03]';
                return (
                  <div key={k} className={`rounded-md py-1 px-0.5 ${cellBg}`}>
                    <div className="text-[8px] uppercase tracking-wider opacity-55 leading-none flex items-center justify-center gap-0.5">
                      <span>{STAT_LABEL[k]}</span>
                      {isPlus && <span className="text-ok">▲</span>}
                      {isMinus && <span className="text-danger">▼</span>}
                    </div>
                    <div className={`text-[12px] font-semibold tabular-nums leading-tight mt-0.5 ${valCls}`}>{shownVal}</div>
                    <div
                      data-testid={`boost-stage-${side}-${k}`}
                      className={`text-[8px] tabular-nums leading-none mt-0.5 ${stage > 0 ? 'text-ok' : stage < 0 ? 'text-danger' : sp > 0 ? 'text-accent/80' : 'opacity-30'}`}
                    >
                      {stage !== 0 ? (stage > 0 ? `+${stage}` : stage) : sp > 0 ? `+${sp}` : '·'}
                    </div>
                    {onChangeBoosts && (
                      <div className="flex gap-0.5 mt-1">
                        <button
                          type="button"
                          onClick={() => stepBoost(k, -1)}
                          disabled={stage <= -6}
                          aria-label={`Lower ${STAT_LABEL[k]} boost`}
                          data-testid={`boost-down-${side}-${k}`}
                          style={{ touchAction: 'manipulation' }}
                          className="flex-1 h-6 rounded bg-white/[0.05] border border-surface-hi text-xs leading-none text-text-mute disabled:opacity-25 hover:border-danger hover:text-danger"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => stepBoost(k, 1)}
                          disabled={stage >= 6}
                          aria-label={`Raise ${STAT_LABEL[k]} boost`}
                          data-testid={`boost-up-${side}-${k}`}
                          style={{ touchAction: 'manipulation' }}
                          className="flex-1 h-6 rounded bg-white/[0.05] border border-surface-hi text-xs leading-none text-text-mute disabled:opacity-25 hover:border-ok hover:text-ok"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/*
            Build + status chips. ability / item / nature are build-state info
            (on opp they jump to a picker for what-ifs; on your-side they open a
            detail sheet first). Status rides on the same row now that boosts
            have moved into the grid above - it's a transient battle edit so it
            jumps straight to its picker. Stop click/keydown bubbling so chips
            don't trip the card-surface swap.
          */}
          <div className="flex gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            {displayAbility ? (
              // The ✦ prefix flags an ability that was overridden by mega
              // evolution (changing the base ability has no effect right now).
              <StatChip
                icon={abilityFromMega ? '✦' : '🩸'}
                label={displayAbility}
                editable={!!onChangeAbility && !abilityFromMega}
                onClick={() => {
                  if (abilityFromMega) {
                    setAbilityDetailOpen(true);
                    return;
                  }
                  if (side === 'opp' && onChangeAbility) setPicker('ability');
                  else setAbilityDetailOpen(true);
                }}
              />
            ) : (
              // No ability set yet — render a placeholder chip so the user
              // can always tap to assign one, even when the synth fill
              // missed (no curated build + species' abilities table is empty).
              <StatChip label="+ Ability" onClick={() => (side === 'opp' && onChangeAbility ? setPicker('ability') : onEdit())} />
            )}
            {mon.item ? (
              <StatChip
                icon="🎒"
                label={mon.item}
                editable={side === 'opp'}
                onClick={() => (side === 'opp' && onChangeItem ? setPicker('item') : setChipDetail('item'))}
              />
            ) : (
              <StatChip label="+ Item" onClick={() => (side === 'opp' && onChangeItem ? setPicker('item') : onEdit())} />
            )}
            <StatChip
              icon="🌿"
              label={mon.nature}
              editable={side === 'opp'}
              onClick={() => (side === 'opp' && onChangeNature ? setPicker('nature') : setChipDetail('nature'))}
            />
            {onChangeStatus &&
              (hasStatus ? (
                <StatChip label={mon.status!} tone="warn" editable onClick={() => setPicker('status')} />
              ) : (
                <StatChip label="+ Status" onClick={() => setPicker('status')} />
              ))}
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
      <AbilityDetailSheet
        open={abilityDetailOpen}
        abilityName={displayAbility ?? null}
        // Always offer a change path so the button appears for your-side
        // mons too (where onChangeAbility isn't wired). When the inline
        // picker is available we use it; otherwise we route to onEdit so
        // the editor handles the change. Suppress only when the ability is
        // a mega override — changing the base ability has no effect.
        canChange={!abilityFromMega}
        onClose={() => setAbilityDetailOpen(false)}
        onChangeRequest={abilityFromMega ? undefined : onChangeAbility ? () => setPicker('ability') : () => onEdit()}
      />

      {/* Build-state chip detail sheets (item, nature). Open on chip tap
          and route "Change …" to an inline picker on the opp side so the
          user doesn't get bounced to the editor mid-calc, or to the
          editor on the your-side where item/nature are build-canonical. */}
      <ChipDetailSheet
        open={chipDetail === 'item'}
        title="Item"
        value={mon.item ?? null}
        detail={
          <p>The held item the calc applies — for example, type boosters add 20% damage to that move type, resist berries halve a super-effective hit.</p>
        }
        canChange
        changeLabel="Change item"
        onClose={() => setChipDetail(null)}
        onChangeRequest={onChangeItem ? () => setPicker('item') : () => onEdit()}
      />
      <ChipDetailSheet
        open={chipDetail === 'nature'}
        title="Nature"
        value={mon.nature}
        detail={(() => {
          if (naturePlus && natureMinus && naturePlus !== natureMinus) {
            return (
              <p>
                +10% <span className="text-ok">{STAT_LABEL[naturePlus]}</span>, −10% <span className="text-danger">{STAT_LABEL[natureMinus]}</span>
              </p>
            );
          }
          return <p className="opacity-70 italic">Neutral nature — no stat changes.</p>;
        })()}
        canChange
        changeLabel="Change nature"
        onClose={() => setChipDetail(null)}
        onChangeRequest={onChangeNature ? () => setPicker('nature') : () => onEdit()}
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
      {/* Inline item / nature pickers. The chip detail sheet's "Change …"
          button opens these whenever an onChange callback is wired so the
          user doesn't get bounced to the editor mid-calc. Wired for the
          opponent on BattleScreen; left undefined on the your-side card
          so the change button falls back to onEdit (build-state canonical). */}
      {onChangeItem && (
        <ItemPicker
          open={picker === 'item'}
          species={mon.species}
          onClose={() => setPicker(null)}
          onPick={(it) => {
            onChangeItem(it || undefined);
            setPicker(null);
          }}
        />
      )}
      {onChangeNature && (
        <NaturePicker
          open={picker === 'nature'}
          onClose={() => setPicker(null)}
          onPick={(n) => {
            onChangeNature(n);
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}
