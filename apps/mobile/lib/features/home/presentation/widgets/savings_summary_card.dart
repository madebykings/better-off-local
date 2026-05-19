import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';

/// Community banner — replaces the savings counter card on the home screen.
/// Reinforces the local community positioning of Better Off Local.
class SavingsSummaryCard extends StatelessWidget {
  const SavingsSummaryCard({super.key});

  @override
  Widget build(BuildContext context) {
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
              'Support the businesses that make Clackmannanshire great.',
              style: AppTextStyles.bodyMedium.copyWith(
                color: Colors.white.withOpacity(0.75),
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
