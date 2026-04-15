import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  PAYMENT_PURPOSES,
  type AllowanceTypeItem,
  type EarnedAllowanceEventGroup,
  type Event,
  type Paginated,
  type PaymentItem,
  type User,
} from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

type PaymentFormState = {
  event_id: string;
  user_id: string;
  purpose: string;
  hours: string;
  per_diem: string;
  allowances: string;
};

type EarnedAllowanceFormState = {
  event_id: string;
  crew_id: string;
  allowance_type_id: string;
  amount: string;
  description: string;
};

function emptyForm(): PaymentFormState {
  return {
    event_id: '',
    user_id: '',
    purpose: 'fair',
    hours: '',
    per_diem: '',
    allowances: '0',
  };
}

function emptyEarnedAllowanceForm(): EarnedAllowanceFormState {
  return {
    event_id: '',
    crew_id: '',
    allowance_type_id: '',
    amount: '',
    description: '',
  };
}

function formatDate(d: string) {
  try {
    const [y, m, day] = d.split('-');
    const date = new Date(Number(y), Number(m) - 1, Number(day));
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

export default function Payments() {
  const [segment, setSegment] = useState<'payments' | 'history' | 'pending' | 'allowances'>('payments');
  const [data, setData] = useState<Paginated<PaymentItem> | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [status, setStatus] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectModal, setRejectModal] = useState<PaymentItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<PaymentFormState>(emptyForm());

  const [pageLoading, setPageLoading] = useState(true);
  const [allowancesData, setAllowancesData] = useState<EarnedAllowanceEventGroup[]>([]);
  const [allowancesLoading, setAllowancesLoading] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceTypeItem[]>([]);
  const [allowanceTypeName, setAllowanceTypeName] = useState('');
  const [allowanceStatusFilter, setAllowanceStatusFilter] = useState('');
  const [allowanceSearch, setAllowanceSearch] = useState('');
  const [allowanceForm, setAllowanceForm] = useState<EarnedAllowanceFormState>(emptyEarnedAllowanceForm());
  const [allocatingAllowance, setAllocatingAllowance] = useState(false);

  const fetchPayments = useCallback(() => {
    api.payments
      .list({
        status: status || undefined,
        event_id: eventFilter ? Number(eventFilter) : undefined,
        page,
      })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setPageLoading(false));
  }, [status, eventFilter, page]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    api.events.list({}).then((r) => setEvents(r.data ?? [])).catch(() => setEvents([]));
    api.payments.allowanceTypes().then((r) => setAllowanceTypes(r.data ?? [])).catch(() => setAllowanceTypes([]));
  }, []);

  const fetchAllowances = useCallback(() => {
    setAllowancesLoading(true);
    api.payments
      .earnedAllowances({
        status: allowanceStatusFilter || undefined,
        search: allowanceSearch || undefined,
        event_id: eventFilter ? Number(eventFilter) : undefined,
      })
      .then((r) => setAllowancesData(r.data ?? []))
      .catch(() => setAllowancesData([]))
      .finally(() => setAllowancesLoading(false));
  }, [allowanceStatusFilter, allowanceSearch, eventFilter]);

  useEffect(() => {
    if (segment === 'allowances') fetchAllowances();
  }, [segment, fetchAllowances]);

  const payments = data?.data ?? [];

  if (pageLoading && !data) {
    return <Preloader message="Loading payments…" fullScreen />;
  }

  const openCreate = () => {
    setForm(emptyForm());
    setError(null);
    setCreateOpen(true);
  };

  const closeModals = () => {
    setCreateOpen(false);
    setRejectModal(null);
    setRejectReason('');
    setError(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const eventId = form.event_id ? Number(form.event_id) : 0;
    const userId = form.user_id ? Number(form.user_id) : 0;
    const hours = Number(form.hours) || 0;
    if (!eventId || !userId) {
      setError('Please select event and crew member.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.payments.initiate({
        event_id: eventId,
        user_id: userId,
        purpose: form.purpose || undefined,
        hours,
        per_diem: Number(form.per_diem) || 0,
        allowances: Number(form.allowances) || 0,
      });
      closeModals();
      fetchPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payment request');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (payment: PaymentItem) => {
    setSaving(true);
    setError(null);
    try {
      await api.payments.approve(payment.id);
      fetchPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setSaving(true);
    setError(null);
    try {
      await api.payments.reject(rejectModal.id, rejectReason.trim() || undefined);
      closeModals();
      fetchPayments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setSaving(false);
    }
  };

  const handleAllocateAllowance = async () => {
    const eventId = Number(allowanceForm.event_id);
    const crewId = Number(allowanceForm.crew_id);
    const typeId = Number(allowanceForm.allowance_type_id);
    const amount = Number(allowanceForm.amount);
    if (!eventId || !crewId || !typeId || !Number.isFinite(amount) || amount <= 0) {
      setError('Select event, crew, allowance type, and a valid amount.');
      return;
    }
    setAllocatingAllowance(true);
    setError(null);
    try {
      await api.payments.addEarnedAllowance({
        event_id: eventId,
        crew_id: crewId,
        allowance_type_id: typeId,
        amount,
        description: allowanceForm.description.trim() || undefined,
      });
      setAllowanceForm((prev) => ({
        ...prev,
        crew_id: '',
        amount: '',
        description: '',
      }));
      fetchAllowances();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to allocate allowance');
    } finally {
      setAllocatingAllowance(false);
    }
  };

  const selectedEventId = form.event_id ? Number(form.event_id) : null;
  const selectedEvent = selectedEventId ? events.find((e) => e.id === selectedEventId) : null;
  const crewForSelect = selectedEvent?.crew ?? [];
  const selectedAllowanceEventId = allowanceForm.event_id ? Number(allowanceForm.event_id) : null;
  const selectedAllowanceEvent = selectedAllowanceEventId ? events.find((e) => e.id === selectedAllowanceEventId) : null;
  const allowanceCrewForSelect = selectedAllowanceEvent?.crew ?? [];

  return (
    <div className="flex max-h-[calc(100vh-6rem)] flex-col gap-6 overflow-y-auto scrollbar-hide">
      <div className="flex gap-2">
        {[
          ['payments', 'Payments'],
          ['history', 'Payment History'],
          ['pending', 'Pending Payments'],
          ['allowances', 'Earned Allowances'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-medium ${segment === id ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
            onClick={() => setSegment(id as 'payments' | 'history' | 'pending' | 'allowances')}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Payments"
          subtitle={
            segment === 'allowances'
              ? 'Earned allowances grouped by event for verification, approval and payroll transparency.'
              : 'Payment requests from crew (mobile app) or allocated by team leaders. Approve or reject pending requests.'
          }
        />
        <button
          type="button"
          onClick={segment === 'allowances' ? handleAllocateAllowance : openCreate}
          className="btn-brand inline-flex items-center gap-2 rounded-xl px-5 py-2.5 shadow-sm"
          disabled={segment === 'allowances' ? allocatingAllowance : false}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {segment === 'allowances' ? (allocatingAllowance ? 'Allocating…' : 'Allocate allowance') : 'Create payment request'}
        </button>
      </div>

      <div className="flex flex-shrink-0 flex-wrap items-center gap-3 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
        <span className="text-sm font-medium text-slate-600">Filters</span>
        {segment !== 'allowances' && (
          <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="form-select w-auto min-w-[10rem]"
          aria-label="Filter by status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
          </select>
        )}
        <select
          value={eventFilter}
          onChange={(e) => { setEventFilter(e.target.value); setPage(1); }}
          className="form-select w-auto min-w-[12rem]"
          aria-label="Filter by event"
        >
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.date})
            </option>
          ))}
        </select>
        {segment === 'allowances' && (
          <>
            <select
              value={allowanceStatusFilter}
              onChange={(e) => setAllowanceStatusFilter(e.target.value)}
              className="form-select w-auto min-w-[10rem]"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </select>
            <input
              className="form-input min-w-[16rem]"
              placeholder="Search event / crew / allowance type"
              value={allowanceSearch}
              onChange={(e) => setAllowanceSearch(e.target.value)}
            />
            <button type="button" className="btn-secondary" onClick={fetchAllowances}>Apply</button>
          </>
        )}
      </div>

      {error && !createOpen && !rejectModal && (
        <div className="form-error-banner flex-shrink-0">{error}</div>
      )}

      {segment !== 'allowances' && (
      <SectionCard sectionLabel="Payment requests">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full table-header-brand">
            <thead>
              <tr>
                <th>Event</th>
                <th>Member</th>
                <th>Purpose</th>
                <th>Hours</th>
                <th>Per diem</th>
                <th>Allowances</th>
                <th>Total</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                  <td className="px-6 py-4">
                    {p.event ? (
                      <Link to={`/events/${p.event.id}`} className="link-brand font-medium">
                        {p.event.name}
                      </Link>
                    ) : (
                      <span className="text-slate-500">Event #{p.event_id}</span>
                    )}
                    {p.event?.date && (
                      <span className="block text-xs text-slate-500">{formatDate(p.event.date)}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {p.user ? (
                      <span className="font-medium text-slate-900">{p.user.name}</span>
                    ) : (
                      <span className="text-slate-500">User #{p.user_id}</span>
                    )}
                    {p.user?.email && (
                      <span className="block text-sm text-slate-500">{p.user.email}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 capitalize text-slate-700">{p.purpose ?? '–'}</td>
                  <td className="px-6 py-4 text-slate-700">{Number(p.hours)}</td>
                  <td className="px-6 py-4 text-slate-700">{Number(p.per_diem).toFixed(2)}</td>
                  <td className="px-6 py-4 text-slate-700">{Number(p.allowances).toFixed(2)}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {Number(p.total_amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`chip-brand capitalize ${
                        p.status === 'approved'
                          ? 'bg-green-100 text-green-800'
                          : p.status === 'rejected'
                            ? 'bg-red-100 text-red-800'
                            : ''
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {p.status === 'pending' && (
                      <span className="inline-flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleApprove(p)}
                          disabled={saving}
                          className="link-brand text-green-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRejectModal(p);
                            setRejectReason('');
                            setError(null);
                          }}
                          disabled={saving}
                          className="text-sm font-medium text-red-600 hover:underline"
                        >
                          Reject
                        </button>
                      </span>
                    )}
                    {p.status !== 'pending' && p.rejection_reason && (
                      <span className="text-xs text-slate-500" title={p.rejection_reason}>
                        {p.rejection_reason.slice(0, 30)}…
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!payments.length && (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-14 text-center">
            <p className="text-slate-600">
              No payment requests yet. Create one for a crew member or wait for requests from the mobile app.
            </p>
            <button type="button" onClick={openCreate} className="btn-brand inline-flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create payment request
            </button>
          </div>
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
      )}

      {segment === 'allowances' && (
        <SectionCard sectionLabel="Earned allowances by event">
          <div className="space-y-4 p-6">
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 text-sm font-medium text-slate-700">Allocate allowance to crew</div>
              <p className="mb-3 text-xs text-slate-500">
                Create an allowance allocation for a crew member. It will appear in their mobile app allowances screen.
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <select
                  className="form-select"
                  value={allowanceForm.event_id}
                  onChange={(e) => setAllowanceForm((f) => ({ ...f, event_id: e.target.value, crew_id: '' }))}
                >
                  <option value="">Select event</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({formatDate(e.date)})
                    </option>
                  ))}
                </select>
                <select
                  className="form-select"
                  value={allowanceForm.crew_id}
                  onChange={(e) => setAllowanceForm((f) => ({ ...f, crew_id: e.target.value }))}
                  disabled={!selectedAllowanceEventId}
                >
                  <option value="">Select crew</option>
                  {allowanceCrewForSelect.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <select
                  className="form-select"
                  value={allowanceForm.allowance_type_id}
                  onChange={(e) => setAllowanceForm((f) => ({ ...f, allowance_type_id: e.target.value }))}
                >
                  <option value="">Allowance type</option>
                  {allowanceTypes
                    .filter((t) => t.is_active)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Amount"
                  value={allowanceForm.amount}
                  onChange={(e) => setAllowanceForm((f) => ({ ...f, amount: e.target.value }))}
                />
                <button
                  type="button"
                  className="btn-brand"
                  onClick={handleAllocateAllowance}
                  disabled={allocatingAllowance}
                >
                  {allocatingAllowance ? 'Allocating…' : 'Allocate'}
                </button>
              </div>
              <input
                className="form-input mt-3"
                placeholder="Optional description"
                value={allowanceForm.description}
                onChange={(e) => setAllowanceForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 text-sm font-medium text-slate-700">Allowance types</div>
              <div className="flex flex-wrap items-center gap-2">
                {allowanceTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`rounded-full px-3 py-1 text-xs ${t.is_active ? 'bg-slate-100 text-slate-800' : 'bg-slate-50 text-slate-400 line-through'}`}
                    onClick={async () => {
                      await api.payments.updateAllowanceType(t.id, { is_active: !t.is_active });
                      const types = await api.payments.allowanceTypes();
                      setAllowanceTypes(types.data ?? []);
                    }}
                  >
                    {t.name}
                  </button>
                ))}
                <input
                  className="form-input min-w-[12rem]"
                  placeholder="New allowance type"
                  value={allowanceTypeName}
                  onChange={(e) => setAllowanceTypeName(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-brand"
                  onClick={async () => {
                    if (!allowanceTypeName.trim()) return;
                    await api.payments.createAllowanceType(allowanceTypeName.trim(), true);
                    setAllowanceTypeName('');
                    const types = await api.payments.allowanceTypes();
                    setAllowanceTypes(types.data ?? []);
                  }}
                >
                  Add type
                </button>
              </div>
            </div>

            {allowancesLoading ? (
              <div className="text-sm text-slate-500">Loading earned allowances…</div>
            ) : allowancesData.length === 0 ? (
              <div className="text-sm text-slate-500">No earned allowances found for the selected filters.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full table-header-brand">
                  <thead>
                    <tr>
                      <th>Event Name</th>
                      <th>Event Date</th>
                      <th>Team Lead</th>
                      <th>Crew Count</th>
                      <th>Total Allowances</th>
                      <th>Status</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allowancesData.map((g) => (
                      <>
                        <tr key={g.event_id} className="border-b border-slate-100">
                          <td className="px-6 py-4">{g.event_name}</td>
                          <td className="px-6 py-4">{g.event_date ? formatDate(g.event_date) : '—'}</td>
                          <td className="px-6 py-4">{g.team_lead ?? '—'}</td>
                          <td className="px-6 py-4">{g.crew_count}</td>
                          <td className="px-6 py-4 font-semibold">{g.total_allowances.toFixed(2)}</td>
                          <td className="px-6 py-4 text-xs text-slate-600">
                            P:{g.status_breakdown.pending} A:{g.status_breakdown.approved} Pd:{g.status_breakdown.paid}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button className="link-brand" onClick={() => setExpandedEventId(expandedEventId === g.event_id ? null : g.event_id)}>View Details</button>
                            <button
                              className="link-brand text-blue-700"
                              onClick={async () => {
                                await Promise.all(
                                  g.details
                                    .filter((d) => d.status === 'pending')
                                    .map((d) => api.payments.updateAllowanceStatus(d.id, 'approved'))
                                );
                                fetchAllowances();
                              }}
                            >
                              Approve Allowances
                            </button>
                            <button
                              className="link-brand"
                              onClick={() => window.open(`${window.location.origin.replace(/\/$/, '')}/api/payments/earned-allowances/export?format=csv`, '_blank')}
                            >
                              Export
                            </button>
                          </td>
                        </tr>
                        {expandedEventId === g.event_id && (
                          <tr key={`${g.event_id}-details`} className="bg-slate-50/70">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-200 text-left text-slate-500">
                                      <th className="py-2 pr-3">Crew Name</th>
                                      <th className="py-2 pr-3">Allowance Type</th>
                                      <th className="py-2 pr-3">Amount</th>
                                      <th className="py-2 pr-3">Reason / Description</th>
                                      <th className="py-2 pr-3">Recorded By</th>
                                      <th className="py-2 pr-3">Date Recorded</th>
                                      <th className="py-2 pr-3">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {g.details.map((d) => (
                                      <tr key={d.id} className="border-b border-slate-100">
                                        <td className="py-2 pr-3">{d.crew_name}</td>
                                        <td className="py-2 pr-3">{d.allowance_type}</td>
                                        <td className="py-2 pr-3">{Number(d.amount).toFixed(2)}</td>
                                        <td className="py-2 pr-3">{d.description || '—'}</td>
                                        <td className="py-2 pr-3">{d.recorded_by || '—'}</td>
                                        <td className="py-2 pr-3">{d.recorded_at ? new Date(d.recorded_at).toLocaleString() : '—'}</td>
                                        <td className="py-2 pr-3">
                                          <select
                                            className="form-select !py-1 !text-xs"
                                            value={d.status}
                                            onChange={async (e) => {
                                              await api.payments.updateAllowanceStatus(d.id, e.target.value as 'pending' | 'approved' | 'paid');
                                              fetchAllowances();
                                            }}
                                          >
                                            <option value="pending">Pending</option>
                                            <option value="approved">Approved</option>
                                            <option value="paid">Paid</option>
                                          </select>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {createOpen && (
        <FormModal title="Create payment request" onClose={closeModals} wide scrollable={false}>
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-5">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="form-field">
                <label className="form-label" htmlFor="pay-event">Event *</label>
                <select
                  id="pay-event"
                  required
                  value={form.event_id}
                  onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value, user_id: '' }))}
                  className="form-select"
                >
                  <option value="">Select event</option>
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} — {formatDate(e.date)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="pay-user">Crew member *</label>
                <select
                  id="pay-user"
                  required
                  value={form.user_id}
                  onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))}
                  className="form-select"
                  disabled={!selectedEventId}
                >
                  <option value="">Select crew member</option>
                  {crewForSelect.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.email ? `(${u.email})` : ''}
                    </option>
                  ))}
                  {selectedEventId && !crewForSelect.length && (
                    <option value="" disabled>
                      No crew on this event — add crew in event detail first
                    </option>
                  )}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="pay-purpose">Purpose</label>
                <select
                  id="pay-purpose"
                  value={form.purpose}
                  onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
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
              <div className="form-row">
                <div className="form-field">
                  <label className="form-label" htmlFor="pay-hours">Hours *</label>
                  <input
                    id="pay-hours"
                    type="number"
                    min={0}
                    step={0.5}
                    required
                    value={form.hours}
                    onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label form-label-optional" htmlFor="pay-perdiem">
                    Per diem
                  </label>
                  <input
                    id="pay-perdiem"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.per_diem}
                    onChange={(e) => setForm((f) => ({ ...f, per_diem: e.target.value }))}
                    className="form-input"
                  />
                </div>
                <div className="form-field">
                  <label className="form-label form-label-optional" htmlFor="pay-allowances">
                    Allowances
                  </label>
                  <input
                    id="pay-allowances"
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.allowances}
                    onChange={(e) => setForm((f) => ({ ...f, allowances: e.target.value }))}
                    className="form-input"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" onClick={closeModals} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
                  {saving ? 'Creating…' : 'Create request'}
                </button>
              </div>
            </form>
          </div>
        </FormModal>
      )}

      {rejectModal && (
        <FormModal title="Reject payment" onClose={closeModals} wide={false}>
          <div className="px-6 py-4">
            {error && <div className="form-error-banner mb-4">{error}</div>}
            <p className="text-slate-700">
              Reject payment for <strong>{rejectModal.user?.name ?? `User #${rejectModal.user_id}`}</strong> — {rejectModal.event?.name ?? `Event #${rejectModal.event_id}`}?
            </p>
            <div className="form-field mt-4">
              <label className="form-label form-label-optional" htmlFor="reject-reason">
                Reason (optional)
              </label>
              <input
                id="reject-reason"
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="form-input"
                placeholder="e.g. Hours not verified"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2 border-t border-slate-200 pt-4">
              <button type="button" onClick={closeModals} className="btn-secondary">
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={saving}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </FormModal>
      )}
    </div>
  );
}