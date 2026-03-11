import 'package:supabase_flutter/supabase_flutter.dart';

class FavouritesRemoteDataSource {
  const FavouritesRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<List<Map<String, dynamic>>> fetchFavourites(String profileId) async {
    return (await _client
        .from('favourites')
        .select('id, profile_id, retailer_id, offer_id, created_at')
        .eq('profile_id', profileId)
        .order('created_at', ascending: false)) as List<Map<String, dynamic>>;
  }

  /// Fetches favourite offers with joined offer + retailer data.
  Future<List<Map<String, dynamic>>> fetchFavouriteOffers(
      String profileId) async {
    return (await _client
        .from('favourites')
        .select(
          'offer_id, offers(id, retailer_id, title, short_summary, '
          'value_text, status, image_url, retailers(name, logo_url))',
        )
        .eq('profile_id', profileId)
        .not('offer_id', 'is', null)
        .order('created_at', ascending: false)) as List<Map<String, dynamic>>;
  }

  /// Fetches favourite retailers with joined retailer data.
  Future<List<Map<String, dynamic>>> fetchFavouriteRetailers(
      String profileId) async {
    return (await _client
        .from('favourites')
        .select(
          'retailer_id, retailers(id, name, slug, short_description, '
          'logo_url, cover_image_url)',
        )
        .eq('profile_id', profileId)
        .not('retailer_id', 'is', null)
        .order('created_at', ascending: false)) as List<Map<String, dynamic>>;
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

  Future<void> addRetailerFavourite(
      {required String profileId, required String retailerId}) async {
    await _client.from('favourites').insert({
      'profile_id': profileId,
      'retailer_id': retailerId,
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
