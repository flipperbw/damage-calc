/**
 * Cross-context clipboard write. The async Clipboard API
 * (`navigator.clipboard.writeText`) is only available in a secure context
 * (HTTPS or localhost). When the dev server is reached via a LAN IP from a
 * phone (e.g. `http://192.168.x.y:5173` from iOS Brave) the page is NOT a
 * secure context, so `navigator.clipboard` is undefined and any code that
 * called it directly threw silently inside the click handler - leaving the
 * user with a Copy button that "did nothing."
 *
 * Strategy:
 *   1. Prefer `navigator.clipboard.writeText` when it exists AND the page
 *      reports `window.isSecureContext === true`. This is the modern path.
 *   2. Otherwise fall back to a hidden `<textarea>` + `document.execCommand('copy')`.
 *      That API predates the secure-context restriction and works on the LAN
 *      dev URL on every modern browser, including iOS Brave.
 *   3. If both routes fail, return false so the caller can surface an
 *      explicit "couldn't copy" toast - never leave the user staring at
 *      nothing.
 *
 * Returns a promise that resolves to true on a verified copy, false on total
 * failure. Never rejects.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  // Secure-context async path. We gate on isSecureContext explicitly because
  // some non-secure environments still expose a stub navigator.clipboard
  // that throws on writeText - gating saves us a try/catch round-trip.
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function' &&
      typeof window !== 'undefined' &&
      window.isSecureContext
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to execCommand path
  }

  // execCommand fallback - works in non-secure contexts.
  try {
    if (typeof document === 'undefined') return false;
    const ta = document.createElement('textarea');
    ta.value = text;
    // Hide off-screen but keep it in the layout so iOS will still let us
    // focus + select it (display:none / visibility:hidden break selection).
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.width = '1px';
    ta.style.height = '1px';
    ta.style.padding = '0';
    ta.style.border = 'none';
    ta.style.outline = 'none';
    ta.style.boxShadow = 'none';
    ta.style.background = 'transparent';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    // iOS sometimes ignores select() on a fresh textarea - explicit range
    // covers that case.
    ta.setSelectionRange(0, text.length);
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
