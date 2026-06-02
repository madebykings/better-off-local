import 'package:supabase_flutter/supabase_flutter.dart';

class FavouritesRemoteDataSource {
  const FavouritesRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<List<Map<String, dynamic>>> fetchFavourites(String profileId) async {
    return await _client
        .from('favourites')
        .select(
          'id, profile_id, retailer_id, retailer_location_id, offer_id, created_at',
        )
        .eq('profile_id', profileId)
        .order('created_at', ascending: false);
  }

  /// Fetches favourite offers with joined offer + retailer data.
  Future<List<Map<String, dynamic>>> fetchFavouriteOffers(
      String profileId) async {
    return await _client
        .from('favourites')
        .select(
          'offer_id, offers(id, retailer_id, title, short_summary, '
          'value_text, status, image_url, retailers(name, logo_url))',
        )
        .eq('profile_id', profileId)
        .not('offer_id', 'is', null)
        .order('created_at', ascending: false);
  }

  /// Fetches favourite retailers with joined retailer data.
  /// Returns nested `retailers` objects from the base table — no
  /// primary_location_id. Use [fetchFavouriteRetailersDiscovery] when a
  /// full Retailer model (including primaryLocationId for venue attribution)
  /// is required.
  Future<List<Map<String, dynamic>>> fetchFavouriteRetailers(
      String profileId) async {
    return await _client
        .from('favourites')
        .select(
          'retailer_id, retailers(id, name, slug, short_description, '
          'logo_url, cover_image_url)',
        )
        .eq('profile_id', profileId)
        .not('retailer_id', 'is', null)
        .order('created_at', ascending: false);
  }

  /// Two-step fetch that returns full Retailer rows from
  /// consumer_discovery_retailers. Use this on screens that render
  /// BusinessCard so that primaryLocationId is populated and subsequent
  /// favourite toggles are venue-attributed.
  Future<List<Map<String, dynamic>>> fetchFavouriteRetailersDiscovery(
      String profileId) async {
    final favRows = await _client
        .from('favourites')
        .select('retailer_id')
        .eq('profile_id', profileId)
        .not('retailer_id', 'is', null)
        .order('created_at', ascending: false);

    final ids = (favRows as List)
        .map((r) => r['retailer_id'] as String)
        .toList();
    if (ids.isEmpty) return [];

    return await _client
        .from('consumer_discovery_retailers')
        .select('*')
        .inFilter('id', ids);
  }

  Future<void> addOfferFavourite(
      {required String profileId, required String offerId}) async {
    await _client.from('favourites').insert({
      'profile_id': profileId,
      'offer_id': offerId,
    });
  }

  Future<void> removeOfferFavourite(
      {required String profileId, required String offerId}) async {
    await _client
        .from('favourites')
        .delete()
        .eq('profile_id', profileId)
        .eq('offer_id', offerId);
  }

  /// Saves a retailer favourite, optionally tagged to a specific venue.
  /// [locationId] should be the primary_location_id from the discovery view.
  /// When provided it enables venue-level badge counting; when omitted the
  /// save is attributed to the retailer only (pre-venue fallback).
  Future<void> addRetailerFavourite({
    required String profileId,
    required String retailerId,
    String? locationId,
  }) async {
    await _client.from('favourites').insert({
      'profile_id': profileId,
      'retailer_id': retailerId,
      if (locationId != null) 'retailer_location_id': locationId,
    });
  }

  Future<void> removeRetailerFavourite(
      {required String profileId, required String retailerId}) async {
    await _client
        .from('favourites')
        .delete()
        .eq('profile_id', profileId)
        .eq('retailer_id', retailerId);
  }
}
