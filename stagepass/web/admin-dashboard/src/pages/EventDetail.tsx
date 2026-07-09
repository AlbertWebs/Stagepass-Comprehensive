import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  PAYMENT_PURPOSES,
  type Client,
  type EarnedAllowanceDetail,
  type Event,
  type EquipmentItem,
  type PaymentItem,
  type ReportFilters,
  type ReportType,
  type User,
} from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

type CrewMember = User & {
  pivot?: {
    role_in_event?: string;
    checkin_time?: string | null;
    checkout_time?: string | null;
    total_hours?: number | null;
    standard_hours?: number | null;
    extra_hours?: number | null;
    hours_status?: 'not_checked_in' | 'within_standard' | 'in_extra_hours' | 'checked_out';
  };
};

function formatHours(h: number | null | undefined): string {
  if (h == null || Number.isNaN(Number(h))) return '–';
  const n = Number(h);
  const mins = Math.round(n * 60);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return `${hh}h ${mm}m`;
}

function crewHoursStatusLabel(member: CrewMember): string {
  const p = member.pivot;
  if (!p?.checkin_time) return 'Pending';
  if (p.checkout_time) return 'Checked Out';
  if (p.hours_status === 'within_standard') return 'Within Standard Hours';
  if (p.hours_status === 'in_extra_hours') return 'In Extra Hours';
  if (p.hours_status === 'checked_out') return 'Checked Out';
  return 'Active';
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '–';
  const dateOnly = typeof d === 'string' && d.includes('T') ? d.slice(0, 10) : String(d).slice(0, 10);
  const [y, m, day] = dateOnly.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(day));
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function dateOnly(d: string | null | undefined): string {
  if (!d) return '';
  return typeof d === 'string' && d.includes('T') ? d.slice(0, 10) : String(d).slice(0, 10);
}

