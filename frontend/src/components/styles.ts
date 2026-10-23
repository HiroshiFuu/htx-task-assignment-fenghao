// Shared Tailwind class lists so form controls look and focus the same everywhere.
export const selectClass =
  'w-40 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-100 md:w-auto';

/**
 * Base for the colour-coded status select. Options are reset to plain colours
 * (Chromium on Windows otherwise inherits the select's tint) and a disabled
 * option is visibly greyed out.
 */
export const statusSelectBaseClass =
  'w-40 rounded-md border px-2 py-1.5 text-sm font-medium shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 [&>option]:bg-white [&>option]:font-normal [&>option]:text-slate-900 [&>option:disabled]:text-slate-400';

export const primaryButtonClass =
  'inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60';

export const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';
