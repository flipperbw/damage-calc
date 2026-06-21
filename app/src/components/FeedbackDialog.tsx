import { useState } from 'react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Category = 'bug' | 'feature' | 'other';

/**
 * Web3Forms endpoint. POST JSON containing `access_key` (UUID); they
 * deliver each submission to the email the key was generated for
 * (flipperbw@gmail.com). The key is safe to commit — Web3Forms blocks
 * server-side IPs by default, so a leaked key can't be used by scripts
 * outside a browser context, and they accept submissions only from the
 * domains/origins on file for that key once configured.
 *
 * If the key ever needs to rotate, regenerate at web3forms.com using the
 * destination email and swap WEB3FORMS_KEY below.
 */
const WEB3FORMS_ENDPOINT = 'https://api.web3forms.com/submit';
const WEB3FORMS_KEY = '7a1a1b29-905f-4459-b412-fb330a71d5c6';

const CATEGORIES: Array<{ id: Category; label: string }> = [
  { id: 'bug', label: 'Bug' },
  { id: 'feature', label: 'Feature request' },
  { id: 'other', label: 'Other' },
];

export function FeedbackDialog({ open, onClose }: Props) {
  const [category, setCategory] = useState<Category>('bug');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  // Hidden honeypot — if a bot fills this, we drop the submission. Real
  // users never see or touch it because the field is visually hidden but
  // not display:none (some bots skip display:none fields).
  const [honey, setHoney] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  if (!open) return null;

  function close() {
    // Reset only after the modal animation would settle — keep it simple
    // and reset synchronously; the next open is always a fresh draft.
    setMessage('');
    setEmail('');
    setCategory('bug');
    setStatus('idle');
    onClose();
  }

  async function submit() {
    if (honey) {
      // Spam — silently succeed so the bot can't iterate against us.
      close();
      return;
    }
    if (!message.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch(WEB3FORMS_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          access_key: WEB3FORMS_KEY,
          subject: `[FutureSight ${category}] ${message.slice(0, 60).replace(/\s+/g, ' ').trim()}`,
          // Web3Forms uses `email` as the reply-to / from-address; falling
          // back to a sentinel keeps the email body consistent even when
          // the user didn't share theirs.
          email: email || 'anonymous@futuresight.gg',
          from_name: 'FutureSight feedback',
          category,
          message,
          page: typeof window !== 'undefined' ? window.location.href : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          // Web3Forms' built-in honeypot field. If a bot fills it the
          // submission is silently dropped server-side.
          botcheck: honey,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: unknown; message?: string };
      const success = json.success === true || json.success === 'true';
      if (!res.ok || !success) {
        throw new Error(typeof json.message === 'string' ? json.message : `HTTP ${res.status}`);
      }
      setStatus('sent');
      toast.success('Feedback sent — thanks!');
    } catch (err) {
      setStatus('idle');
      toast.error("Couldn't send — check your connection and retry");
      // eslint-disable-next-line no-console
      console.warn('[FeedbackDialog] submit failed:', err);
    }
  }

  const canSend = status === 'idle' && message.trim().length > 0;

  return (
    <div className="fixed inset-0 z-30 bg-black/60 flex items-end md:items-center md:justify-end" onClick={close}>
      <div
        className="w-full md:w-[480px] md:h-screen bg-bg-base bg-panel-gradient border border-surface-hi rounded-t-card md:rounded-none max-h-[90vh] md:max-h-screen flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-4 pt-4 mb-3 shrink-0">
          <button
            type="button"
            onClick={close}
            aria-label="Close feedback"
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,255,255,0.15)' }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-lg opacity-70 select-none cursor-pointer transition-opacity hover:opacity-100"
          >
            ←
          </button>
          <span className="font-bold">Send feedback</span>
          <div className="w-[44px]" aria-hidden />
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 [overscroll-behavior:contain]">
          {status === 'sent' ? (
            <div className="text-center py-10 px-4">
              <div className="text-3xl mb-3" aria-hidden>
                ✓
              </div>
              <div className="font-semibold mb-1">Thanks!</div>
              <div className="text-sm opacity-70">
                Your message is on its way. {email ? "I'll reply if it needs a follow-up." : 'Add an email next time if you want a reply.'}
              </div>
              <button
                type="button"
                onClick={close}
                className="mt-6 px-5 py-2 rounded-card bg-surface border border-surface-hi text-sm font-semibold transition-colors hover:border-accent/50 hover:bg-accent/[0.06]"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="text-xxs uppercase tracking-wider opacity-55 mt-2 mb-2">Type</div>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    aria-pressed={category === c.id}
                    className={`px-3 py-1.5 rounded-lg text-sm transition ${category === c.id ? 'bg-accent-gradient text-white' : 'bg-surface border border-surface-hi opacity-70 hover:opacity-100 hover:border-accent/40'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="text-xxs uppercase tracking-wider opacity-55 mt-5 mb-2">Message</div>
              <textarea
                autoFocus
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  category === 'bug'
                    ? 'What happened?'
                    : category === 'feature'
                      ? "What's the idea?"
                      : 'Sup?'
                }
                data-testid="feedback-message"
                // 16px keeps iOS Safari from auto-zooming on focus.
                className="w-full h-40 bg-surface border border-surface-hi rounded-lg px-3 py-2 [overscroll-behavior:contain]"
                style={{ fontSize: 16 }}
              />

              <div className="text-xxs uppercase tracking-wider opacity-55 mt-4 mb-2">Email (optional)</div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com - only if you want a reply"
                data-testid="feedback-email"
                className="w-full bg-surface border border-surface-hi rounded-lg px-3 py-2"
                style={{ fontSize: 16 }}
              />

              {/* Honeypot — hidden from sighted users and screen readers via
                  tabIndex / aria-hidden, but still serialised in the POST
                  body for bots that fill every input they find. */}
              <input
                type="text"
                name="website"
                value={honey}
                onChange={(e) => setHoney(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden
                style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', opacity: 0 }}
              />
            </>
          )}
        </div>

        {status !== 'sent' && (
          <div className="shrink-0 px-4 pt-3 pb-[calc(1rem+var(--safe-bottom,0px))] border-t border-surface-hi bg-bg-base">
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              data-testid="feedback-send"
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(255,255,255,0.15)' }}
              className={`w-full py-3 px-4 rounded-card font-bold text-base transition ${canSend ? 'bg-accent-gradient text-white hover:brightness-110' : 'bg-white/10 text-white/40 cursor-not-allowed'}`}
            >
              {status === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
