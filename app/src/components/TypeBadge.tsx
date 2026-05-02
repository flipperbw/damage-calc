import { colorForType } from '../data/types-palette';

interface Props {
  type: string;
  size?: 'sm' | 'md';
}

export function TypeBadge({ type, size = 'sm' }: Props) {
  const px = size === 'md' ? 'text-[11px] px-2 py-0.5' : 'text-[9px] px-1.5 py-0.5';
  return (
    <span
      className={`${px} font-bold uppercase tracking-wider rounded text-white`}
      style={{ background: colorForType(type) }}
    >
      {type}
    </span>
  );
}
