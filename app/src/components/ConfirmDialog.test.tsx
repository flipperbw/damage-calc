import { useEffect } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ConfirmProvider, useConfirm } from '@/components/ConfirmDialog';

// Harness that exposes the confirm() dispatcher to the test via a ref-like
// callback so we can fire two calls back-to-back and assert on the resolution
// order without rendering a real consumer button.
function Harness({ onReady }: { onReady: (confirm: ReturnType<typeof useConfirm>) => void }) {
  const confirm = useConfirm();
  useEffect(() => {
    onReady(confirm);
  }, [confirm, onReady]);
  return null;
}

describe('ConfirmProvider rapid double-call', () => {
  it('resolves the prior confirm with false when a second call arrives before the first resolves', async () => {
    let confirmFn: ReturnType<typeof useConfirm> | null = null;
    render(
      <ConfirmProvider>
        <Harness onReady={(c) => (confirmFn = c)} />
      </ConfirmProvider>,
    );
    expect(confirmFn).not.toBeNull();
    const confirm = confirmFn!;

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    await act(async () => {
      first = confirm('first?');
      second = confirm('second?');
    });

    // The first promise must already be settled (with false) because the
    // second call took over the dialog. Awaiting it must not hang.
    expect(await first).toBe(false);

    // The dialog now shows the second body. Click OK; second resolves true.
    const dialog = await screen.findByTestId('confirm-dialog');
    expect(dialog).toHaveTextContent('second?');
    fireEvent.click(screen.getByTestId('confirm-ok'));
    expect(await second).toBe(true);
  });
});
