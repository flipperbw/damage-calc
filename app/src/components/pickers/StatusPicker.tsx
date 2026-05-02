import { PickerShell } from './PickerShell';
import type { StatusName } from '../../types';

const OPTIONS: StatusName[] = [
  'Healthy',
  'Poisoned',
  'Badly Poisoned',
  'Burned',
  'Paralyzed',
  'Asleep',
  'Frozen',
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
        {OPTIONS.map(opt => {
          const active = (current ?? 'Healthy') === opt;
          return (
            <button
              key={opt}
              onClick={() => { onPick(opt); onClose(); }}
              className={`text-left px-3 py-2 rounded-lg text-sm border ${
                active
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-surface border-surface-hi'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </PickerShell>
  );
}
