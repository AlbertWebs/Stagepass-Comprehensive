import { useState } from 'react';
import { api } from '@/services/api';
import { PageHeader } from '@/components/PageHeader';

const CONFIRM_PHRASE = 'WIPE';

export default function DangerZone() {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; wiped_tables: string[] } | null>(null);

  const canWipe = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  const handleWipe = async () => {
    if (!canWipe) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await api.dangerZone.wipeNonUserData();
      setSuccess(res);
      setConfirmText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Danger Zone"
        subtitle="Irreversible actions. Users and user-related data (roles, permissions, sessions) are never deleted."
      />
      <div className="space-y-6">
        <div className="rounded-xl border-2 border-red-200 bg-red-50/50 p-6">
          <h2 className="text-lg font-semibold text-red-800">Delete all non-user data</h2>
          <p className="mt-2 text-sm text-red-700">
            This will truncate all tables except: <strong>users</strong>, <strong>password_reset_tokens</strong>,{' '}
            <strong>sessions</strong>, <strong>roles</strong>, <strong>permissions</strong>, <strong>role_user</strong>,{' '}
            <strong>permission_role</strong>, <strong>personal_access_tokens</strong>. All events, tasks, equipment,
            payments, time off, audit logs, settings, and every other application data will be permanently removed.
          </p>
          <p className="mt-2 text-sm font-medium text-red-800">This action cannot be undone.</p>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="min-w-[200px]">
              <label htmlFor="danger-confirm" className="mb-1 block text-sm font-medium text-slate-700">
                Type <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-800">{CONFIRM_PHRASE}</code> to confirm
              </label>
              <input
                id="danger-confirm"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_PHRASE}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              onClick={handleWipe}
              disabled={!canWipe || loading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Wiping…' : 'Wipe all non-user data'}
            </button>
          </div>

          {error && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {success && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">
              <p className="font-medium">{success.message}</p>
              <p className="mt-1 text-green-700">
                Wiped tables: {success.wiped_tables?.length ?? 0} ({success.wiped_tables?.slice(0, 8).join(', ')}
                {success.wiped_tables && success.wiped_tables.length > 8 ? '…' : ''})
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
