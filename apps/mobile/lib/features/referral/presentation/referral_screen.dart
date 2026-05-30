import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/supabase_provider.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../domain/referral.dart';
import '../providers/referral_providers.dart';

class ReferralScreen extends ConsumerWidget {
  const ReferralScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final client = ref.watch(supabaseClientProvider);
    final profileId = client.auth.currentUser?.id;

    if (profileId == null) {
      return const Scaffold(body: Center(child: Text('Sign in required')));
    }

    final statsAsync = ref.watch(referralStatsProvider(profileId));

    return Scaffold(
      backgroundColor: AppColors.cream,
      appBar: AppBar(
        backgroundColor: AppColors.cream,
        elevation: 0,
        title: const Text('Refer a friend'),
      ),
      body: statsAsync.when(
        loading: () => const Center(child: LoadingIndicator()),
        error: (e, _) => ErrorState(message: e.toString()),
        data: (stats) {
          if (stats == null) {
            return const Center(child: Text('Unable to load referral info.'));
          }
          return _ReferralBody(stats: stats, profileId: profileId);
        },
      ),
    );
  }
}

class _ReferralBody extends StatelessWidget {
  const _ReferralBody({required this.stats, required this.profileId});

  final ReferralStats stats;
  final String profileId;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero card
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.primaryLight],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.card_giftcard_outlined,
                    color: Colors.white70, size: 32),
                const SizedBox(height: 14),
                const Text(
                  'Earn a month free',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Invite friends to join Better Off Local. When they become a paying member, you earn a free month of membership.',
                  style: TextStyle(color: Colors.white70, fontSize: 14, height: 1.45),
                ),
                const SizedBox(height: 20),
                // Referral code display
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'YOUR CODE',
                              style: TextStyle(
                                color: Colors.white60,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 1.2,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              stats.code,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 3,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy_outlined,
                            color: Colors.white70, size: 20),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: stats.referralUrl));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Referral link copied'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        },
                        tooltip: 'Copy link',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                // Share button
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _share(stats),
                    icon: const Icon(Icons.share_outlined, size: 18),
                    label: const Text('Share your link'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Stats row
          Row(
            children: [
              _StatTile(
                label: 'Invited',
                value: '${stats.invitedCount}',
              ),
              const SizedBox(width: 12),
              _StatTile(
                label: 'Joined',
                value: '${stats.convertedCount}',
              ),
              const SizedBox(width: 12),
              _StatTile(
                label: 'Rewards',
                value: stats.confirmedRewards > 0
                    ? stats.totalRewardDisplay
                    : '${stats.confirmedRewards}',
              ),
            ],
          ),

          if (stats.pendingRewards > 0) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.amber.shade200),
              ),
              child: Row(
                children: [
                  const Icon(Icons.hourglass_top_outlined,
                      size: 16, color: Colors.amber),
                  const SizedBox(width: 8),
                  Text(
                    '${stats.pendingRewards} reward${stats.pendingRewards == 1 ? '' : 's'} pending — confirmed after 7 days',
                    style: const TextStyle(fontSize: 12, color: Colors.amber),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 24),

          // How it works
          Text('How it works', style: AppTextStyles.titleMedium),
          const SizedBox(height: 12),
          const _HowItWorksStep(
            icon: Icons.share_outlined,
            title: 'Share your link',
            body: 'Send your personal referral link to a friend.',
          ),
          const SizedBox(height: 10),
          const _HowItWorksStep(
            icon: Icons.person_add_outlined,
            title: 'Friend joins',
            body: 'They download the app and sign up using your link.',
          ),
          const SizedBox(height: 10),
          const _HowItWorksStep(
            icon: Icons.card_giftcard_outlined,
            title: 'You earn a free month',
            body: 'Once their first payment clears, we credit your next month free.',
          ),

          const SizedBox(height: 20),
          Text(
            'Rewards apply to your next billing cycle. One reward per friend. Up to 5 rewards per 30 days.',
            style: AppTextStyles.bodyMedium.copyWith(
              fontSize: 11,
              color: AppColors.textDisabled,
            ),
          ),
        ],
      ),
    );
  }

  void _share(ReferralStats stats) {
    Share.share(
      'I\'ve been saving money at local businesses with Better Off Local — join with my link and support local too!\n${stats.referralUrl}',
      subject: 'Join Better Off Local',
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HowItWorksStep extends StatelessWidget {
  const _HowItWorksStep({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: AppColors.primary, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: AppTextStyles.bodyMedium
                      .copyWith(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 2),
              Text(body,
                  style: AppTextStyles.bodyMedium
                      .copyWith(fontSize: 12, color: AppColors.textSecondary)),
            ],
          ),
        ),
      ],
    );
  }
}
