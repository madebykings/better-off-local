import 'package:supabase_flutter/supabase_flutter.dart';

class RetailersRemoteDataSource {
  const RetailersRemoteDataSource(this._client);
  final SupabaseClient _client;

  // consumer_discovery_retailers is a flat view: location fields are top-level
  // and categories arrive as a JSON array in `category_names`.
  // No embedded PostgREST joins needed.
  static const _select = '*';

  Future<Map<String, dynamic>> fetchRetailer(String retailerId) async {
    return await _client
        .from('consumer_discovery_retailers')
        .select(_select)
        .eq('id', retailerId)
        .single();
  }

  Future<List<Map<String, dynamic>>> fetchLiveRetailers() async {
    return (await _client
        .from('consumer_discovery_retailers')
        .select(_select)
        .order('name')) as List<Map<String, dynamic>>;
  }
}
