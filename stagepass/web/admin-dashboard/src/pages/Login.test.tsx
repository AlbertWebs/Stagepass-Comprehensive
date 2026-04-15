import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    loading: false,
    login: mockLogin,
  }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email and password fields and sign in button', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders Stagepass branding and welcome text', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    expect(screen.getByText('Stagepass')).toBeInTheDocument();
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('calls login with email and password on form submit', async () => {
    mockLogin.mockResolvedValue(undefined);
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!);
    expect(mockLogin).toHaveBeenCalledWith('admin@test.com', 'password123');
  });

  it('toggles password visibility', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    const passwordInput = screen.getByLabelText(/password/i) as HTMLInputElement;
    const toggle = screen.getByRole('button', { name: /show password/i });

    expect(passwordInput.type).toBe('password');
    fireEvent.click(toggle);
    expect(passwordInput.type).toBe('text');
    expect(screen.getByRole('button', { name: /hide password/i })).toBeInTheDocument();
  });
});
