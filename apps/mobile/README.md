# Better Off Local – Mobile App

Flutter consumer app for iOS and Android.

## Setup

### Prerequisites
- Flutter SDK >= 3.19.0
- Dart SDK >= 3.3.0
- Xcode (for iOS)
- Android Studio (for Android)

### Environment
Run the app with Supabase credentials injected:

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://your-project.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key
```

Or create a launch configuration in `.vscode/launch.json` or use `--dart-define-from-file`.

### Install dependencies

```bash
flutter pub get
```

### Run

```bash
flutter run
```

### Test

```bash
# Unit + widget tests
flutter test

# Integration tests (needs device or emulator)
flutter test integration_test/
```

## Architecture

See `docs/architecture/flutter-app-structure.md` for full documentation.

### Quick reference
- State: Riverpod (`flutter_riverpod`)
- Navigation: `go_router`
- Backend: Supabase (`supabase_flutter`)
- Structure: feature-first under `lib/features/`

### Feature modules
- `auth` — sign in, sign up, password reset
- `onboarding` — splash, welcome
- `memberships` — paywall, membership card
- `home` — landing, nearby, featured, categories
- `offers` — browse, detail
- `retailers` — retailer detail
- `map` — map exploration
- `favourites` — saved offers/retailers
- `redemptions` — token flow, history
- `notifications` — notification list
- `account` — profile, settings, savings
- `shell` — bottom navigation
