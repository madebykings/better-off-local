import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Check your email – Retailer Portal' };

export default function SignUpConfirmPage() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8 text-center">
      <div className="mb-4 flex justify-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      <h1 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h1>
      <p className="text-sm text-gray-500 mb-6">
        We&apos;ve sent you a confirmation link. Click it to activate your account and start your listing.
      </p>
      <p className="text-xs text-gray-400">
        Didn&apos;t receive it? Check your spam folder, or{' '}
        <Link href="/sign-up" className="text-green-700 hover:underline">
          try again
        </Link>.
      </p>
    </div>
  );
}
