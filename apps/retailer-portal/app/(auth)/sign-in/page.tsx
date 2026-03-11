import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/sign_in_form';

export const metadata: Metadata = { title: 'Sign in – Retailer Portal' };

export default function SignInPage() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Sign in</h1>
        <p className="mt-1 text-sm text-gray-500">
          Access your Better Off Local retailer account
        </p>
      </div>
      <SignInForm />
    </div>
  );
}
