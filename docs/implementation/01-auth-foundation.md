# 01 – Auth Foundation

## Scope

This is the first implementation brief. It covers the complete authentication
foundation across all three apps. Nothing that requires a database schema beyond
Supabase Auth itself is in scope. Profile roles and retailer linking are deferred.

---

## Goals

- Working sign-in, sign-up, and password reset flows in the Flutter app
- Working sign-in and sign-out in both Next.js portals
- Session-based auth guards on all protected Next.js routes
- Admin role guard using `app_metadata.role` (set via Supabase dashboard or service key)
- Retailer auth guard that checks session only (retailer linking deferred to next brief)
- Router redirect logic in Flutter that correctly reacts to auth state changes
- Auth controller tests in Flutter

---

## Out of Scope

- Profile table creation or user metadata beyond auth
- Retailer user ↔ retailer linking (`retailer_users` table)
- Admin user management UI
- OAuth / social sign-in
- Email templates customisation
- Deep link / magic link handling

---

## Flutter

### Router Fix

The `appRouterProvider` must use `refreshListenable` to re-evaluate redirects
when the Supabase session changes. The redirect function must read
`sessionProvider` as an `AsyncValue` and use `.valueOrNull`.

### Screens

All three auth screens must be functional:

**SignInScreen**
- Email + password form with validation
- Loading state from `authControllerProvider`
- Error display via SnackBar from `ref.listen`
- Link to forgot-password (push)
- Link to sign-up (push)

**SignUpScreen**
- Email, password, confirm-password form
- Password minimum 8 characters
- Confirm password must match
- Error + loading same pattern as sign-in

**ForgotPasswordScreen**
- Email form
- On success: show confirmation state (inline, same screen)
- Link back to sign-in

### Auth Controller

Improve `AuthError` messages by parsing `AuthException` from Supabase into
user-friendly strings.

### Tests

`test/features/auth/auth_controller_test.dart`
- sign in success (mock repository returns normally)
- sign in failure (mock throws, state becomes AuthError)
- sign up success
- sign out
- password reset success

---

## Next.js Portals

### Server Actions

Each portal gets `lib/actions/auth.ts` with:
- `signIn(prevState, formData)` — returns `{ error }` or redirects
- `signOut()` — signs out and redirects to /sign-in
- `sendPasswordReset(prevState, formData)` — retailer portal only

### Form Components

Client components with `useActionState` (React 19):
- `components/auth/sign_in_form.tsx`
- `components/auth/forgot_password_form.tsx` (retailer portal only)

### Auth Pages

Both portals' sign-in pages updated to render the form component.

### Auth Guards

**`requireRetailerUser`**
- Auth check: `supabase.auth.getUser()` — redirect to /sign-in if no session
- Retailer linking check: deferred — returns `{ userId }` for now
- Will be extended when `retailer_users` schema lands

**`requireAdmin`**
- Auth check: `supabase.auth.getUser()` — redirect to /sign-in if no session
- Role check: `user.app_metadata?.role === 'admin'` — redirect to /sign-in if false
- No database query required

---

## Supabase

No migrations required for this brief. Supabase Auth is used as-is.
The only admin setup needed is setting `app_metadata: { role: 'admin' }` on
admin user accounts via the Supabase dashboard or service-role key.

---

## File Checklist

### Created
- `docs/implementation/01-auth-foundation.md` (this file)
- `apps/mobile/test/features/auth/auth_controller_test.dart`
- `apps/retailer-portal/lib/actions/auth.ts`
- `apps/retailer-portal/components/auth/sign_in_form.tsx`
- `apps/retailer-portal/components/auth/forgot_password_form.tsx`
- `apps/admin/lib/actions/auth.ts`
- `apps/admin/components/auth/sign_in_form.tsx`

### Modified
- `apps/mobile/lib/app/router/app_router.dart`
- `apps/mobile/lib/features/auth/presentation/auth_controller.dart`
- `apps/mobile/lib/features/auth/presentation/sign_in_screen.dart`
- `apps/mobile/lib/features/auth/presentation/sign_up_screen.dart`
- `apps/mobile/lib/features/auth/presentation/forgot_password_screen.dart`
- `apps/retailer-portal/app/(auth)/sign-in/page.tsx`
- `apps/retailer-portal/app/(auth)/forgot-password/page.tsx`
- `apps/retailer-portal/lib/auth/require_retailer_user.ts`
- `apps/retailer-portal/lib/auth/get_current_retailer_context.ts`
- `apps/admin/app/(auth)/sign-in/page.tsx`
- `apps/admin/lib/auth/require_admin.ts`
