abstract class AppConstants {
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
}
