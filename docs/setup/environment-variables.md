# Environment Variables Reference

Required environment variables across all platforms. Missing any of these will
cause features to silently fail or the platform to reject app store submissions.

---

## Flutter mobile app

Set via `.env` (loaded by `flutter_dotenv`) or as CI/CD build secrets.

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anon (public) key |
| `GOOGLE_MAPS_API_KEY` | **Yes — map screen** | Google Maps SDK key. Restrict to your app bundle ID in Google Cloud Console. Without this the map screen fails to render. |

### Google Maps API key — provisioning steps
1. Create a key in Google Cloud Console → APIs & Services → Credentials.
2. Restrict it to Android (package name + SHA-1) and iOS (bundle ID).
3. Enable "Maps SDK for Android" and "Maps SDK for iOS".
4. Add to `.env`: `GOOGLE_MAPS_API_KEY=AIza...`
5. For iOS: also add to `ios/Runner/AppDelegate.swift` via `GMSServices.provideAPIKey`.

---

## Retailer portal (Next.js)

Set in `.env.local` (local) or Vercel environment variables (production).

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (public) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (public) |
| `NEXT_PUBLIC_APP_URL` | Yes | Portal public URL, e.g. `https://portal.betterofflocal.co.uk` |
| `SUPABASE_URL` | Yes | Supabase project URL (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key — never expose to browser |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key for checkout + portal sessions |
| `STRIPE_EXTRA_VENUE_PRICE_ID` | Yes | Stripe price ID for venue add-on purchases |

---

## Admin portal (Next.js)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_URL` | Yes | Supabase project URL (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key |
| `RESEND_API_KEY` | **Yes — retailer emails** | Resend API key (`re_...`). Without this, retailer approval/rejection emails are silently skipped. Get one at resend.com. |
| `RESEND_FROM_EMAIL` | **Yes — retailer emails** | Verified sender address in your Resend account, e.g. `hello@betterofflocal.co.uk`. Domain must be verified with Resend. |

---

## Supabase edge functions

Set via `supabase secrets set` or the Supabase dashboard.

| Variable | Required | Description |
|---|---|---|
| `SUPABASE_URL` | Yes | Injected automatically by Supabase |
| `SUPABASE_ANON_KEY` | Yes | Injected automatically |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key for DB writes |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret (`whsec_...`) |
| `STRIPE_PRICE_ID_MONTHLY` | Yes | Stripe price ID for monthly consumer membership |
| `STRIPE_PRICE_ID_ANNUAL` | Yes | Stripe price ID for annual consumer membership |
| `STRIPE_RETAILER_ANNUAL_PRICE_ID` | Yes | Stripe price ID for retailer annual subscription |
| `APP_SCHEME` | No | Deep link scheme, default `betterofflocal` |
| `APP_UNIVERSAL_LINK_DOMAIN` | No | Universal link domain, e.g. `betterofflocal.co.uk` |
| `RETAILER_PORTAL_URL` | No | Retailer portal URL for redirect links |
| `RETAILER_GRACE_DAYS` | No | Grace period after subscription expires (default `0`) |

---

## iOS Universal Links (AASA) — required for App Store

For Stripe's post-payment redirect to return users into the app reliably on iOS,
the Apple App Site Association file must be hosted at:

```
https://<APP_UNIVERSAL_LINK_DOMAIN>/.well-known/apple-app-site-association
```

Content:
```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "<TEAM_ID>.<BUNDLE_ID>",
        "paths": ["*"]
      }
    ]
  }
}
```

Steps:
1. Enable Associated Domains in Xcode: `applinks:<APP_UNIVERSAL_LINK_DOMAIN>`.
2. Host the AASA file (no `.json` extension, `Content-Type: application/json`).
3. Configure the Stripe checkout `success_url` to use your universal link domain.

The equivalent for Android is Digital Asset Links:
```
https://<domain>/.well-known/assetlinks.json
```

---

## Legal pages — required for app store submission

Both Apple App Store and Google Play require working privacy policy and terms
links. These must be live at:

- `https://betterofflocal.co.uk/privacy`
- `https://betterofflocal.co.uk/terms`

These URLs are hardcoded in `apps/mobile/lib/core/constants/app_constants.dart`.
If the domain changes, update that file before submission.
