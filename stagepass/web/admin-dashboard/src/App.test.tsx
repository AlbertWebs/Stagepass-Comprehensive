import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ token: null, loading: false, user: null }),
}));

describe('App', () => {
  it('renders login page at /login', () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it('redirects to home when visiting unknown route', () => {
    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>
    );
    // Without auth, protected route redirects to login
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });
});
