import { ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function PickerShell({ open, onClose, title, children }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center justify-center p-3.5"
         onClick={onClose}>
      <div className="w-full max-w-md bg-bg-base bg-panel-gradient border border-surface-hi rounded-card p-3.5 max-h-[80vh] flex flex-col"
           onClick={e => e.stopPropagation()}>
        {title && <h3 className="text-base font-bold mb-2">{title}</h3>}
        {children}
      </div>
    </div>
  );
}
