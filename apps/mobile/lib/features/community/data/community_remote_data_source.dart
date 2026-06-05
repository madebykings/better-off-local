import 'package:supabase_flutter/supabase_flutter.dart';

class CommunityRemoteDataSource {
  const CommunityRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<Map<String, dynamic>> getCommunityHighlights(String regionId) async {
    final rows = await _client.rpc(
      'get_community_highlights',
      params: {'p_region_id': regionId},
    );
    return {'highlights': rows};
  }

  Future<Map<String, dynamic>> getCommunityActivity(String regionId) async {
    final rows = await _client.rpc(
      'get_community_activity',
      params: {'p_region_id': regionId, 'p_limit': 15},
    );
    return {'activity': rows};
  }

  Future<Map<String, dynamic>> getCommunitySavings(String regionId) async {
    final rows = await _client.rpc(
      'get_community_savings',
      params: {'p_region_id': regionId},
    );
    if (rows is List && rows.isNotEmpty) {
      return rows.first as Map<String, dynamic>;
    }
    return {};
  }

  Future<List<Map<String, dynamic>>> getNewRetailers(String regionId) async {
    final rows = await _client
        .from('retailers')
        .select('id, name, logo_url, created_at')
        .eq('region_id', regionId)
        .eq('visibility_status', 'visible')
        .order('created_at', ascending: false)
        .limit(10);
    return List<Map<String, dynamic>>.from(rows as List);
  }

  Future<List<Map<String, dynamic>>> getBusinessStories(String regionId) async {
    final rows = await _client
        .from('business_stories')
        .select(
          'id, title, content, image_url, created_at, retailers!inner(id, name, logo_url, retailer_locations!inner(region_id))',
        )
        .eq('retailers.retailer_locations.region_id', regionId)
        .eq('retailers.retailer_locations.is_primary', true)
        .or('expires_at.is.null,expires_at.gt.${DateTime.now().toIso8601String()}')
        .order('created_at', ascending: false)
        .limit(8);
    return List<Map<String, dynamic>>.from(rows as List);
  }

  Future<List<Map<String, dynamic>>> getFeaturedRetailers(
      String regionId) async {
    final rows = await _client
        .from('retailers')
        .select(
            'id, name, logo_url, category_names:retailers_categories(categories(name))')
        .eq('region_id', regionId)
        .eq('visibility_status', 'visible')
        .eq('is_featured', true)
        .limit(10);
    return List<Map<String, dynamic>>.from(rows as List);
  }
}
