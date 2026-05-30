import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/region.dart';

class RegionRemoteDataSource {
  const RegionRemoteDataSource(this._client);
  final SupabaseClient _client;

  /// All active regions (for selection picker).
  Future<List<Region>> fetchActiveRegions() async {
    final rows = await _client
        .from('regions')
        .select('id, name, slug, member_threshold, is_active')
        .eq('is_active', true)
        .order('name');
    return rows.map((r) => Region.fromTableMap(r)).toList();
  }

  /// Full stats for a single region from region_public_stats view.
  Future<Region?> fetchRegionStats(String regionId) async {
    final row = await _client
        .from('region_public_stats')
        .select()
        .eq('id', regionId)
        .maybeSingle();
    return row != null ? Region.fromMap(row) : null;
  }

  /// Set the member's region in their profile.
  Future<void> setRegion({
    required String profileId,
    required String regionId,
  }) async {
    await _client
        .from('profiles')
        .update({'region_id': regionId})
        .eq('id', profileId);
  }
}
