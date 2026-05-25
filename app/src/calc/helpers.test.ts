import { describe, expect, it } from 'vitest';

import { megaFormeName } from '@/calc/helpers';

describe('megaFormeName', () => {
  it('returns the species unchanged when mega is empty', () => {
    expect(megaFormeName('Garchomp', '', 'Garchompite')).toBe('Garchomp');
  });

  it('returns the species unchanged when it already carries a mega suffix', () => {
    expect(megaFormeName('Charizard-Mega-X', 'mega-x', 'Charizardite X')).toBe('Charizard-Mega-X');
    expect(megaFormeName('Garchomp-Mega', 'mega', 'Garchompite')).toBe('Garchomp-Mega');
  });

  it('uses the naive {base}-Mega rule for ordinary mons', () => {
    expect(megaFormeName('Garchomp', 'mega', 'Garchompite')).toBe('Garchomp-Mega');
  });

  it('respects the mega arg on X/Y splits — the item is just a gate', () => {
    // The mega flag is authoritative when the naive name exists in calc.
    // This guards against a regression where the held item dictated the
    // forme regardless of which side of the X/Y toggle the user picked.
    expect(megaFormeName('Charizard', 'mega-x', 'Charizardite X')).toBe('Charizard-Mega-X');
    expect(megaFormeName('Charizard', 'mega-y', 'Charizardite Y')).toBe('Charizard-Mega-Y');
    expect(megaFormeName('Mewtwo', 'mega-y', 'Mewtwonite Y')).toBe('Mewtwo-Mega-Y');
  });

  it('falls back to the MEGA_STONES mapping for irregular formes', () => {
    // Floette-Eternal + Floettite → Floette-Mega (not Floette-Eternal-Mega).
    // The naive rule produces "Floette-Eternal-Mega" which doesn't exist in
    // calc data, so the item-based lookup wins.
    expect(megaFormeName('Floette-Eternal', 'mega', 'Floettite')).toBe('Floette-Mega');
  });

  it('falls back to the naive form when no item is provided and naive does not exist', () => {
    // Without an item to consult MEGA_STONES, return the naive name even if
    // it's nonsense — callers downstream (the adapter) handle the lookup
    // failure. This preserves backwards compat for the rare unitemed call.
    expect(megaFormeName('Floette-Eternal', 'mega')).toBe('Floette-Eternal-Mega');
  });
});
