# Better Off Local — Firebase Setup

Firebase project: **better-off-local-e302e**
Console: https://console.firebase.google.com/u/0/project/better-off-local-e302e/overview

---

## Current Status

| Component | Status | Notes |
|-----------|--------|-------|
| Firebase project | ✅ Exists | better-off-local-e302e |
| Android app registered | ⏳ Pending | Needs google-services.json download |
| iOS app registered | ⏳ Pending | Can wait — iOS push requires Apple Developer account |
| Crashlytics | ✅ Wired | Disabled in debug, enabled in release |
| Firebase Analytics | ✅ Wired | 8 key events tracked |
| Push notifications | ✅ Wired | Requires google-services.json + APNs key |
| No-op fallback | ✅ Active | App works without Firebase config files |

---

## Android Setup (Priority — Required for Dev Builds)

### Android app identifiers

| Setting | Value |
|---------|-------|
| Package name | `uk.co.betterofflocal.app` |
| Config file path | `apps/mobile/android/app/google-services.json` |
| Gradle plugin | `com.google.gms.google-services 4.4.2` |
| Crashlytics plugin | `com.google.firebase.crashlytics 3.0.3` |

### Step-by-step: add Android app in Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/u/0/project/better-off-local-e302e/overview)
2. Click **Add app** → **Android**
3. Enter package name: `uk.co.betterofflocal.app`
4. App nickname: `Better Off Local Android` (optional)
5. **Skip** the SHA-1 field for now (needed later for release, not for dev)
6. Click **Register app**
7. Download `google-services.json`
8. Place at: `apps/mobile/android/app/google-services.json`
   - This file is gitignored — do not commit it
9. Skip the Gradle setup steps (already done in the codebase)
10. Rebuild: `flutter clean && flutter pub get && flutter run`

### Verify it worked

In the app, go to **Settings → Developer → Firebase Diagnostics** (visible in debug builds).

All checks should show green:
- Firebase initialized ✓
- FCM token (token string) ✓
- Push token saved to Supabase ✓ (requires signing in first)
- Firebase Analytics (instance ID) ✓
- Crashlytics collection: disabled in debug mode — this is expected

---

## iOS Setup (Can Wait)

iOS push notifications require an active Apple Developer account and APNs key.
Do not start this until App Store submission is in scope.

When ready, the steps are:

