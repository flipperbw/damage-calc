interface Props {
  icon?: string;
  label: string;
  tone?: 'default' | 'warn' | 'boost';
  editable?: boolean;
  onClick?: () => void;
}

export function StatChip({ icon, label, tone = 'default', editable, onClick }: Props) {
  const toneClass =
    tone === 'warn'
      ? 'bg-warn/10 border-warn/30 text-warn'
      : tone === 'boost'
        ? 'bg-ok/10 border-ok/30 text-ok'
        : 'bg-surface border-surface-hi text-text';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-0.5 rounded-lg border text-[11px] flex gap-1 items-center ${toneClass} ${editable ? 'after:content-["✎"] after:opacity-40 after:ml-1' : ''}`}
    >
      {icon && <span>{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
