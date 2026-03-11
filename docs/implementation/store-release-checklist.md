# Store Release Checklist

Configuration and steps required before submitting to the App Store and Google Play.

## Flutter Platform Setup

Run `flutter create --platforms=ios,android .` from `apps/mobile/` to generate the
native platform directories if they don't exist, then apply the config below.

---

## iOS (App Store)

### `ios/Runner/Info.plist` — required permission strings

```xml
<!-- Location — required for map discovery screen -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Better Off Local uses your location to show nearby offers and retailers.</string>

<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Better Off Local uses your location to show nearby offers and retailers.</string>

<!-- Camera — required if QR scanning is added in a future release -->
<!-- <key>NSCameraUsageDescription</key> -->
<!-- <string>Better Off Local uses the camera to scan retailer QR codes.</string> -->
```

### `ios/Runner.xcodeproj` — Xcode project settings

| Setting | Value |
|---|---|
| Bundle Identifier | `com.betterofflocal.app` |
| Display Name | `Better Off Local` |
| Version (CFBundleShortVersionString) | `1.0.0` |
| Build (CFBundleVersion) | `1` |
| Minimum iOS Deployment Target | `14.0` |
| Signing Team | _Set to your Apple Developer Team ID_ |

### App Store Connect

- Create app entry with Bundle ID `com.betterofflocal.app`
- Set category: **Lifestyle** or **Shopping**
- Upload screenshots (6.7", 6.1", 5.5", iPad 12.9")
- Write app description emphasising local community value
- Add Privacy Policy URL: `https://betterofflocal.com/privacy`
- Enable push notifications entitlement

---

## Android (Google Play)

### `android/app/src/main/AndroidManifest.xml` — required permissions

```xml
<!-- Location — map discovery screen -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Internet — all API calls -->
<uses-permission android:name="android.permission.INTERNET" />

<!-- Push notifications (Android 13+) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### `android/app/build.gradle` — app identifiers

```groovy
android {
    defaultConfig {
        applicationId "com.betterofflocal.app"
        minSdkVersion 21
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
    }
    signingConfigs {
        release {
            // Load from environment or keystore file — never commit keystore to git
            storeFile file(System.getenv("KEYSTORE_PATH") ?: "release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias System.getenv("KEY_ALIAS")
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### Google Play Console

- Create app with package `com.betterofflocal.app`
- Set category: **Lifestyle**
- Upload signed AAB (`flutter build appbundle --release --dart-define=...`)
- Add privacy policy URL: `https://betterofflocal.com/privacy`
- Complete data safety form (location data collected, not shared with third parties)
- Enable Firebase Cloud Messaging for push notifications

---

## Build Commands

### Development
```bash
flutter run \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key \
  --dart-define=GOOGLE_MAPS_API_KEY=your-maps-key
```

### iOS Release
```bash
flutter build ipa \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key \
  --dart-define=GOOGLE_MAPS_API_KEY=your-maps-key
```

### Android Release
```bash
flutter build appbundle \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key \
  --dart-define=GOOGLE_MAPS_API_KEY=your-maps-key
```

---

## Pre-release Checklist

- [ ] Privacy Policy live at `https://betterofflocal.com/privacy`
- [ ] Terms & Conditions live at `https://betterofflocal.com/terms`
- [ ] App version set to `1.0.0+1` in `pubspec.yaml`
- [ ] All `--dart-define` values set in CI/CD secrets
- [ ] Push notification certificates/keys configured in Supabase dashboard
- [ ] Google Maps API key restricted to app bundle ID in GCP console
- [ ] Supabase anon key has correct RLS policies (no service role key in app)
- [ ] Deep link / URL scheme registered for Stripe redirect
- [ ] Crash reporting configured (Sentry or Firebase Crashlytics)
- [ ] App Store / Play Store listing copy reviewed
