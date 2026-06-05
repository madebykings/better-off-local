import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/member_impact.dart';
import '../domain/region_impact.dart';

class ImpactRemoteDataSource {
  const ImpactRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<MemberImpact> getMemberImpact(String consumerId) async {
    final rows = await _client.rpc(
      'get_member_impact',
      params: {'p_consumer_id': consumerId},
    );
    if (rows is List && rows.isNotEmpty) {
      return MemberImpact.fromMap(rows.first as Map<String, dynamic>);
    }
    return const MemberImpact(
      totalSavedPence: 0,
      offersRedeemed: 0,
      businessesSupported: 0,
      loyaltyCompletions: 0,
      referralsGenerated: 0,
      eventsAttended: 0,
      memberSince: null,
    );
  }

  Future<RegionImpact> getRegionImpact(String regionId) async {
    final rows = await _client.rpc(
      'get_region_impact',
      params: {'p_region_id': regionId},
    );
    if (rows is List && rows.isNotEmpty) {
      return RegionImpact.fromMap(rows.first as Map<String, dynamic>);
    }
    return const RegionImpact(
      totalSavingsPence: 0,
      totalRedemptions: 0,
      activeMembers: 0,
      businessesParticipating: 0,
      eventsHosted: 0,
      loyaltyCompletions: 0,
      referralsGenerated: 0,
    );
  }
}
