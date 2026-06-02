import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../providers/platform_config_provider.dart';

/// Community/CTA banner on the home screen.
/// Headline, body text, and CTA are controlled via the admin content page
/// (stored in the platform_config table, row id=1).
class SavingsSummaryCard extends ConsumerWidget {
  const SavingsSummaryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final config = ref.watch(platformConfigProvider).valueOrNull ??
        PlatformConfig.defaults;

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
