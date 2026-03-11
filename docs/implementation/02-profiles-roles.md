# 02 – Profiles and Roles

## Scope

This brief covers the profile creation flow, role system, and role-based access
guards across all three apps. It builds directly on 01 – Auth Foundation.

Memberships are explicitly out of scope.

---

## Goals

- Auto-create a profile row when a user signs up via Supabase Auth trigger
- Expose profile data to Flutter via a typed `profileProvider`
- Gate authenticated Flutter routes behind a profile-completion check
- Implement the retailer user linking check in the retailer portal
- Extend admin portal guard to accept either `app_metadata.role` or `profiles.role`

---

## Out of Scope

- Consumer membership records or entitlement checks
- Retailer subscription state
- Admin UI for managing user roles
- Avatar upload
- OAuth / social sign-in profile merging

---

## Supabase

### Migration: `021_profile_on_signup.sql`

A `handle_new_user` trigger function runs after every insert on `auth.users`.
It inserts a `profiles` row with `role = 'consumer'` and `on conflict do nothing`
to tolerate re-runs safely.

The `profiles` table itself and its RLS policies were defined in earlier
migrations (`002_profiles.sql`, `018_rls_policies.sql`).

### Role assignment

- **Consumer**: created automatically on sign-up by the trigger above.
- **Retailer user**: set the `profiles.role` to `retailer_user` and create a
  `retailer_users` row linking them to a retailer. This is currently done via
  the Supabase dashboard or a service-role script; a self-service onboarding
  flow is deferred.
- **Admin**: set `app_metadata.role = 'admin'` via the Supabase dashboard or
  service key. Optionally also set `profiles.role = 'admin'`.

---

## Flutter

### Profile domain

`lib/features/profile/domain/profile.dart`

- `Profile` value class (Equatable)
- `UserRole` enum: `consumer`, `retailerUser`, `admin`
- `Profile.isComplete` — true when `fullName` is non-null and non-empty
- `Profile.fromMap` — deserialises Supabase row

### Data layer

- `ProfileRemoteDataSource` — `fetchProfile`, `updateProfile` (only non-null
  fields are written)
- `ProfileRepositoryImpl` — delegates to data source

### Providers

`lib/features/profile/providers/profile_providers.dart`

- `profileProvider` (`FutureProvider<Profile?>`) — watches `sessionProvider`
  and fetches the profile whenever the session changes. Returns null when
  unauthenticated.

### Profile controller

`lib/features/profile/presentation/profile_controller.dart`

- `ProfileController` (`StateNotifier<ProfileUpdateState>`)
- `completeProfile(fullName)` — writes `full_name`, then invalidates
  `profileProvider` so the router re-evaluates.
- `updateProfile(...)` — generic profile update used by account settings later.

### Complete profile screen

`lib/features/profile/presentation/complete_profile_screen.dart`

- Collects `full_name` (required, min 2 chars)
- On success: calls `context.go(RouteNames.home)` (router will pass through
  since profile is now complete)
- On error: SnackBar

### Router changes

`lib/app/router/route_names.dart`
- Added `completeProfile = '/complete-profile'`

`lib/app/router/app_router.dart`
- `_RouterNotifier` now also listens to `profileProvider` to trigger re-evaluation
  after profile fetch or update.
- Redirect logic: if authenticated and `profile.isComplete == false`, redirect to
  `/complete-profile`. While profile is loading (`valueOrNull == null`), no
  redirect fires to avoid a flash.

---

## Next.js Portals

### Retailer portal

**`lib/auth/require_retailer_user.ts`**

Replaced transitional stub with a real `retailer_users` query:
```
.from('retailer_users')
.select('retailer_id')
.eq('profile_id', user.id)
.eq('is_active', true)
.single()
```
Redirects to `/sign-in` if no active link is found.

**`lib/auth/get_current_retailer_context.ts`**

Replaced stub with a join query (`retailer_users → retailers(name)`) to
populate retailer name for layout header.

**`types/index.ts`**

Added `UserRole` type and `Profile` interface.

### Admin portal

**`lib/auth/require_admin.ts`**

Fast path: `app_metadata.role === 'admin'` (no DB query needed).
Fallback: queries `profiles` table for `role = 'admin'` and `is_active = true`.
This supports both setup approaches.

**`lib/auth/get_admin_context.ts`**

Fetches `full_name` from `profiles` table to support header display.
`AdminContext` now includes `fullName: string | null`.

**`types/index.ts`**

Added `UserRole` type and `Profile` interface.

---

## File Checklist

### Created
- `supabase/migrations/021_profile_on_signup.sql`
- `docs/implementation/02-profiles-roles.md` (this file)
- `apps/mobile/lib/features/profile/domain/profile.dart`
- `apps/mobile/lib/features/profile/domain/profile_repository.dart`
- `apps/mobile/lib/features/profile/data/profile_remote_data_source.dart`
- `apps/mobile/lib/features/profile/data/profile_repository_impl.dart`
- `apps/mobile/lib/features/profile/providers/profile_providers.dart`
- `apps/mobile/lib/features/profile/presentation/profile_controller.dart`
- `apps/mobile/lib/features/profile/presentation/complete_profile_screen.dart`

### Modified
- `apps/mobile/lib/app/router/route_names.dart` — added `completeProfile`
- `apps/mobile/lib/app/router/app_router.dart` — profile gate in redirect,
  `profileProvider` listener, `completeProfile` route
- `apps/retailer-portal/lib/auth/require_retailer_user.ts` — real DB check
- `apps/retailer-portal/lib/auth/get_current_retailer_context.ts` — real join
- `apps/retailer-portal/types/index.ts` — added `Profile`, `UserRole`
- `apps/admin/lib/auth/require_admin.ts` — dual-check (app_metadata + profiles)
- `apps/admin/lib/auth/get_admin_context.ts` — fetches `full_name`
- `apps/admin/types/index.ts` — added `Profile`, `UserRole`

---

## Assumptions

- The Supabase Auth trigger (`on_auth_user_created`) runs with `security definer`
  so it can insert into `profiles` even though users cannot insert their own rows
  via RLS (no insert policy is defined on profiles — inserts only happen via the
  trigger).
- Retailer user linking (assigning a user to a retailer) is done out-of-band
  for now. A self-service onboarding flow comes in a later brief.
- Admin users should have `app_metadata.role = 'admin'` set at account creation
  time via the Supabase dashboard.

## Risks and Follow-ups

- **No insert policy on profiles**: if the trigger ever fails (e.g. the trigger
  is dropped), new users will have no profile and will be stuck on
  `/complete-profile` without a target row to write to. Add an error state to
  `CompleteProfileScreen` that handles a missing profile row.
- **profileProvider re-fetches on every session change**: for the current scale
  this is fine. Add caching or a stream subscription for high-frequency
  auth toggles in future.
- **Retailer self-service onboarding**: `requireRetailerUser` now hard-redirects
  if there is no `retailer_users` row. A dedicated "pending approval" page is
  a cleaner UX than silent redirect to sign-in.
