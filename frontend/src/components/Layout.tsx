import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${
    isActive
      ? 'bg-indigo-50 text-indigo-700'
      : 'text-slate-600 hover:bg-slate-100'
  }`;

export function Layout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="text-lg font-semibold">Task Assignment</p>
          <nav aria-label="Main">
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
