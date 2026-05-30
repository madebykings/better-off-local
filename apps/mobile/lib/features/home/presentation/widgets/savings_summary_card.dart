import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/constants/app_constants.dart';
import '../../../../core/providers/location_provider.dart';

/// Community banner on the home screen.
///
/// Shows the launch region name when the user has granted location access
/// (the locationProvider has a position), otherwise falls back to "your
/// community" to avoid showing a place name for users outside the region.
///
/// To update the region name centrally, change [AppConstants.launchRegion].
/// Future: read from a platform_config Supabase table so admins can update
/// it without a code change.
class SavingsSummaryCard extends ConsumerWidget {
  const SavingsSummaryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final position = ref.watch(locationProvider);
    final regionName = position != null ? AppConstants.launchRegion : 'your community';

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
            const Icon(
              Icons.eco_outlined,
              color: Colors.white70,
              size: 28,
            ),
            const SizedBox(height: 12),
            Text(
              'Save locally.\nSpend locally.',
              style: AppTextStyles.headlineMedium.copyWith(
                color: Colors.white,
                fontSize: 22,
                height: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Support the businesses that make $regionName great.',
              style: AppTextStyles.bodyMedium.copyWith(
                color: Colors.white.withValues(alpha: 0.75),
              ),
            ),
            const SizedBox(height: 20),
            OutlinedButton(
              onPressed: () => context.go(RouteNames.explore),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Colors.white54, width: 1.5),
                padding: const EdgeInsets.symmetric(
                    horizontal: 20, vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Explore offers',
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
