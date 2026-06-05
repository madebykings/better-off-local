'use client';

import { useState } from 'react';
import Link from 'next/link';
import { StickyActionBar } from '@better-off-local/ui';

const TITLE_MAX = 100;
const CONTENT_MAX = 500;

// ---------------------------------------------------------------------------
// Field component
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1.5 text-xs text-gray-400">{hint}</p>}
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

export type StoryFormProps = {
  action: (formData: FormData) => Promise<void>;
};

// ---------------------------------------------------------------------------
// StoryForm
// ---------------------------------------------------------------------------

export function StoryForm({ action }: StoryFormProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [titleError, setTitleError] = useState('');
  const [contentError, setContentError] = useState('');
  const [pending, setPending] = useState(false);

  function validate(): boolean {
    let valid = true;
    if (!title.trim()) {
      setTitleError('Please enter a title.');
      valid = false;
    } else {
      setTitleError('');
    }
    if (!content.trim()) {
      setContentError('Please enter some content.');
      valid = false;
    } else {
      setContentError('');
    }
    return valid;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!validate()) return;
    setPending(true);
    const formData = new FormData(e.currentTarget);
    await action(formData);
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <div className="space-y-6">
        {/* Title */}
        <Field label="Title" required>
          <div className="relative">
            <input
              type="text"
              name="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (titleError) setTitleError('');
              }}
              placeholder="e.g. New summer menu now available"
              maxLength={TITLE_MAX}
              className={inputCls(!!titleError)}
              disabled={pending}
            />
            <span
              className={[
                'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs tabular-nums',
                title.length > 85 ? 'text-amber-500' : 'text-gray-300',
              ].join(' ')}
            >
              {title.length}/{TITLE_MAX}
            </span>
          </div>
          {titleError && (
            <p className="mt-1.5 text-xs text-red-500" role="alert">
              {titleError}
            </p>
          )}
        </Field>

        {/* Content */}
        <Field label="Content" required hint="Share what's happening at your business.">
          <div className="relative">
            <textarea
              name="content"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (contentError) setContentError('');
              }}
              placeholder="Tell your local community about this update…"
              rows={5}
              maxLength={CONTENT_MAX}
              className={[inputCls(!!contentError), 'resize-none'].join(' ')}
              disabled={pending}
            />
            <span
              className={[
                'pointer-events-none absolute right-3 bottom-3 text-xs tabular-nums',
                content.length > 450 ? 'text-amber-500' : 'text-gray-300',
              ].join(' ')}
            >
              {content.length}/{CONTENT_MAX}
            </span>
          </div>
          {contentError && (
            <p className="mt-1.5 text-xs text-red-500" role="alert">
              {contentError}
            </p>
          )}
        </Field>

        {/* Expiry */}
        <Field
          label="Expiry date"
          hint="Leave blank to show this story indefinitely."
        >
          <input
            type="date"
            name="expires_at"
            className={inputCls(false)}
            disabled={pending}
          />
        </Field>

        {/* Notify followers */}
        <div className="flex items-start gap-3">
          <input
            id="notify_followers"
            type="checkbox"
            name="notify_followers"
            value="on"
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-green-700 focus:ring-green-700/30 cursor-pointer"
            disabled={pending}
          />
          <div>
            <label
              htmlFor="notify_followers"
              className="text-sm font-medium text-gray-700 cursor-pointer"
            >
              Notify followers
            </label>
            <p className="mt-0.5 text-xs text-gray-400">
              Send a notification to members who follow your business.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky action bar */}
      <StickyActionBar>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-green-800 px-5 py-2 text-sm font-semibold text-white
                     hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Posting…' : 'Post story'}
        </button>
        <Link
          href="/stories"
          className="rounded-lg border border-gray-200 px-5 py-2 text-sm font-medium text-gray-700
                     hover:bg-gray-50 transition-colors"
        >
          Cancel
        </Link>
      </StickyActionBar>
    </form>
  );
}
