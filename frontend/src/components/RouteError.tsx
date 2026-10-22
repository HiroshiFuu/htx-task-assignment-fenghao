import { isRouteErrorResponse, useRouteError } from 'react-router';

/**
 * Router-level error boundary: catches render errors and failed lazy chunk loads
 * in any page, shows a recoverable message and never the raw error text.
 */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="mx-auto max-w-5xl space-y-3 px-4 py-10">
      <h1 className="text-2xl font-semibold">
        {notFound ? 'Page not found' : 'Something went wrong'}
      </h1>
      {!notFound && (
        <p className="text-slate-600">
          The page failed to load. Reloading usually fixes this.
        </p>
      )}
      <a href="/" className="font-medium text-indigo-700 underline">
        Back to tasks
      </a>
    </main>
  );
}
