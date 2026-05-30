abstract class AppConstants {
  // Launch region — used in community banner copy.
  // Update this constant to change the displayed region name without a DB lookup.
  // Future: fetch from platform_config Supabase table so admin can update remotely.
  static const String launchRegion = 'Clackmannanshire';

  // API
  static const Duration apiTimeout = Duration(seconds: 30);

  // Auth
  static const Duration sessionRefreshBuffer = Duration(minutes: 5);

  // Maps
  static const double defaultZoom = 13.0;
  static const double offerPinZoom = 15.0;

  // UI
  static const double bottomNavHeight = 64.0;
  static const double cardElevation = 0.0;

  // App metadata
  static const String appVersion = '1.0.0';

  // Legal URLs — update before store release
  static const String privacyPolicyUrl = 'https://betterofflocal.com/privacy';
  static const String termsUrl = 'https://betterofflocal.com/terms';
}
