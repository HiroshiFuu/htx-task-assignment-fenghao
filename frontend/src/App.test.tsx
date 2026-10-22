import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';
import { developers } from './test/fixtures';
import { jsonResponse, mockFetch } from './test/utils';

describe('App', () => {
  it('renders the layout and lazily loads the task list at /', async () => {
    mockFetch(({ path }) =>
      path === '/api/developers' ? jsonResponse(developers) : jsonResponse([]),
    );
    render(<App />);

    expect(
      screen.getByRole('navigation', { name: 'Main' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tasks' }),
    ).toBeInTheDocument();
  });
});
