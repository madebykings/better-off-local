import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/primary_button.dart';
import '../../profile/providers/profile_providers.dart';
import '../domain/membership.dart';
import '../providers/membership_providers.dart';
import 'membership_controller.dart';

class MembershipCardScreen extends ConsumerWidget {
  const MembershipCardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final membershipAsync = ref.watch(currentMembershipProvider);
    final profileAsync = ref.watch(profileProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My Card')),
      body: membershipAsync.when(
        loading: () => const LoadingIndicator(),
        error: (e, _) => ErrorState(message: e.toString()),
        data: (membership) {
          if (membership == null || !membership.isEntitled) {
            return _PaywallPrompt(
              onSubscribe: () => context.push(RouteNames.paywall),
            );
          }

          final memberName = profileAsync.valueOrNull?.fullName ?? 'Member';
          return _ActiveMembershipCard(
            memberName: memberName,
            membership: membership,
            onRefresh: () => ref
                .read(membershipControllerProvider.notifier)
                .refreshMembership(),
          );
        },
      ),
    );
  }
}

class _ActiveMembershipCard extends StatelessWidget {
  const _ActiveMembershipCard({
    required this.memberName,
    required this.membership,
    required this.onRefresh,
  });

  final String memberName;
  final Membership membership;
  final VoidCallback onRefresh;

  String _formatDate(DateTime? dt) {
    if (dt == null) return '—';
    return DateFormat('d MMM yyyy').format(dt.toLocal());
  }

  String _planLabel(MembershipPlanInterval? interval) =>
      interval == MembershipPlanInterval.annual ? 'Annual' : 'Monthly';

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.pagePadding),
        child: Column(
          children: [
            const SizedBox(height: AppSpacing.md),

            // Membership card visual
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, AppColors.primaryLight],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(AppSpacing.radiusLg),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withOpacity(0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Better Off Local',
                        style: AppTextStyles.titleMedium.copyWith(
                          color: Colors.white70,
                          fontWeight: FontWeight.w400,
                        ),
                      ),
                      _StatusBadge(status: membership.status),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    memberName,
                    style: AppTextStyles.headlineMedium.copyWith(
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    '${_planLabel(membership.planInterval)} member',
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: Colors.white60,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Renews',
                            style: AppTextStyles.labelSmall.copyWith(
                              color: Colors.white54,
                            ),
                          ),
                          Text(
                            _formatDate(membership.currentPeriodEnd),
                            style: AppTextStyles.bodyMedium.copyWith(
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                      if (membership.cancelAtPeriodEnd)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.warning.withOpacity(0.2),
                            borderRadius:
                                BorderRadius.circular(AppSpacing.radiusSm),
                            border: Border.all(
                              color: AppColors.warning.withOpacity(0.5),
                            ),
                          ),
                          child: Text(
                            'Cancels at period end',
                            style: AppTextStyles.labelSmall.copyWith(
                              color: AppColors.warning,
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.xl),

            // QR placeholder — replaced in brief 10 (Redemption Tokens).
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
              decoration: BoxDecoration(
                color: AppColors.surface,
                border: Border.all(color: AppColors.border),
                borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
              ),
              child: Column(
                children: [
                  const Icon(
                    Icons.qr_code_2,
                    size: 80,
                    color: AppColors.textDisabled,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Show this at checkout to redeem',
                    style: AppTextStyles.bodyMedium,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'QR code generation coming soon',
                    style: AppTextStyles.labelSmall,
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.lg),
            Text(
              'Pull down to refresh your membership status.',
              style: AppTextStyles.labelSmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});
  final MembershipStatus status;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (status) {
      MembershipStatus.active => ('Active', AppColors.success),
      MembershipStatus.trialing => ('Trial', AppColors.info),
      MembershipStatus.pastDue => ('Past due', AppColors.warning),
      MembershipStatus.cancelled => ('Cancelled', AppColors.error),
      MembershipStatus.expired => ('Expired', AppColors.error),
      MembershipStatus.inactive => ('Inactive', AppColors.textDisabled),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.15),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}

class _PaywallPrompt extends StatelessWidget {
  const _PaywallPrompt({required this.onSubscribe});
  final VoidCallback onSubscribe;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(
            Icons.card_membership,
            size: 72,
            color: AppColors.textDisabled,
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'No active membership',
            style: AppTextStyles.headlineMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Subscribe to access exclusive local discounts\nand get your digital membership card.',
            style: AppTextStyles.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),
          PrimaryButton(
            label: 'See membership plans',
            onPressed: onSubscribe,
          ),
        ],
      ),
    );
  }
}
