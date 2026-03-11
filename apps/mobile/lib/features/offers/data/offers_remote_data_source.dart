import 'package:supabase_flutter/supabase_flutter.dart';

class OffersRemoteDataSource {
  const OffersRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<List<Map<String, dynamic>>> fetchOffers({
    String? categoryId,
  }) async {
    // TODO: implement
    throw UnimplementedError();
  }

  Future<Map<String, dynamic>> fetchOffer(String offerId) async {
    // TODO: implement
    throw UnimplementedError();
  }

  Future<List<Map<String, dynamic>>> fetchNearbyOffers(
    double latitude,
    double longitude,
  ) async {
    // TODO: implement using PostGIS or Supabase geo functions
    throw UnimplementedError();
  }
}
