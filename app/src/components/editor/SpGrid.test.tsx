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

  it('MAX button sets the stat to 32', () => {
    const onChange = vi.fn();
    render(<SpGrid sps={{}} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/atk max/i));
    expect(onChange).toHaveBeenCalledWith({ atk: 32 });
  });

  it('MAX button sets the stat to 32 even if it had a partial value', () => {
    const onChange = vi.fn();
    render(<SpGrid sps={{ atk: 12 }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/atk max/i));
    expect(onChange).toHaveBeenCalledWith({ atk: 32 });
  });

  it('0 button resets a populated stat to canonical zero (key omitted)', () => {
    const onChange = vi.fn();
    render(<SpGrid sps={{ atk: 20, spe: 10 }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/atk 0/i));
    // Canonical: atk key removed rather than carrying { atk: 0 }.
    expect(onChange).toHaveBeenCalledWith({ spe: 10 });
  });

  it('0 button on a stat at 32 still resets it to 0', () => {
    const onChange = vi.fn();
    render(<SpGrid sps={{ atk: 32 }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/atk 0/i));
    expect(onChange).toHaveBeenCalledWith({});
  });
});