function escapeCsvCell(s: string | number): string {
  const str = String(s ?? '');
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const line = (row: (string | number)[]) => row.map(escapeCsvCell).join(',');
  const csv = [line(headers), ...rows.map((row) => line(row))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function eventCoversDate(ev: Event, day: string): boolean {
  const from = dateOnly(ev.date) || day;
  const to = dateOnly(ev.end_date) || from;
  return from <= day && day <= to;
}

function eventReportFilters(event: Event, extras?: { confirmed_by?: string; signature?: string }): ReportFilters {
  const from = dateOnly(event.date) || new Date().toISOString().slice(0, 10);
  const to = dateOnly(event.end_date) || from;
  return {
    event_id: event.id,
    date_from: from,
    date_to: to,
    per_page: 500,
    ...(extras?.confirmed_by ? { confirmed_by: extras.confirmed_by } : {}),
    ...(extras?.signature ? { signature: extras.signature } : {}),
  };
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
  const [payPerDiem, setPayPerDiem] = useState('');
  const [payAllowances, setPayAllowances] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [earnedAllowances, setEarnedAllowances] = useState<EarnedAllowanceDetail[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferUserId, setTransferUserId] = useState('');
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamLeaderSaving, setTeamLeaderSaving] = useState(false);
  const [clientSaving, setClientSaving] = useState(false);
  const [endEventOpen, setEndEventOpen] = useState(false);
  const [endComment, setEndComment] = useState('');
  const [endSaving, setEndSaving] = useState(false);
  const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [attachingEquipment, setAttachingEquipment] = useState(false);
  const [exportingReport, setExportingReport] = useState<ReportType | 'csv' | null>(null);

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

  const fetchEarnedAllowances = useCallback(() => {
    if (!id) return;
    api.payments
      .earnedAllowances({ event_id: Number(id), per_page: 500 })
      .then((r) => setEarnedAllowances(r.flat ?? r.data?.[0]?.details ?? []))
      .catch(() => setEarnedAllowances([]));
  }, [id]);

  useEffect(() => {
    if (id) fetchEarnedAllowances();
  }, [id, fetchEarnedAllowances]);

  useEffect(() => {
    api.events.list({ per_page: 500 }).then((r) => setAllEvents(r.data ?? [])).catch(() => setAllEvents([]));
  }, []);

  useEffect(() => {
    if (!id || !event?.crew?.length) return;
    const hasOpenSession = event.crew.some((u) => {
      const p = (u as CrewMember).pivot;
      return Boolean(p?.checkin_time) && !p?.checkout_time;
    });
    if (!hasOpenSession) return;
    const t = window.setInterval(() => {
      api.events.get(Number(id)).then(setEvent).catch(() => {});
    }, 30_000);
    return () => window.clearInterval(t);
  }, [id, event?.crew]);

  const isEventEnded = event?.status === 'completed' || event?.status === 'closed';
  const isDoneForDay = event?.status === 'done_for_the_day';
  const eventSpanEnded = event
    ? (dateOnly(event.end_date) || dateOnly(event.date) || '') < new Date().toISOString().slice(0, 10)
    : false;
  const showPermanentEnd = !isEventEnded && (!isDoneForDay || eventSpanEnded);

  const transferTargetEvents = event
    ? allEvents.filter((e) => {
        if (e.id === event.id) return false;
        if (e.status === 'completed' || e.status === 'closed') return false;
        const refDay = dateOnly(event.date);
        return refDay ? eventCoversDate(e, refDay) : false;
      })
    : [];

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
      const body = (err as Error & { responseBody?: { conflicting_events?: Array<{ id: number; name: string }> } })
        .responseBody;
      const conflict = body?.conflicting_events?.[0];
      if (conflict && window.confirm(`This person is on "${conflict.name}". Move them from that event instead?`)) {
        try {
          await api.events.transferUser(conflict.id, Number(selectedUserId), event.id);
          setAddCrewOpen(false);
          fetchEvent();
          return;
        } catch (transferErr) {
          setError(transferErr instanceof Error ? transferErr.message : 'Transfer failed');
          return;
        }
      }
      setError(err instanceof Error ? err.message : 'Failed to add crew member');
    } finally {
      setAssigning(false);
    }
  };

  const openTransferCrew = () => {
    setTransferUserId('');
    setTransferTargetId('');
    setError(null);
    setTransferOpen(true);
  };

  const handleTransferCrew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !transferUserId || !transferTargetId) return;
    setTransferring(true);
    setError(null);
    try {
      await api.events.transferUser(event.id, Number(transferUserId), Number(transferTargetId));
      setTransferOpen(false);
      fetchEvent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transfer failed');
    } finally {
      setTransferring(false);
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
    setPayPerDiem('');
    setPayAllowances('');
    setError(null);
    setAllocatePayOpen(true);
  };

  const handleDownloadPdf = async (type: ReportType) => {
    if (!event) return;
    setExportingReport(type);
    setError(null);
    try {
      const leadName = event.team_leader?.name?.trim();
      const { html } = await api.reports.exportHtml(
        type,
        eventReportFilters(event, leadName ? { confirmed_by: leadName } : undefined)
      );
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => {
          w.print();
        }, 500);
      } else {
        setError('Pop-up blocked. Allow pop-ups to download/print the report.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setExportingReport(null);
    }
  };

  const handleDownloadCsv = async () => {
    if (!event) return;
    setExportingReport('csv');
    setError(null);
    try {
      const filters = eventReportFilters(event);
      const full = await api.reports.fullEvent(filters);
      const item = full.events?.find((e) => e.event.id === event.id) ?? full.events?.[0];
      const slug = event.name.replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').slice(0, 40) || `event-${event.id}`;
      const dateLabel = dateOnly(event.date) || 'report';

      downloadCsv(
        `${slug}-allowances-${dateLabel}.csv`,
        ['Crew', 'Type', 'Amount', 'Status', 'Source', 'Description', 'Meal slot', 'Meal date', 'Recorded at'],
        (item?.earned_allowances ?? []).map((a) => [
          a.crew_name,
          a.allowance_type,
          a.amount,
          a.status,
          a.source,
          a.description ?? '',
          a.meal_slot ?? '',
          a.meal_grant_date ?? '',
          a.recorded_at ?? '',
        ])
      );

      downloadCsv(
        `${slug}-payments-${dateLabel}.csv`,
        ['Crew', 'Purpose', 'Date', 'Allowances', 'Per diem', 'Total', 'Status'],
        (item?.payments ?? []).map((p) => [
          p.crew_name,
          p.purpose ?? '',
          p.payment_date ?? '',
          p.allowances,
          p.per_diem,
          p.total_amount,
          p.status,
        ])
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
    } finally {
      setExportingReport(null);
    }
  };

  const handleAllocatePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !payUserId) return;
    const perDiem = Number(payPerDiem) || 0;
    const allowances = Number(payAllowances) || 0;
    if (perDiem <= 0 && allowances <= 0) return;
    setPaymentSaving(true);
    setError(null);
    try {
      await api.payments.initiate({
        event_id: event.id,
        user_id: Number(payUserId),
        purpose: payPurpose || undefined,
        payment_date: payDate || undefined,
        per_diem: perDiem,
        allowances,
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownloadPdf('full-event')}
              disabled={exportingReport !== null}
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-[#ca8a04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#a16204] disabled:opacity-50"
            >
              {exportingReport === 'full-event' ? 'Preparing…' : 'Download report'}
            </button>
            <Link
              to="/events"
              className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/15 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/25 hover:border-white/40"
            >
              <span aria-hidden>←</span>
              Back to events
            </Link>
          </div>
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
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-brand-600">Daily allowance</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {event.daily_allowance != null ? Number(event.daily_allowance).toFixed(2) : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-brand-600">Per diem</dt>
                  <dd className="mt-1 font-medium text-slate-900">{event.per_diem_enabled ? 'Enabled' : 'Disabled'}</dd>
                </div>
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
              <div className="flex gap-2">
                <button type="button" onClick={openAddCrew} className="btn-brand text-sm">
                  Add crew
                </button>
                {(event.crew?.length ?? 0) > 0 && transferTargetEvents.length > 0 && (
                  <button type="button" onClick={openTransferCrew} className="btn-secondary text-sm">
                    Transfer crew
                  </button>
                )}
              </div>
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

      <SectionCard sectionLabel="Reports">
        <div
          className="rounded-r-xl border-l-4 p-6"
          style={{ borderColor: '#ca8a04', background: 'linear-gradient(90deg, #fef9ee 0%, #ffffff 100%)' }}
        >
          <p className="mb-4 text-sm text-slate-600">
            Download a printable PDF or CSV export for this event (attendance, payments, and end-of-day summary).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleDownloadPdf('full-event')}
              disabled={exportingReport !== null}
              className="btn-brand text-sm disabled:opacity-50"
            >
              {exportingReport === 'full-event' ? 'Preparing…' : 'Full event PDF'}
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPdf('end-of-day')}
              disabled={exportingReport !== null}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {exportingReport === 'end-of-day' ? 'Preparing…' : 'End-of-day PDF'}
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPdf('crew-attendance')}
              disabled={exportingReport !== null}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {exportingReport === 'crew-attendance' ? 'Preparing…' : 'Attendance PDF'}
            </button>
            <button
              type="button"
              onClick={() => handleDownloadPdf('crew-payments')}
              disabled={exportingReport !== null}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {exportingReport === 'crew-payments' ? 'Preparing…' : 'Payments PDF'}
            </button>
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={exportingReport !== null}
              className="btn-secondary text-sm disabled:opacity-50"
            >
              {exportingReport === 'csv' ? 'Preparing…' : 'Export CSV'}
            </button>
            <Link
              to={`/reports?event_id=${event.id}`}
              className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Open in Reports
            </Link>
          </div>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Crew arrivals">
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
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Total</th>
                    <th>Standard</th>
                    <th>Extra</th>
                    <th>Work status</th>
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
                    const workLabel = crewHoursStatusLabel(member);
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
                        <td className="px-6 py-4 text-sm text-slate-700">
                          {checkinTime ? (
                            <span className="inline-flex flex-wrap items-center gap-1.5">
                              {formatTime(checkinTime)}
                              {isLateArrival(checkinTime) && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">Late</span>
                              )}
                            </span>
                          ) : (
                            '–'
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-700">{checkoutTime ? formatTime(checkoutTime) : '–'}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{formatHours(member.pivot?.total_hours)}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{formatHours(member.pivot?.standard_hours)}</td>
                        <td className="px-6 py-4 text-sm font-medium text-amber-800">{formatHours(member.pivot?.extra_hours)}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                              checkedOut
                                ? 'text-slate-600'
                                : workLabel.includes('Extra')
                                  ? 'text-amber-800'
                                  : arrived
                                    ? 'text-green-700'
                                    : 'text-slate-500'
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                checkedOut ? 'bg-slate-400' : workLabel.includes('Extra') ? 'bg-amber-500' : arrived ? 'bg-green-500' : 'bg-slate-300'
                              }`}
                              aria-hidden
                            />
                            {workLabel}
                          </span>
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
              <p className="py-6 text-center text-sm text-slate-500">No crew assigned. Add crew above to track arrivals.</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Earned allowances">
        <div className="flex flex-col">
          <div
            className="flex flex-shrink-0 items-center justify-between border-b px-6 py-3.5"
            style={{ borderColor: '#b3c1e1', background: 'linear-gradient(90deg, #fef9ee 0%, #f8f9fc 100%)' }}
          >
            <span className="text-sm font-medium" style={{ color: '#1e2d5c' }}>
              Meal and manual allowance lines recorded for this event (from check-in rules or approvals).
            </span>
            <Link to="/payments?tab=allowances" className="link-brand text-sm">
              Manage on Payments
            </Link>
          </div>
          <div className="overflow-x-auto">
            {earnedAllowances.length > 0 ? (
              <table className="w-full table-header-brand">
                <thead>
                  <tr>
                    <th>Crew</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Description</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {earnedAllowances.map((a) => (
                    <tr key={a.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                      <td className="px-6 py-4 font-medium text-slate-900">{a.crew_name}</td>
                      <td className="px-6 py-4 text-slate-700">{a.allowance_type}</td>
                      <td className="px-6 py-4 text-slate-700">{Number(a.amount).toFixed(2)}</td>
                      <td className="px-6 py-4 capitalize text-slate-700">{a.status}</td>
                      <td className="px-6 py-4 text-slate-600">{a.source ?? '—'}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {a.description || a.meal_slot || '—'}
                        {a.meal_grant_date ? ` (${a.meal_grant_date})` : ''}
                      </td>
                      <td className="px-6 py-4 text-slate-600">{a.recorded_at ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="px-6 py-10 text-center text-sm text-slate-500">No earned allowances recorded for this event yet.</p>
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
                    <th>Per diem</th>
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
                      <td className="px-6 py-4 text-slate-700">{Number(p.per_diem ?? 0).toFixed(2)}</td>
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

      {showPermanentEnd && (
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
      )}

      {isDoneForDay && !isEventEnded && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-6 py-4 text-sm text-amber-900">
          This event is done for the day. Crew were checked out and can check in again tomorrow if the event continues.
        </div>
      )}

      {error && !addCrewOpen && !allocatePayOpen && !endEventOpen && !transferOpen && (
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
                <label className="form-label" htmlFor="alloc-per-diem">Per diem</label>
                <input
                  id="alloc-per-diem"
                  type="number"
                  min={0}
                  step={0.01}
                  value={payPerDiem}
                  onChange={(e) => setPayPerDiem(e.target.value)}
                  className="form-input"
                  placeholder="0"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="alloc-allowances">Allowances</label>
                <input
                  id="alloc-allowances"
                  type="number"
                  min={0}
                  step={0.01}
                  value={payAllowances}
                  onChange={(e) => setPayAllowances(e.target.value)}
                  className="form-input"
                  placeholder="0"
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setAllocatePayOpen(false)} className="btn-secondary">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSaving || !payUserId || (Number(payPerDiem) <= 0 && Number(payAllowances) <= 0)}
                  className="btn-brand disabled:opacity-50"
                >
                  {paymentSaving ? 'Creating…' : 'Create payment request'}
                </button>
              </div>
            </form>
          </div>
        </FormModal>
      )}

      {transferOpen && event && (
        <FormModal title="Transfer crew" onClose={() => { setTransferOpen(false); setError(null); }} wide={false}>
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-4">{error}</div>}
            <p className="mb-4 text-sm text-slate-600">
              Move a crew member to another event on the same day. Open check-ins on this event are checked out automatically.
            </p>
            <form onSubmit={handleTransferCrew} className="space-y-4">
              <div className="form-field">
                <label className="form-label" htmlFor="xfer-user">Crew member *</label>
                <select
                  id="xfer-user"
                  required
                  value={transferUserId}
                  onChange={(e) => setTransferUserId(e.target.value)}
                  className="form-select"
                >
                  <option value="">Select crew member</option>
                  {(event.crew ?? []).map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="xfer-target">To event (same day) *</label>
                <select
                  id="xfer-target"
                  required
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="form-select"
                >
                  <option value="">Select destination event</option>
                  {transferTargetEvents.map((e) => (
                    <option key={e.id} value={e.id}>{e.name} – {formatDate(e.date)}</option>
                  ))}
                </select>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setTransferOpen(false)} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={transferring || !transferUserId || !transferTargetId} className="btn-brand disabled:opacity-50">
                  {transferring ? 'Transferring…' : 'Transfer'}
                </button>
              </div>
            </form>
          </div>
        </FormModal>
      )}
    </div>
  );
}
