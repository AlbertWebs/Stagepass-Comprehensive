import { useCallback, useEffect, useState } from 'react';
import { api, type Paginated, type Role, type User } from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

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
};

export default function Users({
  title = 'Users',
  subtitle = 'Manage crew and staff. Search, create, edit or delete users and assign roles.',
  sectionLabel = 'Team members',
  createButtonLabel = 'Create user',
}: UsersPageProps = {}) {
  const [data, setData] = useState<Paginated<User> | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [form, setForm] = useState<UserFormState>(emptyForm());

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
    setError(null);
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
          <button type="button" onClick={openCreate} className="btn-brand">
            {createButtonLabel}
          </button>
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
      </div>

      <SectionCard sectionLabel={sectionLabel}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full table-header-brand">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Username</th>
                <th>Roles</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
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
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex gap-3">
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
