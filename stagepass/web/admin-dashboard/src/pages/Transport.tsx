import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type Vehicle,
  type VehicleStatus,
  type TransportAssignment,
  type Paginated,
  type Event,
  type User,
} from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

const VEHICLE_STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'in_use', label: 'In use' },
  { value: 'maintenance', label: 'Maintenance' },
];

type VehicleFormState = {
  name: string;
  registration_number: string;
  capacity: string;
  status: VehicleStatus;
  notes: string;
};

function emptyVehicleForm(): VehicleFormState {
  return {
    name: '',
    registration_number: '',
    capacity: '',
    status: 'available',
    notes: '',
  };
}

function vehicleToForm(v: Vehicle): VehicleFormState {
  return {
    name: v.name,
    registration_number: v.registration_number ?? '',
    capacity: v.capacity != null ? String(v.capacity) : '',
    status: v.status,
    notes: v.notes ?? '',
  };
}

type AssignFormState = {
  event_id: string;
  vehicle_id: string;
  driver_id: string;
  notes: string;
};

function emptyAssignForm(): AssignFormState {
  return {
    event_id: '',
    vehicle_id: '',
    driver_id: '',
    notes: '',
  };
}

export default function Transport() {
  const [vehiclesData, setVehiclesData] = useState<Paginated<Vehicle> | null>(null);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<string>('');
  const [vehiclePage, setVehiclePage] = useState(1);
  const [assignmentsData, setAssignmentsData] = useState<Paginated<TransportAssignment> | null>(null);
  const [assignmentEventFilter, setAssignmentEventFilter] = useState<string>('');
  const [assignmentPage, setAssignmentPage] = useState(1);

  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [createVehicleOpen, setCreateVehicleOpen] = useState(false);
  const [editVehicle, setEditVehicle] = useState<Vehicle | null>(null);
  const [deleteVehicle, setDeleteVehicle] = useState<Vehicle | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const [vehicleForm, setVehicleForm] = useState<VehicleFormState>(emptyVehicleForm());
  const [assignForm, setAssignForm] = useState<AssignFormState>(emptyAssignForm());

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehiclesLoading, setVehiclesLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  const fetchVehicles = useCallback(() => {
    setVehiclesLoading(true);
    api.vehicles
      .list({
        search: vehicleSearch || undefined,
        status: vehicleStatusFilter ? (vehicleStatusFilter as VehicleStatus) : undefined,
        page: vehiclePage,
      })
      .then(setVehiclesData)
      .catch(() => setVehiclesData(null))
      .finally(() => setVehiclesLoading(false));
  }, [vehicleSearch, vehicleStatusFilter, vehiclePage]);

  const fetchAssignments = useCallback(() => {
    setAssignmentsLoading(true);
    api.transport
      .listAssignments({
        event_id: assignmentEventFilter ? parseInt(assignmentEventFilter, 10) : undefined,
        page: assignmentPage,
      })
      .then(setAssignmentsData)
      .catch(() => setAssignmentsData(null))
      .finally(() => setAssignmentsLoading(false));
  }, [assignmentEventFilter, assignmentPage]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  useEffect(() => {
    api.events.list({ per_page: 500 }).then((r) => setEvents(r.data)).catch(() => setEvents([]));
    api.users.list({ per_page: 500 }).then((r) => setUsers(r.data)).catch(() => setUsers([]));
  }, []);

  const vehicles = vehiclesData?.data ?? [];
  const assignments = assignmentsData?.data ?? [];

  const closeVehicleModals = () => {
    setCreateVehicleOpen(false);
    setEditVehicle(null);
    setDeleteVehicle(null);
    setError(null);
  };

  const openCreateVehicle = () => {
    setVehicleForm(emptyVehicleForm());
    setError(null);
    setCreateVehicleOpen(true);
  };

  const openEditVehicle = (v: Vehicle) => {
    setVehicleForm(vehicleToForm(v));
    setError(null);
    setEditVehicle(v);
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.vehicles.create({
        name: vehicleForm.name.trim(),
        registration_number: vehicleForm.registration_number.trim() || undefined,
        capacity: vehicleForm.capacity.trim() ? parseInt(vehicleForm.capacity, 10) : undefined,
        status: vehicleForm.status,
        notes: vehicleForm.notes.trim() || undefined,
      });
      closeVehicleModals();
      fetchVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create vehicle');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editVehicle) return;
    setSaving(true);
    setError(null);
    try {
      await api.vehicles.update(editVehicle.id, {
        name: vehicleForm.name.trim(),
        registration_number: vehicleForm.registration_number.trim() || undefined,
        capacity: vehicleForm.capacity.trim() ? parseInt(vehicleForm.capacity, 10) : undefined,
        status: vehicleForm.status,
        notes: vehicleForm.notes.trim() || undefined,
      });
      closeVehicleModals();
      fetchVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update vehicle');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!deleteVehicle) return;
    setSaving(true);
    setError(null);
    try {
      await api.vehicles.delete(deleteVehicle.id);
      closeVehicleModals();
      fetchVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete vehicle');
    } finally {
      setSaving(false);
    }
  };

  const openAssign = () => {
    setAssignForm(emptyAssignForm());
    setError(null);
    setAssignOpen(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const eventId = parseInt(assignForm.event_id, 10);
    const vehicleId = parseInt(assignForm.vehicle_id, 10);
    if (!eventId || !vehicleId) {
      setError('Please select an event and a vehicle.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.transport.assignToEvent(eventId, {
        vehicle_id: vehicleId,
        driver_id: assignForm.driver_id ? parseInt(assignForm.driver_id, 10) : null,
        notes: assignForm.notes.trim() || null,
      });
      setAssignOpen(false);
      fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign vehicle to event');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async (a: TransportAssignment) => {
    if (!confirm(`Remove ${a.vehicle?.name ?? 'vehicle'} from this event?`)) return;
    setSaving(true);
    setError(null);
    try {
      await api.transport.removeAssignment(a.id);
      fetchAssignments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove assignment');
    } finally {
      setSaving(false);
    }
  };

  const vehicleFormContent = (
    <div className="form-card-body">
      {error && <div className="form-error-banner mb-5">{error}</div>}
      <form onSubmit={editVehicle ? handleUpdateVehicle : handleCreateVehicle} className="space-y-5">
        <div className="form-row">
          <div className="form-field">
            <label className="form-label" htmlFor="vehicle-name">Name *</label>
            <input
              id="vehicle-name"
              type="text"
              required
              value={vehicleForm.name}
              onChange={(e) => setVehicleForm((f) => ({ ...f, name: e.target.value }))}
              className="form-input"
              placeholder="e.g. Van 1, Minibus"
            />
          </div>
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="vehicle-reg">Registration</label>
            <input
              id="vehicle-reg"
              type="text"
              value={vehicleForm.registration_number}
              onChange={(e) => setVehicleForm((f) => ({ ...f, registration_number: e.target.value }))}
              className="form-input"
              placeholder="Optional"
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-field">
            <label className="form-label form-label-optional" htmlFor="vehicle-capacity">Capacity</label>
            <input
              id="vehicle-capacity"
              type="number"
              min={1}
              max={999}
              value={vehicleForm.capacity}
              onChange={(e) => setVehicleForm((f) => ({ ...f, capacity: e.target.value }))}
              className="form-input"
              placeholder="Seats"
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="vehicle-status">Status *</label>
            <select
              id="vehicle-status"
              value={vehicleForm.status}
              onChange={(e) => setVehicleForm((f) => ({ ...f, status: e.target.value as VehicleStatus }))}
              className="form-select"
            >
              {VEHICLE_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="form-row-single">
          <label className="form-label form-label-optional" htmlFor="vehicle-notes">Notes</label>
          <textarea
            id="vehicle-notes"
            rows={2}
            value={vehicleForm.notes}
            onChange={(e) => setVehicleForm((f) => ({ ...f, notes: e.target.value }))}
            className="form-input"
            placeholder="Optional"
          />
        </div>
        <div className="form-actions">
          <button type="button" onClick={closeVehicleModals} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
            {saving ? 'Saving…' : editVehicle ? 'Update vehicle' : 'Create vehicle'}
          </button>
        </div>
      </form>
    </div>
  );

  const statusLabel = (s: string) => VEHICLE_STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s;

  const showPreloader = (vehiclesLoading && !vehiclesData) || (assignmentsLoading && !assignmentsData);

  return (
    <>
      {showPreloader && <Preloader message="Loading transport…" fullScreen />}
      <div className="space-y-6">
      <PageHeader
        title="Transport & Logistics"
        subtitle="Manage vehicles and assign them to events. Add drivers and notes for each assignment."
      />

      {/* Vehicles */}
      <SectionCard sectionLabel="Vehicles">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
          <input
            type="search"
            placeholder="Search by name or registration..."
            value={vehicleSearch}
            onChange={(e) => {
              setVehicleSearch(e.target.value);
              setVehiclePage(1);
            }}
            className="input-search-brand w-64"
            aria-label="Search vehicles"
          />
          <select
            value={vehicleStatusFilter}
            onChange={(e) => {
              setVehicleStatusFilter(e.target.value);
              setVehiclePage(1);
            }}
            className="form-select w-40"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {VEHICLE_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          </div>
          <button type="button" onClick={openCreateVehicle} className="btn-brand">
            Add vehicle
          </button>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full table-header-brand">
            <thead>
              <tr>
                <th>Name</th>
                <th>Registration</th>
                <th>Capacity</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                  <td className="px-6 py-4 font-medium text-slate-900">{v.name}</td>
                  <td className="px-6 py-4 text-slate-600">{v.registration_number ?? '–'}</td>
                  <td className="px-6 py-4 text-slate-600">{v.capacity ?? '–'}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-700">
                      {statusLabel(v.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex gap-3">
                      <button type="button" onClick={() => openEditVehicle(v)} className="link-brand">Edit</button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteVehicle(v);
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
        {!vehicles.length && (
          <p className="px-6 py-12 text-center text-sm text-brand-600">
            No vehicles found. Add a vehicle to get started.
          </p>
        )}
        {vehiclesData && vehiclesData.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200/80 px-6 py-3.5">
            <p className="text-sm text-slate-600">
              Page {vehiclesData.current_page} of {vehiclesData.last_page} ({vehiclesData.total} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={vehiclesData.current_page <= 1}
                onClick={() => setVehiclePage((p) => p - 1)}
                className="btn-pagination"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={vehiclesData.current_page >= vehiclesData.last_page}
                onClick={() => setVehiclePage((p) => p + 1)}
                className="btn-pagination"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Assignments */}
      <SectionCard sectionLabel="Event assignments">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <select
            value={assignmentEventFilter}
            onChange={(e) => {
              setAssignmentEventFilter(e.target.value);
              setAssignmentPage(1);
            }}
            className="form-select w-56"
            aria-label="Filter by event"
          >
            <option value="">All events</option>
            {events.map((ev) => (
              <option key={ev.id} value={String(ev.id)}>
                {ev.name} ({ev.date})
              </option>
            ))}
          </select>
          <button type="button" onClick={openAssign} className="btn-brand">
            Assign vehicle to event
          </button>
        </div>
        {error && assignments.length >= 0 && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full table-header-brand">
            <thead>
              <tr>
                <th>Event</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Notes</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {a.event?.name ?? `Event #${a.event_id}`}
                    {a.event?.date && (
                      <span className="ml-1 text-slate-500 text-sm">({a.event.date})</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{a.vehicle?.name ?? `Vehicle #${a.vehicle_id}`}</td>
                  <td className="px-6 py-4 text-slate-600">{a.driver?.name ?? '–'}</td>
                  <td className="px-6 py-4 text-slate-600 max-w-xs truncate">{a.notes ?? '–'}</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemoveAssignment(a)}
                      disabled={saving}
                      className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!assignments.length && (
          <p className="px-6 py-12 text-center text-sm text-brand-600">
            No assignments yet. Assign a vehicle to an event above.
          </p>
        )}
        {assignmentsData && assignmentsData.last_page > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200/80 px-6 py-3.5">
            <p className="text-sm text-slate-600">
              Page {assignmentsData.current_page} of {assignmentsData.last_page} ({assignmentsData.total} total)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={assignmentsData.current_page <= 1}
                onClick={() => setAssignmentPage((p) => p - 1)}
                className="btn-pagination"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={assignmentsData.current_page >= assignmentsData.last_page}
                onClick={() => setAssignmentPage((p) => p + 1)}
                className="btn-pagination"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {createVehicleOpen && (
        <FormModal title="Add vehicle" onClose={closeVehicleModals} wide>
          {vehicleFormContent}
        </FormModal>
      )}

      {editVehicle && (
        <FormModal title="Edit vehicle" onClose={closeVehicleModals} wide>
          {vehicleFormContent}
        </FormModal>
      )}

      {deleteVehicle && (
        <FormModal title="Delete vehicle" onClose={closeVehicleModals} wide={false}>
          <div className="px-6 py-4">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
                {error}
              </div>
            )}
            <p className="text-slate-700">
              Are you sure you want to delete <strong>{deleteVehicle.name}</strong>
              {deleteVehicle.registration_number ? ` (${deleteVehicle.registration_number})` : ''}? This cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={closeVehicleModals} className="btn-secondary">Cancel</button>
              <button
                type="button"
                onClick={handleDeleteVehicle}
                disabled={saving}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </FormModal>
      )}

      {assignOpen && (
        <FormModal title="Assign vehicle to event" onClose={() => { setAssignOpen(false); setError(null); }} wide>
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-5">{error}</div>}
            <form onSubmit={handleAssign} className="space-y-5">
              <div className="form-row-single">
                <label className="form-label" htmlFor="assign-event">Event *</label>
                <select
                  id="assign-event"
                  required
                  value={assignForm.event_id}
                  onChange={(e) => setAssignForm((f) => ({ ...f, event_id: e.target.value }))}
                  className="form-select"
                >
                  <option value="">Select event</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={String(ev.id)}>
                      {ev.name} – {ev.date}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row-single">
                <label className="form-label" htmlFor="assign-vehicle">Vehicle *</label>
                <select
                  id="assign-vehicle"
                  required
                  value={assignForm.vehicle_id}
                  onChange={(e) => setAssignForm((f) => ({ ...f, vehicle_id: e.target.value }))}
                  className="form-select"
                >
                  <option value="">Select vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={String(v.id)}>
                      {v.name}{v.registration_number ? ` (${v.registration_number})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row-single">
                <label className="form-label form-label-optional" htmlFor="assign-driver">Driver</label>
                <select
                  id="assign-driver"
                  value={assignForm.driver_id}
                  onChange={(e) => setAssignForm((f) => ({ ...f, driver_id: e.target.value }))}
                  className="form-select"
                >
                  <option value="">No driver</option>
                  {users.map((u) => (
                    <option key={u.id} value={String(u.id)}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row-single">
                <label className="form-label form-label-optional" htmlFor="assign-notes">Notes</label>
                <textarea
                  id="assign-notes"
                  rows={2}
                  value={assignForm.notes}
                  onChange={(e) => setAssignForm((f) => ({ ...f, notes: e.target.value }))}
                  className="form-input"
                  placeholder="Optional"
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => { setAssignOpen(false); setError(null); }} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
                  {saving ? 'Assigning…' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </FormModal>
      )}
      </div>
    </>
  );
}
