import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sign in – Retailer Portal' };

export default function SignInPage() {
  return (
    <div className="bg-white rounded-xl shadow-sm p-8">
      <h1 className="text-2xl font-semibold mb-2">Sign in</h1>
      <p className="text-sm text-gray-500 mb-6">
        Access your Better Off Local retailer account
      </p>
      {/* TODO: implement sign-in form with server action */}
      <p className="text-center text-sm text-gray-400">TODO: Sign-in form</p>
    </div>
  );
}
