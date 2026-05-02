import { Generations, toID } from '@smogon/calc';
import type { SavedMon, StatIDExceptHP, MegaState } from '../types';
import { spriteUrl } from '../data/sprites';
import { TypeBadge } from './TypeBadge';
import { StatChip } from './StatChip';
import { HpBar } from './HpBar';
import { MegaToggle } from './MegaToggle';

const GEN = Generations.get(0);

interface Props {
  mon: SavedMon;
  maxHp: number;
  side: 'you' | 'opp';
  onEdit: () => void;
  onChangeHp: (hp: number) => void;
  onChangeMega: (mega: MegaState) => void;
}

export function MonCard({ mon, maxHp, side, onEdit, onChangeHp, onChangeMega }: Props) {
  const sp = GEN.species.get(toID(mon.species) as any);
  const types = sp?.types ?? [];
  const dashed = side === 'opp' ? 'border-dashed border-danger/25' : 'border-surface-hi';

  return (
    <div className={`bg-surface border ${dashed} rounded-card p-3 mb-2.5`}>
      <div className="flex gap-2.5 items-center mb-2">
        <button onClick={onEdit}>
          <img src={spriteUrl(mon.species)} alt={mon.species} className="w-13 h-13 rounded-xl" />
        </button>
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <button onClick={onEdit} className="font-bold text-base text-left">{mon.species}</button>
            <span className="text-[10px] opacity-50">L50</span>
          </div>
          <div className="flex gap-1 mt-1">
            {types.map(t => <TypeBadge key={t} type={t as string} />)}
          </div>
        </div>
      </div>

      <HpBar
        current={mon.currentHp}
        max={maxHp}
        showRaw={side === 'you'}
        onChange={onChangeHp}
      />

      <div className="flex gap-1.5 mt-2 flex-wrap">
        {mon.ability && (
          <StatChip icon="🩸" label={mon.ability} editable={side === 'opp'} onClick={onEdit} />
        )}
        {mon.item && (
          <StatChip icon="🎒" label={mon.item} editable={side === 'opp'} onClick={onEdit} />
        )}
        <StatChip icon="🌿" label={mon.nature} editable={side === 'opp'} onClick={onEdit} />
        {mon.status && mon.status !== 'Healthy' && (
          <StatChip label={mon.status} tone="warn" />
        )}
        {(Object.entries(mon.boosts) as [StatIDExceptHP, number][]).map(([k, v]) =>
          v !== 0 ? (
            <StatChip key={k} label={`${v > 0 ? '+' : ''}${v} ${k}`} tone="boost" />
          ) : null,
        )}
        <MegaToggle mega={mon.mega} species={mon.species} onChange={onChangeMega} />
      </div>
    </div>
  );
}
