import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Reset password – Retailer Portal' };

export default function ForgotPasswordPage() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <h1 className="text-2xl font-semibold mb-2">Reset your password</h1>
      <p className="text-sm text-gray-500 mb-6">
        Enter your email address and we'll send you a reset link.
      </p>
      {/* TODO: implement password reset form */}
      <p className="text-center text-sm text-gray-400">TODO: Reset form</p>
    </div>
  );
}
