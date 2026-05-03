import { afterEach, describe, expect, it, vi } from 'vitest';

import { uuid } from '@/util/uuid';

const realCrypto = globalThis.crypto;

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', {
    value: realCrypto,
    configurable: true,
    writable: true,
  });
});

describe('uuid', () => {
  it('returns a v4 UUID via crypto.randomUUID when available', () => {
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('falls back to getRandomValues when randomUUID is missing (LAN/non-secure context)', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: { getRandomValues: realCrypto.getRandomValues.bind(realCrypto) },
      configurable: true,
      writable: true,
    });
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('falls back to Math.random when crypto is missing entirely', () => {
    Object.defineProperty(globalThis, 'crypto', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const id = uuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    spy.mockRestore();
  });

  it('produces different ids on consecutive calls', () => {
    const a = uuid();
    const b = uuid();
    expect(a).not.toBe(b);
  });
});
