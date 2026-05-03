import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

import { PickerShell } from '@/components/pickers/PickerShell';

/**
 * In-app confirm/prompt dialogs that replace `window.confirm` / `window.prompt` /
 * `window.alert`. iOS Brave (and several other mobile browsers) suppress the
 * native dialogs by default - when that happens `window.confirm` returns
 * false silently, so a user who tapped Delete sees no UI and reports "the
 * button does nothing." Routing every yes/no through our own modal makes
 * the flow deterministic on every platform.
 *
 * Wire once at the app root (`<ConfirmProvider>` wraps the tree) and call
 * `useConfirm()` / `usePrompt()` from any child.
 */

interface ConfirmOpts {
  title?: string;
  body?: string;
  /** Tinges the OK button red and renames it "Remove" by default. */
  danger?: boolean;
  okLabel?: string;
  cancelLabel?: string;
}

interface PromptOpts {
  title?: string;
  body?: string;
  defaultValue?: string;
  okLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
}

interface ConfirmState extends ConfirmOpts {
  body: string;
  resolve: (ok: boolean) => void;
}
interface PromptState extends PromptOpts {
  body: string;
  resolve: (value: string | null) => void;
}

interface ConfirmContextValue {
  confirm: (body: string, opts?: ConfirmOpts) => Promise<boolean>;
  prompt: (body: string, opts?: PromptOpts) => Promise<string | null>;
  alert: (body: string, opts?: { title?: string; okLabel?: string }) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [promptState, setPromptState] = useState<PromptState | null>(null);
  const [promptValue, setPromptValue] = useState('');
  // Track whether the user actually picked OK/Cancel so we resolve consistently
  // when the modal closes (e.g. backdrop tap should resolve as cancel).
  const settledRef = useRef(false);
  // Mirror the latest pending state so a rapid second call can resolve the
  // first one with its cancel value before installing the new state. Using a
  // ref avoids stale closures inside the useCallback dispatchers.
  const confirmStateRef = useRef<ConfirmState | null>(null);
  const promptStateRef = useRef<PromptState | null>(null);

  const confirm = useCallback((body: string, opts?: ConfirmOpts) => {
    return new Promise<boolean>((resolve) => {
      const pending = confirmStateRef.current;
      if (pending && !settledRef.current) {
        // Resolve the prior call as cancel so its caller doesn't hang.
        pending.resolve(false);
      }
      settledRef.current = false;
      const next: ConfirmState = { body, ...opts, resolve };
      confirmStateRef.current = next;
      setConfirmState(next);
    });
  }, []);

  const prompt = useCallback((body: string, opts?: PromptOpts) => {
    return new Promise<string | null>((resolve) => {
      const pending = promptStateRef.current;
      if (pending && !settledRef.current) {
        pending.resolve(null);
      }
      settledRef.current = false;
      setPromptValue(opts?.defaultValue ?? '');
      const next: PromptState = { body, ...opts, resolve };
      promptStateRef.current = next;
      setPromptState(next);
    });
  }, []);

  const alert = useCallback((body: string, opts?: { title?: string; okLabel?: string }) => {
    return new Promise<void>((resolve) => {
      const pending = confirmStateRef.current;
      if (pending && !settledRef.current) {
        pending.resolve(false);
      }
      settledRef.current = false;
      const next: ConfirmState = {
        body,
        title: opts?.title,
        okLabel: opts?.okLabel ?? 'OK',
        cancelLabel: '',
        resolve: () => resolve(),
      };
      confirmStateRef.current = next;
      setConfirmState(next);
    });
  }, []);

  function closeConfirm(ok: boolean) {
    if (!confirmState || settledRef.current) return;
    settledRef.current = true;
    confirmState.resolve(ok);
    confirmStateRef.current = null;
    setConfirmState(null);
  }

  function closePrompt(value: string | null) {
    if (!promptState || settledRef.current) return;
    settledRef.current = true;
    promptState.resolve(value);
    promptStateRef.current = null;
    setPromptState(null);
  }

  return (
    <ConfirmContext.Provider value={{ confirm, prompt, alert }}>
      {children}

      <PickerShell open={!!confirmState} onClose={() => closeConfirm(false)} title={confirmState?.title} align="centered">
        {confirmState && (
          <div data-testid="confirm-dialog" className="flex flex-col gap-3">
            <div className="text-sm whitespace-pre-line">{confirmState.body}</div>
            <div className="flex gap-2 justify-end">
              {confirmState.cancelLabel !== '' && (
                <button
                  type="button"
                  data-testid="confirm-cancel"
                  onClick={() => closeConfirm(false)}
                  className="px-4 py-2 rounded-lg bg-surface border border-surface-hi text-sm"
                >
                  {confirmState.cancelLabel ?? 'Cancel'}
                </button>
              )}
              <button
                type="button"
                data-testid="confirm-ok"
                onClick={() => closeConfirm(true)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                  confirmState.danger ? 'bg-danger/20 border border-danger/40 text-danger' : 'bg-accent text-white'
                }`}
              >
                {confirmState.okLabel ?? (confirmState.danger ? 'Remove' : 'OK')}
              </button>
            </div>
          </div>
        )}
      </PickerShell>

      <PickerShell open={!!promptState} onClose={() => closePrompt(null)} title={promptState?.title} align="centered">
        {promptState && (
          <form
            data-testid="prompt-dialog"
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              closePrompt(promptValue);
            }}
          >
            {promptState.body && <div className="text-sm whitespace-pre-line">{promptState.body}</div>}
            <input
              type="text"
              data-testid="prompt-input"
              autoFocus
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={promptState.placeholder}
              className="w-full px-3 py-2 rounded-lg bg-surface border border-surface-hi text-base"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                data-testid="prompt-cancel"
                onClick={() => closePrompt(null)}
                className="px-4 py-2 rounded-lg bg-surface border border-surface-hi text-sm"
              >
                {promptState.cancelLabel ?? 'Cancel'}
              </button>
              <button type="submit" data-testid="prompt-ok" className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-semibold">
                {promptState.okLabel ?? 'OK'}
              </button>
            </div>
          </form>
        )}
      </PickerShell>
    </ConfirmContext.Provider>
  );
}

function useConfirmContext(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm/usePrompt must be used inside <ConfirmProvider>');
  }
  return ctx;
}

/** Returns an async confirm() function. Resolves to true on OK, false otherwise. */
export function useConfirm() {
  return useConfirmContext().confirm;
}

/** Returns an async prompt() function. Resolves to the entered string or null on cancel. */
export function usePrompt() {
  return useConfirmContext().prompt;
}

/** Returns an async alert() function. Resolves once the user dismisses. */
export function useAlert() {
  return useConfirmContext().alert;
}
