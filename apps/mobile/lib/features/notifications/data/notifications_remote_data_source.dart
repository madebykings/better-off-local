import 'package:supabase_flutter/supabase_flutter.dart';

class NotificationsRemoteDataSource {
  const NotificationsRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<List<Map<String, dynamic>>> fetchNotifications(String profileId) async {
    return await _client
        .from('notifications')
        .select('id, type, title, body, data_json, read_at, created_at')
        .eq('profile_id', profileId)
        .order('created_at', ascending: false)
        .limit(50);
  }

  Future<void> markRead(String notificationId) async {
    await _client
        .from('notifications')
        .update({'read_at': DateTime.now().toUtc().toIso8601String()})
        .eq('id', notificationId)
        .isFilter('read_at', null);
  }

  Future<void> markAllRead(String profileId) async {
    await _client
        .from('notifications')
        .update({'read_at': DateTime.now().toUtc().toIso8601String()})
        .eq('profile_id', profileId)
        .isFilter('read_at', null);
  }

  Future<void> upsertPushToken({
    required String profileId,
    required String token,
    required String platform,
  }) async {
    await _client.from('push_tokens').upsert({
      'profile_id': profileId,
      'token': token,
      'platform': platform,
      'updated_at': DateTime.now().toUtc().toIso8601String(),
    }, onConflict: 'profile_id,token');
  }
}
