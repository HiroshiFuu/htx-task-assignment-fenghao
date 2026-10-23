import { useCallback, useRef, useState } from 'react';
import type { Feedback } from './LiveRegion';

export interface Toast extends Feedback {
  id: number;
}

/**
 * Older toasts give way so a burst of edits never covers the table; confirmations
 * go first, so an unread error is not pushed out by later successes.
 */
const MAX_TOASTS = 3;

/**
 * Page-local toast queue. Confirmations fade out on their own; errors stay until
 * dismissed, because the user has to read why a change was rolled back.
 */
export function useToasts(initial: Feedback | null = null) {
  const nextId = useRef(1);
  const [toasts, setToasts] = useState<readonly Toast[]>(() =>
    initial ? [{ ...initial, id: 0 }] : [],
  );

  const push = useCallback((feedback: Feedback) => {
    const id = nextId.current++;
    setToasts((current) => {
      const next = [...current, { ...feedback, id }];
      while (next.length > MAX_TOASTS) {
        const oldestConfirmation = next.findIndex((t) => t.kind !== 'error');
        next.splice(Math.max(oldestConfirmation, 0), 1);
      }
      return next;
    });
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  return { toasts, push, dismiss };
}
