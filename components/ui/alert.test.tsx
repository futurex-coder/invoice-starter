import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Bell } from 'lucide-react';

import { Alert, AlertTitle, AlertDescription } from './alert';

afterEach(cleanup);

describe('Alert', () => {
  it('renders children with role="alert"', () => {
    render(<Alert variant="success">Saved!</Alert>);
    const node = screen.getByRole('alert');
    expect(node).toHaveTextContent('Saved!');
  });

  it('applies variant classes for each variant', () => {
    const { container, rerender } = render(<Alert variant="info">Info</Alert>);
    expect(container.firstChild).toHaveClass('border-blue-200');
    rerender(<Alert variant="error">Bad</Alert>);
    expect(container.firstChild).toHaveClass('border-red-200');
  });

  it('renders the default icon for the variant', () => {
    const { container } = render(<Alert variant="error">Error</Alert>);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('uses a custom icon when provided', () => {
    const { container } = render(
      <Alert variant="info" icon={Bell}>
        Notice
      </Alert>
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('hides the icon entirely when icon={null}', () => {
    const { container } = render(
      <Alert variant="info" icon={null}>
        Silent
      </Alert>
    );
    expect(container.querySelector('svg')).toBeNull();
  });

  it('composes with AlertTitle + AlertDescription', () => {
    render(
      <Alert variant="warning">
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>Details here.</AlertDescription>
      </Alert>
    );
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Details here.')).toBeInTheDocument();
  });
});
