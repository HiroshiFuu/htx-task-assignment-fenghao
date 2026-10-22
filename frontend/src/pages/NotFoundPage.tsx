import { Link } from 'react-router';

export default function NotFoundPage() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="font-medium text-indigo-700 underline">
        Back to tasks
      </Link>
    </section>
  );
}
