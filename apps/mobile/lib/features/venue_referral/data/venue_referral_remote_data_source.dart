import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/venue_referral_status.dart';

class VenueReferralRemoteDataSource {
  const VenueReferralRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<VenueReferralStatus> fetchStatusForOffer({
    required String offerId,
    required String profileId,
    required String offerTitle,
  }) async {
    final rows = await _client.rpc('get_venue_referral_status', params: {
      'p_offer_id':   offerId,
      'p_profile_id': profileId,
    });

    final data = (rows as List).isNotEmpty
        ? (rows.first as Map<String, dynamic>)
        : <String, dynamic>{};

    final token = data['share_token'] as String? ?? '';
    final shareUrl = token.isNotEmpty
        ? 'https://betterofflocal.com/venue-referral?t=$token'
        : '';

    return VenueReferralStatus(
      offerId: offerId,
      offerTitle: offerTitle,
      shareToken: token,
      shareUrl: shareUrl,
      invitedCount: (data['invited_count'] as num?)?.toInt() ?? 0,
      unlockedCount: (data['unlocked_count'] as num?)?.toInt() ?? 0,
      redeemedCount: (data['redeemed_count'] as num?)?.toInt() ?? 0,
    );
  }

  Future<List<VenueReferralReward>> fetchMyRewards(String profileId) async {
    final rows = await _client
        .from('venue_referral_rewards')
        .select('id, offer_id, status, unlocked_at, redeemed_at, offer:offers(title)')
        .eq('referrer_profile_id', profileId)
        .inFilter('status', ['unlocked', 'redeemed'])
        .order('unlocked_at', ascending: false);

    return (rows as List)
        .cast<Map<String, dynamic>>()
        .map(VenueReferralReward.fromMap)
        .toList();
  }
}
