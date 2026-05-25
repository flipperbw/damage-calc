import { useState } from 'react';

import type { ComputedStats } from '@/calc/adapter';
import { GEN, toID } from '@/calc/gen';
import { effectiveAbility, megaFormeName, natureMods } from '@/calc/helpers';
import { AbilityDetailSheet } from '@/components/AbilityDetailSheet';
import { ChipDetailSheet } from '@/components/ChipDetailSheet';
import { HpBar } from '@/components/HpBar';
import { MegaToggle } from '@/components/MegaToggle';
import { AbilityPicker } from '@/components/pickers/AbilityPicker';
import { BoostPicker } from '@/components/pickers/BoostPicker';
import { ItemPicker } from '@/components/pickers/ItemPicker';
import { NaturePicker } from '@/components/pickers/NaturePicker';
import { StatusPicker } from '@/components/pickers/StatusPicker';
import { StatChip } from '@/components/StatChip';
import { Sprite } from '@/components/Sprite';
import { TypeBadge } from '@/components/TypeBadge';
import { STAT_LABEL, STAT_ORDER_NO_HP, type MegaState, type SavedMon, type StatIDExceptHP, type StatusName } from '@/types';

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
  onChangeItem,
  onChangeNature,
  onSwap,
}: Props) {
  // When a mega is active, look up the mega forme's species so types
  // reflect the transform (Mega Charizard X is Fire/Dragon; Mega Gyarados
  // is Water/Dark; etc.). Falls back to base when calc lacks the forme.
  const effectiveSpecies = mon.mega ? megaFormeName(mon.species, mon.mega, mon.item) : mon.species;
  const sp = GEN.species.get(toID(effectiveSpecies) as any) ?? GEN.species.get(toID(mon.species) as any);
  const types = sp?.types ?? [];
  // Mega evolution overrides the user's base ability (Mega Charizard X is
  // Tough Claws; Mega Gyarados is Mold Breaker). Display the in-effect
  // ability so the chip matches what calc actually uses.
  const displayAbility = effectiveAbility(mon.species, mon.mega, mon.ability, mon.item);
  const abilityFromMega = !!mon.mega && displayAbility !== mon.ability;
  const dashed = side === 'opp' ? 'border-dashed border-danger/25' : 'border-surface-hi';

  const [picker, setPicker] = useState<'status' | 'boosts' | 'ability' | 'item' | 'nature' | null>(null);
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
        className: `bg-surface border ${dashed} rounded-card p-3 mb-3 cursor-pointer`,
      }
    : { className: `bg-surface border ${dashed} rounded-card p-3 mb-3` };

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

      {/* HP gauge sits above the stats row — the slider thumb is the
          most touched control on the card, so keeping it near the top
          lets the user adjust it without skipping past the stats they
          might not need to read on each interaction. */}
      <div className="mb-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        <HpBar current={mon.currentHp} max={maxHp} onChange={onChangeHp} />
      </div>

      {/* Stats row - five cells, atk/def/spa/spd/spe. HP lives in the HpBar
          above (max value baked into the "HP N" label) so we don't render
          two competing HP indicators. Each cell shows the stat value with
          a small indicator line for nature (▲/▼) and EV allocation
          ("+N SP"). Tabular numerals so values line up.

          Tapping any stat cell opens the editor on BOTH sides — viewing
          full stats is the natural reason to drill in, and routing to
          edit (rather than the opp-side swap) keeps the affordance
          intuitive. We override surface bubbling explicitly here. */}
      {stats && (
        <div
          className="grid grid-cols-5 gap-1 mb-3 text-center"
          role="button"
          tabIndex={0}
          aria-label={`Edit ${mon.species} stats`}
          onClick={(e) => stop(e, onEdit)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') stop(e, onEdit);
          }}
        >
          {STAT_ORDER_NO_HP.map((k) => {
            const sp = mon.sps[k] ?? 0;
            const isPlus = k === naturePlus && naturePlus !== natureMinus;
            const isMinus = k === natureMinus && naturePlus !== natureMinus;
            const valCls = isPlus ? 'text-ok' : isMinus ? 'text-danger' : sp > 0 ? 'text-accent' : '';
            return (
              <div key={k} className={`rounded-md py-1 px-0.5 ${sp > 0 ? 'bg-accent/[0.07]' : 'bg-white/[0.03]'}`}>
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
        a swap target — chips and MegaToggle each route to their own handlers,
        not the swap. (HpBar gets its own wrapper above the stats grid.)
      */}
      <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
        {/* Row 1: ability / item / nature — build-state info chips.
            On the opp side, every chip jumps straight to its picker
            (testing what-ifs is the common opp interaction; the detail
            sheet would be friction). On your-side these chips open the
            descriptive sheet first, since the change action there opens
            the full editor and the inline info is more useful. */}
        <div className="flex gap-1.5 flex-wrap mb-2">
          {displayAbility && (
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
          )}
          {mon.item && (
            <StatChip
              icon="🎒"
              label={mon.item}
              editable={side === 'opp'}
              onClick={() => (side === 'opp' && onChangeItem ? setPicker('item') : setChipDetail('item'))}
            />
          )}
          <StatChip
            icon="🌿"
            label={mon.nature}
            editable={side === 'opp'}
            onClick={() => (side === 'opp' && onChangeNature ? setPicker('nature') : setChipDetail('nature'))}
          />
        </div>

        {/* Row 2: Boost + Status side by side. Both are battle-state
            controls (transient mid-fight edits, not build edits), so
            tapping a chip jumps straight to its picker — no intermediate
            detail sheet. Build-state chips (ability/item/nature) above
            still route through a detail sheet first because their info
            is worth surfacing. */}
        {(onChangeBoosts || onChangeStatus) && (
          <div className="flex gap-1.5 flex-wrap mt-1.5">
            {onChangeBoosts &&
              (hasBoosts ? (
                (Object.entries(mon.boosts) as [StatIDExceptHP, number][]).map(([k, v]) =>
                  v !== 0 ? (
                    <StatChip
                      key={k}
                      label={`${v > 0 ? '+' : ''}${v} ${k}`}
                      tone={v > 0 ? 'boost' : 'drop'}
                      editable
                      onClick={() => setPicker('boosts')}
                    />
                  ) : null,
                )
              ) : (
                <StatChip label="+ Boost" onClick={() => setPicker('boosts')} />
              ))}
            {onChangeStatus &&
              (hasStatus ? (
                <StatChip label={mon.status!} tone="warn" editable onClick={() => setPicker('status')} />
              ) : (
                <StatChip label="+ Status" onClick={() => setPicker('status')} />
              ))}
          </div>
        )}
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
