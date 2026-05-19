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
  /// This function issues a short-lived membership-level token — not tied to
  /// any specific offer or retailer. The consumer scans this on the Card tab
  /// to prove active BOL membership.
  ///
  /// Expected response: { token, expires_at }
  /// (offer_id and retailer_id are omitted — null in [RedemptionToken])
  ///
  /// TODO: Implement the `create-membership-pass-token` edge function.
  ///   - Validate consumer has active/trialing membership within period
  ///   - Generate a cryptographically random token UUID
  ///   - Store SHA-256 hash in a new `membership_pass_tokens` table (or reuse
  ///     `redemption_tokens` with a null offer_id and token_purpose = 'pass')
  ///   - Return { token, expires_at } (5 min TTL)
  ///   - No offer rules checked — membership status only
  Future<Map<String, dynamic>> requestPassToken() async {
    // TODO: Replace with real edge function call once implemented:
    //
    // final response = await _client.functions.invoke(
    //   'create-membership-pass-token',
    //   body: {},
    // );
    // if (response.status != 200) {
    //   final message =
    //       (response.data as Map<String, dynamic>?)?['error'] as String? ??
    //           'Could not create membership pass token';
    //   throw Exception(message);
    // }
    // return response.data as Map<String, dynamic>;

    throw UnimplementedError(
      'create-membership-pass-token edge function not yet implemented. '
      'See redemptions_remote_data_source.dart for the required API contract.',
    );
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
