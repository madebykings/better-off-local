import 'package:supabase_flutter/supabase_flutter.dart';

class RedemptionsRemoteDataSource {
  const RedemptionsRemoteDataSource(this._client);
  final SupabaseClient _client;

  /// Calls the `create-redemption-token` edge function.
  /// Returns the raw response map: token, offer_id, retailer_id, expires_at.
  /// Throws on membership/offer/rule violations (server returns 4xx).
  Future<Map<String, dynamic>> requestRedemptionToken(String offerId) async {
    final response = await _client.functions.invoke(
      'create-redemption-token',
      body: {'offer_id': offerId},
    );

    if (response.status != 200) {
      final message =
          (response.data as Map<String, dynamic>?)?['error'] as String? ??
              'Could not create redemption token';
      throw Exception(message);
    }

    return response.data as Map<String, dynamic>;
  }

  /// Calls the `create-membership-pass-token` edge function.
  ///
  /// Issues a short-lived membership-level token (5-minute TTL) — not tied to
  /// any specific offer or retailer. The consumer displays this as a QR on the
  /// Card tab to prove active BOL membership.
  ///
  /// Returns { token, expires_at }. offer_id and retailer_id are absent from
  /// the response and will be null in the resulting [RedemptionToken].
  Future<Map<String, dynamic>> requestPassToken() async {
    final response = await _client.functions.invoke(
      'create-membership-pass-token',
      body: {},
    );

    if (response.status != 200) {
      final message =
          (response.data as Map<String, dynamic>?)?['error'] as String? ??
              'Could not create membership pass token';
      throw Exception(message);
    }

    return response.data as Map<String, dynamic>;
  }

  /// Fetches the authenticated user's redemption history with offer title,
  /// most recent first, limited to 50 entries.
  Future<List<Map<String, dynamic>>> fetchRedemptionHistory(
    String userId,
  ) async {
    final response = await _client
        .from('redemptions')
        .select('*, offers(title)')
        .eq('profile_id', userId)
        .order('redeemed_at', ascending: false)
        .limit(50);
    return List<Map<String, dynamic>>.from(response as List);
  }
}
