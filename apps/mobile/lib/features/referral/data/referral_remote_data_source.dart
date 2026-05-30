import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/referral.dart';

class ReferralRemoteDataSource {
  const ReferralRemoteDataSource(this._client);
  final SupabaseClient _client;

  /// Calls the generate-referral-code edge function.
  /// Returns { code, referral_url }.
  Future<Map<String, String>> generateCode() async {
    final res = await _client.functions.invoke(
      'generate-referral-code',
      method: HttpMethod.post,
    );
    final data = res.data as Map<String, dynamic>;
    return {
      'code': data['code'] as String,
      'referral_url': data['referral_url'] as String,
    };
  }

  /// Reads the member's referral stats from the referral_stats view.
  Future<ReferralStats?> fetchStats(String profileId) async {
    final codeResult = await _client
        .from('referral_codes')
        .select('code')
        .eq('profile_id', profileId)
        .maybeSingle();

    if (codeResult == null) return null;

    final code = codeResult['code'] as String;

    final statsResult = await _client
        .from('referral_stats')
        .select()
        .eq('profile_id', profileId)
        .maybeSingle();

    // Build referral URL (same logic as edge function)
    final referralUrl = 'https://betterofflocal.com/join?ref=$code';

    if (statsResult == null) {
      return ReferralStats(
        code: code,
        referralUrl: referralUrl,
        invitedCount: 0,
        convertedCount: 0,
        pendingRewards: 0,
        confirmedRewards: 0,
        totalRewardPence: 0,
      );
    }

    return ReferralStats(
      code: code,
      referralUrl: referralUrl,
      invitedCount: (statsResult['invited_count'] as num?)?.toInt() ?? 0,
      convertedCount: (statsResult['converted_count'] as num?)?.toInt() ?? 0,
      pendingRewards: (statsResult['pending_rewards'] as num?)?.toInt() ?? 0,
      confirmedRewards: (statsResult['confirmed_rewards'] as num?)?.toInt() ?? 0,
      totalRewardPence: (statsResult['total_reward_pence'] as num?)?.toInt() ?? 0,
    );
  }

  /// Calls the attribute-referral edge function after sign-up.
  Future<String> attributeReferral({
    required String code,
    String? deviceFingerprint,
  }) async {
    final res = await _client.functions.invoke(
      'attribute-referral',
      method: HttpMethod.post,
      body: {
        'code': code,
        if (deviceFingerprint != null) 'device_fingerprint': deviceFingerprint,
      },
    );
    final data = res.data as Map<String, dynamic>;
    return data['result'] as String? ?? 'error';
  }
}
