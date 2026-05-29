/// Environment configuration.
///
/// Values are injected at build time via --dart-define:
///   flutter run \
///     --dart-define=SUPABASE_URL=https://xxx.supabase.co \
///     --dart-define=SUPABASE_ANON_KEY=xxx \
///     --dart-define=GOOGLE_MAPS_API_KEY=AIza...
///
/// The Google Maps key must ALSO be passed so Gradle can inject it into
/// AndroidManifest.xml (see android/app/build.gradle.kts). Passing the key
/// via --dart-define is the single source of truth for both layers.
abstract class Env {
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: '',
  );

  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );

  static const String googleMapsApiKey = String.fromEnvironment(
    'GOOGLE_MAPS_API_KEY',
    defaultValue: '',
  );
}
