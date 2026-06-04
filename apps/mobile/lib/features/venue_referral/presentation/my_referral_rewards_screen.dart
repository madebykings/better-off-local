import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/supabase_provider.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../domain/venue_referral_status.dart';
import '../providers/venue_referral_providers.dart';

const _amber = Color(0xFFD97706);
const _amberLight = Color(0xFFFEF3C7);

class MyReferralRewardsScreen extends ConsumerWidget {
  const MyReferralRewardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileId = ref.watch(supabaseClientProvider).auth.currentUser?.id;
    if (profileId == null) {
      return const Scaffold(body: Center(child: Text('Sign in required')));
    }

    final rewardsAsync = ref.watch(myVenueReferralRewardsProvider(profileId));

    return Scaffold(
      backgroundColor: AppColors.cream,
      appBar: AppBar(
        backgroundColor: AppColors.cream,
        elevation: 0,
        title: const Text('My referral rewards'),
      ),
      body: rewardsAsync.when(
        loading: () => const Center(child: LoadingIndicator()),
        error: (e, _) => ErrorState(message: e.toString()),
        data: (rewards) {
          if (rewards.isEmpty) {
            return _EmptyState();
          }
          final unlocked = rewards.where((r) => r.isUnlocked).toList();
          final redeemed = rewards.where((r) => !r.isUnlocked).toList();

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (unlocked.isNotEmpty) ...[
                _SectionHeader(
                  icon: Icons.card_giftcard_outlined,
                  label: 'Ready to use',
                  count: unlocked.length,
                ),
                const SizedBox(height: 8),
                ...unlocked.map((r) => _RewardCard(reward: r)),
                const SizedBox(height: 24),
              ],
              if (redeemed.isNotEmpty) ...[
                _SectionHeader(
                  icon: Icons.check_circle_outline,
                  label: 'Redeemed',
                  count: redeemed.length,
                ),
                const SizedBox(height: 8),
                ...redeemed.map((r) => _RewardCard(reward: r)),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.people_outline, size: 56, color: AppColors.textDisabled),
            const SizedBox(height: 16),
            Text(
              'No referral rewards yet',
              style: AppTextStyles.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              'Share a venue offer with a friend. When they visit for the first time, your reward unlocks.',
              style: AppTextStyles.bodyMedium.copyWith(
                color: AppColors.textSecondary,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({
    required this.icon,
    required this.label,
    required this.count,
  });
  final IconData icon;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 16, color: AppColors.textSecondary),
        const SizedBox(width: 6),
        Text(
          '$label ($count)',
          style: AppTextStyles.labelSmall.copyWith(
            color: AppColors.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _RewardCard extends StatelessWidget {
  const _RewardCard({required this.reward});
  final VenueReferralReward reward;

  String _fmtDate(DateTime dt) =>
      DateFormat('d MMM yyyy').format(dt.toLocal());

  @override
  Widget build(BuildContext context) {
    final isUnlocked = reward.isUnlocked;

    return GestureDetector(
      onTap: isUnlocked
          ? () => context.push(
                RouteNames.redemptionQR.replaceAll(':offerId', reward.offerId),
              )
          : null,
      child: Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isUnlocked ? _amberLight : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isUnlocked
              ? _amber.withValues(alpha: 0.35)
              : AppColors.border,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isUnlocked
                  ? _amber.withValues(alpha: 0.15)
                  : AppColors.border,
              shape: BoxShape.circle,
            ),
            child: Icon(
              isUnlocked ? Icons.card_giftcard_outlined : Icons.check_circle_outline,
              size: 20,
              color: isUnlocked ? _amber : AppColors.success,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (reward.retailerName.isNotEmpty)
                  Text(
                    reward.retailerName,
                    style: AppTextStyles.labelSmall.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                Text(
                  reward.rewardTitle ?? reward.offerTitle,
                  style: AppTextStyles.bodyLarge.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                if (isUnlocked)
                  Text(
                    'Earned ${_fmtDate(reward.unlockedAt)} · tap to redeem',
                    style: AppTextStyles.labelSmall.copyWith(
                      color: _amber,
                    ),
                  )
                else
                  Text(
                    'Redeemed ${_fmtDate(reward.redeemedAt!)}',
                    style: AppTextStyles.labelSmall.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
              ],
            ),
          ),
          if (isUnlocked)
            const Icon(Icons.chevron_right, size: 18, color: AppColors.textDisabled),
        ],
      ),
    ));
  }
}
