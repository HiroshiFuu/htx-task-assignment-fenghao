export interface Feedback {
  kind: 'success' | 'error';
  message: string;
}

/**
 * Always mounted so screen readers notice when its text changes; errors and
 * confirmations are announced politely without moving focus.
 */
export function LiveRegion({ feedback }: { feedback: Feedback | null }) {
  return (
    <div aria-live="polite" role="status" className="min-h-6">
      {feedback && (
        <p
          className={
            feedback.kind === 'error'
              ? 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'
              : 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800'
          }
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
