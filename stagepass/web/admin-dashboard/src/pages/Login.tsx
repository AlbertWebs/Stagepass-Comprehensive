import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Preloader } from '@/components/Preloader';
import { useAuth } from '@/contexts/AuthContext';

export default function Login() {
  const { user, token, loading, login } = useAuth();
  const navigate = useNavigate();
  const [signingIn, setSigningIn] = useState(false);

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

  if (signingIn) {
    return <Preloader message="Signing in…" />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-brand-50/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-accent shadow-glow">
            <span className="text-2xl font-bold text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Stagepass</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to the admin panel</p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
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
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder-slate-400 focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
              />
            </div>
            <button
              type="submit"
              className="btn-brand w-full py-3"
            >
              Sign in
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
