import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';
import '../data/impact_remote_data_source.dart';
import '../domain/member_impact.dart';
import '../domain/region_impact.dart';

final impactDataSourceProvider = Provider<ImpactRemoteDataSource>(
  (ref) => ImpactRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final memberImpactProvider = FutureProvider<MemberImpact>((ref) async {
  final userId = ref.watch(supabaseClientProvider).auth.currentUser?.id;
  if (userId == null) throw Exception('Not authenticated');
  return ref.read(impactDataSourceProvider).getMemberImpact(userId);
});

final regionImpactProvider = FutureProvider.family<RegionImpact, String>(
  (ref, regionId) =>
      ref.read(impactDataSourceProvider).getRegionImpact(regionId),
);
