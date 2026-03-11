abstract class AppConfig {
  static const String appName = 'Better Off Local';
  static const String appVersion = '1.0.0';

  // Geo
  static const double defaultLatitude = 51.5074;
  static const double defaultLongitude = -0.1278;
  static const double nearbyRadiusKm = 5.0;

  // Pagination
  static const int defaultPageSize = 20;

  // Cache
  static const Duration cacheTimeout = Duration(minutes: 5);
}
