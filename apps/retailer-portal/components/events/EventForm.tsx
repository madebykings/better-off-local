'use client';

import { useState } from 'react';
import type { EventFields } from '@/lib/actions/events';
import { StickyActionBar, GuidanceCard } from '@better-off-local/ui';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_TYPES = [
  'Live Music',
  'Quiz Night',
  'Farmers Market',
  'Festival',
  'Networking',
  'Workshop',
  'Charity',
  'Kids Activity',
  'Seasonal',
  'Other',
] as const;

const SUMMARY_MAX = 160;

const TABS = [
  { id: 'basics', label: 'Basics' },
  { id: 'date-venue', label: 'Date & Venue' },
  { id: 'booking-images', label: 'Booking & Images' },
  { id: 'preview', label: 'Preview' },
  { id: 'review', label: 'Review' },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ---------------------------------------------------------------------------
// Field component
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
      {error && (
        <p className="mt-1.5 text-xs text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return [
    'w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900',
    'placeholder:text-gray-400 transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700',
    'disabled:bg-gray-50 disabled:text-gray-500',
    hasError ? 'border-red-300 bg-red-50/50' : 'border-gray-200 bg-white',
  ].join(' ');
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type Venue = {
  id: string;
  name: string;
  address_line1: string;
};

export type EventFormProps = {
  initialValues?: Partial<EventFields>;
  venues: Venue[];
  onSubmit: (fields: EventFields, action: 'draft' | 'submit') => void;
  isSubmitting: boolean;
  fieldErrors?: Partial<Record<keyof EventFields, string>>;
};

const EMPTY_EVENT: EventFields = {
  title: '',
  shortSummary: '',
  description: '',
  eventType: '',
  startDate: '',
  startTime: '',
  endDate: '',
  endTime: '',
  venueId: '',
  imageUrl: '',
  bookingUrl: '',
};

// ---------------------------------------------------------------------------
// EventForm
// ---------------------------------------------------------------------------

export function EventForm({
  initialValues,
  venues,
  onSubmit,
  isSubmitting,
  fieldErrors,
}: EventFormProps) {
  const [fields, setFields] = useState<EventFields>({
    ...EMPTY_EVENT,
    ...initialValues,
  });
  const [localErrors, setLocalErrors] = useState<Partial<Record<keyof EventFields, string>>>({});
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('basics');

  const errors: Partial<Record<keyof EventFields, string>> = {
    ...localErrors,
    ...fieldErrors,
  };

  function set(key: keyof EventFields) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) => {
      setFields((prev) => ({ ...prev, [key]: e.target.value }));
      if (localErrors[key]) setLocalErrors((prev) => ({ ...prev, [key]: undefined }));
      if (key === 'imageUrl') setImagePreviewError(false);
    };
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof EventFields, string>> = {};
    if (!fields.title.trim()) errs.title = 'Please enter a title.';
    if (!fields.startDate) errs.startDate = 'Please select a start date.';
    if (!fields.startTime) errs.startTime = 'Please select a start time.';
    if (fields.startDate && fields.startTime) {
      const d = new Date(`${fields.startDate}T${fields.startTime}`);
      if (isNaN(d.getTime())) {
        errs.startDate = 'Invalid start date or time.';
      } else if (d <= new Date()) {
        errs.startDate = 'Start date and time must be in the future.';
      }
    }
    if (!fields.eventType) errs.eventType = 'Please select an event type.';
    if (fields.endDate && fields.startDate && fields.endDate < fields.startDate) {
      errs.endDate = 'End date must be on or after the start date.';
    }
    setLocalErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleAction(action: 'draft' | 'submit') {
    if (action === 'submit' && !validate()) return;
    onSubmit(fields, action);
  }

  const summaryCount = fields.shortSummary.length;
  const showImagePreview =
    fields.imageUrl.trim() &&
    !imagePreviewError &&
    (fields.imageUrl.startsWith('http://') || fields.imageUrl.startsWith('https://'));

  const selectedVenue = venues.find((v) => v.id === fields.venueId);

  return (
    <div className="max-w-2xl">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-gray-200 scrollbar-none mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'shrink-0 px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === tab.id
                ? 'border-b-2 border-green-700 text-green-800 -mb-px'
                : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-300 -mb-px',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab panels — hidden class preserves React state across tab switches */}

      {/* Basics */}
      <div className={activeTab === 'basics' ? 'space-y-6' : 'hidden'}>
        <Field label="Title" required error={errors.title}>
          <input
            type="text"
            value={fields.title}
            onChange={set('title')}
            placeholder="e.g. Live Jazz Evening"
            maxLength={120}
            className={inputCls(!!errors.title)}
            disabled={isSubmitting}
          />
        </Field>

        <Field
          label="Short summary"
          hint="Shown in event cards"
          error={errors.shortSummary}
        >
          <div className="relative">
            <input
              type="text"
              value={fields.shortSummary}
              onChange={set('shortSummary')}
              placeholder="e.g. An evening of live jazz in the heart of Alloa"
              maxLength={SUMMARY_MAX}
              className={inputCls(!!errors.shortSummary)}
              disabled={isSubmitting}
            />
            <span
              className={[
                'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums',
                summaryCount > 140 ? 'text-amber-500' : 'text-gray-300',
              ].join(' ')}
            >
              {summaryCount}/{SUMMARY_MAX}
            </span>
          </div>
        </Field>

        <Field label="Description" error={errors.description}>
          <textarea
            value={fields.description}
            onChange={set('description')}
            placeholder="Tell members more about this event — what to expect, who it's for, any requirements."
            rows={4}
            className={[inputCls(!!errors.description), 'resize-none'].join(' ')}
            disabled={isSubmitting}
          />
        </Field>

        <Field label="Event type" required error={errors.eventType}>
          <select
            value={fields.eventType}
            onChange={set('eventType')}
            className={inputCls(!!errors.eventType) + ' cursor-pointer'}
            disabled={isSubmitting}
          >
            <option value="">Select event type…</option>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Date & Venue */}
      <div className={activeTab === 'date-venue' ? 'space-y-6' : 'hidden'}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date" required error={errors.startDate}>
            <input
              type="date"
              value={fields.startDate}
              onChange={set('startDate')}
              className={inputCls(!!errors.startDate)}
              disabled={isSubmitting}
            />
          </Field>
          <Field label="Start time" required error={errors.startTime}>
            <input
              type="time"
              value={fields.startTime}
              onChange={set('startTime')}
              className={inputCls(!!errors.startTime)}
              disabled={isSubmitting}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="End date" hint="Optional" error={errors.endDate}>
            <input
              type="date"
              value={fields.endDate}
              onChange={set('endDate')}
              min={fields.startDate || undefined}
              className={inputCls(!!errors.endDate)}
              disabled={isSubmitting}
            />
          </Field>
          <Field label="End time" hint="Optional">
            <input
              type="time"
              value={fields.endTime}
              onChange={set('endTime')}
              className={inputCls(false)}
              disabled={isSubmitting}
            />
          </Field>
        </div>

        <Field label="Venue" hint="Where the event is taking place">
          <select
            value={fields.venueId}
            onChange={set('venueId')}
            className={inputCls(false) + ' cursor-pointer'}
            disabled={isSubmitting}
          >
            <option value="">No specific venue</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
                {v.address_line1 ? ` — ${v.address_line1}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Booking & Images */}
      <div className={activeTab === 'booking-images' ? 'space-y-6' : 'hidden'}>
        <Field
          label="Image URL"
          hint="Paste a public image URL (e.g. from your storage bucket)"
          error={errors.imageUrl}
        >
          <input
            type="url"
            value={fields.imageUrl}
            onChange={set('imageUrl')}
            placeholder="https://…"
            className={inputCls(!!errors.imageUrl)}
            disabled={isSubmitting}
          />
          {showImagePreview && (
            <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fields.imageUrl}
                alt="Event image preview"
                className="w-full max-h-40 object-cover"
                onError={() => setImagePreviewError(true)}
              />
            </div>
          )}
        </Field>

        <Field
          label="Booking URL"
          hint="External link for tickets or sign-up (optional)"
          error={errors.bookingUrl}
        >
          <input
            type="url"
            value={fields.bookingUrl}
            onChange={set('bookingUrl')}
            placeholder="https://…"
            className={inputCls(!!errors.bookingUrl)}
            disabled={isSubmitting}
          />
        </Field>
      </div>

      {/* Preview */}
      <div className={activeTab === 'preview' ? '' : 'hidden'}>
        <p className="mb-4 text-sm text-gray-500">
          This is how your event will appear to members in the app.
        </p>
        <div className="max-w-sm rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {showImagePreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fields.imageUrl}
              alt="Event preview"
              className="w-full h-36 object-cover"
              onError={() => setImagePreviewError(true)}
            />
          ) : (
            <div className="w-full h-36 bg-gray-100 flex items-center justify-center text-3xl">
              📅
            </div>
          )}
          <div className="p-4">
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
              {fields.eventType || 'Event'}
            </span>
            <p className="font-semibold text-gray-900 mt-2">
              {fields.title || 'Event title'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {fields.shortSummary || 'Short summary appears here'}
            </p>
            {fields.startDate && (
              <p className="text-xs text-gray-400 mt-2">
                📅{' '}
                {new Date(fields.startDate).toLocaleDateString('en-GB', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
                {fields.startTime && ` at ${fields.startTime}`}
              </p>
            )}
            {selectedVenue && (
              <p className="text-xs text-gray-400 mt-1">
                📍 {selectedVenue.name}
                {selectedVenue.address_line1 ? `, ${selectedVenue.address_line1}` : ''}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Review */}
      <div className={activeTab === 'review' ? 'space-y-6' : 'hidden'}>
        <GuidanceCard
          icon="ℹ️"
          heading="Review process"
          body="Submitted events are reviewed by our team within 2 business days. Once approved, your event will be visible to members."
        />

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Ready to publish?</p>
          <p className="text-sm text-gray-500">
            Save as a draft to continue editing later, or submit for review when your event details are complete.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => handleAction('draft')}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700
                         hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Save as draft'}
            </button>
            <button
              type="button"
              onClick={() => handleAction('submit')}
              disabled={isSubmitting}
              className="rounded-lg bg-green-800 px-5 py-2.5 text-sm font-semibold text-white
                         hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting…' : 'Submit for review'}
            </button>
          </div>
        </div>
      </div>

      {/* Sticky action bar — visible on all tabs except Review */}
      <div className={activeTab === 'review' ? 'hidden' : ''}>
        <StickyActionBar>
          <button
            type="button"
            onClick={() => handleAction('draft')}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700
                       hover:bg-gray-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Save draft'}
          </button>
        </StickyActionBar>
      </div>
    </div>
  );
}
