import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/primary_button.dart';
import '../providers/membership_providers.dart';

/// Shown after a successful Stripe Checkout redirect.
/// Refreshes membership from the server before showing confirmation.
class SubscriptionSuccessScreen extends ConsumerStatefulWidget {
  const SubscriptionSuccessScreen({super.key});

  @override
  ConsumerState<SubscriptionSuccessScreen> createState() =>
      _SubscriptionSuccessScreenState();
}

class _SubscriptionSuccessScreenState
    extends ConsumerState<SubscriptionSuccessScreen> {
  @override
  void initState() {
    super.initState();
    // Refresh server-side membership state on arrival.
    // Stripe webhook may have already processed; if not, user can pull-refresh
    // from the membership card screen.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.invalidate(currentMembershipProvider);
    });
  }

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
                'You're a member!',
                style: AppTextStyles.displayLarge,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Your subscription is active. Start discovering\nexclusive local deals in Clackmannanshire.',
                style: AppTextStyles.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.xxl),
              PrimaryButton(
                label: 'Start exploring',
                onPressed: () => context.go(RouteNames.home),
              ),
              const SizedBox(height: AppSpacing.md),
              TextButton(
                onPressed: () => context.go(RouteNames.card),
                child: const Text('View my membership card'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
