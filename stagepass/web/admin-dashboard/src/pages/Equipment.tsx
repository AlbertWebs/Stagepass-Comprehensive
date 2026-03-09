import { useCallback, useEffect, useState } from 'react';
import { api, type EquipmentItem, type Paginated } from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

const CONDITION_OPTIONS = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'out_of_service', label: 'Out of service' },
];

type EquipmentFormState = {
  name: string;
  serial_number: string;
  condition: string;
};

function emptyForm(): EquipmentFormState {
  return {
    name: '',
    serial_number: '',
    condition: 'good',
  };
}

function itemToForm(e: EquipmentItem): EquipmentFormState {
  return {
    name: e.name,
    serial_number: e.serial_number ?? '',
    condition: e.condition,
  };
}

export default function Equipment() {
  const [data, setData] = useState<Paginated<EquipmentItem> | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<EquipmentItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<EquipmentItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EquipmentFormState>(emptyForm());

  const [pageLoading, setPageLoading] = useState(true);

  const fetchEquipment = useCallback(() => {
    api.equipment
      .list({ search: search || undefined, page })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setPageLoading(false));
  }, [search, page]);

  useEffect(() => {
    setPageLoading(true);
    fetchEquipment();
  }, [fetchEquipment]);

  const items = data?.data ?? [];

  if (pageLoading && !data) {
    return <Preloader message="Loading equipment…" fullScreen />;
  }

  const openCreate = () => {
    setForm(emptyForm());
    setError(null);
    setCreateOpen(true);
  };

  const openEdit = (item: EquipmentItem) => {
    setForm(itemToForm(item));
    setError(null);
    setEditItem(item);
  };

  const closeModals = () => {
    setCreateOpen(false);
    setEditItem(null);
    setDeleteItem(null);
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.equipment.create({
        name: form.name.trim(),
        serial_number: form.serial_number.trim() || undefined,
        condition: form.condition,
      });
      closeModals();
      fetchEquipment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create equipment');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    setSaving(true);
    setError(null);
    try {
      await api.equipment.update(editItem.id, {
        name: form.name.trim(),
        serial_number: form.serial_number.trim() || undefined,
        condition: form.condition,
      });
      closeModals();
      fetchEquipment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update equipment');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setSaving(true);
    setError(null);
    try {
      await api.equipment.delete(deleteItem.id);
      closeModals();
      fetchEquipment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete equipment');
    } finally {
      setSaving(false);
    }
  };

  const formContent = (
    <div className="form-card-body">
      {error && <div className="form-error-banner mb-5">{error}</div>}
      <form onSubmit={editItem ? handleUpdate : handleCreate} className="space-y-5">
        <div className="form-row">
          <div className="form-field">
            <label className="form-label" htmlFor="equip-name">Name *</label>
            <input
              id="equip-name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="form-input"
              placeholder="e.g. Mixing desk, LED par"
            />
          </div>
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="equip-serial">
              Serial number
            </label>
            <input
              id="equip-serial"
              type="text"
              value={form.serial_number}
              onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
              className="form-input"
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="form-row-single">
          <label className="form-label" htmlFor="equip-condition">Condition *</label>
          <select
            id="equip-condition"
            required
            value={form.condition}
            onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))}
            className="form-select"
          >
            {CONDITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-actions">
          <button type="button" onClick={closeModals} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving…' : editItem ? 'Update equipment' : 'Create equipment'}
          </button>
        </div>
      </form>
    </div>
  );

  const conditionLabel = (c: string) => CONDITION_OPTIONS.find((o) => o.value === c)?.label ?? c;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipment"
        subtitle="View and manage AV equipment. Search by name or serial number. Create, edit or delete items."
        action={
          <button type="button" onClick={openCreate} className="btn-brand">
            Create equipment
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          placeholder="Search by name or serial number..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="input-search-brand w-80"
          aria-label="Search equipment"
        />
      </div>

      <SectionCard sectionLabel="AV equipment">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full table-header-brand">
            <thead>
              <tr>
                <th>Name</th>
                <th>Serial number</th>
                <th>Condition</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                  <td className="px-6 py-4 font-medium text-slate-900">{e.name}</td>
                  <td className="px-6 py-4 text-slate-600">{e.serial_number ?? '–'}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700">
                      {conditionLabel(e.condition)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex gap-3">
                      <button type="button" onClick={() => openEdit(e)} className="link-brand">
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteItem(e);
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
        {!items.length && (
          <p className="px-6 py-12 text-center text-sm text-brand-600">
            No equipment found. Create an item to get started.
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
        <FormModal title="Create equipment" onClose={closeModals} wide>
          {formContent}
        </FormModal>
      )}

      {editItem && (
        <FormModal title="Edit equipment" onClose={closeModals} wide>
          {formContent}
        </FormModal>
      )}

      {deleteItem && (
        <FormModal title="Delete equipment" onClose={closeModals} wide={false}>
          <div className="px-6 py-4">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
                {error}
              </div>
            )}
            <p className="text-slate-700">
              Are you sure you want to delete <strong>{deleteItem.name}</strong>
              {deleteItem.serial_number ? ` (${deleteItem.serial_number})` : ''}? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={closeModals} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
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
