import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';
import '../data/venue_referral_remote_data_source.dart';
import '../domain/venue_referral_status.dart';

final venueReferralDataSourceProvider =
    Provider<VenueReferralRemoteDataSource>(
  (ref) => VenueReferralRemoteDataSource(ref.watch(supabaseClientProvider)),
);

/// Status for a specific (offerId, profileId) pair — used in offer detail.
final venueReferralStatusProvider =
    FutureProvider.family<VenueReferralStatus, ({String offerId, String profileId, String offerTitle})>(
  (ref, args) => ref
      .watch(venueReferralDataSourceProvider)
      .fetchStatusForOffer(
        offerId: args.offerId,
        profileId: args.profileId,
        offerTitle: args.offerTitle,
      ),
);

/// All unlocked/redeemed rewards for the current member.
final myVenueReferralRewardsProvider =
    FutureProvider.family<List<VenueReferralReward>, String>(
  (ref, profileId) =>
      ref.watch(venueReferralDataSourceProvider).fetchMyRewards(profileId),
);
