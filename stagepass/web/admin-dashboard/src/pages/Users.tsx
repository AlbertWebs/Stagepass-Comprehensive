import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Paginated, type Role, type User } from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';
import { useAuth } from '@/contexts/AuthContext';
import {
  downloadCrewExcelTemplate,
  parseCrewExcelFile,
  resolveRoleIdsFromCell,
  type CrewExcelRow,
} from '@/utils/crewExcelImport';

function hasAdminAccess(user: { roles?: Array<{ name?: string }> } | null): boolean {
  const names = (user?.roles ?? [])
    .map((r) => String(r?.name ?? '').trim().toLowerCase())
    .filter(Boolean);
  return names.some((n) => n === 'admin' || n === 'super_admin' || n === 'director');
}

type UserFormState = {
  name: string;
  email: string;
  password: string;
  username: string;
  pin: string;
  phone: string;
  role_ids: number[];
};

function emptyForm(): UserFormState {
  return {
    name: '',
    email: '',
    password: '',
    username: '',
    pin: '',
    phone: '',
    role_ids: [],
  };
}

function userToForm(u: User): UserFormState {
  return {
    name: u.name,
    email: u.email,
    password: '',
    username: u.username ?? '',
    pin: '',
    phone: (u as { phone?: string }).phone ?? '',
    role_ids: u.roles?.map((r) => r.id) ?? [],
  };
}

type UsersPageProps = {
  title?: string;
  subtitle?: string;
  sectionLabel?: string;
  createButtonLabel?: string;
  /** Crew page: show “Test push” per row (admins only; uses /checkins/send-push). */
  showPushTestActions?: boolean;
  /** Crew page: download Excel template + bulk upload. */
  showExcelImport?: boolean;
};

