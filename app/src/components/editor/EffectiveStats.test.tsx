import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EffectiveStats, megaFormeFromItem, isMegaStone } from './EffectiveStats';

describe('megaFormeFromItem', () => {
  it('returns -Mega-X for Charizard with Charizardite X', () => {
    expect(megaFormeFromItem('Charizard', 'Charizardite X')).toBe('Charizard-Mega-X');
  });
  it('returns -Mega-Y for Charizard with Charizardite Y', () => {
    expect(megaFormeFromItem('Charizard', 'Charizardite Y')).toBe('Charizard-Mega-Y');
  });
  it('returns -Mega for Garchomp with Garchompite', () => {
    expect(megaFormeFromItem('Garchomp', 'Garchompite')).toBe('Garchomp-Mega');
  });
  it('returns null when species does not match the stone', () => {
    // Charizardite X doesn't mega-evolve Garchomp.
    expect(megaFormeFromItem('Garchomp', 'Charizardite X')).toBeNull();
  });
  it('returns null for non-mega items', () => {
    expect(megaFormeFromItem('Garchomp', 'Leftovers')).toBeNull();
    expect(megaFormeFromItem('Garchomp', undefined)).toBeNull();
  });
});

describe('isMegaStone', () => {
  it('accepts known mega stones', () => {
    expect(isMegaStone('Charizardite X')).toBe(true);
    expect(isMegaStone('Garchompite')).toBe(true);
    expect(isMegaStone('Venusaurite')).toBe(true);
  });
  it('rejects ordinary items and undefined', () => {
    expect(isMegaStone('Leftovers')).toBe(false);
    expect(isMegaStone(undefined)).toBe(false);
    expect(isMegaStone('')).toBe(false);
  });
});

describe('EffectiveStats panel', () => {
  it('renders 6 stats and uses calc to compute values', () => {
    // Garchomp base atk = 130. With +Atk nature and 32 sp, Champions formula:
    // floor(1.1 * (130 + 32 + 20)) = floor(1.1 * 182) = floor(200.2) = 200.
    render(<EffectiveStats species="Garchomp" nature="Adamant" sps={{ atk: 32 }} />);
    expect(screen.getByText('Atk')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('shows the Mega column when item is a mega stone', () => {
    const { container } = render(
      <EffectiveStats species="Garchomp" nature="Adamant" sps={{ atk: 32 }} item="Garchompite" />,
    );
    expect(screen.getByText('Mega')).toBeInTheDocument();
    // Garchomp-Mega base atk = 170 (verified). +Adamant +32 sp:
    // floor(1.1 * (170 + 32 + 20)) = floor(1.1 * 222) = floor(244.2) = 244.
    expect(container.textContent).toContain('244');
  });

  it('hides the Mega column for non-mega items', () => {
    render(
      <EffectiveStats species="Garchomp" nature="Adamant" sps={{ atk: 32 }} item="Leftovers" />,
    );
    expect(screen.queryByText('Mega')).toBeNull();
  });
});
