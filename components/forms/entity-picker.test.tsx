import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { EntityPicker } from './entity-picker';

afterEach(cleanup);

interface Partner {
  id: number;
  name: string;
  eik: string;
}

const PARTNERS: Partner[] = [
  { id: 1, name: 'Alpha Corp', eik: '111111111' },
  { id: 2, name: 'Beta Ltd', eik: '222222222' },
  { id: 3, name: 'Gamma Trading', eik: '333333333' },
];

function Harness({
  value,
  onChange,
  clearLabel,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  clearLabel?: string | null;
}) {
  return (
    <EntityPicker
      items={PARTNERS}
      value={value}
      onChange={onChange}
      getKey={(p) => p.id}
      getLabel={(p) => p.name}
      getSecondary={(p) => p.eik}
      getSearchText={(p) => `${p.name} ${p.eik}`}
      placeholder="Pick a partner"
      clearLabel={clearLabel ?? null}
    />
  );
}

describe('EntityPicker', () => {
  it('renders the placeholder when no value is selected', () => {
    render(<Harness value={null} onChange={vi.fn()} />);
    expect(screen.getByText('Pick a partner')).toBeInTheDocument();
  });

  it('opens on click and lists every item by default', async () => {
    render(<Harness value={null} onChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Pick a partner/i }));
    expect(await screen.findByText('Alpha Corp')).toBeInTheDocument();
    expect(screen.getByText('Beta Ltd')).toBeInTheDocument();
    expect(screen.getByText('Gamma Trading')).toBeInTheDocument();
  });

  it('filters items by label and by secondary search text', async () => {
    render(<Harness value={null} onChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Pick a partner/i }));

    const input = await screen.findByPlaceholderText('Търсене…');
    await user.type(input, 'beta');
    expect(screen.queryByText('Alpha Corp')).not.toBeInTheDocument();
    expect(screen.getByText('Beta Ltd')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '333');
    expect(screen.queryByText('Beta Ltd')).not.toBeInTheDocument();
    expect(screen.getByText('Gamma Trading')).toBeInTheDocument();
  });

  it('shows the empty message when no items match', async () => {
    render(<Harness value={null} onChange={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Pick a partner/i }));

    const input = await screen.findByPlaceholderText('Търсене…');
    await user.type(input, 'no-such-partner');
    expect(screen.getByText('Няма съвпадения.')).toBeInTheDocument();
  });

  it('emits the picked id and closes', async () => {
    const onChange = vi.fn();
    render(<Harness value={null} onChange={onChange} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /Pick a partner/i }));
    await user.click(await screen.findByText('Beta Ltd'));

    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('shows a clear option when clearLabel is set and emits null on click', async () => {
    const onChange = vi.fn();
    render(
      <Harness value={1} onChange={onChange} clearLabel="— Manual entry —" />
    );
    const user = userEvent.setup();

    await user.click(screen.getByRole('button'));
    await user.click(await screen.findByText('— Manual entry —'));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
