import 'package:supabase_flutter/supabase_flutter.dart';

class RetailerFollowsRemoteDataSource {
  const RetailerFollowsRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<List<String>> fetchFollowedRetailerIds(String profileId) async {
    final rows = await _client
        .from('retailer_follows')
        .select('retailer_id')
        .eq('profile_id', profileId);
    return (rows as List)
        .map((r) => r['retailer_id'] as String)
        .toList();
  }

  Future<List<Map<String, dynamic>>> fetchFollowedRetailers(
      String profileId) async {
    return await _client
        .from('retailer_follows')
        .select('retailer_id, created_at, retailers(id, name, logo_url, short_description)')
        .eq('profile_id', profileId)
        .order('created_at', ascending: false);
  }

  Future<void> followRetailer(
      {required String profileId, required String retailerId}) async {
    await _client.from('retailer_follows').insert({
      'profile_id': profileId,
      'retailer_id': retailerId,
    });
  }

  Future<void> unfollowRetailer(
      {required String profileId, required String retailerId}) async {
    await _client
        .from('retailer_follows')
        .delete()
        .eq('profile_id', profileId)
        .eq('retailer_id', retailerId);
  }
}
