import { QueryClientProvider } from '@tanstack/react-query';
import { lazy } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { Layout } from './components/Layout';
import { RouteError } from './components/RouteError';
import { createQueryClient } from './lib/query-client';

// Route-level code splitting: each page is its own chunk.
const TaskListPage = lazy(() => import('./pages/TaskListPage'));
const TaskCreatePage = lazy(() => import('./pages/TaskCreatePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <TaskListPage /> },
      { path: 'tasks/new', element: <TaskCreatePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

const queryClient = createQueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

export default App;
