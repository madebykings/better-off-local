import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/primary_button.dart';

/// Shown when a redemption attempt was rejected, expired, or rule-blocked.
/// [reason] is the human-readable rejection message from the server.
class RedemptionFailedScreen extends StatelessWidget {
  const RedemptionFailedScreen({super.key, this.reason});

  final String? reason;

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
                Icons.cancel_outlined,
                size: 88,
                color: AppColors.error,
              ),
              const SizedBox(height: AppSpacing.lg),
              const Text(
                'Redemption unsuccessful',
                style: AppTextStyles.displayLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                reason ?? 'Your redemption could not be completed.',
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
