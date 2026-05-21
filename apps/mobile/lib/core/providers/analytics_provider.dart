import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'supabase_provider.dart';
import '../services/discovery_analytics_service.dart';

final discoveryAnalyticsProvider = Provider<DiscoveryAnalyticsService>(
  (ref) => DiscoveryAnalyticsService(ref.read(supabaseClientProvider)),
);
