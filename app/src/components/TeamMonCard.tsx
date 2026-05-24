import { calcStat } from '@smogon/calc';

import { GEN, toID } from '@/calc/gen';
import { effectiveAbility, megaFormeName, natureMods } from '@/calc/helpers';
import { Sprite } from '@/components/Sprite';
import { StatChip } from '@/components/StatChip';
import { TypeBadge } from '@/components/TypeBadge';
import { STAT_LABEL, STAT_ORDER, type SavedMon, type StatID } from '@/types';

interface Props {
  mon: SavedMon;
  /**
   * Called when the user taps anywhere on the card surface — opens the
   * MonEditor for this mon. The chips themselves stop propagation if they
   * want to do something else, but for a read-only team view we route them
   * all to the editor too.
   */
  onEdit?: () => void;
}

/**
 * Read-only "team builder" card — sprite, name, types, effective stats,
 * item / ability / nature, and the four moves. No battle-state UI (no HP
 * bar, no status, no boost chips, no Mega Active toggle) since the team
 * screen is about how the mon is *built*, not how it's faring in a fight.
 *
 * Designed to lay out in a responsive grid (1 column on mobile, 3 on
 * desktop) inside the TeamsScreen's expanded team card.
 */
export function TeamMonCard({ mon, onEdit }: Props) {
  const effectiveSpecies = mon.mega ? megaFormeName(mon.species, mon.mega, mon.item) : mon.species;
  const sp = GEN.species.get(toID(effectiveSpecies) as any) ?? GEN.species.get(toID(mon.species) as any);
  const types = (sp?.types ?? []) as string[];
  const baseStats = sp?.baseStats;
  const { plus, minus } = natureMods(mon.nature);
  const ability = effectiveAbility(mon.species, mon.mega, mon.ability, mon.item) ?? mon.ability;

  return (
    <div
      role={onEdit ? 'button' : undefined}
      tabIndex={onEdit ? 0 : undefined}
      onClick={onEdit}
      onKeyDown={
        onEdit
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onEdit();
              }
            }
          : undefined
      }
      className={`bg-surface border border-surface-hi rounded-card p-3 ${onEdit ? 'cursor-pointer' : ''}`}
    >
      {/* Header — mirrors MonCard's three-column layout: sprite, name +
          types, plus a small Mega badge when applicable (no toggle, since
          this view is read-only). */}
      <div className="flex gap-2.5 items-center mb-3">
        <Sprite species={effectiveSpecies} className="w-13 h-13 rounded-xl shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base truncate">{mon.species}</span>
            {mon.mega && <span className="text-[10px] uppercase tracking-wider text-accent font-bold">✦ Mega</span>}
          </div>
          <div className="flex gap-1 mt-1 flex-wrap">
            {types.map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
      </div>

      {/* Stats grid — same look as BattleScreen's MonCard so the eye picks
          up the same colour / SP cues. Values are post-nature, post-SP,
          post-mega when mega is set. */}
      <div className="grid grid-cols-6 gap-1 mb-2 text-center">
        {STAT_ORDER.map((k) => {
          const base = baseStats?.[k] ?? 0;
          const sp = mon.sps[k] ?? 0;
          const value = baseStats ? calcStat(GEN, k as StatID, base, 31, sp, 50, mon.nature) : 0;
          const isPlus = k === plus && plus !== minus;
          const isMinus = k === minus && plus !== minus;
          const arrow = isPlus ? '▲' : isMinus ? '▼' : '';
          const valCls = isPlus ? 'text-ok' : isMinus ? 'text-danger' : sp > 0 ? 'text-accent' : '';
          return (
            <div key={k} className={`rounded-md py-1 px-0.5 ${sp > 0 ? 'bg-accent/[0.07]' : 'bg-white/[0.03]'}`}>
              <div className="text-[8px] uppercase tracking-wider opacity-55 leading-none flex items-center justify-center gap-0.5">
                <span>{STAT_LABEL[k]}</span>
                {arrow && <span className={isPlus ? 'text-ok' : 'text-danger'}>{arrow}</span>}
              </div>
              <div className={`text-base font-bold tabular-nums leading-tight mt-0.5 ${valCls}`}>{value}</div>
              {sp > 0 ? <div className="text-[9px] text-accent leading-none">+{sp}</div> : <div className="text-[9px] opacity-30 leading-none">·</div>}
            </div>
          );
        })}
      </div>

      {/* Ability / Item / Nature chips — same StatChip styling as MonCard. */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {ability && <StatChip icon="🩸" label={ability} />}
        {mon.item && <StatChip icon="🎒" label={mon.item} />}
        <StatChip icon="🌿" label={mon.nature} />
      </div>

      {/* Moves — 2×2 grid with the move's type badge. Empty slots get a
          muted placeholder so the grid keeps its shape. */}
      <div className="grid grid-cols-2 gap-1.5">
        {mon.moves.map((name, i) => {
          if (!name) {
            return (
              <div
                key={i}
                className="flex items-center px-2 py-1 bg-white/[0.02] border border-surface-hi/40 rounded text-[11px] opacity-40"
              >
                — empty —
              </div>
            );
          }
          const moveData = GEN.moves.get(toID(name) as any) as { type?: string } | undefined;
          const type = moveData?.type;
          return (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-white/[0.04] border border-surface-hi/60 rounded">
              {type && <TypeBadge type={type} />}
              <span className="text-[12px] font-semibold truncate">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
