import 'package:supabase_flutter/supabase_flutter.dart';

class OffersRemoteDataSource {
  const OffersRemoteDataSource(this._client);
  final SupabaseClient _client;

  static const _listSelect =
      'id, retailer_id, title, short_summary, value_text, offer_type, '
      'start_at, end_at, status, is_featured, image_url, '
      'retailers(name, logo_url)';

  static const _detailSelect =
      '*, retailers(id, name, slug, logo_url, cover_image_url, '
      'short_description, description, phone, email, website_url, '
      'retailer_locations(address_line_1, town, postcode, '
      'latitude, longitude, is_primary))';

  Future<List<Map<String, dynamic>>> fetchOffers({String? categoryId}) async {
    final now = DateTime.now().toUtc().toIso8601String();

    if (categoryId != null) {
      final catRows = await _client
          .from('retailer_categories')
          .select('retailer_id')
          .eq('category_id', categoryId);
      final retailerIds =
          (catRows as List).map((r) => r['retailer_id'] as String).toList();
      if (retailerIds.isEmpty) return [];

      return (await _client
          .from('offers')
          .select(_listSelect)
          .eq('status', 'live')
          .or('end_at.is.null,end_at.gt.$now')
          .or('start_at.is.null,start_at.lte.$now')
          .inFilter('retailer_id', retailerIds)
          .order('is_featured', ascending: false)
          .order('created_at', ascending: false)) as List<Map<String, dynamic>>;
    }

    return (await _client
        .from('offers')
        .select(_listSelect)
        .eq('status', 'live')
        .or('end_at.is.null,end_at.gt.$now')
        .or('start_at.is.null,start_at.lte.$now')
        .order('is_featured', ascending: false)
        .order('created_at', ascending: false)) as List<Map<String, dynamic>>;
  }

  Future<Map<String, dynamic>> fetchOffer(String offerId) async {
    return await _client
        .from('offers')
        .select(_detailSelect)
        .eq('id', offerId)
        .single();
  }

  Future<List<Map<String, dynamic>>> fetchOffersByRetailer(
      String retailerId) async {
    final now = DateTime.now().toUtc().toIso8601String();
    return (await _client
        .from('offers')
        .select(_listSelect)
        .eq('retailer_id', retailerId)
        .eq('status', 'live')
        .or('end_at.is.null,end_at.gt.$now')
        .or('start_at.is.null,start_at.lte.$now')
        .order('created_at', ascending: false)) as List<Map<String, dynamic>>;
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
  Future<List<Map<String, dynamic>>> fetchFeaturedOfferForRetailers(
      List<String> retailerIds) async {
    return (await _client
        .from('consumer_discovery_offers')
        .select('id, retailer_id, title, value_text, is_featured')
        .inFilter('retailer_id', retailerIds)
        .order('is_featured', ascending: false)
        .order('created_at', ascending: true)) as List<Map<String, dynamic>>;
  }

  Future<List<Map<String, dynamic>>> fetchCategories() async {
    return (await _client
        .from('categories')
        .select('id, name, slug, icon, sort_order')
        .eq('is_active', true)
        .order('sort_order')) as List<Map<String, dynamic>>;
  }
}
