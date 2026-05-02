import { useState } from 'react';
import { Generations } from '@smogon/calc';
import { TypeBadge } from '../TypeBadge';
import { MovePicker } from '../pickers/MovePicker';

const GEN = Generations.get(0);

function moveTypeOf(name: string): string {
  if (!name) return '???';
  const m = GEN.moves.get(name as any);
  return (m?.type as string) ?? '???';
}

interface Props {
  moves: [string, string, string, string];
  onChange: (moves: [string, string, string, string]) => void;
}

export function MoveSlots({ moves, onChange }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <div>
      {moves.map((m, i) => (
        <div key={i} onClick={() => setEditing(i)}
             className="flex justify-between items-center bg-surface border border-surface-hi rounded-lg px-3 py-2 mb-1.5 cursor-pointer">
          <div className="flex items-center gap-2">
            {m ? <><TypeBadge type={moveTypeOf(m)} /><b>{m}</b></> : <span className="text-text-mute">— empty —</span>}
          </div>
          <span className="opacity-40">▾</span>
        </div>
      ))}
      <MovePicker
        open={editing !== null}
        onClose={() => setEditing(null)}
        onPick={(name) => {
          if (editing === null) return;
          const next = [...moves] as [string, string, string, string];
          next[editing] = name;
          onChange(next);
        }}
      />
    </div>
  );
}
