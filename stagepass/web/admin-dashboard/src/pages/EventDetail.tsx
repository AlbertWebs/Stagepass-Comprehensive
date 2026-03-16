import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, PAYMENT_PURPOSES, type Client, type Event, type EventChecklistItem, type EquipmentItem, type PaymentItem, type User } from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

type CrewMember = User & {
  pivot?: {
    role_in_event?: string;
    checkin_time?: string | null;
    checkout_time?: string | null;
  };
};

function formatDate(d: string | null | undefined): string {
  if (!d) return '–';
  const dateOnly = typeof d === 'string' && d.includes('T') ? d.slice(0, 10) : String(d).slice(0, 10);
  const [y, m, day] = dateOnly.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(day));
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [addCrewOpen, setAddCrewOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [roleInEvent, setRoleInEvent] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [markingArrivalId, setMarkingArrivalId] = useState<number | null>(null);
  const [eventPayments, setEventPayments] = useState<PaymentItem[]>([]);
  const [allocatePayOpen, setAllocatePayOpen] = useState(false);
  const [payUserId, setPayUserId] = useState('');
  const [payPurpose, setPayPurpose] = useState<string>('fair');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payAmount, setPayAmount] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamLeaderSaving, setTeamLeaderSaving] = useState(false);
  const [clientSaving, setClientSaving] = useState(false);
  const [dailyAllowanceSaving, setDailyAllowanceSaving] = useState(false);
  const [checklistItems, setChecklistItems] = useState<EventChecklistItem[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [checklistCreating, setChecklistCreating] = useState(false);
  const [checklistTogglingId, setChecklistTogglingId] = useState<number | null>(null);
  const [endEventOpen, setEndEventOpen] = useState(false);
  const [endComment, setEndComment] = useState('');
  const [endSaving, setEndSaving] = useState(false);
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [attachingEquipment, setAttachingEquipment] = useState(false);

  const fetchEvent = useCallback(() => {
    if (!id) return;
    api.events
      .get(Number(id))
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.events
      .get(Number(id))
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api.users.list({}).then((r) => setUsers(r.data ?? [])).catch(() => setUsers([]));
  }, []);

  useEffect(() => {
    api.equipment.list({}).then((r) => setEquipmentList(r.data ?? [])).catch(() => setEquipmentList([]));
  }, []);
  useEffect(() => {
    api.clients.list({ per_page: 500 }).then((r) => setClients(r.data ?? [])).catch(() => setClients([]));
  }, []);

  const fetchEventPayments = useCallback(() => {
    if (!id) return;
    api.payments
      .list({ event_id: Number(id) })
      .then((r) => setEventPayments(r.data ?? []))
      .catch(() => setEventPayments([]));
  }, [id]);

  useEffect(() => {
    if (id) fetchEventPayments();
  }, [id, fetchEventPayments]);

  const fetchChecklist = useCallback(() => {
    if (!id) return;
    setChecklistLoading(true);
    api.events.checklist
      .list(Number(id))
      .then((r) => setChecklistItems(r.data ?? []))
      .catch(() => setChecklistItems([]))
      .finally(() => setChecklistLoading(false));
  }, [id]);

  useEffect(() => {
    if (id) fetchChecklist();
  }, [id, fetchChecklist]);

  const handleCreateChecklist = async () => {
    if (!event) return;
    setChecklistCreating(true);
    setError(null);
    try {
      const r = await api.events.checklist.create(event.id);
      setChecklistItems(r.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create checklist');
    } finally {
      setChecklistCreating(false);
    }
  };

  const isEventEnded = event?.status === 'completed' || event?.status === 'closed';

  const openEndEvent = () => {
    setEndComment('');
    setError(null);
    setEndEventOpen(true);
  };

  const handleEndEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !endComment.trim()) return;
    setEndSaving(true);
    setError(null);
    try {
      const updated = await api.events.end(event.id, { end_comment: endComment.trim() });
      setEvent(updated);
      setEndEventOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to end event');
    } finally {
      setEndSaving(false);
    }
  };

  const handleChecklistToggle = async (item: EventChecklistItem) => {
    if (!event) return;
    const next = !item.is_checked;
    setChecklistTogglingId(item.id);
    setError(null);
    try {
      const updated = await api.events.checklist.toggleItem(event.id, item.id, next);
      setChecklistItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...updated } : i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setChecklistTogglingId(null);
    }
  };

  const crewIds = new Set((event?.crew ?? []).map((u) => u.id));
  const availableUsers = users.filter((u) => !crewIds.has(u.id));

  const openAddCrew = () => {
    setSelectedUserId('');
    setRoleInEvent('');
    setError(null);
    setAddCrewOpen(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !selectedUserId) return;
    setAssigning(true);
    setError(null);
    try {
      await api.events.assignUser(event.id, Number(selectedUserId), roleInEvent.trim() || undefined);
      setAddCrewOpen(false);
      fetchEvent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add crew member');
    } finally {
      setAssigning(false);
    }
  };

  const handleTeamLeaderChange = async (userId: string) => {
    if (!event) return;
    const value = userId === '' ? null : Number(userId);
    setTeamLeaderSaving(true);
    setError(null);
    try {
      await api.events.update(event.id, { team_leader_id: value } as Partial<Event>);
      fetchEvent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team leader');
    } finally {
      setTeamLeaderSaving(false);
    }
  };

  const handleClientChange = async (clientId: string) => {
    if (!event) return;
    const value = clientId === '' ? null : Number(clientId);
    setClientSaving(true);
    setError(null);
    try {
      await api.events.update(event.id, { client_id: value } as Partial<Event>);
      fetchEvent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update client');
    } finally {
      setClientSaving(false);
    }
  };

  const handleDailyAllowanceChange = async (value: string) => {
    if (!event) return;
    const num = value.trim() === '' ? null : Number(value);
    if (value.trim() !== '' && (Number.isNaN(num) || (num !== null && num < 0))) return;
    setDailyAllowanceSaving(true);
    setError(null);
    try {
      await api.events.update(event.id, { daily_allowance: num } as Partial<Event>);
      fetchEvent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update daily allowance');
    } finally {
      setDailyAllowanceSaving(false);
    }
  };

  const handleRemove = async (userId: number) => {
    if (!event) return;
    setRemovingId(userId);
    setError(null);
    try {
      await api.events.removeUser(event.id, userId);
      fetchEvent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove crew member');
    } finally {
      setRemovingId(null);
    }
  };

  const handleMarkArrived = async (userId: number) => {
    if (!event) return;
    setMarkingArrivalId(userId);
    setError(null);
    try {
      await api.events.manualCheckin(event.id, userId);
      fetchEvent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark as arrived');
    } finally {
      setMarkingArrivalId(null);
    }
  };

  const handleAttachEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !selectedEquipmentId) return;
    setAttachingEquipment(true);
    setError(null);
    try {
      await api.events.attachEquipment(event.id, Number(selectedEquipmentId));
      setSelectedEquipmentId('');
      fetchEvent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add equipment');
    } finally {
      setAttachingEquipment(false);
    }
  };

  const formatTime = (iso: string | null | undefined) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  /** True if check-in time is after event scheduled start (late arrival). */
  const isLateArrival = (checkinTime: string | null | undefined) => {
    if (!event?.date || !event?.start_time || !checkinTime) return false;
    const startStr = event.start_time.length === 5 ? `${event.start_time}:00` : event.start_time;
    const eventStart = new Date(`${event.date}T${startStr}`);
    const checkin = new Date(checkinTime);
    return checkin > eventStart;
  };

  const openAllocatePay = () => {
    setPayUserId('');
    setPayPurpose('fair');
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayAmount('');
    setError(null);
    setAllocatePayOpen(true);
  };

  const handleAllocatePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !payUserId) return;
    const amount = Number(payAmount) || 0;
    setPaymentSaving(true);
    setError(null);
    try {
      await api.payments.initiate({
        event_id: event.id,
        user_id: Number(payUserId),
        purpose: payPurpose || undefined,
        payment_date: payDate || undefined,
        amount,
      });
      setAllocatePayOpen(false);
      fetchEventPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment request');
    } finally {
      setPaymentSaving(false);
    }
  };

  if (loading) {
    return <Preloader message="Loading event…" fullScreen />;
  }
  if (!event) {
    return (
      <div className="space-y-4">
        <Link to="/events" className="link-brand text-sm">
          ← Back to events
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-red-800">
          Event not found.
        </div>
      </div>
    );
  }

  const startDateOnly = event.date ? String(event.date).slice(0, 10) : '';
  const endDateOnly = event.end_date ? String(event.end_date).slice(0, 10) : '';
  const dateRange =
    endDateOnly && endDateOnly !== startDateOnly
      ? `${formatDate(event.date)} – ${formatDate(event.end_date)}`
      : formatDate(event.date);
  const subtitle = [
    dateRange,
    event.location_name || 'No location',
    event.start_time,
    event.status,
  ].join(' · ');

  const checklistChecked = checklistItems.filter((i) => i.is_checked).length;
  const checklistTotal = checklistItems.length;

  return (
    <div className="space-y-6">
      {/* Hero: dark brand gradient + high-contrast event name */}
      <div
        className="relative overflow-hidden rounded-2xl px-6 py-6 shadow-lg"
        style={{
          background: 'linear-gradient(135deg, #0f1838 0%, #1e2d5c 40%, #172455 100%)',
          boxShadow: '0 4px 14px rgba(15,24,56,0.35)',
        }}
      >
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1
              className="text-2xl font-bold tracking-tight text-white drop-shadow-sm sm:text-3xl"
              style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
            >
              {event.name}
            </h1>
            <p className="mt-1.5 text-sm text-white/90" style={{ textShadow: '0 1px 1px rgba(0,0,0,0.2)' }}>
              {subtitle}
            </p>
          </div>
          <Link
            to="/events"
            className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/25 hover:border-white/40"
          >
            <span aria-hidden>←</span>
            Back to events
          </Link>
        </div>
        <div className="absolute bottom-0 right-0 h-28 w-44 rounded-tl-full opacity-30" style={{ background: 'linear-gradient(135deg, #ca8a04 0%, transparent 70%)' }} aria-hidden />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard sectionLabel="Details">
          <div
            className="rounded-r-xl border-l-4 p-6"
            style={{ borderColor: '#4a64ab', background: 'linear-gradient(90deg, #eef1f9 0%, #ffffff 100%)' }}
          >
            <dl className="space-y-4">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-brand-600">Status</dt>
                <dd className="mt-1">
                  <span className="chip-brand capitalize">{event.status}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-brand-600">Team leader</dt>
                <dd className="mt-1">
                  <select
                    value={event.team_leader_id ?? ''}
                    onChange={(e) => handleTeamLeaderChange(e.target.value)}
                    disabled={teamLeaderSaving}
                    className="form-select w-full max-w-xs"
                    aria-label="Assign team leader"
                  >
                    <option value="">Not assigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} {u.email ? `(${u.email})` : ''}
                      </option>
                    ))}
                  </select>
                  {teamLeaderSaving && (
                    <span className="ml-2 text-xs text-slate-500">Saving…</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-brand-600">Client</dt>
                <dd className="mt-1">
                  <select
                    value={event.client_id ?? ''}
                    onChange={(e) => handleClientChange(e.target.value)}
                    disabled={clientSaving}
                    className="form-select w-full max-w-xs"
                    aria-label="Assign client"
                  >
                    <option value="">No client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.contact_name ? ` (${c.contact_name})` : ''}
                      </option>
                    ))}
                  </select>
                  {clientSaving && (
                    <span className="ml-2 text-xs text-slate-500">Saving…</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-brand-600">Daily allowance (KES)</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    className="form-input w-32"
                    aria-label="Daily allowance in KES"
                    value={event.daily_allowance != null ? String(event.daily_allowance) : ''}
                    onChange={(e) => {
                    const v = e.target.value;
                    const num = v === '' ? null : Number(v);
                    setEvent((prev) => (prev ? { ...prev, daily_allowance: num === null || !Number.isNaN(num) ? num : prev.daily_allowance } : null));
                  }}
                    onBlur={(e) => handleDailyAllowanceChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                  />
                  {dailyAllowanceSaving && (
                    <span className="text-xs text-slate-500">Saving…</span>
                  )}
                  <span className="text-xs text-slate-500">Shown to crew on mobile for this event</span>
                </dd>
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-brand-600">Start</dt>
                  <dd className="mt-1 font-medium text-slate-900">{event.start_time}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-brand-600">End</dt>
                  <dd className="mt-1 font-medium text-slate-900">{event.expected_end_time ?? '–'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-brand-600">Geofence</dt>
                  <dd className="mt-1">
                    <span className="inline-flex items-center rounded-lg px-2.5 py-1 text-sm font-semibold text-white" style={{ backgroundColor: '#3a5092' }}>
                      {event.geofence_radius} m
                    </span>
                    <span className="ml-2 text-xs text-slate-500">Check-in allowed only within this radius</span>
                  </dd>
                </div>
              </div>
              {event.description && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-brand-600">Description</dt>
                  <dd className="mt-1 text-slate-700">{event.description}</dd>
                </div>
              )}
            </dl>
          </div>
        </SectionCard>

        <SectionCard sectionLabel="Event crew">
          <div className="flex flex-col">
            <div
              className="flex flex-shrink-0 items-center justify-between border-b px-6 py-3.5"
              style={{ borderColor: '#b3c1e1', background: 'linear-gradient(180deg, #eef1f9 0%, #ffffff 100%)' }}
            >
              <span className="text-sm font-semibold" style={{ color: '#1e2d5c' }}>
                {(event.crew?.length ?? 0)} member{(event.crew?.length ?? 0) === 1 ? '' : 's'}
              </span>
              <button type="button" onClick={openAddCrew} className="btn-brand text-sm">
                Add crew
              </button>
            </div>
            <div className="overflow-x-auto">
              {(event.crew?.length ?? 0) > 0 ? (
                <table className="w-full table-header-brand">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th className="w-20 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(event.crew ?? []).map((u) => (
                      <tr key={u.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                        <td className="px-6 py-4">
                          <div>
                            <span className="font-medium text-slate-900">{u.name}</span>
                            {u.email && (
                              <span className="block text-sm text-slate-500">{u.email}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {(u as CrewMember).pivot?.role_in_event ? (
                            <span className="chip-brand">{(u as CrewMember).pivot.role_in_event}</span>
                          ) : (
                            <span className="text-slate-400">–</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemove(u.id)}
                            disabled={removingId === u.id}
                            className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                          >
                            {removingId === u.id ? 'Removing…' : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-brand-600">No crew assigned yet.</p>
                  <p className="mt-1 text-xs text-slate-500">Admins and the team leader can add crew.</p>
                  <button type="button" onClick={openAddCrew} className="btn-brand mt-4 text-sm">
                    Add crew
                  </button>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard sectionLabel="Event equipment">
          <div className="flex flex-col">
            <div
              className="flex flex-shrink-0 items-center justify-between border-b px-6 py-3.5"
              style={{ borderColor: '#b3c1e1', background: 'linear-gradient(180deg, #eef1f9 0%, #ffffff 100%)' }}
            >
              <span className="text-sm font-semibold" style={{ color: '#1e2d5c' }}>
                {(event.event_equipment?.length ?? 0)} item{(event.event_equipment?.length ?? 0) === 1 ? '' : 's'} assigned
              </span>
              <form onSubmit={handleAttachEquipment} className="flex flex-wrap items-center gap-2">
                <select
                  value={selectedEquipmentId}
                  onChange={(e) => setSelectedEquipmentId(e.target.value)}
                  className="form-select text-sm"
                  aria-label="Select equipment"
                >
                  <option value="">Add equipment…</option>
                  {equipmentList
                    .filter((eq) => !(event.event_equipment ?? []).some((ae) => ae.equipment_id === eq.id))
                    .map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} {eq.serial_number ? `(${eq.serial_number})` : ''}
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  disabled={attachingEquipment || !selectedEquipmentId}
                  className="btn-brand text-sm disabled:opacity-50"
                >
                  {attachingEquipment ? 'Adding…' : 'Add'}
                </button>
              </form>
            </div>
            <div className="overflow-x-auto">
              {(event.event_equipment?.length ?? 0) > 0 ? (
                <table className="w-full table-header-brand">
                  <thead>
                    <tr>
                      <th>Equipment</th>
                      <th>Serial</th>
                      <th>Condition</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(event.event_equipment ?? []).map((ae) => (
                      <tr key={ae.id} className="border-b border-slate-100">
                        <td className="px-6 py-4 font-medium text-slate-900">{ae.equipment?.name ?? `#${ae.equipment_id}`}</td>
                        <td className="px-6 py-4 text-slate-600">{ae.equipment?.serial_number ?? '–'}</td>
                        <td className="px-6 py-4">
                          <span className="rounded px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700">
                            {ae.equipment?.condition ?? '–'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm text-slate-500">No equipment assigned yet. Add items above.</p>
                </div>
              )}
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard sectionLabel="Event checklist">
        <div className="flex flex-col">
          <div
            className="flex flex-shrink-0 items-center justify-between border-b px-6 py-3.5"
            style={{ borderColor: '#b3c1e1', background: 'linear-gradient(90deg, #eef1f9 0%, #f8f9fc 100%)' }}
          >
            <span className="text-sm font-medium text-brand-800">
              Crew and equipment to carry. Check off from this dashboard or from the mobile app.
            </span>
            {checklistTotal === 0 && (
              <button
                type="button"
                onClick={handleCreateChecklist}
                disabled={checklistCreating || (event.crew?.length ?? 0) + (event.event_equipment?.length ?? 0) === 0}
                className="btn-brand text-sm disabled:opacity-50"
              >
                {checklistCreating ? 'Creating…' : 'Create Event checklist'}
              </button>
            )}
          </div>
          <div className="p-4 sm:px-6">
            {checklistLoading ? (
              <div className="flex items-center gap-3 py-8 text-brand-600">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
                <span className="text-sm">Loading checklist…</span>
              </div>
            ) : checklistTotal === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-slate-600">No checklist yet. Create one from the current crew and event equipment.</p>
                <p className="mt-1 text-xs text-slate-500">Crew can check items off from the mobile app.</p>
                <button
                  type="button"
                  onClick={handleCreateChecklist}
                  disabled={checklistCreating || (event.crew?.length ?? 0) + (event.event_equipment?.length ?? 0) === 0}
                  className="btn-brand mt-4 text-sm disabled:opacity-50"
                >
                  {checklistCreating ? 'Creating…' : 'Create Event checklist'}
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-100">
                    <div
                      className="h-full rounded-full bg-brand-accent transition-all"
                      style={{ width: `${checklistTotal ? (checklistChecked / checklistTotal) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-brand-800">
                    {checklistChecked} of {checklistTotal} checked
                  </span>
                </div>
                <ul className="space-y-2">
                  {checklistItems.map((item) => (
                    <li
                      key={item.id}
                      className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition ${
                        item.is_checked ? 'border-green-200 bg-green-50/80' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleChecklistToggle(item)}
                        disabled={checklistTogglingId === item.id}
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border-2 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 disabled:opacity-50 ${
                          item.is_checked ? 'border-brand-accent bg-brand-accent' : 'border-slate-300 bg-white'
                        }`}
                        aria-pressed={item.is_checked}
                        aria-label={item.is_checked ? `Uncheck ${item.label}` : `Check ${item.label}`}
                      >
                        {item.is_checked && (
                          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                      <span className={`flex-1 text-sm font-medium ${item.is_checked ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                        {item.label}
                      </span>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${item.type === 'crew' ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-700'}`}>
                        {item.type === 'crew' ? 'Crew' : 'Equipment'}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Arrival checklist">
        <div className="p-4 sm:px-6">
          <p className="mb-4 text-sm text-slate-600">
            As team leader, mark crew members who have arrived when they cannot check in themselves (e.g. no device or geofence issue).
          </p>
          <div className="overflow-x-auto">
            {(event.crew?.length ?? 0) > 0 ? (
              <table className="w-full table-header-brand">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th className="w-36 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(event.crew ?? []).map((u) => {
                    const member = u as CrewMember;
                    const checkinTime = member.pivot?.checkin_time;
                    const checkoutTime = member.pivot?.checkout_time;
                    const arrived = !!checkinTime;
                    const checkedOut = !!checkoutTime;
                    const isMarking = markingArrivalId === u.id;
                    const statusLabel = checkedOut
                      ? 'Checked Out'
                      : arrived
                        ? 'Checked In'
                        : 'Pending';
                    return (
                      <tr key={u.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                        <td className="px-6 py-4">
                          <span className="font-medium text-slate-900">{u.name}</span>
                          {u.email && (
                            <span className="block text-sm text-slate-500">{u.email}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {member.pivot?.role_in_event ? (
                            <span className="chip-brand">{member.pivot.role_in_event}</span>
                          ) : (
                            <span className="text-slate-400">–</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {checkedOut ? (
                            <span className="inline-flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-600">
                              <span className="h-2 w-2 rounded-full bg-slate-400" aria-hidden />
                              Checked Out {formatTime(checkoutTime)}
                            </span>
                          ) : arrived ? (
                            <span className="inline-flex flex-wrap items-center gap-1.5 text-sm font-medium text-green-700">
                              <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
                              {statusLabel} {formatTime(checkinTime)}
                              {isLateArrival(checkinTime) && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">Late</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-slate-500">Pending</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {!arrived && (
                            <button
                              type="button"
                              onClick={() => handleMarkArrived(u.id)}
                              disabled={isMarking}
                              className="btn-brand text-sm disabled:opacity-50"
                            >
                              {isMarking ? 'Marking…' : 'Mark arrived'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No crew assigned. Add crew above to use the arrival checklist.</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Payment requests">
        <div className="flex flex-col">
          <div
            className="flex flex-shrink-0 items-center justify-between border-b px-6 py-3.5"
            style={{ borderColor: '#b3c1e1', background: 'linear-gradient(90deg, #eef1f9 0%, #f8f9fc 100%)' }}
          >
            <span className="text-sm font-medium" style={{ color: '#1e2d5c' }}>
              Allocate payments to crew or view requests (from mobile or here). Approve or reject on the Payments page.
            </span>
            <div className="flex items-center gap-2">
              <Link to="/payments" className="link-brand text-sm">
                View all payments
              </Link>
              <button type="button" onClick={openAllocatePay} className="btn-brand text-sm">
                Allocate payment
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            {eventPayments.length > 0 ? (
              <table className="w-full table-header-brand">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Purpose</th>
                    <th>Allowances</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {eventPayments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-900">{p.user?.name ?? `User #${p.user_id}`}</span>
                        {p.user?.email && <span className="block text-sm text-slate-500">{p.user.email}</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize text-slate-700">{p.purpose ?? '–'}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-700">{Number(p.allowances).toFixed(2)}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{Number(p.total_amount).toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`chip-brand capitalize ${
                            p.status === 'approved' ? 'bg-green-100 text-green-800' : p.status === 'rejected' ? 'bg-red-100 text-red-800' : ''
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-slate-500">No payment requests for this event yet.</p>
                <p className="mt-1 text-xs text-slate-500">Crew can request from the mobile app, or allocate one above.</p>
                <button type="button" onClick={openAllocatePay} className="btn-brand mt-4 text-sm">
                  Allocate payment
                </button>
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="End event">
        <div className="p-4 sm:px-6">
          {isEventEnded ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">
                This event was ended
                {event.ended_at && (
                  <span className="text-slate-500">
                    {' '}
                    on {formatDate(String(event.ended_at).split('T')[0])}
                    {event.ended_by ? ` by ${event.ended_by.name}` : ''}.
                  </span>
                )}
              </p>
              {event.end_comment && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500 mb-2">End comment</p>
                  <p className="text-slate-800 whitespace-pre-wrap">{event.end_comment}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-600">
                As team leader (or admin), you can end this event and add a comment: what went well, what needs to be improved, and any other notes.
              </p>
              <button type="button" onClick={openEndEvent} className="btn-brand text-sm">
                End event with comment
              </button>
            </>
          )}
        </div>
      </SectionCard>

      {error && !addCrewOpen && !allocatePayOpen && !endEventOpen && (
        <div className="form-error-banner">{error}</div>
      )}

      {addCrewOpen && (
        <FormModal
          title="Add crew member"
          onClose={() => { setAddCrewOpen(false); setError(null); }}
          wide={false}
        >
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-4">{error}</div>}
            <form onSubmit={handleAssign} className="space-y-4">
              <div className="form-field">
                <label className="form-label" htmlFor="add-crew-user">User *</label>
                <select
                  id="add-crew-user"
                  required
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="form-select"
                >
                  <option value="">Select a user</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.email ? `(${u.email})` : ''}
                    </option>
                  ))}
                </select>
                {availableUsers.length === 0 && (
                  <p className="mt-1 text-xs text-slate-500">All users are already on the crew.</p>
                )}
              </div>
              <div className="form-field">
                <label className="form-label form-label-optional" htmlFor="add-crew-role">Role in event</label>
                <input
                  id="add-crew-role"
                  type="text"
                  value={roleInEvent}
                  onChange={(e) => setRoleInEvent(e.target.value)}
                  className="form-input"
                  placeholder="e.g. Sound, Lighting"
                  maxLength={50}
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setAddCrewOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={assigning || !selectedUserId} className="btn-brand disabled:opacity-50">
                  {assigning ? 'Adding…' : 'Add to crew'}
                </button>
              </div>
            </form>
          </div>
        </FormModal>
      )}

      {endEventOpen && (
        <FormModal title="End event" onClose={() => { setEndEventOpen(false); setError(null); }} wide>
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-4">{error}</div>}
            <form onSubmit={handleEndEvent} className="space-y-4">
              <div className="form-field">
                <label className="form-label" htmlFor="end-comment">Comment *</label>
                <textarea
                  id="end-comment"
                  required
                  value={endComment}
                  onChange={(e) => setEndComment(e.target.value)}
                  className="form-textarea min-h-[160px]"
                  placeholder="e.g. Everything went well. Crew arrived on time, equipment was set up correctly. To improve: consider adding a backup cable for the main mixer. Thanks to all."
                  maxLength={5000}
                  rows={6}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Summarise what went well, what needs to be improved, and any other notes. This will be saved with the event.
                </p>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setEndEventOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={endSaving || !endComment.trim()} className="btn-brand disabled:opacity-50">
                  {endSaving ? 'Ending…' : 'End event'}
                </button>
              </div>
            </form>
          </div>
        </FormModal>
      )}

      {endEventOpen && (
        <FormModal title="End event" onClose={() => { setEndEventOpen(false); setError(null); }} wide>
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-4">{error}</div>}
            <form onSubmit={handleEndEvent} className="space-y-4">
              <div className="form-field">
                <label className="form-label" htmlFor="end-comment">Comment *</label>
                <textarea
                  id="end-comment"
                  required
                  value={endComment}
                  onChange={(e) => setEndComment(e.target.value)}
                  className="form-textarea min-h-[160px]"
                  placeholder="e.g. Everything went well. Crew arrived on time, equipment was set up correctly. To improve: consider adding a backup cable for the main mixer. Thanks to all."
                  maxLength={5000}
                  rows={6}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Summarise what went well, what needs to be improved, and any other notes. This will be saved with the event.
                </p>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setEndEventOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={endSaving || !endComment.trim()} className="btn-brand disabled:opacity-50">
                  {endSaving ? 'Ending…' : 'End event'}
                </button>
              </div>
            </form>
          </div>
        </FormModal>
      )}

      {allocatePayOpen && (
        <FormModal title="Allocate payment" onClose={() => { setAllocatePayOpen(false); setError(null); }} wide={false}>
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-4">{error}</div>}
            <form onSubmit={handleAllocatePay} className="space-y-4">
              <div className="form-field">
                <label className="form-label" htmlFor="alloc-user">Select member *</label>
                <select
                  id="alloc-user"
                  required
                  value={payUserId}
                  onChange={(e) => setPayUserId(e.target.value)}
                  className="form-select"
                >
                  <option value="">Select crew member</option>
                  {(event?.crew ?? []).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.email ? `(${u.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="alloc-purpose">Purpose</label>
                <select
                  id="alloc-purpose"
                  value={payPurpose}
                  onChange={(e) => setPayPurpose(e.target.value)}
                  className="form-select"
                  aria-label="Purpose for payment"
                >
                  {PAYMENT_PURPOSES.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="alloc-date">Date</label>
                <input
                  id="alloc-date"
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="alloc-amount">Amount *</label>
                <input
                  id="alloc-amount"
                  type="number"
                  min={0}
                  step={0.01}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="form-input"
                  placeholder="0"
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setAllocatePayOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={paymentSaving || !payUserId} className="btn-brand disabled:opacity-50">
                  {paymentSaving ? 'Creating…' : 'Create payment request'}
                </button>
              </div>
            </form>
          </div>
        </FormModal>
      )}
    </div>
  );
}