1. Register App ID `uk.co.betterofflocal.app` in [Apple Developer portal](https://developer.apple.com)
   - Enable: **Push Notifications**, **Associated Domains**
2. Create APNs Auth Key (`.p8`) — Key Services → Apple Push Notifications service
   - Note the Key ID and Team ID
3. In Firebase Console → Project Settings → Cloud Messaging → **Apple app configuration**
   - Upload the `.p8` key file, enter Key ID and Team ID
4. In Firebase Console → Add app → **Apple (iOS)**
   - Bundle ID: `uk.co.betterofflocal.app`
   - Download `GoogleService-Info.plist`
   - Place at: `apps/mobile/ios/Runner/GoogleService-Info.plist`
   - In Xcode: drag into Runner target → Build Phases → Copy Bundle Resources
5. Run `cd apps/mobile/ios && pod install`
6. In Xcode → Signing & Capabilities → add **Push Notifications**
7. Change `aps-environment` in `ios/Runner/Runner.entitlements` from `development` to `production` before App Store builds

---

## What the No-Op Fallback Covers

If `google-services.json` is absent (e.g. CI environments, new developer setup), the app:

- Starts normally — no crash, no hang
- Push notifications are disabled (no-op service)
- Firebase Analytics is disabled (no-op service)
- Crashlytics is disabled (no-op service)
- All other features (Supabase, maps, Stripe, deep links) work as normal

This is governed by the `try/catch` with 10-second timeout in `lib/app/bootstrap/bootstrap.dart`.

---

## Analytics Events Tracked

| Event | Trigger | GA4 Standard? |
|-------|---------|--------------|
| `purchase` | Membership confirmed active (activation screen) | ✅ Yes |
| `membership_renewed` | Stripe webhook (server-side) — not yet wired client-side | ❌ No |
| `offer_viewed` | Offer detail screen — **not yet wired** | ❌ No |
| `offer_redeemed` | After server confirms redemption — **not yet wired** | ❌ No |
| `loyalty_stamp_earned` | When retailer scans loyalty QR code | ❌ No |
| `loyalty_card_completed` | When loyalty card is claimed | ❌ No |
| `share` | Referral link share sheet opened | ✅ Yes (`logShare`) |
| `referral_reward_unlocked` | Not yet wired — needs referral reward flow | ❌ No |
| `event_viewed` | Event detail screen — **not yet wired** | ❌ No |
| `event_reminder_enabled` | Not yet wired — needs map event sheet update | ❌ No |
| `retailer_followed` | On successful follow toggle | ❌ No |
| `story_viewed` | Not yet wired — needs community screen update | ❌ No |

---

## Android App Links (assetlinks.json)

Required for verified HTTPS deep links (`https://betterofflocal.com/...`).

The app already handles the routing — you just need the server-side file.

Deploy to: `https://betterofflocal.com/.well-known/assetlinks.json`

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "uk.co.betterofflocal.app",
    "sha256_cert_fingerprints": ["YOUR_RELEASE_SHA256_HERE"]
  }
}]
```

Get the SHA-256: `keytool -list -v -keystore your-release.keystore -alias your-alias`

**Can wait until release signing is configured.**

---

## iOS Universal Links (apple-app-site-association)

Required for verified HTTPS deep links on iOS.

`ios/Runner/Runner.entitlements` already contains `applinks:betterofflocal.com`.

Deploy to: `https://betterofflocal.com/.well-known/apple-app-site-association`

```json
{
  "applinks": {
    "apps": [],
    "details": [{
      "appIDs": ["TEAM_ID.uk.co.betterofflocal.app"],
      "components": [
        { "/": "/join*" },
        { "/": "/subscription-success*" },
        { "/": "/venue-referral*" }
      ]
    }]
  }
}
```

Replace `TEAM_ID` with your Apple Team ID from the Developer portal.

**Can wait until iOS development is in scope.**

---

## Release Signing (Android)

Currently using debug keys for all builds. Must be fixed before Play Store upload.

```bash
# 1. Generate keystore (do once, store securely)
keytool -genkeypair -v \
  -keystore better-off-local-release.jks \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -alias bol-release

# 2. Create apps/mobile/android/key.properties (gitignored)
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=bol-release
storeFile=/absolute/path/to/better-off-local-release.jks

# 3. Update build.gradle.kts to load key.properties for release signing
# (See: https://developer.android.com/studio/publish/app-signing)
```

**Can wait until Google Play submission.**

---

## Google Maps API Key

| Platform | Where to set | Current value |
|----------|-------------|---------------|
| Android | `apps/mobile/android/local.properties` | Not set (map blank) |
| iOS | `apps/mobile/ios/Runner/Info.plist` key `GMSApiKey` | Placeholder |

Steps:
1. Go to [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create an API key, restrict to:
   - Android: package `uk.co.betterofflocal.app` + SHA-1 fingerprints
   - iOS: bundle ID `uk.co.betterofflocal.app`
3. Enable: Maps SDK for Android, Maps SDK for iOS
4. Android: add `GOOGLE_MAPS_API_KEY=AIza...` to `apps/mobile/android/local.properties`
5. iOS: replace `YOUR_GOOGLE_MAPS_API_KEY` in `Info.plist`

---

## Files That Must Not Be Committed

These are gitignored. Never commit them.

| File | Contains |
|------|---------|
| `apps/mobile/android/app/google-services.json` | Firebase Android config + API keys |
| `apps/mobile/ios/Runner/GoogleService-Info.plist` | Firebase iOS config + API keys |
| `apps/mobile/android/local.properties` | Google Maps API key + SDK paths |
| `apps/mobile/android/key.properties` | Release keystore credentials |

All four are covered by `.gitignore` files in the repository.
