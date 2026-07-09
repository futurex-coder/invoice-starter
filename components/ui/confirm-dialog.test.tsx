import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ConfirmDialog } from './confirm-dialog';

afterEach(cleanup);

function Harness({
  onConfirm,
  variant,
}: {
  onConfirm: () => void | Promise<void>;
  variant?: 'default' | 'destructive';
}) {
  const [open, setOpen] = useState(true);
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Delete item?"
      description="This cannot be undone."
      confirmText="Delete"
      variant={variant}
      onConfirm={onConfirm}
    />
  );
}

describe('ConfirmDialog', () => {
  it('renders title + description + buttons when open', () => {
    render(<Harness onConfirm={vi.fn()} />);
    expect(screen.getByText('Delete item?')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отказ' })).toBeInTheDocument();
  });

  it('calls onConfirm and closes on Delete', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<Harness onConfirm={onConfirm} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    // After the resolved promise + state flush, the title should be gone.
    expect(screen.queryByText('Delete item?')).not.toBeInTheDocument();
  });

  it('does not call onConfirm on Cancel', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Отказ' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete item?')).not.toBeInTheDocument();
  });

  it('stays open if onConfirm throws', async () => {
    // handleConfirm re-throws on rejection (by design — caller surfaces
    // the error). React's onClick path turns that into an unhandled
    // rejection; intercept it for the duration of this test.
    const swallow = () => {};
    process.on('unhandledRejection', swallow);

    try {
      const onConfirm = vi.fn().mockRejectedValue(new Error('boom'));
      render(<Harness onConfirm={onConfirm} />);
      const user = userEvent.setup();

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      // Let the rejection microtask resolve.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Delete item?')).toBeInTheDocument();
    } finally {
      process.off('unhandledRejection', swallow);
    }
  });
});
