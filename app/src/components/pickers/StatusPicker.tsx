import { PickerShell } from '@/components/pickers/PickerShell';
import type { StatusName } from '@/types';

const OPTIONS: ReadonlyArray<{ name: StatusName; desc: string }> = [
  { name: 'Healthy', desc: 'No status condition.' },
  { name: 'Poisoned', desc: 'Residual damage 1/8 max HP per turn.' },
  { name: 'Badly Poisoned', desc: 'Escalating residual — 1/16, 2/16, 3/16, … per turn.' },
  { name: 'Burned', desc: 'Halves Attack on physical moves. 1/16 residual per turn.' },
  { name: 'Paralyzed', desc: 'Halves Speed. 25% chance the move fails (full para).' },
  { name: 'Asleep', desc: 'Cannot act for 1–3 turns.' },
  { name: 'Frozen', desc: 'Cannot act until thawed by a Fire-hit or thawing move.' },
];

interface Props {
  open: boolean;
  current?: StatusName;
  onClose: () => void;
  onPick: (status: StatusName) => void;
}

export function StatusPicker({ open, current, onClose, onPick }: Props) {
  return (
    <PickerShell open={open} onClose={onClose} title="Status">
      <div className="flex flex-col gap-1.5">
        {OPTIONS.map(({ name, desc }) => {
          const active = (current ?? 'Healthy') === name;
          return (
            <button
              key={name}
              onClick={() => {
                onPick(name);
                onClose();
              }}
              className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                active ? 'bg-accent/15 border-accent text-accent' : 'bg-surface border-surface-hi hover:bg-surface-hi/30'
              }`}
            >
              <div className="font-semibold text-sm">{name}</div>
              <div className={`text-[11px] mt-0.5 ${active ? 'opacity-80' : 'opacity-60'}`}>{desc}</div>
            </button>
          );
        })}
      </div>
    </PickerShell>
  );
}
