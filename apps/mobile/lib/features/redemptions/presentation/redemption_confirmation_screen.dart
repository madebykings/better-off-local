import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/primary_button.dart';

/// Shown after a successful redemption is confirmed.
/// [offerTitle] is passed as an extra from the history screen or router.
class RedemptionConfirmationScreen extends StatelessWidget {
  const RedemptionConfirmationScreen({super.key, this.offerTitle});

  final String? offerTitle;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.pagePadding),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(
                Icons.check_circle_outline,
                size: 88,
                color: AppColors.success,
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                'Offer redeemed!',
                style: AppTextStyles.displayLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              if (offerTitle != null) ...[
                Text(
                  offerTitle!,
                  style: AppTextStyles.titleMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              Text(
                'Your redemption has been recorded. Enjoy your offer!',
                style: AppTextStyles.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xxl),
              PrimaryButton(
                label: 'Back to home',
                onPressed: () => context.go(RouteNames.home),
              ),
              const SizedBox(height: AppSpacing.md),
              TextButton(
                onPressed: () => context.go(RouteNames.redemptionHistory),
                child: const Text('View redemption history'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
