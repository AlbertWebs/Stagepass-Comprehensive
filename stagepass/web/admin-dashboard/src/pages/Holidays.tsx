import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, type HolidayItem } from '@/services/api';

type FormState = {
  id: number | null;
  name: string;
  date: string;
  description: string;
  is_active: boolean;
};

const emptyForm: FormState = { id: null, name: '', date: '', description: '', is_active: true };

export default function Holidays() {
  const [items, setItems] = useState<HolidayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowActionId, setRowActionId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'upcoming'>('all');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.holidays.list();
      setItems(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      if (form.id) {
        await api.holidays.update(form.id, {
          name: form.name,
          date: form.date,
          description: form.description || null,
          is_active: form.is_active,
        });
      } else {
        await api.holidays.create({
          name: form.name,
          date: form.date,
          description: form.description || undefined,
          is_active: form.is_active,
        });
      }
      setForm(emptyForm);
      setNotice(form.id ? 'Holiday updated successfully.' : 'Holiday added successfully.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save holiday');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: number) {
    if (!window.confirm('Delete this holiday?')) return;
    setError(null);
    setNotice(null);
    setRowActionId(id);
    try {
      await api.holidays.delete(id);
      if (form.id === id) setForm(emptyForm);
      setNotice('Holiday deleted successfully.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete holiday');
    } finally {
      setRowActionId(null);
    }
  }

  async function onToggleStatus(holiday: HolidayItem) {
    setError(null);
    setNotice(null);
    setRowActionId(holiday.id);
    try {
      await api.holidays.update(holiday.id, { is_active: !holiday.is_active });
      setNotice(`${holiday.name} is now ${holiday.is_active ? 'inactive' : 'active'}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update holiday status');
    } finally {
      setRowActionId(null);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const stats = useMemo(() => {
    const active = items.filter((h) => h.is_active).length;
    const upcoming = items.filter((h) => h.date >= today).length;
    return {
      total: items.length,
      active,
      inactive: items.length - active,
      upcoming,
    };
  }, [items, today]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return items
      .filter((h) => {
        if (statusFilter === 'active' && !h.is_active) return false;
        if (statusFilter === 'inactive' && h.is_active) return false;
        if (statusFilter === 'upcoming' && h.date < today) return false;
        if (!term) return true;
        return (
          h.name.toLowerCase().includes(term) ||
          (h.description ?? '').toLowerCase().includes(term) ||
          h.date.includes(term)
        );
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [items, query, statusFilter, today]);

  const isEditing = form.id !== null;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total holidays</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Active</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-900">{stats.active}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Inactive</p>
          <p className="mt-2 text-2xl font-semibold text-amber-900">{stats.inactive}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Upcoming</p>
          <p className="mt-2 text-2xl font-semibold text-indigo-900">{stats.upcoming}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{isEditing ? 'Edit holiday' : 'Add holiday'}</h2>
          {isEditing ? (
            <button type="button" className="btn-secondary" onClick={() => setForm(emptyForm)}>
              Clear form
            </button>
          ) : null}
        </div>
        <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Holiday name</span>
            <input
              className="input w-full"
              placeholder="e.g. Labour Day"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Date</span>
            <input
              className="input w-full"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              required
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Description (optional)</span>
            <input
              className="input w-full"
              placeholder="Add extra details for planners and payroll checks"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
            Active
          </label>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={saving} type="submit">{saving ? 'Saving…' : isEditing ? 'Update holiday' : 'Add holiday'}</button>
            {isEditing ? (
              <button type="button" className="btn-secondary" onClick={() => setForm(emptyForm)}>Cancel</button>
            ) : null}
          </div>
        </form>
        {notice ? <p className="mt-3 text-sm text-emerald-700">{notice}</p> : null}
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Configured holidays</h2>
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'active', 'inactive', 'upcoming'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={statusFilter === f ? 'btn-primary' : 'btn-secondary'}
              >
                {f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <input
          className="input mt-3 w-full md:max-w-sm"
          placeholder="Search by name, date, or description"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Loading holidays…</p>
        ) : filtered.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No holidays configured yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr key={h.id} className="border-b border-slate-100">
                    <td className="py-2 pr-3">{h.date}</td>
                    <td className="py-2 pr-3">{h.name}</td>
                    <td className="py-2 pr-3 text-slate-600">{h.description || '—'}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          h.is_active
                            ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800'
                            : 'rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700'
                        }
                      >
                        {h.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2 pr-3 space-x-3">
                      <button
                        className="link-brand"
                        onClick={() => setForm({ id: h.id, name: h.name, date: h.date, description: h.description ?? '', is_active: h.is_active })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-slate-700 hover:underline"
                        disabled={rowActionId === h.id}
                        onClick={() => onToggleStatus(h)}
                      >
                        {rowActionId === h.id ? 'Saving…' : h.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="text-red-600 hover:underline"
                        disabled={rowActionId === h.id}
                        onClick={() => onDelete(h.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
