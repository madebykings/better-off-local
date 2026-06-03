import 'profile.dart';

abstract interface class ProfileRepository {
  /// Fetches the profile for the given user ID.
  /// Returns null if no profile row exists yet.
  Future<Profile?> fetchProfile(String userId);

  /// Updates editable profile fields. Only non-null values are written.
  Future<void> updateProfile({
    required String userId,
    String? fullName,
    String? phone,
    String? avatarUrl,
    String? paypalEmail,
  });
}
