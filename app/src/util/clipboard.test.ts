import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { copyToClipboard } from './clipboard';

// jsdom doesn't define document.execCommand by default. We assign a stub
// before each test and restore the original (or undefined) after.
const realClipboard = (globalThis.navigator as any)?.clipboard;
const realIsSecureContext = (globalThis.window as any)?.isSecureContext;
const realExecCommand = (document as any).execCommand;

beforeEach(() => {
  // Default: execCommand exists and returns true. Tests override per-case.
  (document as any).execCommand = vi.fn(() => true);
});

afterEach(() => {
  // Restore navigator.clipboard
  if (realClipboard === undefined) {
    delete (globalThis.navigator as any).clipboard;
  } else {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: realClipboard,
      configurable: true,
      writable: true,
    });
  }
  Object.defineProperty(globalThis.window, 'isSecureContext', {
    value: realIsSecureContext,
    configurable: true,
    writable: true,
  });
  if (realExecCommand === undefined) {
    delete (document as any).execCommand;
  } else {
    (document as any).execCommand = realExecCommand;
  }
  vi.restoreAllMocks();
});

describe('copyToClipboard', () => {
  it('uses navigator.clipboard.writeText in a secure context', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis.window, 'isSecureContext', {
      value: true,
      configurable: true,
      writable: true,
    });

    const ok = await copyToClipboard('hello world');

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello world');
  });

  it('falls back to execCommand when navigator.clipboard is undefined (LAN/non-secure)', async () => {
    // Simulate the iOS-Brave-via-LAN-IP environment: no async clipboard.
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis.window, 'isSecureContext', {
      value: false,
      configurable: true,
      writable: true,
    });
    const exec = vi.fn(() => true);
    (document as any).execCommand = exec;

    const ok = await copyToClipboard('lan-only text');

    expect(ok).toBe(true);
    expect(exec).toHaveBeenCalledWith('copy');
    // textarea is appended and removed cleanly (no leftover in DOM).
    expect(document.querySelectorAll('textarea')).toHaveLength(0);
  });

  it('falls back to execCommand when isSecureContext is false even if clipboard exists', async () => {
    const writeText = vi.fn();
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis.window, 'isSecureContext', {
      value: false,
      configurable: true,
      writable: true,
    });
    const exec = vi.fn(() => true);
    (document as any).execCommand = exec;

    const ok = await copyToClipboard('non-secure');

    expect(ok).toBe(true);
    // Critical: never call writeText in non-secure context — it would throw
    // a DOMException in real browsers.
    expect(writeText).not.toHaveBeenCalled();
    expect(exec).toHaveBeenCalledWith('copy');
  });

  it('returns false when both paths fail', async () => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis.window, 'isSecureContext', {
      value: false,
      configurable: true,
      writable: true,
    });
    (document as any).execCommand = vi.fn(() => false);

    const ok = await copyToClipboard('nope');
    expect(ok).toBe(false);
  });

  it('returns true when writeText rejects but execCommand fallback succeeds', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('blocked'));
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis.window, 'isSecureContext', {
      value: true,
      configurable: true,
      writable: true,
    });
    (document as any).execCommand = vi.fn(() => true);

    const ok = await copyToClipboard('rejected then exec');
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalled();
  });
});
