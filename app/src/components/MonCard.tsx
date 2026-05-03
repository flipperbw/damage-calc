import { useState } from 'react';
import { Generations, toID } from '@smogon/calc';
import type { SavedMon, StatIDExceptHP, StatusName, MegaState } from '../types';
import { spriteUrl } from '../data/sprites';
import { TypeBadge } from './TypeBadge';
import { StatChip } from './StatChip';
import { HpBar } from './HpBar';
import { MegaToggle } from './MegaToggle';
import { StatusPicker } from './pickers/StatusPicker';
import { BoostPicker } from './pickers/BoostPicker';
import { AbilityPicker } from './pickers/AbilityPicker';
import { AbilityDetailSheet } from './AbilityDetailSheet';

const GEN = Generations.get(0);

interface Props {
  mon: SavedMon;
  maxHp: number;
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
  mon, maxHp, side, onEdit, onChangeHp, onChangeMega,
  onChangeStatus, onChangeBoosts, onChangeAbility, onSwap,
}: Props) {
  const sp = GEN.species.get(toID(mon.species) as any);
  const types = sp?.types ?? [];
  const dashed = side === 'opp' ? 'border-dashed border-danger/25' : 'border-surface-hi';

  const [picker, setPicker] = useState<'status' | 'boosts' | 'ability' | null>(null);
  const [abilityDetailOpen, setAbilityDetailOpen] = useState(false);

  const hasStatus = mon.status && mon.status !== 'Healthy';
  const hasBoosts =
    Object.values(mon.boosts).some(v => typeof v === 'number' && v !== 0);

  // The outer card is interactive only when onSwap is wired (opponent-side).
  // We use role="button" + a div instead of a <button> so we can nest other
  // buttons (sprite/name/chips) without invalid DOM (button-in-button).
  const swapProps = onSwap
    ? {
        role: 'button',
        tabIndex: 0,
        'aria-label': `Swap ${mon.species}`,
        'data-testid': `swap-${side}`,
        onClick: onSwap,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSwap();
          }
        },
        className: `bg-surface border ${dashed} rounded-card p-3 mb-2.5 cursor-pointer`,
      }
    : { className: `bg-surface border ${dashed} rounded-card p-3 mb-2.5` };

  function stop<E extends React.SyntheticEvent>(e: E, fn?: () => void) {
    e.stopPropagation();
    fn?.();
  }

  return (
    <div {...swapProps}>
      <div className="flex gap-2.5 items-center mb-2">
        <button
          onClick={e => stop(e, onEdit)}
          data-testid={`edit-sprite-${side}`}
        >
          <img src={spriteUrl(mon.species)} alt={mon.species} className="w-13 h-13 rounded-xl" />
        </button>
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <button
              onClick={e => stop(e, onEdit)}
              data-testid={`edit-name-${side}`}
              className="font-bold text-base text-left"
            >{mon.species}</button>
            <span className="text-[10px] opacity-50">L50</span>
          </div>
          <div className="flex gap-1 mt-1">
            {types.map(t => <TypeBadge key={t} type={t as string} />)}
          </div>
        </div>
      </div>

      {/*
        Stop click/keydown bubbling for inner controls when the card surface is
        a swap target — chips, HpBar, and MegaToggle each route to their own
        handlers, not the swap.
      */}
      <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
        <HpBar
          current={mon.currentHp}
          max={maxHp}
          showRaw={side === 'you'}
          onChange={onChangeHp}
        />

        <div className="flex gap-1.5 mt-2 flex-wrap">
          {mon.ability && (
            // Tapping the ability chip opens the read-only detail sheet —
            // not the editor. The sheet's "Change ability" button (rendered
            // only when onChangeAbility is wired) routes to AbilityPicker.
            <StatChip
              icon="🩸"
              label={mon.ability}
              editable={!!onChangeAbility}
              onClick={() => setAbilityDetailOpen(true)}
            />
          )}
          {mon.item && (
            <StatChip icon="🎒" label={mon.item} editable={side === 'opp'} onClick={onEdit} />
          )}
          <StatChip icon="🌿" label={mon.nature} editable={side === 'opp'} onClick={onEdit} />

          {/* Status: chip when set, "Status" pill when not. */}
          {hasStatus ? (
            <StatChip
              label={mon.status!}
              tone="warn"
              editable={!!onChangeStatus}
              onClick={onChangeStatus ? () => setPicker('status') : undefined}
            />
          ) : onChangeStatus ? (
            <StatChip label="+ Status" onClick={() => setPicker('status')} />
          ) : null}

          {/* Boosts: one chip per non-zero boost, plus a "+ Boost" pill. */}
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
          {!hasBoosts && onChangeBoosts && (
            <StatChip label="+ Boost" onClick={() => setPicker('boosts')} />
          )}

          <MegaToggle mega={mon.mega} species={mon.species} item={mon.item} onChange={onChangeMega} />
        </div>
      </div>

      {onChangeStatus && (
        <StatusPicker
          open={picker === 'status'}
          current={mon.status}
          onClose={() => setPicker(null)}
          onPick={status => onChangeStatus(status === 'Healthy' ? undefined : status)}
        />
      )}
      {onChangeBoosts && (
        <BoostPicker
          open={picker === 'boosts'}
          boosts={mon.boosts}
          onClose={() => setPicker(null)}
          onSave={onChangeBoosts}
        />
      )}
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
          onPick={a => { onChangeAbility(a); setPicker(null); }}
        />
      )}
    </div>
  );
}
