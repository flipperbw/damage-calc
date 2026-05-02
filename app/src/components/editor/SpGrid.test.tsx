import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SpGrid } from './SpGrid';

describe('SpGrid', () => {
  it('shows current allocation total', () => {
    render(<SpGrid sps={{ atk: 32, spe: 32 }} onChange={() => {}} />);
    expect(screen.getByText(/64 \/ 66/)).toBeInTheDocument();
  });

  it('blocks save when over total', () => {
    render(<SpGrid sps={{ atk: 32, spe: 32, hp: 10 }} onChange={() => {}} />);
    expect(screen.getByText(/exceeds 66/i)).toBeInTheDocument();
  });

  it('calls onChange when a cell is incremented', () => {
    const onChange = vi.fn();
    render(<SpGrid sps={{}} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/atk \+/i));
    expect(onChange).toHaveBeenCalledWith({ atk: 1 });
  });
});
