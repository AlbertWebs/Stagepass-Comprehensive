import { useCallback, useEffect, useState } from 'react';
import { api, type Client, type Paginated } from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

type ClientFormState = {
  name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

function emptyForm(): ClientFormState {
  return {
    name: '',
    contact_name: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  };
}

function clientToForm(c: Client): ClientFormState {
  return {
    name: c.name,
    contact_name: c.contact_name ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
    notes: c.notes ?? '',
  };
}

export default function Clients() {
  const [data, setData] = useState<Paginated<Client> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [viewClient, setViewClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<ClientFormState>(emptyForm());
  const [pageLoading, setPageLoading] = useState(true);

  const fetchClients = useCallback(() => {
    api.clients
      .list({ search: search || undefined, page })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setPageLoading(false));
  }, [search, page]);

  useEffect(() => {
    setPageLoading(true);
    fetchClients();
  }, [fetchClients]);

  const clients = data?.data ?? [];

  if (pageLoading && !data) {
    return <Preloader message="Loading clients…" fullScreen />;
  }

  const openCreate = () => {
    setForm(emptyForm());
    setError(null);
    setCreateOpen(true);
  };

  const openEdit = (c: Client) => {
    setForm(clientToForm(c));
    setError(null);
    setEditClient(c);
    setViewClient(null);
  };

  const openView = (c: Client) => {
    setViewClient(c);
    setEditClient(null);
  };

  const closeModals = () => {
    setCreateOpen(false);
    setEditClient(null);
    setViewClient(null);
    setDeleteClient(null);
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.clients.create({
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      closeModals();
      fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create client');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editClient) return;
    setSaving(true);
    setError(null);
    try {
      await api.clients.update(editClient.id, {
        name: form.name.trim(),
        contact_name: form.contact_name.trim() || undefined,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      });
      closeModals();
      fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteClient) return;
    setSaving(true);
    setError(null);
    try {
      await api.clients.delete(deleteClient.id);
      closeModals();
      fetchClients();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete client');
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <div className="form-card-body">
      {error && <div className="form-error-banner mb-5">{error}</div>}
      <form onSubmit={editClient ? handleUpdate : handleCreate} className="space-y-5">
        <div className="form-field">
          <label className="form-label" htmlFor="client-name">Company / Client name *</label>
          <input
            id="client-name"
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="form-input"
            placeholder="e.g. Acme Events Ltd"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="client-contact">Contact name</label>
            <input
              id="client-contact"
              type="text"
              value={form.contact_name}
              onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
              className="form-input"
              placeholder="Main contact"
            />
          </div>
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="client-email">Email</label>
            <input
              id="client-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="form-input"
              placeholder="contact@example.com"
            />
          </div>
        </div>
        <div className="form-field">
          <label className="form-label form-label-optional" htmlFor="client-phone">Phone</label>
          <input
            id="client-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="form-input"
            placeholder="+44 123 456 7890"
          />
        </div>
        <div className="form-field">
          <label className="form-label form-label-optional" htmlFor="client-address">Address</label>
          <textarea
            id="client-address"
            rows={2}
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="form-input"
            placeholder="Full address (optional)"
          />
        </div>
        <div className="form-field">
          <label className="form-label form-label-optional" htmlFor="client-notes">Notes</label>
          <textarea
            id="client-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="form-input"
            placeholder="Internal notes about this client"
          />
        </div>
        <div className="form-actions">
          <button type="button" onClick={closeModals} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving…' : editClient ? 'Update client' : 'Create client'}
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Manage clients and assign them to events. Create, edit or delete client records."
        action={
          <button type="button" onClick={openCreate} className="btn-brand">
            Create client
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          placeholder="Search by name, contact, email or phone..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="input-search-brand w-80"
          aria-label="Search clients"
        />
      </div>

      <SectionCard sectionLabel="Clients">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full table-header-brand">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Phone</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                  <td className="px-6 py-4 font-medium text-slate-900">{c.name}</td>
                  <td className="px-6 py-4 text-slate-600">{c.contact_name ?? '–'}</td>
                  <td className="px-6 py-4 text-slate-600">{c.email ?? '–'}</td>
                  <td className="px-6 py-4 text-slate-600">{c.phone ?? '–'}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex gap-3">
                      <button type="button" onClick={() => openView(c)} className="link-brand">
                        View
                      </button>
                      <button type="button" onClick={() => openEdit(c)} className="link-brand">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteClient(c);
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
        {clients.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-brand-600">
            No clients found. Create a client to get started, then assign them to events.
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
        <FormModal title="Create client" onClose={closeModals} wide>
          {formContent}
        </FormModal>
      )}

      {editClient && (
        <FormModal title="Edit client" onClose={closeModals} wide>
          {formContent}
        </FormModal>
      )}

      {viewClient && (
        <FormModal title={viewClient.name} onClose={closeModals} wide>
          <div className="form-card-body space-y-4">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Contact name</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{viewClient.contact_name ?? '–'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Email</dt>
                <dd className="mt-0.5 text-slate-700">{viewClient.email ?? '–'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Phone</dt>
                <dd className="mt-0.5 text-slate-700">{viewClient.phone ?? '–'}</dd>
              </div>
            </dl>
            {viewClient.address && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Address</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-slate-700">{viewClient.address}</dd>
              </div>
            )}
            {viewClient.notes && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Notes</dt>
                <dd className="mt-0.5 whitespace-pre-wrap text-slate-700">{viewClient.notes}</dd>
              </div>
            )}
            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={() => openEdit(viewClient)} className="btn-brand">
                Edit client
              </button>
              <button type="button" onClick={closeModals} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </FormModal>
      )}

      {deleteClient && (
        <FormModal title="Delete client" onClose={closeModals} wide={false}>
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-5">{error}</div>}
            <p className="text-slate-700">
              Are you sure you want to delete <strong>{deleteClient.name}</strong>? Events linked to this client will
              have their client assignment cleared. This cannot be undone.
            </p>
            <div className="form-actions mt-6">
              <button type="button" onClick={closeModals} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={saving}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
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
