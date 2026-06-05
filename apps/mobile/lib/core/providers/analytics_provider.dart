import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/analytics_service.dart';
import '../services/discovery_analytics_service.dart';
import 'supabase_provider.dart';

/// Supabase-backed discovery event analytics (map interactions, search).
final discoveryAnalyticsProvider = Provider<DiscoveryAnalyticsService>(
  (ref) => DiscoveryAnalyticsService(ref.read(supabaseClientProvider)),
);

/// Firebase Analytics service — overridden in bootstrap with the real
/// implementation or a no-op fallback when Firebase is unavailable.
final analyticsServiceProvider = Provider<AnalyticsService>((_) {
  throw UnimplementedError(
    'analyticsServiceProvider was not overridden — '
    'ensure bootstrap() is called before runApp().',
  );
});
