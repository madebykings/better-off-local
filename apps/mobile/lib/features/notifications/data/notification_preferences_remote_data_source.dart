import 'package:supabase_flutter/supabase_flutter.dart';

class NotificationPreferencesRemoteDataSource {
  const NotificationPreferencesRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<Map<String, dynamic>?> fetchPreferences(String profileId) async {
    final rows = await _client
        .from('notification_preferences')
        .select('new_offers, loyalty_programmes, referral_campaigns')
        .eq('profile_id', profileId)
        .limit(1);
    return (rows as List).isEmpty ? null : (rows.first as Map<String, dynamic>);
  }

  /// Upserts a single column by name. Column must be a boolean field.
  Future<void> updatePreference({
    required String profileId,
    required String column,
    required bool value,
  }) async {
    await _client.from('notification_preferences').upsert(
      {
        'profile_id': profileId,
        column: value,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      },
      onConflict: 'profile_id',
    );
  }
}
