'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitOnboarding } from '@/lib/actions/submit_onboarding';

export function SubmitButton({ blockingErrors }: { blockingErrors: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  // If the checklist already shows blocking errors, display those immediately.
  // Server errors are shown only after an actual submit attempt.
  const displayErrors = blockingErrors.length > 0 ? blockingErrors : serverErrors;
  const isBlocked = blockingErrors.length > 0;

  function handleSubmit() {
    setServerErrors([]);
    startTransition(async () => {
      const result = await submitOnboarding();

      if (!result) {
        router.push('/onboarding/submitted');
        return;
      }

      if (result.errors) {
        setServerErrors(result.errors);
        return;
      }

      if (result.error) {
        setServerErrors([result.error]);
      }
    });
  }

  return (
    <div className="space-y-3">
      {displayErrors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold text-red-700">
            Please complete the following before submitting:
          </p>
          <ul className="space-y-1">
            {displayErrors.map((e, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-red-600">
                <span className="mt-0.5 shrink-0 select-none">–</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || isBlocked}
        className="w-full rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white
                   transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? 'Submitting…' : 'Submit for review'}
      </button>
    </div>
  );
}
