import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';

class PlatformConfig {
  const PlatformConfig({
    required this.headline,
    required this.body,
    required this.ctaText,
    required this.ctaUrl,
  });

  final String headline;
  final String body;
  final String ctaText;
  final String ctaUrl;

  static const PlatformConfig defaults = PlatformConfig(
    headline: 'Discover local offers.\nSupport local businesses.',
    body: 'Better Off Local gives you exclusive discounts at brilliant independent businesses near you.',
    ctaText: 'Explore offers',
    ctaUrl: '',
  );

  factory PlatformConfig.fromMap(Map<String, dynamic> map) {
    return PlatformConfig(
      headline: (map['homepage_headline'] as String? ?? '').isNotEmpty
          ? map['homepage_headline'] as String
          : PlatformConfig.defaults.headline,
      body: (map['homepage_body'] as String? ?? '').isNotEmpty
          ? map['homepage_body'] as String
          : PlatformConfig.defaults.body,
      ctaText: (map['homepage_cta_text'] as String? ?? '').isNotEmpty
          ? map['homepage_cta_text'] as String
          : PlatformConfig.defaults.ctaText,
      ctaUrl: map['homepage_cta_url'] as String? ?? '',
    );
  }
}

/// Fetches platform_config row id=1. Falls back to defaults on any error.
final platformConfigProvider = FutureProvider<PlatformConfig>((ref) async {
  try {
    final client = ref.read(supabaseClientProvider);
    final row = await client
        .from('platform_config')
        .select('homepage_headline, homepage_body, homepage_cta_text, homepage_cta_url')
        .eq('id', 1)
        .maybeSingle();

    if (row == null) return PlatformConfig.defaults;
    return PlatformConfig.fromMap(row);
  } catch (_) {
    return PlatformConfig.defaults;
  }
});
