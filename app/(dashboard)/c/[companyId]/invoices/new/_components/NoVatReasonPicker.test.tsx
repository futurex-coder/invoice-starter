import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NoVatReasonPicker } from './LineItemsCard';
import {
  VAT_EXEMPTION_GROUNDS,
  vatGroundValue,
} from '@/src/features/bulgarian-invoicing/vat-grounds';

describe('NoVatReasonPicker', () => {
  it('renders the placeholder and no free-text input for an empty value', () => {
    render(<NoVatReasonPicker value="" onChange={vi.fn()} />);
    expect(screen.getByText('Изберете основание за 0% ДДС')).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Основание за неначисляване на ДДС')
    ).not.toBeInTheDocument();
  });

  it('shows a recognised ground as selected, without the free-text input', () => {
    const picked = vatGroundValue(VAT_EXEMPTION_GROUNDS[0]);
    render(<NoVatReasonPicker value={picked} onChange={vi.fn()} />);
    // Trigger shows the selected ground, not the placeholder.
    expect(screen.getByText(picked)).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Основание за неначисляване на ДДС')
    ).not.toBeInTheDocument();
  });

  it('opens free-text mode when the stored value is not a known ground', () => {
    render(
      <NoVatReasonPicker value="специално основание" onChange={vi.fn()} />
    );
    const input = screen.getByPlaceholderText(
      'Основание за неначисляване на ДДС'
    );
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue('специално основание');
  });
});
