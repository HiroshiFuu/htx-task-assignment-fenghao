import { useEffect, useState } from 'react';
import { AlertIcon, BanIcon, CheckCircleIcon, CloseIcon } from './icons';
import type { Feedback } from './LiveRegion';
import type { Toast } from './use-toasts';

const AUTO_DISMISS_MS = 5000;

const TONE: Readonly<
  Record<Feedback['kind'], { box: string; icon: typeof CheckCircleIcon }>
> = {
  success: {
    box: 'bg-emerald-700 text-white ring-emerald-800/20',
    icon: CheckCircleIcon,
  },
  cancelled: {
    box: 'bg-red-600 text-white ring-red-700/20',
    icon: BanIcon,
  },
  error: {
    box: 'bg-white text-red-800 ring-red-300 border-l-4 border-red-600',
    icon: AlertIcon,
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const { box, icon: ToneIcon } = TONE[toast.kind];
  // Hovering or focusing a toast holds it open (WCAG 2.2.1).
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (toast.kind === 'error' || paused) return;
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, AUTO_DISMISS_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [toast.id, toast.kind, paused, onDismiss]);

  const pause = () => {
    setPaused(true);
  };
  const resume = () => {
    setPaused(false);
  };

  return (
    <li
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ring-1 motion-safe:animate-toast-in ${box}`}
    >
      <ToneIcon className="mt-0.5 size-5 shrink-0" />
      <p className="min-w-0 flex-1 break-words">{toast.message}</p>
      <button
        type="button"
        onClick={() => {
          onDismiss(toast.id);
        }}
        aria-label="Dismiss notification"
        className="-m-1 shrink-0 rounded p-1 opacity-80 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-current"
      >
        <CloseIcon />
      </button>
    </li>
  );
}

/**
 * Both live regions stay mounted (and empty) so screen readers notice new toasts:
 * confirmations politely, errors assertively. Toasts never take focus.
 */
export function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: readonly Toast[];
  onDismiss: (id: number) => void;
}) {
  const list = (errors: boolean) => (
    <ol className="flex flex-col gap-2">
      {toasts
        .filter((toast) => (toast.kind === 'error') === errors)
        .map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
    </ol>
  );

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-30 flex flex-col gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96">
      <div role="alert">{list(true)}</div>
      <div role="status" aria-live="polite">
        {list(false)}
      </div>
    </div>
  );
}
