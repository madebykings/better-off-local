import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';
import '../data/community_remote_data_source.dart';

final communityDataSourceProvider = Provider<CommunityRemoteDataSource>(
  (ref) => CommunityRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final communityHighlightsProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, regionId) async {
    final result = await ref
        .read(communityDataSourceProvider)
        .getCommunityHighlights(regionId);
    return result['highlights'] as List? ?? [];
  },
);

final communityActivityProvider = FutureProvider.family<List<dynamic>, String>(
  (ref, regionId) async {
    final result = await ref
        .read(communityDataSourceProvider)
        .getCommunityActivity(regionId);
    return result['activity'] as List? ?? [];
  },
);

final communitySavingsProvider =
    FutureProvider.family<Map<String, dynamic>, String>(
  (ref, regionId) =>
      ref.read(communityDataSourceProvider).getCommunitySavings(regionId),
);

final newRetailersProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
  (ref, regionId) =>
      ref.read(communityDataSourceProvider).getNewRetailers(regionId),
);

final businessStoriesProvider =
    FutureProvider.family<List<Map<String, dynamic>>, String>(
  (ref, regionId) =>
      ref.read(communityDataSourceProvider).getBusinessStories(regionId),
);
