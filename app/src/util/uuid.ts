/**
 * Cross-context UUID generator. `crypto.randomUUID()` only exists in secure
 * contexts (HTTPS or localhost) — when the dev server is reached via a LAN
 * IP from a phone it's NOT secure, so randomUUID is undefined and any code
 * that calls it throws silently inside an event handler. This fallback uses
 * crypto.getRandomValues (available in non-secure contexts on every modern
 * browser) and falls back further to Math.random as a last resort.
 *
 * Format: RFC 4122 v4 UUID (e.g. "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d").
 */
export function uuid(): string {
  const c: Crypto | undefined =
    typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;

  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Per RFC 4122 §4.4: set version (4) and variant (10).
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex: string[] = [];
  for (const b of bytes) hex.push(b.toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') +
    '-' + hex.slice(4, 6).join('') +
    '-' + hex.slice(6, 8).join('') +
    '-' + hex.slice(8, 10).join('') +
    '-' + hex.slice(10, 16).join('')
  );
}
