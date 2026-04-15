import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Preloader } from '@/components/Preloader';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const { user, token, loading, login } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && token && user) navigate('/', { replace: true });
  }, [loading, token, user, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    if (!email || !password) return;
    setSigningIn(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSigningIn(false);
    }
  };

  if (loading) {
    return <Preloader message="Checking session…" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center" aria-hidden>
            <div
              className="absolute inset-0 rounded-2xl border-2 border-transparent"
              style={{
                borderTopColor: '#ca8a04',
                borderRightColor: '#1e2d5c',
                animation: 'preloader-spin 0.9s linear infinite',
              }}
            />
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold text-white"
              style={{ backgroundColor: '#ca8a04', boxShadow: '0 4px 14px rgba(202, 138, 4, 0.35)' }}
            >
              S
            </div>
          </div>
          <p className="mb-1 text-lg font-semibold tracking-wide text-slate-800">Stagepass</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
        </div>
        <div className={`rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card transition-opacity duration-200 ${signingIn ? 'opacity-90' : ''}`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={signingIn}
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative mt-1.5">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={signingIn}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 pr-28 text-slate-900 placeholder-slate-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20 disabled:cursor-not-allowed disabled:opacity-70"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={signingIn}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-2 my-1 rounded-lg px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-accent/25 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={signingIn}
              className="btn-brand w-full py-3 disabled:cursor-not-allowed disabled:opacity-80"
            >
              {signingIn ? (
                <span className="inline-flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" aria-hidden>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Loading…
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Use your Stagepass admin credentials to continue.
        </p>
      </div>
    </div>
  );
}
