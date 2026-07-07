import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

afterEach(cleanup);

function Harness({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label="fruit">
        <SelectValue placeholder="Pick one" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
      </SelectContent>
    </Select>
  );
}

describe('Select', () => {
  it('renders the placeholder when no value is set', () => {
    render(<Harness />);
    expect(screen.getByText('Pick one')).toBeInTheDocument();
  });

  it('opens on click and shows items', async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('combobox', { name: 'fruit' }));
    expect(await screen.findByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
  });

  it('emits the chosen value', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'fruit' }));
    await user.click(await screen.findByText('Banana'));

    expect(onChange).toHaveBeenCalledWith('banana');
  });

  it('reflects a controlled value in the trigger label', () => {
    render(<Harness value="cherry" />);
    expect(screen.getByText('Cherry')).toBeInTheDocument();
  });
});
