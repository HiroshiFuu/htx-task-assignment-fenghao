import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Feedback } from './LiveRegion';
import { Toaster } from './Toaster';
import { useToasts } from './use-toasts';

function Harness({
  initial = null,
  queue = [],
}: {
  initial?: Feedback | null;
  queue?: readonly Feedback[];
}) {
  const toasts = useToasts(initial);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          queue.forEach(toasts.push);
        }}
      >
        Push all
      </button>
      <Toaster toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </>
  );
}

const pushAll = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Push all' }));
};

const region = () => screen.getByRole('status');
const alerts = () => screen.getByRole('alert');
const items = () => screen.queryAllByRole('listitem');

describe('Toaster', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the initial message in a live region', () => {
    render(<Harness initial={{ kind: 'success', message: 'Created "A".' }} />);
    expect(region()).toHaveAttribute('aria-live', 'polite');
    expect(region()).toHaveTextContent('Created "A".');
  });

  it('auto-dismisses confirmations but keeps errors until dismissed', async () => {
    vi.useFakeTimers();
    render(
      <Harness
        queue={[
          { kind: 'cancelled', message: 'Cancelled it.' },
          { kind: 'error', message: 'Could not save.' },
        ]}
      />,
    );
    pushAll();
    expect(items()).toHaveLength(2);

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(items()).toHaveLength(1);
    expect(alerts()).toHaveTextContent('Could not save.');

    vi.useRealTimers();
    await userEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    );
    expect(items()).toHaveLength(0);
  });

  it('keeps three toasts, dropping confirmations before errors', () => {
    render(
      <Harness
        queue={[
          { kind: 'error', message: 'E1' },
          { kind: 'success', message: 'S1' },
          { kind: 'success', message: 'S2' },
          { kind: 'cancelled', message: 'C1' },
        ]}
      />,
    );
    pushAll();
    expect(items().map((li) => li.textContent)).toEqual(['E1', 'S2', 'C1']);
  });

  it('holds a confirmation open while it is hovered', () => {
    vi.useFakeTimers();
    render(<Harness queue={[{ kind: 'success', message: 'Saved.' }]} />);
    pushAll();
    fireEvent.mouseEnter(items()[0]);
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(items()).toHaveLength(1);
    fireEvent.mouseLeave(items()[0]);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(items()).toHaveLength(0);
  });
});
