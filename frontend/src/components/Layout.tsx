import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-md px-2 py-2 text-sm font-medium whitespace-nowrap sm:px-3 focus-visible:outline-2 focus-visible:outline-indigo-600 ${
    isActive
      ? 'bg-indigo-50 text-indigo-700'
      : 'text-slate-600 hover:bg-slate-100'
  }`;

export function Layout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-30 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      {/* Sticky so navigation stays reachable on long task lists. */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        {/* One row at every width: the header height must stay below the
            scroll-padding-top in index.css so focused elements are never hidden. */}
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <p className="min-w-0 truncate text-base font-semibold sm:text-lg">
            Task Assignment
          </p>
          <nav aria-label="Main" className="shrink-0">
            <ul className="flex gap-1">
              <li>
                <NavLink to="/" end className={navLinkClass}>
                  Tasks
                </NavLink>
              </li>
              <li>
                <NavLink to="/tasks/new" className={navLinkClass}>
                  New task
                </NavLink>
              </li>
            </ul>
          </nav>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto max-w-5xl px-4 py-6 focus:outline-none"
      >
        <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}
