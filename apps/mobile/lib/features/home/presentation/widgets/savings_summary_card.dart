import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/config/env.dart';
import '../../providers/platform_config_provider.dart';

/// Community/CTA banner on the home screen.
/// Headline, body text, and CTA are controlled via the admin content page
/// (stored in the platform_config table, row id=1).
class SavingsSummaryCard extends ConsumerWidget {
  const SavingsSummaryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncConfig = ref.watch(platformConfigProvider);
    final config = asyncConfig.valueOrNull ?? PlatformConfig.defaults;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.eco_outlined, color: Colors.white70, size: 28),
            const SizedBox(height: 12),
            Text(
              config.headline,
              style: AppTextStyles.headlineMedium.copyWith(
                color: Colors.white,
                fontSize: 22,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              config.body,
              style: AppTextStyles.bodyMedium.copyWith(
                color: Colors.white.withValues(alpha: 0.75),
              ),
            ),
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: () => _handleCta(context, config.ctaUrl),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Colors.white54, width: 1.5),
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: Text(
                config.ctaText,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14),
              ),
            ),
            if (kDebugMode) ...[
              const SizedBox(height: 12),
              _DebugOverlay(asyncConfig: asyncConfig, config: config),
            ],
          ],
        ),
      ),
    );
  }

  void _handleCta(BuildContext context, String ctaUrl) {
    if (ctaUrl.isEmpty) {
      context.go(RouteNames.explore);
      return;
    }
    final uri = Uri.tryParse(ctaUrl);
    if (uri == null) {
      context.go(RouteNames.explore);
      return;
    }
    // In-app routes start with '/' without a scheme.
    if (!uri.hasScheme) {
      context.go(ctaUrl);
    } else {
      launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

// ---------------------------------------------------------------------------
// Debug overlay — shown inside the card in kDebugMode builds only
// ---------------------------------------------------------------------------

class _DebugOverlay extends StatelessWidget {
  const _DebugOverlay({
    required this.asyncConfig,
    required this.config,
  });

  final AsyncValue<PlatformConfig> asyncConfig;
  final PlatformConfig config;

  @override
  Widget build(BuildContext context) {
    final urlRef  = Uri.tryParse(Env.supabaseUrl)?.host.split('.').firstOrNull ?? '?';
    // Decode jwt_ref directly from the anon key so the comparison works in the
    // error case too (config.diagJwtRef is null when the provider fails because
    // PlatformConfig.fromMap is never called on the failure path).
    final jwtRef  = jwtProjectRef(Env.supabaseAnonKey);
    final rawRow  = config.diagRawRow;
    final error   = asyncConfig.error;
    final isPgErr = error is PostgrestException;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: Colors.black54,
        borderRadius: BorderRadius.circular(6),
      ),
      child: DefaultTextStyle(
        style: const TextStyle(
            color: Colors.white70, fontSize: 9, fontFamily: 'monospace'),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('── DEBUG: platform_config ──',
                style: TextStyle(
                    color: Colors.yellow, fontWeight: FontWeight.bold)),

            // Project identity check
            Text('url_ref : $urlRef'),
            Text('jwt_ref : $jwtRef',
                style: TextStyle(
                    color: urlRef == jwtRef ? Colors.greenAccent : Colors.redAccent)),
            Text('supabase: ${Env.supabaseUrl}'),

            // DB timestamps
            Text('db updated_at: ${config.updatedAt?.toUtc().toIso8601String() ?? "(null)"}'),
            Text('fetched_at:    ${config.fetchedAt?.toLocal().toIso8601String() ?? "(null)"}'),

            const SizedBox(height: 4),

            // Provider state
            if (asyncConfig.isLoading)
              const Text('state: loading…',
                  style: TextStyle(color: Colors.cyan)),

            if (asyncConfig.hasValue && asyncConfig.value != null)
              const Text('state: ok — DB row received',
                  style: TextStyle(
                      color: Colors.greenAccent,
                      fontWeight: FontWeight.bold)),

            if (asyncConfig.hasError) ...[
              const Text('state: ERROR — using hardcoded defaults',
                  style: TextStyle(
                      color: Colors.redAccent, fontWeight: FontWeight.bold)),
              if (isPgErr) ...[
                Text('pg.code:    ${(error as PostgrestException).code}',
                    style: const TextStyle(color: Colors.orangeAccent)),
                Text('pg.message: ${error.message}',
                    style: const TextStyle(color: Colors.orangeAccent)),
                Text('pg.details: ${error.details}',
                    style: const TextStyle(color: Colors.orangeAccent)),
                Text('pg.hint:    ${error.hint}',
                    style: const TextStyle(color: Colors.orangeAccent)),
              ] else
                Text('reason: $error',
                    style: const TextStyle(color: Colors.orange)),
            ],

            if (!asyncConfig.isLoading &&
                !asyncConfig.hasError &&
                asyncConfig.value == null)
              const Text('state: null — row id=1 missing in DB',
                  style: TextStyle(color: Colors.redAccent)),

            // Diagnostic raw row
            if (rawRow != null) ...[
              const SizedBox(height: 4),
              const Text('diag select(*) row:',
                  style: TextStyle(color: Colors.lightBlueAccent)),
              ...rawRow.entries.map(
                (e) => Text('  ${e.key}: ${e.value}',
                    style: const TextStyle(color: Colors.lightBlueAccent)),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
