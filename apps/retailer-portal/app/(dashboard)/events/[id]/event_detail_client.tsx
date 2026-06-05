'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateEvent,
  submitEventForReview,
  archiveEvent,
  type EventFields,
} from '@/lib/actions/events';
import { EventForm, type Venue } from '@/components/events/EventForm';

interface Props {
  eventId: string;
  initialValues: EventFields;
  status: string;
  reviewNotes: string | null;
  venues: Venue[];
}

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  live:     { label: 'Live',     classes: 'bg-green-100 text-green-800 border-green-200' },
  draft:    { label: 'Draft',    classes: 'bg-gray-100 text-gray-700 border-gray-200' },
  pending:  { label: 'Pending review', classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  paused:   { label: 'Paused',   classes: 'bg-orange-100 text-orange-800 border-orange-200' },
  rejected: { label: 'Rejected', classes: 'bg-red-100 text-red-800 border-red-200' },
  archived: { label: 'Archived', classes: 'bg-gray-100 text-gray-500 border-gray-200' },
};

export function EventDetailClient({
  eventId,
  initialValues,
  status,
  reviewNotes,
  venues,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof EventFields, string>>
  >({});

  const canEdit = status === 'draft' || status === 'rejected' || status === 'paused';
  const canSubmit = status === 'draft' || status === 'rejected';
  const badge = STATUS_LABELS[status] ?? {
    label: status,
    classes: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  function handleSubmit(fields: EventFields, action: 'draft' | 'submit') {
    setServerError(null);
    setFieldErrors({});
    setSaved(false);

    startTransition(async () => {
      // Always save changes first.
      const updateResult = await updateEvent(eventId, fields);

      if (updateResult.fieldErrors) {
        setFieldErrors(updateResult.fieldErrors as Partial<Record<keyof EventFields, string>>);
        return;
      }
      if (updateResult.error) {
        setServerError(updateResult.error);
        return;
      }

      if (action === 'submit' && canSubmit) {
        const reviewResult = await submitEventForReview(eventId);
        if (reviewResult.error) {
          setServerError(reviewResult.error);
          return;
        }
        router.refresh();
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  async function handleArchive() {
    if (!confirm('Archive this event? It will no longer be visible to members.')) return;
    startTransition(async () => {
      const result = await archiveEvent(eventId);
      if (result?.error) {
        setServerError(result.error);
      }
      // archiveEvent redirects to /events on success.
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Status card */}
      <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex-1">
          <span className="text-sm text-gray-500">Status: </span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ml-1 ${badge.classes}`}
          >
            {badge.label}
          </span>
        </div>
        {/* Archive button */}
        {status !== 'archived' && (
          <button
            onClick={handleArchive}
            disabled={isPending}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
          >
            Archive
          </button>
        )}
      </div>

      {/* Review notes (shown when rejected) */}
      {status === 'rejected' && reviewNotes && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800 mb-1">Rejection notes</p>
          <p className="text-sm text-red-700">{reviewNotes}</p>
          <p className="text-xs text-red-500 mt-2">
            Update your event and submit again.
          </p>
        </div>
      )}

      {/* Non-editable notice for pending / live */}
      {(status === 'pending' || status === 'live') && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          {status === 'pending'
            ? 'This event is under review and cannot be edited until approved or rejected.'
            : 'This event is live. Archive it to remove it from the platform.'}
        </div>
      )}

      {/* Server error */}
      {serverError && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}

      {/* Saved confirmation */}
      {saved && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
        >
          Changes saved.
        </div>
      )}

      {/* Read-only view for pending/live */}
      {!canEdit ? (
        <ReadOnlyView values={initialValues} venues={venues} />
      ) : (
        <EventForm
          initialValues={initialValues}
          venues={venues}
          onSubmit={handleSubmit}
          isSubmitting={isPending}
          fieldErrors={fieldErrors}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Read-only view for pending / live events
// ---------------------------------------------------------------------------

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-3 gap-4 py-3 border-b border-gray-100 last:border-0">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="col-span-2 text-sm text-gray-800 break-words">{value}</dd>
    </div>
  );
}

function ReadOnlyView({
  values,
  venues,
}: {
  values: EventFields;
  venues: Venue[];
}) {
  const venue = venues.find((v) => v.id === values.venueId);
  return (
    <dl className="rounded-lg border border-gray-200 bg-white px-4 divide-y divide-gray-100">
      <ReadOnlyRow label="Title" value={values.title} />
      <ReadOnlyRow label="Short summary" value={values.shortSummary} />
      <ReadOnlyRow label="Description" value={values.description} />
      <ReadOnlyRow label="Event type" value={values.eventType} />
      <ReadOnlyRow
        label="Start"
        value={
          values.startDate
            ? `${values.startDate} at ${values.startTime || '—'}`
            : '—'
        }
      />
      <ReadOnlyRow
        label="End"
        value={
          values.endDate
            ? `${values.endDate}${values.endTime ? ` at ${values.endTime}` : ''}`
            : '—'
        }
      />
      <ReadOnlyRow
        label="Venue"
        value={venue ? `${venue.name}${venue.address_line1 ? ` — ${venue.address_line1}` : ''}` : '—'}
      />
      <ReadOnlyRow label="Image URL" value={values.imageUrl} />
      <ReadOnlyRow label="Booking URL" value={values.bookingUrl} />
    </dl>
  );
}
