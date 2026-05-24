import { useState } from 'react';
import { toast } from 'sonner';

import { useConfirm } from '@/components/ConfirmDialog';
import { FeedbackDialog } from '@/components/FeedbackDialog';
import { PERSISTED_KEYS, useStore } from '@/store';
import { isImportShape } from '@/store/import-shape';
import type { AppState } from '@/types';

const APP_VERSION = '0.1.0';
const REPO_URL = 'https://github.com/smogon/damage-calc';

function pickPersisted(state: any): Partial<AppState> {
  const out: any = {};
  for (const k of PERSISTED_KEYS) {
    if (k in state) out[k] = state[k];
  }
  return out;
}

export function SettingsScreen() {
  const notation = useStore((s) => s.notation);
  const setNotation = useStore((s) => s.setNotation);
  const clearAllRecents = useStore((s) => s.clearAllRecents);
  const resetAll = useStore((s) => s.resetAll);
  const confirm = useConfirm();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  function exportJson() {
    const state = useStore.getState();
    const persisted = pickPersisted(state);
    const blob = new Blob([JSON.stringify(persisted, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `futuresight-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export downloaded');
  }

  async function importJson() {
    const file = await pickFile();
    if (!file) return;
    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      toast.error('Invalid JSON file');
      return;
    }
    if (!isImportShape(parsed)) {
      toast.error("That file doesn't look like a FutureSight export");
      return;
    }
    const slice = pickPersisted(parsed);
    // Merge into existing state, preserving action functions and transient UI.
    useStore.setState((s) => ({ ...s, ...slice }));
    toast.success('Import complete');
  }

  function clearRecents() {
    clearAllRecents();
    toast.success('Recent opponents cleared');
  }

  async function handleResetAll() {
    const ok = await confirm('All teams, recent opponents, and settings will be permanently deleted.', {
      title: 'Reset everything?',
      danger: true,
      okLabel: 'Reset',
    });
    if (ok) {
      resetAll();
      toast.success('Reset complete');
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Settings</h2>

      <Section title="Notation">
        <Toggle value={notation === 'percent'} onClick={() => setNotation('percent')} label="100%" />
        <Toggle value={notation === 'pixels'} onClick={() => setNotation('pixels')} label="48ths" />
      </Section>

      <Section title="Data">
        <Action label="Export all data" onClick={exportJson} />
        <Action label="Import data" onClick={importJson} />
        <Action label="Clear recent opponents" onClick={clearRecents} />
        <Action label="Reset everything" tone="danger" onClick={handleResetAll} />
      </Section>

      <Section title="Feedback">
        <Action label="Send feedback" onClick={() => setFeedbackOpen(true)} />
      </Section>

      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      <div className="mt-8 pt-4 border-t border-surface-hi text-[11px] opacity-50">
        <div>FutureSight v{APP_VERSION}</div>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-accent">
          {REPO_URL.replace(/^https?:\/\//, '')}
        </a>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="text-xxs uppercase tracking-wider opacity-55 mb-2">{title}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Toggle({ value, onClick, label }: { value: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm ${value ? 'bg-accent-gradient text-white' : 'bg-surface border border-surface-hi opacity-70'}`}
    >
      {label}
    </button>
  );
}

function Action({ label, onClick, tone }: { label: string; onClick: () => void; tone?: 'danger' }) {
  const c = tone === 'danger' ? 'bg-danger/10 border-danger/30 text-danger' : 'bg-surface border-surface-hi';
  return (
    <button onClick={onClick} className={`w-full text-left px-3 py-2 rounded-lg border ${c} text-sm`}>
      {label}
    </button>
  );
}

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    let settled = false;
    function settle(value: File | null) {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      resolve(value);
    }
    // Fallback for browsers that don't fire `cancel` (Safari/Firefox): when
    // the window regains focus after the picker closes, give the change event
    // a beat to fire; if no file was selected, treat it as a cancellation.
    function onFocus() {
      setTimeout(() => {
        if (!settled && (input.files?.length ?? 0) === 0) settle(null);
      }, 200);
    }

    input.onchange = () => settle(input.files?.[0] ?? null);
    input.oncancel = () => settle(null);
    window.addEventListener('focus', onFocus);
    input.click();
  });
}
