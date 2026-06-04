import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/env.dart';
import '../../../core/providers/supabase_provider.dart';

class PlatformConfig {
  const PlatformConfig({
    required this.headline,
    required this.body,
    required this.ctaText,
    required this.ctaUrl,
    this.updatedAt,
    this.fetchedAt,
  });

  final String headline;
  final String body;
  final String ctaText;
  final String ctaUrl;

  /// Timestamp from the DB updated_at column. Null when using defaults.
  final DateTime? updatedAt;

  /// Local time when the provider resolved. Null when using defaults.
  final DateTime? fetchedAt;

  static const PlatformConfig defaults = PlatformConfig(
    headline: 'Discover local offers.\nSupport local businesses.',
    body: 'Better Off Local gives you exclusive discounts at brilliant independent businesses near you.',
    ctaText: 'Explore offers',
    ctaUrl: '',
  );

  factory PlatformConfig.fromMap(Map<String, dynamic> map) {
    final headline      = map['homepage_headline'] as String? ?? '';
    final body          = map['homepage_body']     as String? ?? '';
    final ctaText       = map['homepage_cta_text'] as String? ?? '';
    final ctaUrl        = map['homepage_cta_url']  as String? ?? '';
    final updatedAtStr  = map['updated_at']        as String?;
    final updatedAt     = updatedAtStr != null ? DateTime.tryParse(updatedAtStr) : null;
    final fetchedAt     = DateTime.now();

    if (kDebugMode) {
      debugPrint('[PlatformConfig] fetched from ${Env.supabaseUrl}: '
          'headline="${headline.isEmpty ? "(empty)" : headline}" '
          'body="${body.isEmpty ? "(empty)" : body.substring(0, body.length.clamp(0, 40))}…" '
          'ctaText="${ctaText.isEmpty ? "(empty)" : ctaText}" '
          'ctaUrl="${ctaUrl.isEmpty ? "(empty)" : ctaUrl}" '
          'updated_at="$updatedAtStr" '
          'fetchedAt="$fetchedAt"');
    }

    return PlatformConfig(
      headline:  headline.isNotEmpty ? headline : PlatformConfig.defaults.headline,
      body:      body.isNotEmpty     ? body     : PlatformConfig.defaults.body,
      ctaText:   ctaText.isNotEmpty  ? ctaText  : PlatformConfig.defaults.ctaText,
      ctaUrl:    ctaUrl,
      updatedAt: updatedAt,
      fetchedAt: fetchedAt,
    );
  }
}

/// Fetches platform_config row id=1 from the admin-editable table.
///
/// Throws [StateError] if the row is missing (signals a missing seed row or
/// wrong environment). Propagates other exceptions (network, auth) so the
/// widget can inspect [AsyncValue.error] in the debug overlay.
///
/// Invalidate this provider to force a re-fetch (e.g. on pull-to-refresh).
final platformConfigProvider = FutureProvider<PlatformConfig>((ref) async {
  try {
    final client = ref.read(supabaseClientProvider);
    final row = await client
        .from('platform_config')
        .select('homepage_headline, homepage_body, homepage_cta_text, homepage_cta_url, updated_at')
        .eq('id', 1)
        .maybeSingle();

    if (row == null) {
      final msg = '[PlatformConfig] platform_config row id=1 not found at '
          '${Env.supabaseUrl} — check migration 070 was applied and the '
          'correct SUPABASE_URL dart-define is set';
      debugPrint(msg);
      throw StateError(msg);
    }
    return PlatformConfig.fromMap(row);
  } catch (e, st) {
    if (e is! StateError) {
      debugPrint('[PlatformConfig] fetch error from ${Env.supabaseUrl}\n$e\n$st');
    }
    rethrow;
  }
});
