export interface Feedback {
  /** "cancelled" is a success too, but shown in red so it is not mistaken for Done. */
  kind: 'success' | 'cancelled' | 'error';
  message: string;
}

/**
 * Always mounted so screen readers notice when its text changes; errors and
 * confirmations are announced politely without moving focus.
 */
export function LiveRegion({ feedback }: { feedback: Feedback | null }) {
  return (
    <div aria-live="polite" role="status">
      {feedback && (
        <p
          className={
            feedback.kind === 'success'
              ? 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
              : 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
          }
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
