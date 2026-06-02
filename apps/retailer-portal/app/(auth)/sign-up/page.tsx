import type { Metadata } from 'next';
import Link from 'next/link';
import { SignUpForm } from '@/components/auth/sign_up_form';

export const metadata: Metadata = { title: 'Create account – Retailer Portal' };

export default function SignUpPage() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500">
          Join Better Off Local as a retailer. Free to get started.
        </p>
      </div>
      <SignUpForm />
      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-green-700 hover:text-green-800 font-medium">
          Sign in
        </Link>
      </p>
    </div>
  );
}
