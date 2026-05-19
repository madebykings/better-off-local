import 'package:supabase_flutter/supabase_flutter.dart';

class OnlineRedemptionRemoteDataSource {
  const OnlineRedemptionRemoteDataSource(this._client);
  final SupabaseClient _client;

  /// Calls the `approve-verification-session` edge function.
  ///
  /// Expected request body: { session_token: String }
  ///
  /// Expected response (200):
  /// {
  ///   "session_token": String,
  ///   "retailer_name": String,
  ///   "retailer_logo_url": String?,
  ///   "offer_title": String?
  /// }
  ///
  /// Error responses (4xx) return { "error": String } with descriptive messages:
  ///   - 401: consumer membership not active
  ///   - 404: session_token not found
  ///   - 409: session already approved/consumed
  ///   - 410: session expired (past TTL)
  ///
  /// TODO: Implement the `approve-verification-session` edge function.
  ///   - Look up session by token in `verification_sessions` table
  ///   - Validate consumer has active or trialing membership
  ///   - Atomically UPDATE SET status='approved' WHERE status='pending'
  ///     (prevents race conditions if scanned twice)
  ///   - Return retailer context from joined `retailers` table
  ///   - Session TTL: 5 minutes from creation
  Future<Map<String, dynamic>> approveSession(String sessionToken) async {
    // TODO: Replace with real edge function call once implemented:
    //
    // final response = await _client.functions.invoke(
    //   'approve-verification-session',
    //   body: {'session_token': sessionToken},
    // );
    //
    // if (response.status != 200) {
    //   final message =
    //       (response.data as Map<String, dynamic>?)?['error'] as String? ??
    //           'Could not approve verification session';
    //   throw Exception(message);
    // }
    //
    // return response.data as Map<String, dynamic>;

    throw UnimplementedError(
      'approve-verification-session edge function not yet implemented. '
      'See online_redemption_remote_data_source.dart for the required API contract.',
    );
  }
}
