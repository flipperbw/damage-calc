import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmProvider } from '@/components/ConfirmDialog';
import { MonEditor } from '@/components/editor/MonEditor';
import type { SavedMon } from '@/types';

function renderEditor(props: React.ComponentProps<typeof MonEditor>) {
  return render(
    <ConfirmProvider>
      <MonEditor {...props} />
    </ConfirmProvider>,
  );
}

const baseMon: SavedMon = {
  id: 'test-id',
  species: 'Garchomp',
  nature: 'Hardy',
  sps: {},
  moves: ['', '', '', ''],
  mega: '',
  boosts: {},
};

describe('MonEditor draft preservation', () => {
  // Regression for the Round-3 bug report: tapping a sub-picker (species,
  // item, ability, nature) inside the editor and dismissing it MUST NOT
  // close the editor or stomp the in-progress draft. The picker's backdrop
  // tap calls e.stopPropagation() inside PickerShell, so the editor's own
  // backdrop onClick={onClose} never fires - this test pins that down.
  it('keeps the editor open and preserves stat edits when a picker is opened and closed', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    renderEditor({ open: true, initial: baseMon, onClose, onSave });

    // Edit ATK +1 so the draft has a real change to lose.
    fireEvent.click(screen.getByLabelText(/atk \+/i));
    expect(screen.getByText(/1 \/ 66/)).toBeInTheDocument();

    // Open the species picker (clicking the species name in the hero).
    fireEvent.click(screen.getByText('Garchomp', { selector: '.font-extrabold' }));
    // PickerShell renders with data-testid="picker-shell".
    expect(screen.getByTestId('picker-shell')).toBeInTheDocument();

    // Dismiss the picker via its backdrop (the wrapper outside picker-shell).
    const shell = screen.getByTestId('picker-shell');
    const backdrop = shell.parentElement!;
    fireEvent.click(backdrop);

    // Picker is gone but the editor is still mounted with the draft intact.
    expect(screen.queryByTestId('picker-shell')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/1 \/ 66/)).toBeInTheDocument();
  });

  it('keeps the editor open after an item picker is dismissed', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    renderEditor({ open: true, initial: baseMon, onClose, onSave });

    fireEvent.click(screen.getByLabelText(/spe \+/i));
    expect(screen.getByText(/1 \/ 66/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('field-item'));
    const shell = screen.getByTestId('picker-shell');
    const backdrop = shell.parentElement!;
    fireEvent.click(backdrop);

    expect(screen.queryByTestId('picker-shell')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(/1 \/ 66/)).toBeInTheDocument();
  });
});
