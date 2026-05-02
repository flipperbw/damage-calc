import { useState } from 'react';
import { useStore } from '../store';
import { FieldDrawer } from './FieldDrawer';

export function FieldBar() {
  const field = useStore(s => s.field);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex gap-1.5 mb-3.5 flex-wrap">
        {field.weather && (
          <Pill active onClick={() => setOpen(true)}>
            {weatherIcon(field.weather)} {field.weather}
          </Pill>
        )}
        {field.terrain && (
          <Pill active onClick={() => setOpen(true)}>
            ⚡ {field.terrain}
          </Pill>
        )}
        <Pill onClick={() => setOpen(true)}>＋ Field</Pill>
      </div>
      <FieldDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function weatherIcon(w: string) {
  return ({ Sun: '☀', Rain: '🌧', Sand: '🟫', Snow: '❄' } as Record<string, string>)[w] ?? '';
}

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const cls = active
    ? 'bg-warn/15 border-warn/40 text-warn'
    : 'bg-surface border-surface-hi opacity-70';
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-2.5 py-1 rounded-full border ${cls}`}
    >
      {children}
    </button>
  );
}