export default function Users({
  title = 'Users',
  subtitle = 'Manage crew and staff. Search, create, edit or delete users and assign roles.',
  sectionLabel = 'Team members',
  createButtonLabel = 'Create user',
  showPushTestActions = false,
  showExcelImport = false,
}: UsersPageProps = {}) {
  const { user: authUser } = useAuth();
  const canSendTestPush = showPushTestActions && hasAdminAccess(authUser);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Paginated<User> | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [welcomeUser, setWelcomeUser] = useState<User | null>(null);
  const [welcomePassword, setWelcomePassword] = useState('');
  const [welcomePin, setWelcomePin] = useState('');
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [welcomeError, setWelcomeError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [form, setForm] = useState<UserFormState>(emptyForm());
  const [pushTestUserId, setPushTestUserId] = useState<number | null>(null);
  const [pushTestMessage, setPushTestMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<CrewExcelRow[]>([]);
  const [importParseErrors, setImportParseErrors] = useState<{ rowNumber: number; message: string }[]>([]);
  const [importResult, setImportResult] = useState<{
    created: number;
    failed: { rowNumber: number; email: string; message: string }[];
  } | null>(null);

  const fetchUsers = useCallback(() => {
    api.users
      .list({ search: search || undefined, page })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setPageLoading(false));
  }, [search, page]);

  useEffect(() => {
    setPageLoading(true);
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    api.roles.list().then(setRoles).catch(() => setRoles([]));
  }, []);

  const sendTestPushToUser = useCallback(async (userId: number, userName: string) => {
    setPushTestUserId(userId);
    setPushTestMessage(null);
    try {
      await api.checkins.sendPush(
        userId,
        'Stagepass',
        `Test notification: Hi ${userName}, this is a test push from the admin dashboard.`
      );
      setPushTestMessage({ type: 'success', text: 'Test push notification sent.' });
    } catch (err) {
      setPushTestMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to send test push.',
      });
    } finally {
      setPushTestUserId(null);
    }
  }, []);

  const users = data?.data ?? [];

  if (pageLoading && !data) {
    return <Preloader message="Loading users…" fullScreen />;
  }

  const openCreate = () => {
    setForm(emptyForm());
    setError(null);
    setCreateOpen(true);
  };

  const openEdit = (u: User) => {
    setForm(userToForm(u));
    setError(null);
    setEditUser(u);
  };

  const closeModals = () => {
    setCreateOpen(false);
    setEditUser(null);
    setDeleteUser(null);
    setWelcomeUser(null);
    setWelcomePassword('');
    setWelcomePin('');
    setWelcomeError(null);
    setError(null);
    setImportOpen(false);
    setImportPreview([]);
    setImportParseErrors([]);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openImportModal = () => {
    setImportPreview([]);
    setImportParseErrors([]);
    setImportResult(null);
    setError(null);
    setImportOpen(true);
  };

  const handleExcelFileSelected = async (file: File | null) => {
    if (!file) return;
    setImportResult(null);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const { rows, errors } = parseCrewExcelFile(buffer);
      setImportPreview(rows);
      setImportParseErrors(errors);
      if (rows.length === 0 && errors.length === 0) {
        setImportParseErrors([{ rowNumber: 0, message: 'No crew rows found in the file.' }]);
      }
    } catch (err) {
      setImportPreview([]);
      setImportParseErrors([
        {
          rowNumber: 0,
          message: err instanceof Error ? err.message : 'Could not read this Excel file.',
        },
      ]);
    }
  };

  const handleConfirmImport = async () => {
    if (importPreview.length === 0) return;
    setImporting(true);
    setError(null);
    const failed: { rowNumber: number; email: string; message: string }[] = [];
    let created = 0;

    for (const row of importPreview) {
      const { roleIds, unknownNames } = resolveRoleIdsFromCell(row.roles, roles);
      if (unknownNames.length > 0) {
        failed.push({
          rowNumber: row.rowNumber,
          email: row.email,
          message: `Unknown role(s): ${unknownNames.join(', ')}`,
        });
        continue;
      }
      try {
        await api.users.create({
          name: row.name,
          email: row.email,
          password: row.password,
          username: row.username,
          pin: row.pin,
          phone: row.phone,
          role_ids: roleIds.length ? roleIds : undefined,
        });
        created += 1;
      } catch (err) {
        failed.push({
          rowNumber: row.rowNumber,
          email: row.email,
          message: err instanceof Error ? err.message : 'Failed to create',
        });
      }
    }

    setImportResult({ created, failed });
    setImporting(false);
    if (created > 0) fetchUsers();
  };

  const toggleRole = (roleId: number) => {
    setForm((f) => ({
      ...f,
      role_ids: f.role_ids.includes(roleId)
        ? f.role_ids.filter((id) => id !== roleId)
        : [...f.role_ids, roleId],
    }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.users.create({
        name: form.name,
        email: form.email,
        password: form.password,
        username: form.username || undefined,
        pin: form.pin || undefined,
        phone: form.phone || undefined,
        role_ids: form.role_ids.length ? form.role_ids : undefined,
      });
      closeModals();
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    setError(null);
    try {
      await api.users.update(editUser.id, {
        name: form.name,
        email: form.email,
        password: form.password || undefined,
        username: form.username || undefined,
        pin: form.pin || undefined,
        phone: form.phone || undefined,
        role_ids: form.role_ids,
      });
      closeModals();
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    setSaving(true);
    setError(null);
    try {
      await api.users.delete(deleteUser.id);
      closeModals();
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setSaving(false);
    }
  };

  const handleSendWelcomeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!welcomeUser) return;
    setWelcomeSaving(true);
    setWelcomeError(null);
    try {
      const body: { password?: string; pin?: string } = {};
      if (welcomePassword.trim().length > 0) body.password = welcomePassword.trim();
      if (welcomePin.trim().length > 0) body.pin = welcomePin.trim();
      await api.users.sendWelcomeEmail(welcomeUser.id, Object.keys(body).length ? body : undefined);
      closeModals();
    } catch (err) {
      setWelcomeError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setWelcomeSaving(false);
    }
  };

  function getInitials(u: User): string {
    const n = (u.name || '').trim();
    if (!n) return '?';
    const parts = n.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }

  const formContent = (
    <div className="form-card-body">
      {error && <div className="form-error-banner mb-5">{error}</div>}
      <form onSubmit={editUser ? handleUpdate : handleCreate} className="space-y-5">
        <div className="form-row">
          <div className="form-field">
            <label className="form-label" htmlFor="user-name">Name *</label>
            <input
              id="user-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="form-input"
              placeholder="Full name"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="user-email">Email *</label>
            <input
              id="user-email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="form-input"
              placeholder="email@example.com"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="user-password">
              Password {editUser ? '(leave blank to keep)' : '*'}
            </label>
            <input
              id="user-password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              minLength={editUser ? undefined : 8}
              required={!editUser}
              className="form-input"
              placeholder="Min 8 characters"
            />
          </div>
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="user-username">
              Username (mobile login)
            </label>
            <input
              id="user-username"
              type="text"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              className="form-input"
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="user-pin">
              PIN (mobile, 4+ digits)
            </label>
            <input
              id="user-pin"
              type="text"
              inputMode="numeric"
              maxLength={20}
              value={form.pin}
              onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
              className="form-input"
              placeholder="Optional"
            />
          </div>
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="user-phone">
              Phone
            </label>
            <input
              id="user-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="form-input"
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="form-row-single">
          <p className="form-section-label">Roles</p>
          <div className="form-check-group">
            {roles.map((r) => (
              <label key={r.id} className="form-check-chip">
                <input
                  type="checkbox"
                  checked={form.role_ids.includes(r.id)}
                  onChange={() => toggleRole(r.id)}
                />
                <span>{r.label ?? r.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="form-actions">
          <button type="button" onClick={closeModals} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving…' : editUser ? 'Update user' : 'Create user'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showExcelImport ? (
              <>
                <button
                  type="button"
                  onClick={downloadCrewExcelTemplate}
                  className="btn-secondary"
                >
                  Download Excel template
                </button>
                <button type="button" onClick={openImportModal} className="btn-secondary">
                  Upload Excel
                </button>
              </>
            ) : null}
            <button type="button" onClick={openCreate} className="btn-brand">
              {createButtonLabel}
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          placeholder="Search by name, email or username..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="input-search-brand w-80"
          aria-label="Search users"
        />
        {canSendTestPush && authUser?.id != null ? (
          <button
            type="button"
            onClick={() => sendTestPushToUser(authUser.id, authUser.name ?? 'there')}
            disabled={pushTestUserId === authUser.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {pushTestUserId === authUser.id ? 'Sending…' : 'Test push (my device)'}
          </button>
        ) : null}
      </div>

      {pushTestMessage ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            pushTestMessage.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {pushTestMessage.text}
        </div>
      ) : null}

      <SectionCard sectionLabel={sectionLabel}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full table-header-brand">
            <thead>
              <tr>
                <th className="w-14">Photo</th>
                <th>Name</th>
                <th>Email</th>
                <th>Username</th>
                <th>Roles</th>
                <th className="text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                  <td className="px-6 py-4">
                    <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-sm font-medium text-slate-600">
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(u)
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                  <td className="px-6 py-4 text-slate-600">{u.email}</td>
                  <td className="px-6 py-4 text-slate-600">{u.username ?? '–'}</td>
                  <td className="px-6 py-4">
                    {u.roles?.length
                      ? u.roles.map((r) => (
                          <span key={r.id} className="chip-brand mr-1">
                            {r.label ?? r.name}
                          </span>
                        ))
                      : '–'}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <span className="inline-flex items-center justify-end gap-3">
                      {canSendTestPush ? (
                        <button
                          type="button"
                          onClick={() => sendTestPushToUser(u.id, u.name)}
                          disabled={pushTestUserId === u.id}
                          className="link-brand hover:underline disabled:opacity-50"
                          aria-label={`Send test push to ${u.name}`}
                        >
                          {pushTestUserId === u.id ? 'Sending…' : 'Test push'}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setWelcomeUser(u);
                          setWelcomePassword('');
                          setWelcomePin('');
                          setWelcomeError(null);
                        }}
                        className="link-brand hover:underline"
                        aria-label={`Send welcome email to ${u.name}`}
                      >
                        Welcome email
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="link-brand"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteUser(u);
                          setError(null);
                        }}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length && (
          <p className="px-6 py-12 text-center text-sm text-brand-600">
            No users found. Create a user to get started.
          </p>
        )}
        {data && data.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200/80 px-6 py-3.5">
            <p className="text-sm text-slate-600">
              Page {data.current_page} of {data.last_page} ({data.total} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={data.current_page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-pagination"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={data.current_page >= data.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="btn-pagination"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {importOpen && (
        <FormModal title="Upload crew Excel" onClose={closeModals} wide>
          <div className="form-card-body space-y-4">
            <p className="text-sm text-slate-600">
              Download the template, fill in crew details, then upload the <strong>.xlsx</strong> file. Required
              columns: <code className="text-xs">name</code>, <code className="text-xs">email</code>,{' '}
              <code className="text-xs">password</code> (min 8). Optional:{' '}
              <code className="text-xs">username</code>, <code className="text-xs">pin</code>,{' '}
              <code className="text-xs">phone</code>, <code className="text-xs">roles</code> (e.g.{' '}
              <code className="text-xs">crew</code>).
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={downloadCrewExcelTemplate} className="btn-secondary">
                Download template
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                Choose Excel file
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                className="hidden"
                onChange={(e) => {
                  void handleExcelFileSelected(e.target.files?.[0] ?? null);
                }}
              />
            </div>

            {importParseErrors.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-semibold">Could not use some rows</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {importParseErrors.slice(0, 8).map((err) => (
                    <li key={`${err.rowNumber}-${err.message}`}>
                      {err.rowNumber > 0 ? `Row ${err.rowNumber}: ` : ''}
                      {err.message}
                    </li>
                  ))}
                </ul>
                {importParseErrors.length > 8 ? (
                  <p className="mt-2 text-xs">…and {importParseErrors.length - 8} more</p>
                ) : null}
              </div>
            ) : null}

            {importPreview.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Row</th>
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Email</th>
                      <th className="px-3 py-2">Username</th>
                      <th className="px-3 py-2">Roles</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 50).map((row) => (
                      <tr key={`${row.rowNumber}-${row.email}`} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-500">{row.rowNumber}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{row.name}</td>
                        <td className="px-3 py-2 text-slate-700">{row.email}</td>
                        <td className="px-3 py-2 text-slate-600">{row.username ?? '–'}</td>
                        <td className="px-3 py-2 text-slate-600">{row.roles?.trim() || 'crew (default)'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {importPreview.length > 50 ? (
                  <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                    Showing first 50 of {importPreview.length} rows
                  </p>
                ) : null}
              </div>
            ) : null}

            {importResult ? (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  importResult.failed.length === 0
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-slate-200 bg-slate-50 text-slate-800'
                }`}
              >
                <p className="font-semibold">
                  Created {importResult.created} of {importPreview.length} crew member
                  {importPreview.length === 1 ? '' : 's'}.
                </p>
                {importResult.failed.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-red-700">
                    {importResult.failed.slice(0, 10).map((f) => (
                      <li key={`${f.rowNumber}-${f.email}`}>
                        Row {f.rowNumber} ({f.email}): {f.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="form-actions">
              <button type="button" onClick={closeModals} className="btn-secondary" disabled={importing}>
                {importResult ? 'Close' : 'Cancel'}
              </button>
              {!importResult ? (
                <button
                  type="button"
                  className="btn-brand disabled:opacity-50"
                  disabled={importing || importPreview.length === 0}
                  onClick={() => void handleConfirmImport()}
                >
                  {importing
                    ? 'Importing…'
                    : `Import ${importPreview.length || ''} crew`.replace(/\s+/g, ' ').trim()}
                </button>
              ) : null}
            </div>
          </div>
        </FormModal>
      )}

      {createOpen && (
        <FormModal title="Create user" onClose={closeModals} wide>
          {formContent}
        </FormModal>
      )}

      {editUser && (
        <FormModal title="Edit user" onClose={closeModals} wide>
          {formContent}
        </FormModal>
      )}

      {welcomeUser && (
        <FormModal title="Send welcome email" onClose={closeModals} wide={false}>
          <div className="px-6 py-4">
            {welcomeError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
                {welcomeError}
              </div>
            )}
            <p className="text-sm text-slate-700">
              Send <strong>{welcomeUser.name}</strong> ({welcomeUser.email}) a sign-in details email. Leave the fields
              empty to resend a reminder only (password and PIN are not shown in that case). If you set a new password
              or PIN below, it is saved on the account and included in the email.
            </p>
            <form onSubmit={handleSendWelcomeEmail} className="mt-4 space-y-4">
              <div className="form-field">
                <label className="form-label form-label-optional" htmlFor="welcome-password">
                  New password (optional, min 8 characters)
                </label>
                <input
                  id="welcome-password"
                  type="password"
                  autoComplete="new-password"
                  value={welcomePassword}
                  onChange={(e) => setWelcomePassword(e.target.value)}
                  className="form-input"
                  placeholder="Leave blank to keep current password"
                />
              </div>
              <div className="form-field">
                <label className="form-label form-label-optional" htmlFor="welcome-pin">
                  New mobile PIN (optional)
                </label>
                <input
                  id="welcome-pin"
                  type="text"
                  inputMode="numeric"
                  value={welcomePin}
                  onChange={(e) => setWelcomePin(e.target.value)}
                  className="form-input"
                  placeholder="Leave blank to keep current PIN"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={closeModals}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={welcomeSaving}
                  className="btn-brand disabled:opacity-50"
                >
                  {welcomeSaving ? 'Sending…' : 'Send email'}
                </button>
              </div>
            </form>
          </div>
        </FormModal>
      )}

      {deleteUser && (
        <FormModal title="Delete user" onClose={closeModals} wide={false}>
          <div className="px-6 py-4">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
                {error}
              </div>
            )}
            <p className="text-slate-700">
              Are you sure you want to delete <strong>{deleteUser.name}</strong> ({deleteUser.email})? This cannot be
              undone.
            </p>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={closeModals}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}
