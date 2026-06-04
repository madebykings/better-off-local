import 'package:supabase_flutter/supabase_flutter.dart';

class OffersRemoteDataSource {
  const OffersRemoteDataSource(this._client);
  final SupabaseClient _client;

  static const _listSelect =
      'id, retailer_id, title, short_summary, value_text, offer_type, '
      'start_at, end_at, status, is_featured, image_url, estimated_saving_pence, '
      'retailers(name, logo_url), '
      'offer_rules(max_redemptions_per_user, max_redemptions_per_day, '
      'cooldown_hours, max_redemptions_total, new_customers_only)';

  // Flat select for consumer_discovery_offers view (includes retailer info +
  // rules + redemption_count for correct sort: featured → redeemed → newest).
  static const _discoverySelect =
      'id, retailer_id, retailer_name, retailer_logo_url, title, short_summary, '
      'value_text, offer_type, start_at, end_at, is_featured, image_url, '
      'estimated_saving_pence, redemption_count, '
      'max_redemptions_per_user, max_redemptions_per_day, '
      'max_redemptions_total, cooldown_hours, new_customers_only';

  static const _detailSelect =
      '*, retailers(id, name, slug, logo_url, cover_image_url, '
      'short_description, description, phone, email, website_url, '
      'retailer_locations(address_line_1, town, postcode, '
      'latitude, longitude, is_primary))';

  /// Fetches live offers for the explore screen.
  /// Uses the consumer_discovery_offers view so offers sort by:
  ///   featured → most redeemed → newest.
  /// The view already filters for live/approved/within-dates.
  Future<List<Map<String, dynamic>>> fetchOffers({String? categoryId}) async {
    if (categoryId != null) {
      final catRows = await _client
          .from('retailer_categories')
          .select('retailer_id')
          .eq('category_id', categoryId);
      final retailerIds =
          catRows.map((r) => r['retailer_id'] as String).toList();
      if (retailerIds.isEmpty) return [];

      return await _client
          .from('consumer_discovery_offers')
          .select(_discoverySelect)
          .inFilter('retailer_id', retailerIds)
          .order('is_featured', ascending: false)
          .order('redemption_count', ascending: false)
          .order('created_at', ascending: false);
    }

    return await _client
        .from('consumer_discovery_offers')
        .select(_discoverySelect)
        .order('is_featured', ascending: false)
        .order('redemption_count', ascending: false)
        .order('created_at', ascending: false);
  }

  Future<Map<String, dynamic>?> fetchOffer(String offerId) async {
    return await _client
        .from('offers')
        .select(_detailSelect)
        .eq('id', offerId)
        .maybeSingle();
  }

  /// Fetches all consumer-facing offers for a retailer (live + expired).
  /// Expired offers are included so the availability layer can show them
  /// with an explanation rather than silently hiding them.
  /// Sorting is handled client-side after merging with availability data.
  Future<List<Map<String, dynamic>>> fetchOffersByRetailer(
      String retailerId) async {
    return await _client
        .from('offers')
        .select(_listSelect)
        .eq('retailer_id', retailerId)
        .inFilter('status', ['live', 'expired'])
        .order('is_featured', ascending: false)
        .order('created_at', ascending: true);
  }

  /// Calls the get_retailer_offers_availability RPC and returns the raw rows.
  /// p_consumer_id may be null for unauthenticated browsing.
  Future<List<Map<String, dynamic>>> fetchRetailerOffersAvailability({
    required String retailerId,
    String? consumerId,
  }) async {
    final result = await _client.rpc(
      'get_retailer_offers_availability',
      params: {
        'p_retailer_id': retailerId,
        'p_consumer_id': consumerId,
      },
    );
    return List<Map<String, dynamic>>.from(result as List);
  }

  /// Calls the get_offer_availability RPC for a single offer.
  /// Used as the pre-redemption gate check on the detail screen.
  Future<Map<String, dynamic>?> fetchOfferAvailability({
    required String offerId,
    required String consumerId,
  }) async {
    final result = await _client.rpc(
      'get_offer_availability',
      params: {
        'p_offer_id': offerId,
        'p_consumer_id': consumerId,
      },
    );
    final rows = List<Map<String, dynamic>>.from(result as List);
    return rows.isNotEmpty ? rows.first : null;
  }

  Future<void> logOfferView({
    required String offerId,
    required String retailerId,
    String? profileId,
  }) async {
    await _client.from('offer_views').insert({
      'offer_id': offerId,
      'retailer_id': retailerId,
      if (profileId != null) 'profile_id': profileId,
    });
  }

  /// Fetches the best offer per retailer from [retailerIds] using the
  /// `consumer_discovery_offers` view. Featured offers are preferred; oldest
  /// live offer is the fallback. Callers keep the first result per retailer.
  /// Home screen offers: featured → most redeemed → newest, capped at [limit].
  /// Uses _discoverySelect so all redemption rule fields are included.
  Future<List<Map<String, dynamic>>> fetchHomeOffers({int limit = 10}) async {
    return await _client
        .from('consumer_discovery_offers')
        .select(_discoverySelect)
        .order('is_featured', ascending: false)
        .order('redemption_count', ascending: false)
        .order('created_at', ascending: false)
        .limit(limit);
  }

  Future<List<Map<String, dynamic>>> fetchFeaturedOfferForRetailers(
      List<String> retailerIds) async {
    return await _client
        .from('consumer_discovery_offers')
        .select('id, retailer_id, title, value_text, is_featured')
        .inFilter('retailer_id', retailerIds)
        .order('is_featured', ascending: false)
        .order('created_at', ascending: true);
  }

  Future<List<Map<String, dynamic>>> fetchCategories() async {
    return await _client
        .from('categories')
        .select('id, name, slug, icon, sort_order')
        .eq('is_active', true)
        .order('sort_order');
  }
}
