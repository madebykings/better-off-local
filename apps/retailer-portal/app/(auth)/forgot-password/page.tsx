import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/forgot_password_form';

export const metadata: Metadata = { title: 'Reset password – Retailer Portal' };

export default function ForgotPasswordPage() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Reset your password</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your email address and we&apos;ll send you a reset link.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
