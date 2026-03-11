import 'package:supabase_flutter/supabase_flutter.dart';

class RetailersRemoteDataSource {
  const RetailersRemoteDataSource(this._client);
  final SupabaseClient _client;

  static const _select =
      'id, name, slug, description, short_description, logo_url, '
      'cover_image_url, website_url, phone, email, '
      'retailer_locations(address_line_1, town, postcode, '
      'latitude, longitude, is_primary)';

  Future<Map<String, dynamic>> fetchRetailer(String retailerId) async {
    return await _client
        .from('retailers')
        .select(_select)
        .eq('id', retailerId)
        .eq('visibility_status', 'live')
        .single();
  }

  Future<List<Map<String, dynamic>>> fetchLiveRetailers() async {
    return (await _client
        .from('retailers')
        .select(_select)
        .eq('visibility_status', 'live')
        .eq('is_active', true)
        .order('name')) as List<Map<String, dynamic>>;
  }
}
