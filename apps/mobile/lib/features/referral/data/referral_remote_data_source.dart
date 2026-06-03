import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/referral.dart';

class ReferralRemoteDataSource {
  const ReferralRemoteDataSource(this._client);
  final SupabaseClient _client;

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

  Future<ReferralStats?> fetchStats(String profileId) async {
    // Fetch referral code
    final codeResult = await _client
        .from('referral_codes')
        .select('code')
        .eq('profile_id', profileId)
        .maybeSingle();

    if (codeResult == null) return null;

    final code = codeResult['code'] as String;
    final referralUrl = 'https://betterofflocal.com/join?ref=$code';

    // Count attributed invitations for this member's code
    final referralCodeResult = await _client
        .from('referral_codes')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle();

    int invitedCount = 0;
    if (referralCodeResult != null) {
      final invitationsResult = await _client
          .from('referral_invitations')
          .select('id')
          .eq('referral_code_id', referralCodeResult['id'] as String);
      invitedCount = (invitationsResult as List).length;
    }

    // Fetch rewards grouped by status
    final rewardsResult = await _client
        .from('referral_rewards')
        .select('status, reward_amount_pence')
        .eq('referrer_profile_id', profileId)
        .inFilter('status', ['pending', 'eligible', 'paid']);

    final rewards = (rewardsResult as List).cast<Map<String, dynamic>>();

    int pendingPence = 0;
    int eligiblePence = 0;
    int paidPence = 0;
    int convertedCount = 0;

    for (final r in rewards) {
      final status = r['status'] as String?;
      final amount = (r['reward_amount_pence'] as num?)?.toInt() ?? 0;
      switch (status) {
        case 'pending':
          pendingPence += amount;
          convertedCount++;
        case 'eligible':
          eligiblePence += amount;
          convertedCount++;
        case 'paid':
          paidPence += amount;
          convertedCount++;
      }
    }

    // Fetch PayPal email from profile
    final profileResult = await _client
        .from('profiles')
        .select('paypal_email')
        .eq('id', profileId)
        .maybeSingle();

    final paypalEmail = profileResult?['paypal_email'] as String?;

    return ReferralStats(
      code: code,
      referralUrl: referralUrl,
      invitedCount: invitedCount,
      convertedCount: convertedCount,
      pendingAmountPence: pendingPence,
      eligibleAmountPence: eligiblePence,
      paidAmountPence: paidPence,
      paypalEmail: paypalEmail,
    );
  }

  Future<void> savePaypalEmail({
    required String profileId,
    required String paypalEmail,
  }) async {
    await _client
        .from('profiles')
        .update({'paypal_email': paypalEmail.trim()})
        .eq('id', profileId);
  }

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
