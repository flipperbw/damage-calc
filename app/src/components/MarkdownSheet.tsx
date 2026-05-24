import { MarkdownView } from '@/components/MarkdownView';

interface Props {
  open: boolean;
  title: string;
  source: string;
  onClose: () => void;
}

/**
 * Right-side modal / bottom sheet that displays a markdown document.
 * Layout matches ShowdownImportDialog and FeedbackDialog so the three
 * shells feel consistent: bottom sheet on mobile, right-edge modal on
 * desktop, with a back-arrow header.
 */
export function MarkdownSheet({ open, title, source, onClose }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center md:justify-end" onClick={onClose}>
      <div
        className="w-full md:w-[480px] md:h-screen bg-bg-base bg-panel-gradient border border-surface-hi rounded-t-card md:rounded-none max-h-[90vh] md:max-h-screen flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-4 pt-4 mb-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,255,255,0.15)' }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-lg opacity-70 select-none cursor-pointer"
          >
            ←
          </button>
          <span className="font-bold">{title}</span>
          <div className="w-[44px]" aria-hidden />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 [overscroll-behavior:contain]">
          <MarkdownView source={source} />
        </div>
      </div>
    </div>
  );
}
