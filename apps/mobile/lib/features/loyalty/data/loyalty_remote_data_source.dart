import 'package:supabase_flutter/supabase_flutter.dart';

class LoyaltyRemoteDataSource {
  const LoyaltyRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<List<Map<String, dynamic>>> fetchMyCards(String profileId) async {
    return await _client
        .from('loyalty_cards')
        .select(
          'id, offer_id, retailer_id, stamps_earned, stamps_required, status, '
          'created_at, completed_at, claimed_at, '
          'offers(title), '
          'retailers(name), '
          'offer_loyalty_config(reward_description)',
        )
        .eq('profile_id', profileId)
        .order('created_at', ascending: false);
  }

  Future<Map<String, dynamic>?> fetchCardForOffer(
      String profileId, String offerId) async {
    final rows = await _client
        .from('loyalty_cards')
        .select(
          'id, offer_id, retailer_id, stamps_earned, stamps_required, status, '
          'created_at, completed_at, claimed_at, '
          'offers(title), '
          'retailers(name), '
          'offer_loyalty_config(reward_description)',
        )
        .eq('profile_id', profileId)
        .eq('offer_id', offerId)
        .limit(1);
    if (rows.isEmpty) return null;
    return rows.first;
  }

  Future<Map<String, dynamic>?> fetchLoyaltyConfig(String offerId) async {
    final rows = await _client
        .from('offer_loyalty_config')
        .select('stamps_required, reward_description, reward_type, reward_value_text, min_hours_between_stamps')
        .eq('offer_id', offerId)
        .limit(1);
    if (rows.isEmpty) return null;
    return rows.first;
  }
}
