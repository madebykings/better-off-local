import 'package:supabase_flutter/supabase_flutter.dart';

/// Fire-and-forget analytics for map and discovery interactions.
/// Inserts rows into `discovery_events`; errors are silently swallowed so
/// analytics never block or break the UI.
class DiscoveryAnalyticsService {
  const DiscoveryAnalyticsService(this._client);
  final SupabaseClient _client;

  void logMapViewed(String? profileId) =>
      _log('map_viewed', profileId);

  void logMarkerOpened(String? profileId, String retailerId) =>
      _log('marker_opened', profileId, retailerId: retailerId);

  void logRetailerOpenedFromMap(String? profileId, String retailerId) =>
      _log('retailer_opened_from_map', profileId, retailerId: retailerId);

  void logSearchUsed(String? profileId, String query) =>
      _log('search_used', profileId, metadata: {'query': query});

  void _log(
    String eventType,
    String? profileId, {
    String? retailerId,
    Map<String, dynamic>? metadata,
  }) {
    _client.from('discovery_events').insert({
      'event_type': eventType,
      if (profileId != null) 'profile_id': profileId,
      if (retailerId != null) 'retailer_id': retailerId,
      if (metadata != null) 'metadata': metadata,
    }).then((_) {}).catchError((_) {});
  }
}
