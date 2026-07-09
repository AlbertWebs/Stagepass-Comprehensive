import { useState } from 'react';
import { api } from '@/services/api';
import { PageHeader } from '@/components/PageHeader';

const LEGACY_CONFIRM_PHRASE = 'WIPE';
const TEST_DATA_CONFIRM_PHRASE = 'DELETE TEST DATA';

type TestDataScope = 'events' | 'users' | 'operational' | 'all';

const TEST_DATA_OPTIONS: Array<{
  id: TestDataScope;
  label: string;
  description: string;
}> = [
  {
    id: 'events',
    label: 'Events',
    description: 'Events, attendance, crew assignments, payments, expenses, allowances linked to events, reminders.',
  },
  {
    id: 'users',
    label: 'Users',
    description: 'All users except admin accounts (admin, director, super_admin) and your own account.',
  },
  {
    id: 'operational',
    label: 'Other operational data',
    description: 'Tasks, equipment, vehicles, clients, holidays, time off, check-ins, communications, audit logs.',
  },
  {
    id: 'all',
    label: 'All of the above',
    description: 'Full test reset: events, users (with safeguards), and all other operational data.',
  },
];

export default function DangerZone() {
  const [legacyConfirmText, setLegacyConfirmText] = useState('');
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [legacySuccess, setLegacySuccess] = useState<{ message: string; wiped_tables: string[] } | null>(null);

  const [selectedScopes, setSelectedScopes] = useState<TestDataScope[]>([]);
  const [testConfirmText, setTestConfirmText] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testSuccess, setTestSuccess] = useState<{
    message: string;
    scopes: string[];
    wiped_tables: string[];
    deleted_users: number;
  } | null>(null);

  const canLegacyWipe = legacyConfirmText.trim().toUpperCase() === LEGACY_CONFIRM_PHRASE;
  const canTestWipe =
    selectedScopes.length > 0 && testConfirmText.trim() === TEST_DATA_CONFIRM_PHRASE;

  const toggleScope = (scope: TestDataScope) => {
    setTestSuccess(null);
    setTestError(null);

    if (scope === 'all') {
      setSelectedScopes((current) => (current.includes('all') ? [] : ['all']));
      return;
    }

    setSelectedScopes((current) => {
      const withoutAll = current.filter((item) => item !== 'all');
      if (withoutAll.includes(scope)) {
        return withoutAll.filter((item) => item !== scope);
      }
      return [...withoutAll, scope];
    });
  };

  const handleLegacyWipe = async () => {
    if (!canLegacyWipe) return;
    setLegacyError(null);
    setLegacySuccess(null);
    setLegacyLoading(true);
    try {
      const res = await api.dangerZone.wipeNonUserData();
      setLegacySuccess(res);
      setLegacyConfirmText('');
    } catch (e) {
      setLegacyError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLegacyLoading(false);
    }
  };

  const handleTestDataWipe = async () => {
    if (!canTestWipe) return;
    setTestError(null);
    setTestSuccess(null);
    setTestLoading(true);
    try {
      const res = await api.dangerZone.wipeTestData({
        scopes: selectedScopes,
        confirm: testConfirmText.trim(),
      });
      setTestSuccess(res);
      setTestConfirmText('');
      setSelectedScopes([]);
    } catch (e) {
      setTestError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Danger Zone"
        subtitle="Irreversible actions. Roles, permissions, and system settings are always preserved."
      />
      <div className="space-y-6">
        <div className="rounded-xl border-2 border-red-200 bg-red-50/50 p-6">
          <h2 className="text-lg font-semibold text-red-800">Delete test data (selective)</h2>
          <p className="mt-2 text-sm text-red-700">
            Choose what to remove from your environment. Use this to clear seeded or test records before go-live.
            Download a backup from Settings first if you may need to recover anything.
          </p>

          <div className="mt-4 space-y-3">
            {TEST_DATA_OPTIONS.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer gap-3 rounded-lg border border-red-100 bg-white/80 p-3"
              >
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(option.id)}
                  onChange={() => toggleScope(option.id)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                />
                <span>
                  <span className="block text-sm font-semibold text-slate-900">{option.label}</span>
                  <span className="mt-0.5 block text-sm text-slate-600">{option.description}</span>
                </span>
              </label>
            ))}
          </div>

          <p className="mt-4 text-sm font-medium text-red-800">This action cannot be undone.</p>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="min-w-[260px]">
              <label htmlFor="test-data-confirm" className="mb-1 block text-sm font-medium text-slate-700">
                Type{' '}
                <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-800">
                  {TEST_DATA_CONFIRM_PHRASE}
                </code>{' '}
                to confirm
              </label>
              <input
                id="test-data-confirm"
                type="text"
                value={testConfirmText}
                onChange={(e) => setTestConfirmText(e.target.value)}
                placeholder={TEST_DATA_CONFIRM_PHRASE}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              onClick={handleTestDataWipe}
              disabled={!canTestWipe || testLoading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {testLoading ? 'Deleting…' : 'Delete selected test data'}
            </button>
          </div>

          {testError && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {testError}
            </p>
          )}
          {testSuccess && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">
              <p className="font-medium">{testSuccess.message}</p>
              <p className="mt-1 text-green-700">
                Scopes: {testSuccess.scopes.join(', ')} · Tables wiped: {testSuccess.wiped_tables.length} · Users
                deleted: {testSuccess.deleted_users}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border-2 border-red-200 bg-red-50/50 p-6">
          <h2 className="text-lg font-semibold text-red-800">Delete all non-user data</h2>
          <p className="mt-2 text-sm text-red-700">
            This will truncate all tables except: <strong>users</strong>, <strong>password_reset_tokens</strong>,{' '}
            <strong>sessions</strong>, <strong>roles</strong>, <strong>permissions</strong>, <strong>role_user</strong>,{' '}
            <strong>permission_role</strong>, <strong>personal_access_tokens</strong>. All events, tasks, equipment,
            payments, time off, audit logs, and every other application data will be permanently removed.
          </p>
          <p className="mt-2 text-sm font-medium text-red-800">This action cannot be undone.</p>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div className="min-w-[200px]">
              <label htmlFor="danger-confirm" className="mb-1 block text-sm font-medium text-slate-700">
                Type <code className="rounded bg-red-100 px-1.5 py-0.5 font-mono text-red-800">{LEGACY_CONFIRM_PHRASE}</code> to confirm
              </label>
              <input
                id="danger-confirm"
                type="text"
                value={legacyConfirmText}
                onChange={(e) => setLegacyConfirmText(e.target.value)}
                placeholder={LEGACY_CONFIRM_PHRASE}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500"
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              onClick={handleLegacyWipe}
              disabled={!canLegacyWipe || legacyLoading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {legacyLoading ? 'Wiping…' : 'Wipe all non-user data'}
            </button>
          </div>

          {legacyError && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {legacyError}
            </p>
          )}
          {legacySuccess && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800" role="status">
              <p className="font-medium">{legacySuccess.message}</p>
              <p className="mt-1 text-green-700">
                Wiped tables: {legacySuccess.wiped_tables?.length ?? 0} ({legacySuccess.wiped_tables?.slice(0, 8).join(', ')}
                {legacySuccess.wiped_tables && legacySuccess.wiped_tables.length > 8 ? '…' : ''})
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
