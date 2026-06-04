abstract class StorageKeys {
  static const String onboardingComplete = 'onboarding_complete';
  static const String lastKnownLatitude = 'last_known_lat';
  static const String lastKnownLongitude = 'last_known_lng';
  static const String notificationsEnabled = 'notifications_enabled';
  static const String preferredCategories = 'preferred_categories';

  /// Referral code captured from a deep link before sign-up.
  /// Written at app open when ?ref= is in the link, cleared after attribution.
  static const String pendingReferralCode = 'pending_referral_code';

  /// Venue referral share token captured from a /venue-referral?t=TOKEN deep link.
  /// Written on link open, cleared once attribute_venue_referral succeeds.
  static const String pendingVenueReferralToken = 'pending_venue_referral_token';
}
