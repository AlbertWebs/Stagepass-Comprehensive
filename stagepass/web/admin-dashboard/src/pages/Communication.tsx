import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type CommunicationItem,
  type Event,
  type Paginated,
} from '@/services/api';
import { FormModal } from '@/components/FormModal';
import { PageHeader } from '@/components/PageHeader';
import { Preloader } from '@/components/Preloader';
import { SectionCard } from '@/components/SectionCard';

const RECIPIENT_SCOPES = [
  { value: 'all_staff', label: 'All staff' },
  { value: 'crew', label: 'Crew only' },
  { value: 'event_crew', label: 'Event crew' },
] as const;

type FormState = {
  subject: string;
  body: string;
  recipient_scope: 'all_staff' | 'crew' | 'event_crew';
  event_id: string;
  send_as_message: boolean;
  send_as_email: boolean;
};

function emptyForm(): FormState {
  return {
    subject: '',
    body: '',
    recipient_scope: 'all_staff',
    event_id: '',
    send_as_message: true,
    send_as_email: false,
  };
}

export default function Communication() {
  const [data, setData] = useState<Paginated<CommunicationItem> | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [page, setPage] = useState(1);
  const [sendOpen, setSendOpen] = useState(false);
  const [viewItem, setViewItem] = useState<CommunicationItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<CommunicationItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [pageLoading, setPageLoading] = useState(true);

  const fetchCommunications = useCallback(() => {
    api.communications
      .list({ page })
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setPageLoading(false));
  }, [page]);

  useEffect(() => {
    setPageLoading(true);
    fetchCommunications();
  }, [fetchCommunications]);

  useEffect(() => {
    api.events.list({ per_page: 500 }).then((r) => setEvents(r.data ?? [])).catch(() => setEvents([]));
  }, []);

  const items = data?.data ?? [];

  if (pageLoading && !data) {
    return <Preloader message="Loading communications…" fullScreen />;
  }

  const openSend = () => {
    setForm(emptyForm());
    setError(null);
    setSendOpen(true);
  };

  const closeModals = () => {
    setSendOpen(false);
    setViewItem(null);
    setDeleteItem(null);
    setError(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.send_as_message && !form.send_as_email) {
      setError('Select at least one: In-app message and/or Email.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.communications.send({
        subject: form.subject.trim(),
        body: form.body.trim(),
        recipient_scope: form.recipient_scope,
        event_id: form.recipient_scope === 'event_crew' && form.event_id ? Number(form.event_id) : undefined,
        send_as_message: form.send_as_message,
        send_as_email: form.send_as_email,
      });
      closeModals();
      fetchCommunications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setSaving(true);
    setError(null);
    try {
      await api.communications.delete(deleteItem.id);
      closeModals();
      fetchCommunications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
    } finally {
      setSaving(false);
    }
  };

  const scopeLabel = (scope: string) => RECIPIENT_SCOPES.find((s) => s.value === scope)?.label ?? scope;
  const channelSummary = (c: CommunicationItem) => {
    const parts = [];
    if (c.send_as_message) parts.push('In-app');
    if (c.send_as_email) parts.push('Email');
    return parts.length ? parts.join(', ') : '–';
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Communication"
        subtitle="Send internal messages and/or emails to staff. Choose recipients and delivery channels."
        action={
          <button type="button" onClick={openSend} className="btn-brand">
            Send message
          </button>
        }
      />

      <SectionCard sectionLabel="Send internal message or email">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-6 py-5">
          <p className="text-sm text-slate-700">
            Use <strong>Send message</strong> to compose a broadcast. Select <strong>All staff</strong>, <strong>Crew only</strong>, or
            <strong> Event crew</strong> (then pick an event). Check <strong>In-app message</strong> to deliver via the app and/or{' '}
            <strong>Email</strong> to send by email. Recipients will see it in their notifications and/or inbox.
          </p>
        </div>
      </SectionCard>

      <SectionCard sectionLabel="Sent communications">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full table-header-brand">
            <thead>
              <tr>
                <th>Subject</th>
                <th>To</th>
                <th>Channels</th>
                <th>Sent by</th>
                <th>Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                  <td className="px-6 py-4 font-medium text-slate-900">{c.subject}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {scopeLabel(c.recipient_scope)}
                    {c.event ? ` (${c.event.name})` : ''}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{channelSummary(c)}</td>
                  <td className="px-6 py-4 text-slate-600">{c.sent_by ? c.sent_by.name : '–'}</td>
                  <td className="px-6 py-4 text-slate-600">
                    {c.sent_at ? new Date(c.sent_at).toLocaleString() : '–'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="inline-flex gap-3">
                      <button type="button" onClick={() => setViewItem(c)} className="link-brand">
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteItem(c);
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
        {items.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-brand-600">
            No communications yet. Send a message or email to get started.
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

      {sendOpen && (
        <FormModal title="Send message" onClose={closeModals} wide>
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-5">{error}</div>}
            <form onSubmit={handleSend} className="space-y-5">
              <div className="form-field">
                <label className="form-label" htmlFor="comm-subject">Subject *</label>
                <input
                  id="comm-subject"
                  type="text"
                  required
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  className="form-input"
                  placeholder="e.g. Schedule update for Saturday"
                />
              </div>
              <div className="form-field">
                <label className="form-label" htmlFor="comm-body">Message *</label>
                <textarea
                  id="comm-body"
                  rows={5}
                  required
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  className="form-input"
                  placeholder="Write your message..."
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="form-field">
                  <label className="form-label" htmlFor="comm-scope">Send to</label>
                  <select
                    id="comm-scope"
                    value={form.recipient_scope}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        recipient_scope: e.target.value as FormState['recipient_scope'],
                        event_id: e.target.value === 'event_crew' ? f.event_id : '',
                      }))
                    }
                    className="form-select"
                  >
                    {RECIPIENT_SCOPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                {form.recipient_scope === 'event_crew' && (
                  <div className="form-field">
                    <label className="form-label" htmlFor="comm-event">Event *</label>
                    <select
                      id="comm-event"
                      required={form.recipient_scope === 'event_crew'}
                      value={form.event_id}
                      onChange={(e) => setForm((f) => ({ ...f, event_id: e.target.value }))}
                      className="form-select"
                    >
                      <option value="">Select event</option>
                      {events.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} – {e.date}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="mb-3 text-sm font-medium text-slate-700">Delivery channels (select at least one)</p>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.send_as_message}
                    onChange={(e) => setForm((f) => ({ ...f, send_as_message: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-800">In-app message</span>
                </label>
                <label className="mt-2 flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.send_as_email}
                    onChange={(e) => setForm((f) => ({ ...f, send_as_email: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-800">Email</span>
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={closeModals} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-brand disabled:opacity-50">
                  {saving ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </FormModal>
      )}

      {viewItem && (
        <FormModal title={viewItem.subject} onClose={closeModals} wide>
          <div className="form-card-body space-y-4">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">To</dt>
                <dd className="mt-0.5 font-medium text-slate-900">
                  {scopeLabel(viewItem.recipient_scope)}
                  {viewItem.event ? ` – ${viewItem.event.name}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Channels</dt>
                <dd className="mt-0.5 text-slate-700">{channelSummary(viewItem)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Sent by</dt>
                <dd className="mt-0.5 text-slate-700">{viewItem.sent_by ? viewItem.sent_by.name : '–'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Sent at</dt>
                <dd className="mt-0.5 text-slate-700">
                  {viewItem.sent_at ? new Date(viewItem.sent_at).toLocaleString() : '–'}
                </dd>
              </div>
            </dl>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-slate-500">Message</dt>
              <dd className="mt-1 whitespace-pre-wrap text-slate-800">{viewItem.body}</dd>
            </div>
            <div className="flex justify-end border-t border-slate-200 pt-4">
              <button type="button" onClick={closeModals} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </FormModal>
      )}

      {deleteItem && (
        <FormModal title="Delete communication" onClose={closeModals} wide={false}>
          <div className="form-card-body">
            {error && <div className="form-error-banner mb-5">{error}</div>}
            <p className="text-slate-700">
              Delete this sent communication? This only removes the record; recipients who already got the message or
              email will still have it. This cannot be undone.
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
