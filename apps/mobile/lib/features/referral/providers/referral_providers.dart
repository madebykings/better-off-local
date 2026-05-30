import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';
import '../data/referral_remote_data_source.dart';
import '../domain/referral.dart';

final referralDataSourceProvider = Provider<ReferralRemoteDataSource>(
  (ref) => ReferralRemoteDataSource(ref.watch(supabaseClientProvider)),
);

/// Fetches or generates the member's referral code and stats.
/// Keyed by the member's profile_id so it refreshes on sign-in.
final referralStatsProvider = FutureProvider.family<ReferralStats?, String>(
  (ref, profileId) async {
    final ds = ref.watch(referralDataSourceProvider);

    // Try to fetch existing stats first
    var stats = await ds.fetchStats(profileId);
    if (stats != null) return stats;

    // No code yet — generate one (lazy creation)
    await ds.generateCode();
    return ds.fetchStats(profileId);
  },
);
