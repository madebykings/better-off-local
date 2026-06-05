import 'package:supabase_flutter/supabase_flutter.dart';

import '../domain/map_event_pin.dart';

class MapRemoteDataSource {
  const MapRemoteDataSource(this._client);
  final SupabaseClient _client;

  /// Calls the get_map_events RPC — returns live upcoming events with venue
  /// coordinates. Filters to the given region. Includes reminder state for
  /// the authenticated consumer if [consumerId] is provided.
  Future<List<MapEventPin>> fetchMapEvents({
    required String regionId,
    String? consumerId,
  }) async {
    final params = <String, dynamic>{
      'p_region_id': regionId,
    };
    if (consumerId != null) params['p_consumer_id'] = consumerId;

    try {
      final rows = await _client.rpc('get_map_events', params: params);
      if (rows is! List) return [];
      return rows.map((r) => MapEventPin.fromMap(r as Map<String, dynamic>)).toList();
    } catch (_) {
      return [];
    }
  }
}
