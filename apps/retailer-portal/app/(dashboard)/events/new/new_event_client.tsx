'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createEvent,
  submitEventForReview,
  type EventFields,
  type CreateEventResult,
} from '@/lib/actions/events';
import { EventForm, type Venue } from '@/components/events/EventForm';
import { useState } from 'react';

interface Props {
  venues: Venue[];
}

export function NewEventClient({ venues }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof EventFields, string>>
  >({});

  function handleSubmit(fields: EventFields, action: 'draft' | 'submit') {
    setServerError(null);
    setFieldErrors({});

    startTransition(async () => {
      // Always create first (as draft).
      const result: CreateEventResult = await createEvent(fields);

      if ('eventId' in result) {
        if (action === 'submit') {
          // Submit for review immediately after creation.
          const reviewResult = await submitEventForReview(result.eventId);
          if (reviewResult.error) {
            // Created but failed to submit — go to the event page to retry.
            router.push(`/events/${result.eventId}`);
            return;
          }
        }
        router.push(`/events/${result.eventId}`);
        return;
      }

      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors as Partial<Record<keyof EventFields, string>>);
        return;
      }
      if (result.error) {
        setServerError(result.error);
      }
    });
  }

  return (
    <div>
      {serverError && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {serverError}
        </div>
      )}
      <EventForm
        venues={venues}
        onSubmit={handleSubmit}
        isSubmitting={isPending}
        fieldErrors={fieldErrors}
      />
    </div>
  );
}
