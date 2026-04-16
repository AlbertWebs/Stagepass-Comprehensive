import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type Event,
  type User,
} from '@/services/api';
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

const EVENT_STATUSES_FOR_OPS = ['created', 'active'];

export default function EventOperations() {
  const [events, setEvents] = useState<Event[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Transfer state
  const [transferSourceEventId, setTransferSourceEventId] = useState('');
  const [transferUserId, setTransferUserId] = useState('');
  const [transferTargetEventId, setTransferTargetEventId] = useState('');
  const [transferring, setTransferring] = useState(false);

  // Manual check-in state
  const [checkinEventId, setCheckinEventId] = useState('');
  const [checkinUserId, setCheckinUserId] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [pauseEventId, setPauseEventId] = useState('');
  const [pauseUserId, setPauseUserId] = useState('');
  const [pauseReason, setPauseReason] = useState('');
  const [pauseSaving, setPauseSaving] = useState(false);
  const [transportEventId, setTransportEventId] = useState('');
  const [transportUserId, setTransportUserId] = useState('');
  const [transportType, setTransportType] = useState<'organization' | 'cab' | 'none'>('organization');
  const [transportAmount, setTransportAmount] = useState('');
  const [transportSaving, setTransportSaving] = useState(false);
  const [closeEventId, setCloseEventId] = useState('');
  const [closeComment, setCloseComment] = useState('');
  const [closing, setClosing] = useState(false);

  // Add crew state
  const [addCrewEventId, setAddCrewEventId] = useState('');
  const [addCrewUserId, setAddCrewUserId] = useState('');
  const [addCrewRole, setAddCrewRole] = useState('');
  const [addCrewSaving, setAddCrewSaving] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api.events.list({ per_page: 100 }).then((r) => r.data ?? []),
      api.users.list({}).then((r) => r.data ?? []),
    ])
      .then(([evts, usrs]) => {
        setEvents(evts);
        setUsers(usrs);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
        setEvents([]);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeEvents = events.filter(
    (e) => EVENT_STATUSES_FOR_OPS.includes(e.status)
  );
  const sourceEvent = transferSourceEventId
    ? events.find((e) => e.id === Number(transferSourceEventId))
    : null;
  const sourceEventCrew = sourceEvent?.crew ?? [];
  const targetEventsForTransfer = activeEvents.filter(
    (e) => e.id !== Number(transferSourceEventId)
  );

  const checkinEvent = checkinEventId
    ? events.find((e) => e.id === Number(checkinEventId))
    : null;
  const checkinEventCrewNotCheckedIn = (checkinEvent?.crew ?? []).filter(
    (u) => !(u as CrewMember).pivot?.checkin_time
  );
  const pauseEvent = pauseEventId ? events.find((e) => e.id === Number(pauseEventId)) : null;
  const pauseCrew = (pauseEvent?.crew ?? []).filter((u) => (u as CrewMember).pivot?.checkin_time && !(u as CrewMember).pivot?.checkout_time);
  const transportEvent = transportEventId ? events.find((e) => e.id === Number(transportEventId)) : null;
  const transportCrew = transportEvent?.crew ?? [];

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const sourceId = Number(transferSourceEventId);
    const targetId = Number(transferTargetEventId);
    const userId = Number(transferUserId);
    if (!sourceId || !targetId || !userId) return;
    setTransferring(true);
    setError(null);
    setSuccess(null);
    try {
      await api.events.transferUser(sourceId, userId, targetId);
      setSuccess('Crew member transferred successfully.');
      setTransferSourceEventId('');
      setTransferUserId('');
      setTransferTargetEventId('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed.');
    } finally {
      setTransferring(false);
    }
  };

  const handleManualCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    const eventId = Number(checkinEventId);
    const userId = Number(checkinUserId);
    if (!eventId || !userId) return;
    setCheckinLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.events.manualCheckin(eventId, userId);
      setSuccess('Crew member marked as arrived.');
      setCheckinEventId('');
      setCheckinUserId('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Manual check-in failed.');
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleAddCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    const eventId = Number(addCrewEventId);
    const userId = Number(addCrewUserId);
    if (!eventId || !userId) return;
    setAddCrewSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.events.assignUser(eventId, userId, addCrewRole || undefined);
      setSuccess('Crew member added to event.');
      setAddCrewEventId('');
      setAddCrewUserId('');
      setAddCrewRole('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add crew.');
    } finally {
      setAddCrewSaving(false);
    }
  };

  const handlePauseResume = async (e: React.FormEvent) => {
    e.preventDefault();
    const eventId = Number(pauseEventId);
    const userId = Number(pauseUserId);
    if (!eventId || !userId) return;
    setPauseSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const member = pauseCrew.find((u) => u.id === userId) as CrewMember | undefined;
      const isPaused = Boolean(member?.pivot && (member.pivot as { is_paused?: boolean }).is_paused);
      if (isPaused) await api.events.resumeCrew(eventId, userId);
      else await api.events.pauseCrew(eventId, userId, pauseReason || undefined);
      setSuccess(isPaused ? 'Crew resumed successfully.' : 'Crew paused successfully.');
      setPauseReason('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pause/resume failed.');
    } finally {
      setPauseSaving(false);
    }
  };

  const handleTransport = async (e: React.FormEvent) => {
    e.preventDefault();
    const eventId = Number(transportEventId);
    const userId = Number(transportUserId);
    if (!eventId || !userId) return;
    setTransportSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await api.events.recordCrewTransport(eventId, userId, {
        transport_type: transportType,
        transport_amount: transportType === 'cab' && transportAmount !== '' ? Number(transportAmount) : null,
      });
      setSuccess('Transport recorded successfully.');
      setTransportAmount('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transport record failed.');
    } finally {
      setTransportSaving(false);
    }
  };

  const handleDoneForDay = async (e: React.FormEvent) => {
    e.preventDefault();
    const eventId = Number(closeEventId);
    if (!eventId || !closeComment.trim()) return;
    setClosing(true);
    setError(null);
    setSuccess(null);
    try {
      await api.events.doneForDay(eventId, closeComment.trim());
      setSuccess('Event marked as done for the day.');
      setCloseComment('');
      setCloseEventId('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close event for the day.');
    } finally {
      setClosing(false);
    }
  };

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  if (loading && events.length === 0) {
    return <Preloader message="Loading event operations…" fullScreen />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Operations"
        subtitle="Transfer crew between events, record manual check-in, add crew to events, and open event details for full management."
      />

      {(error || success) && (
        <div
          className={`rounded-xl border px-5 py-4 text-sm ${
            error
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          <span>{error ?? success}</span>
          <button
            type="button"
            onClick={clearFeedback}
            className="ml-3 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <SectionCard sectionLabel="Transfer crew between events">
        <div className="p-6">
          <p className="mb-4 text-sm text-slate-600">
            Move a crew member from one event to another. They will be removed from the source event and added to the target event. Both events must be created or active.
          </p>
          <form onSubmit={handleTransfer} className="flex flex-wrap items-end gap-4">
            <div className="form-field min-w-[200px]">
              <label className="form-label" htmlFor="transfer-source">From event</label>
              <select
                id="transfer-source"
                value={transferSourceEventId}
                onChange={(e) => {
                  setTransferSourceEventId(e.target.value);
                  setTransferUserId('');
                }}
                required
                className="form-select"
              >
                <option value="">Select event</option>
                {activeEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} – {e.date}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field min-w-[200px]">
              <label className="form-label" htmlFor="transfer-user">Crew member</label>
              <select
                id="transfer-user"
                value={transferUserId}
                onChange={(e) => setTransferUserId(e.target.value)}
                required
                className="form-select"
                disabled={!transferSourceEventId || sourceEventCrew.length === 0}
              >
                <option value="">Select crew</option>
                {sourceEventCrew.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.email ? ` (${u.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field min-w-[200px]">
              <label className="form-label" htmlFor="transfer-target">To event</label>
              <select
                id="transfer-target"
                value={transferTargetEventId}
                onChange={(e) => setTransferTargetEventId(e.target.value)}
                required
                className="form-select"
                disabled={targetEventsForTransfer.length === 0}
              >
                <option value="">Select event</option>
                {targetEventsForTransfer.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} – {e.date}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={transferring || !transferSourceEventId || !transferUserId || !transferTargetEventId}
              className="btn-brand disabled:opacity-50"
            >
              {transferring ? 'Transferring…' : 'Transfer'}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Manual check-in (mark as arrived)">
        <div className="p-6">
          <p className="mb-4 text-sm text-slate-600">
            Record that a crew member has arrived when they cannot check in via the app (e.g. no device or location off).
          </p>
          <form onSubmit={handleManualCheckin} className="flex flex-wrap items-end gap-4">
            <div className="form-field min-w-[200px]">
              <label className="form-label" htmlFor="checkin-event">Event</label>
              <select
                id="checkin-event"
                value={checkinEventId}
                onChange={(e) => {
                  setCheckinEventId(e.target.value);
                  setCheckinUserId('');
                }}
                required
                className="form-select"
              >
                <option value="">Select event</option>
                {activeEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} – {e.date}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field min-w-[200px]">
              <label className="form-label" htmlFor="checkin-user">Crew member (not yet checked in)</label>
              <select
                id="checkin-user"
                value={checkinUserId}
                onChange={(e) => setCheckinUserId(e.target.value)}
                required
                className="form-select"
                disabled={!checkinEventId || checkinEventCrewNotCheckedIn.length === 0}
              >
                <option value="">Select crew</option>
                {checkinEventCrewNotCheckedIn.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.email ? ` (${u.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={checkinLoading || !checkinEventId || !checkinUserId}
              className="btn-brand disabled:opacity-50"
            >
              {checkinLoading ? 'Saving…' : 'Mark as arrived'}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Pause / resume crew">
        <div className="p-6">
          <form onSubmit={handlePauseResume} className="flex flex-wrap items-end gap-4">
            <div className="form-field min-w-[200px]">
              <label className="form-label">Event</label>
              <select className="form-select" value={pauseEventId} onChange={(e) => { setPauseEventId(e.target.value); setPauseUserId(''); }} required>
                <option value="">Select event</option>
                {activeEvents.map((e) => <option key={e.id} value={e.id}>{e.name} – {e.date}</option>)}
              </select>
            </div>
            <div className="form-field min-w-[220px]">
              <label className="form-label">Crew member</label>
              <select className="form-select" value={pauseUserId} onChange={(e) => setPauseUserId(e.target.value)} required>
                <option value="">Select crew</option>
                {pauseCrew.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-field min-w-[240px]">
              <label className="form-label form-label-optional">Reason (optional)</label>
              <input className="form-input" value={pauseReason} onChange={(e) => setPauseReason(e.target.value)} placeholder="Break / delay / temporary absence" />
            </div>
            <button type="submit" disabled={pauseSaving || !pauseEventId || !pauseUserId} className="btn-brand disabled:opacity-50">
              {pauseSaving ? 'Saving…' : 'Pause / Resume'}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Transport tracking">
        <div className="p-6">
          <form onSubmit={handleTransport} className="flex flex-wrap items-end gap-4">
            <div className="form-field min-w-[200px]">
              <label className="form-label">Event</label>
              <select className="form-select" value={transportEventId} onChange={(e) => { setTransportEventId(e.target.value); setTransportUserId(''); }} required>
                <option value="">Select event</option>
                {activeEvents.map((e) => <option key={e.id} value={e.id}>{e.name} – {e.date}</option>)}
              </select>
            </div>
            <div className="form-field min-w-[200px]">
              <label className="form-label">Crew member</label>
              <select className="form-select" value={transportUserId} onChange={(e) => setTransportUserId(e.target.value)} required>
                <option value="">Select crew</option>
                {transportCrew.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div className="form-field min-w-[180px]">
              <label className="form-label">Transport type</label>
              <select className="form-select" value={transportType} onChange={(e) => setTransportType(e.target.value as 'organization' | 'cab' | 'none')}>
                <option value="organization">Organization transport</option>
                <option value="cab">Cab / Taxi</option>
                <option value="none">No transport</option>
              </select>
            </div>
            {transportType === 'cab' && (
              <div className="form-field min-w-[140px]">
                <label className="form-label">Amount (KSh)</label>
                <input className="form-input" type="number" min="0" step="0.01" value={transportAmount} onChange={(e) => setTransportAmount(e.target.value)} required />
              </div>
            )}
            <button type="submit" disabled={transportSaving || !transportEventId || !transportUserId} className="btn-brand disabled:opacity-50">
              {transportSaving ? 'Saving…' : 'Record transport'}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Done for the day">
        <div className="p-6">
          <form onSubmit={handleDoneForDay} className="flex flex-wrap items-end gap-4">
            <div className="form-field min-w-[220px]">
              <label className="form-label">Event</label>
              <select className="form-select" value={closeEventId} onChange={(e) => setCloseEventId(e.target.value)} required>
                <option value="">Select event</option>
                {activeEvents.map((e) => <option key={e.id} value={e.id}>{e.name} – {e.date}</option>)}
              </select>
            </div>
            <div className="form-field min-w-[320px] flex-1">
              <label className="form-label">Leave a comment about today&apos;s work</label>
              <input className="form-input" value={closeComment} onChange={(e) => setCloseComment(e.target.value)} required />
            </div>
            <button type="submit" disabled={closing || !closeEventId || !closeComment.trim()} className="btn-brand disabled:opacity-50">
              {closing ? 'Closing…' : 'Confirm done'}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Add crew to event">
        <div className="p-6">
          <p className="mb-4 text-sm text-slate-600">
            Add a crew member to an event. They will receive a notification. You can also add crew from the event detail page.
          </p>
          <form onSubmit={handleAddCrew} className="flex flex-wrap items-end gap-4">
            <div className="form-field min-w-[200px]">
              <label className="form-label" htmlFor="add-event">Event</label>
              <select
                id="add-event"
                value={addCrewEventId}
                onChange={(e) => setAddCrewEventId(e.target.value)}
                required
                className="form-select"
              >
                <option value="">Select event</option>
                {activeEvents.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} – {e.date}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field min-w-[200px]">
              <label className="form-label" htmlFor="add-user">Crew / user</label>
              <select
                id="add-user"
                value={addCrewUserId}
                onChange={(e) => setAddCrewUserId(e.target.value)}
                required
                className="form-select"
              >
                <option value="">Select user</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {u.email ? ` (${u.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field min-w-[140px]">
              <label className="form-label form-label-optional" htmlFor="add-role">Role (optional)</label>
              <input
                id="add-role"
                type="text"
                value={addCrewRole}
                onChange={(e) => setAddCrewRole(e.target.value)}
                className="form-input"
                placeholder="e.g. Technician"
              />
            </div>
            <button
              type="submit"
              disabled={addCrewSaving || !addCrewEventId || !addCrewUserId}
              className="btn-brand disabled:opacity-50"
            >
              {addCrewSaving ? 'Adding…' : 'Add to event'}
            </button>
          </form>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Events – full management">
        <div className="p-6">
          <p className="mb-4 text-sm text-slate-600">
            Open an event to manage crew, equipment, notes, payments, and end the event.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full table-header-brand">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.slice(0, 20).map((e) => (
                  <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                    <td className="px-6 py-4 font-medium text-slate-900">{e.name}</td>
                    <td className="px-6 py-4 text-slate-600">{e.date}</td>
                    <td className="px-6 py-4">
                      <span className="chip-brand capitalize">{e.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link to={`/events/${e.id}`} className="link-brand">
                        View & manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {events.length > 20 && (
            <p className="mt-3 text-sm text-slate-500">
              Showing 20 of {events.length}. Use <Link to="/events" className="link-brand">Events</Link> for the full list.
            </p>
          )}
          {events.length === 0 && !loading && (
            <p className="py-8 text-center text-slate-500">No events. Create one from the Events page.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
