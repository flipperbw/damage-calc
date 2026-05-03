import { colorForType } from '@/data/types-palette';

interface Props {
  type: string;
  size?: 'sm' | 'md';
  /**
   * When true, the badge is sized to a fixed width that fits the longest
   * type name ("FIGHTING") so multiple badges in a vertical list align
   * their following content. Used in MoveRow so move names line up.
   */
  fixedWidth?: boolean;
}

export function TypeBadge({ type, size = 'sm', fixedWidth = false }: Props) {
  const px = size === 'md' ? 'text-[11px] px-2 py-0.5' : 'text-[9px] px-1.5 py-0.5';
  // Eyeballed widths: at 9px font, "FIGHTING" measures ~52px including
  // padding; 60 leaves a touch of breathing room. md size is wider.
  const fixed = fixedWidth ? (size === 'md' ? 'w-[68px]' : 'w-[58px]') : '';
  const align = fixedWidth ? 'inline-flex items-center justify-center' : 'inline-block';
  return (
    <span className={`${px} ${fixed} ${align} font-bold uppercase tracking-wider rounded text-white`} style={{ background: colorForType(type) }}>
      {type}
    </span>
  );
}
