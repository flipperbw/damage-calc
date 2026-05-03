interface SectionToggleProps {
  open: boolean;
  onToggle: () => void;
  title: string;
  testId?: string;
  rightSlot?: React.ReactNode;
}

export function SectionToggle({ open, onToggle, title, testId, rightSlot }: SectionToggleProps) {
  return (
    <div className="flex items-center justify-between mb-2 gap-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        data-testid={testId}
        className="shrink-0 flex items-center gap-2 text-base font-bold py-1 -ml-1 px-1 rounded hover:bg-white/[0.03] whitespace-nowrap"
      >
        <span aria-hidden className="text-xs opacity-60 inline-block w-3 text-center">
          {open ? '▾' : '▸'}
        </span>
        <span>{title}</span>
      </button>
      {rightSlot}
    </div>
  );
}
