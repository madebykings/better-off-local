import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

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
    this.diagRawRow,
    this.diagJwtRef,
  });

  final String headline;
  final String body;
  final String ctaText;
  final String ctaUrl;

  /// Timestamp from the DB updated_at column. Null when using defaults.
  final DateTime? updatedAt;

  /// Local time when the provider resolved. Null when using defaults.
  final DateTime? fetchedAt;

  /// Raw row map from the diagnostic fetch (debug only, null in release).
  final Map<String, dynamic>? diagRawRow;

  /// JWT ref claim extracted from the anon key (debug only, null in release).
  final String? diagJwtRef;

  static const PlatformConfig defaults = PlatformConfig(
    headline: 'Discover local offers.\nSupport local businesses.',
    body: 'Better Off Local gives you exclusive discounts at brilliant independent businesses near you.',
    ctaText: 'Explore offers',
    ctaUrl: '',
  );

  factory PlatformConfig.fromMap(
    Map<String, dynamic> map, {
    Map<String, dynamic>? diagRawRow,
    String? diagJwtRef,
  }) {
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
      headline:     headline.isNotEmpty ? headline : PlatformConfig.defaults.headline,
      body:         body.isNotEmpty     ? body     : PlatformConfig.defaults.body,
      ctaText:      ctaText.isNotEmpty  ? ctaText  : PlatformConfig.defaults.ctaText,
      ctaUrl:       ctaUrl,
      updatedAt:    updatedAt,
      fetchedAt:    fetchedAt,
      diagRawRow:   diagRawRow,
      diagJwtRef:   diagJwtRef,
    );
  }
}

// ---------------------------------------------------------------------------
// JWT helper — extracts the 'ref' claim to confirm project identity
// ---------------------------------------------------------------------------

/// Decodes the Supabase project ref from a JWT (anon key or any Supabase token).
/// Returns a human-readable string in all failure cases so the overlay always
/// shows something actionable.
String jwtProjectRef(String jwt) {
  try {
    final parts = jwt.split('.');
    if (parts.length != 3) return '(malformed jwt)';
    final padded = parts[1].padRight(((parts[1].length + 3) ~/ 4) * 4, '=');
    final decoded = utf8.decode(base64Url.decode(padded));
    final claims = jsonDecode(decoded) as Map<String, dynamic>;
    return claims['ref'] as String? ?? '(no ref claim)';
  } catch (e) {
    return '(decode error: $e)';
  }
}

/// Fetches platform_config row id=1 from the admin-editable table.
///
/// In debug mode, runs a preliminary diagnostic fetch first:
///   select('*').limit(5) — no filters, no column selection
/// This surface any RLS/permission/schema-cache errors before the real fetch.
///
/// Throws [StateError] if the row is missing (signals a missing seed row or
/// wrong environment). Propagates other exceptions (network, auth) so the
/// widget can inspect [AsyncValue.error] in the debug overlay.
///
/// Invalidate this provider to force a re-fetch (e.g. on pull-to-refresh).
final platformConfigProvider = FutureProvider<PlatformConfig>((ref) async {
  final client = ref.read(supabaseClientProvider);
  final jwtRef = kDebugMode ? jwtProjectRef(Env.supabaseAnonKey) : null;

  // ── Debug diagnostic ──────────────────────────────────────────────────────
  Map<String, dynamic>? diagRawRow;
  // Tracks the outcome of the broad diagnostic select for the error message.
  // Values: '0_rows' | 'N_rows' | 'pg_error:<code>:<message>' | 'error:<msg>'
  String diagSelectResult = 'not_run';

  if (kDebugMode) {
    debugPrint('[PlatformConfig][diag] ─────────────────────────────────');
    debugPrint('[PlatformConfig][diag] URL      : ${Env.supabaseUrl}');
    debugPrint('[PlatformConfig][diag] JWT ref  : $jwtRef');
    debugPrint('[PlatformConfig][diag] URL ref  : ${Uri.parse(Env.supabaseUrl).host.split('.').first}');

    try {
      // Broadest possible fetch — no filters, no explicit column list.
      // If this fails, it's an RLS/permission/schema-cache problem.
      final rawRows = await client
          .from('platform_config')
          .select()
          .limit(5);

      debugPrint('[PlatformConfig][diag] select(*) limit 5 → ${rawRows.length} row(s)');
      for (final r in rawRows) {
        debugPrint('[PlatformConfig][diag]   row: $r');
      }
      diagSelectResult = rawRows.isEmpty ? '0_rows' : '${rawRows.length}_rows';
      if (rawRows.isNotEmpty) {
        diagRawRow = Map<String, dynamic>.from(rawRows.first as Map);
      }
    } on PostgrestException catch (e) {
      diagSelectResult = 'pg_error:${e.code}:${e.message}';
      debugPrint('[PlatformConfig][diag] PostgrestException on select(*):');
      debugPrint('[PlatformConfig][diag]   code   : ${e.code}');
      debugPrint('[PlatformConfig][diag]   message: ${e.message}');
      debugPrint('[PlatformConfig][diag]   details: ${e.details}');
      debugPrint('[PlatformConfig][diag]   hint   : ${e.hint}');
    } catch (e) {
      diagSelectResult = 'error:$e';
      debugPrint('[PlatformConfig][diag] error on select(*): $e');
    }
    debugPrint('[PlatformConfig][diag] ─────────────────────────────────');
  }

  // ── Real fetch ────────────────────────────────────────────────────────────
  try {
    final row = await client
        .from('platform_config')
        .select('homepage_headline, homepage_body, homepage_cta_text, homepage_cta_url, updated_at')
        .eq('id', 1)
        .maybeSingle();

    if (row == null) {
      final msg = '[PlatformConfig] platform_config row id=1 not found at '
          '${Env.supabaseUrl} (jwt_ref=$jwtRef, diag_select=$diagSelectResult) — '
          'check migration 070 was applied and the correct SUPABASE_URL dart-define is set';
      debugPrint(msg);
      throw StateError(msg);
    }
    return PlatformConfig.fromMap(row, diagRawRow: diagRawRow, diagJwtRef: jwtRef);
  } on PostgrestException catch (e) {
    debugPrint('[PlatformConfig] PostgrestException on named-column fetch:');
    debugPrint('[PlatformConfig]   code   : ${e.code}');
    debugPrint('[PlatformConfig]   message: ${e.message}');
    debugPrint('[PlatformConfig]   details: ${e.details}');
    debugPrint('[PlatformConfig]   hint   : ${e.hint}');
    rethrow;
  } catch (e, st) {
    if (e is! StateError) {
      debugPrint('[PlatformConfig] fetch error from ${Env.supabaseUrl}\n$e\n$st');
    }
    rethrow;
  }
});
