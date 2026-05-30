import 'package:supabase_flutter/supabase_flutter.dart';

class MembershipRemoteDataSource {
  const MembershipRemoteDataSource(this._client);

  final SupabaseClient _client;

  /// Fetches the most recent membership row for the user.
  /// Returns null when no row exists.
  Future<Map<String, dynamic>?> fetchMembership(String userId) async {
    final response = await _client
        .from('consumer_memberships')
        .select()
        .eq('profile_id', userId)
        .order('created_at', ascending: false)
        .limit(1)
        .maybeSingle();
    return response;
  }

  /// Calls the create-checkout-session edge function.
  /// Returns the Stripe Checkout Session URL.
  Future<String> createCheckoutSession({required String plan}) async {
    final response = await _client.functions.invoke(
      'create-checkout-session',
      body: {'plan': plan},
    );

    if (response.status != 200) {
      final message =
          (response.data as Map<String, dynamic>?)?['error'] as String? ??
              'Failed to create checkout session';
      throw Exception(message);
    }

    final url = (response.data as Map<String, dynamic>)['url'] as String?;
    if (url == null) throw Exception('No checkout URL returned');
    return url;
  }

  /// Calls the create-portal-session edge function.
  /// Returns the Stripe Billing Portal URL.
  Future<String> createPortalSession() async {
    final response = await _client.functions.invoke('create-portal-session');

    if (response.status == 404) {
      throw Exception('No billing account found. Please subscribe first.');
    }
    if (response.status != 200) {
      final message =
          (response.data as Map<String, dynamic>?)?['error'] as String? ??
              'Failed to open billing portal';
      throw Exception(message);
    }

    final url = (response.data as Map<String, dynamic>)['url'] as String?;
    if (url == null) throw Exception('No portal URL returned');
    return url;
  }
}
