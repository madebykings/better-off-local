import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/redemption_exception.dart';

class RedemptionsRemoteDataSource {
  const RedemptionsRemoteDataSource(this._client);
  final SupabaseClient _client;

  /// Calls the `create-redemption-token` edge function.
  /// Returns the raw response map: token, offer_id, retailer_id, expires_at.
  /// Throws [RedemptionException] on membership/offer/rule violations (4xx/5xx).
  Future<Map<String, dynamic>> requestRedemptionToken(String offerId) async {
    final response = await _client.functions.invoke(
      'create-redemption-token',
      body: {'offer_id': offerId},
    );

    if (response.status != 200) {
      final body = response.data as Map<String, dynamic>?;
      throw RedemptionException(
        message: body?['error'] as String? ?? 'Could not create redemption token',
        statusCode: response.status,
        errorCode: body?['error_code'] as String?,
      );
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

  /// Calls the `reset_loyalty_card` RPC to archive the claimed card and create
  /// a fresh active card for the same offer.
  ///
  /// Returns the new card id on success.
  /// Throws [RedemptionException] with a human-friendly message on failure.
  Future<String> resetLoyaltyCard({
    required String offerId,
    required String consumerId,
  }) async {
    try {
      final result = await _client.rpc(
        'reset_loyalty_card',
        params: {
          'p_offer_id': offerId,
          'p_consumer_id': consumerId,
        },
      );
      // RPC returns the new card UUID as a scalar string.
      return result as String;
    } on PostgrestException catch (e) {
      throw RedemptionException(
        message: e.message.contains('not live') || e.message.contains('offer')
            ? 'This offer is no longer available'
            : 'Could not start a new card. Please try again.',
        statusCode: 500,
        errorCode: e.code,
      );
    } catch (_) {
      throw const RedemptionException(
        message: 'Could not start a new card. Please try again.',
        statusCode: 500,
      );
    }
  }

  /// Calls `get_offer_availability` RPC and returns the `availability_state`
  /// string (e.g. 'available', 'already_redeemed', 'offer_unavailable').
  /// Returns null on any error so callers can treat it as indeterminate.
  Future<String?> checkOfferAvailability({
    required String offerId,
    required String consumerId,
  }) async {
    try {
      final rows = await _client.rpc(
        'get_offer_availability',
        params: {
          'p_offer_id': offerId,
          'p_consumer_id': consumerId,
        },
      );
      if (rows is List && rows.isNotEmpty) {
        return rows.first['availability_state'] as String?;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Fetches the authenticated user's redemption history with offer and
  /// retailer details, most recent first, limited to 50 entries.
  Future<List<Map<String, dynamic>>> fetchRedemptionHistory(
    String userId,
  ) async {
    final response = await _client
        .from('redemptions')
        .select('*, offers(title), retailers(name, logo_url)')
        .eq('profile_id', userId)
        .order('redeemed_at', ascending: false)
        .limit(50);
    return List<Map<String, dynamic>>.from(response as List);
  }
}
