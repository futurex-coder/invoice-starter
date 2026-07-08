import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog';

afterEach(cleanup);

function Harness() {
  return (
    <Dialog>
      <DialogTrigger>Open dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Some body text.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('renders nothing until the trigger is clicked', () => {
    render(<Harness />);
    expect(screen.queryByText('Test dialog')).not.toBeInTheDocument();
  });

  it('opens when the trigger is activated', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Open dialog'));
    expect(await screen.findByText('Test dialog')).toBeInTheDocument();
    expect(screen.getByText('Some body text.')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Open dialog'));
    expect(await screen.findByText('Test dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Test dialog')).not.toBeInTheDocument();
  });

  it('closes when the built-in close button is clicked', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Open dialog'));
    expect(await screen.findByText('Test dialog')).toBeInTheDocument();
    await user.click(screen.getByText('Затвори'));
    expect(screen.queryByText('Test dialog')).not.toBeInTheDocument();
  });
});
