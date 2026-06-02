import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';
import '../data/region_remote_data_source.dart';
import '../domain/region.dart';

final regionDataSourceProvider = Provider<RegionRemoteDataSource>(
  (ref) => RegionRemoteDataSource(ref.watch(supabaseClientProvider)),
);

/// All active regions — used for the region selection picker.
final activeRegionsProvider = FutureProvider<List<Region>>((ref) async {
  return ref.watch(regionDataSourceProvider).fetchActiveRegions();
});

/// Stats for a specific region (from region_public_stats view).
final regionStatsProvider =
    FutureProvider.family<Region?, String>((ref, regionId) async {
  return ref.watch(regionDataSourceProvider).fetchRegionStats(regionId);
});

/// The current member's region_id — keyed by userId so it can be invalidated
/// after a region change without a full session reload.
final memberRegionIdProvider = FutureProvider.family<String?, String>(
  (ref, userId) async {
    final client = ref.watch(supabaseClientProvider);
    final row = await client
        .from('profiles')
        .select('region_id')
        .eq('id', userId)
        .maybeSingle();
    return row?['region_id'] as String?;
  },
);
