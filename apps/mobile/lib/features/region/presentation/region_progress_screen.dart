import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/supabase_provider.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../domain/region.dart';
import '../providers/region_providers.dart';

class RegionProgressScreen extends ConsumerWidget {
  const RegionProgressScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final client = ref.watch(supabaseClientProvider);
    final userId = client.auth.currentUser?.id;

    return Scaffold(
      backgroundColor: AppColors.cream,
      appBar: AppBar(
        backgroundColor: AppColors.cream,
        elevation: 0,
        title: const Text('My community'),
      ),
      body: _RegionProgressBody(userId: userId),
    );
  }
}

class _RegionProgressBody extends ConsumerWidget {
  const _RegionProgressBody({this.userId});
  final String? userId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (userId == null) {
      return const Center(child: Text('Sign in required'));
    }

    final regionIdAsync = ref.watch(_memberRegionIdProvider(userId!));

    return regionIdAsync.when(
      loading: () => const LoadingIndicator(),
      error: (_, __) => const Center(child: Text('Could not load region.')),
      data: (regionId) {
        if (regionId == null) {
          return const Center(
            child: Text('No region selected. Update in Account settings.'),
          );
        }
        return _RegionStatsView(regionId: regionId);
      },
    );
  }
}

final _memberRegionIdProvider = FutureProvider.family<String?, String>(
  (ref, userId) async {
    final client = ref.watch(supabaseClientProvider);
    final row = await client
        .from('profiles')
        .select('region_id')
        .eq('id', userId)
        .maybeSingle();
    return row?['region_id'] as String?;
  },
);

class _RegionStatsView extends ConsumerWidget {
  const _RegionStatsView({required this.regionId});
  final String regionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final statsAsync = ref.watch(regionStatsProvider(regionId));

    return statsAsync.when(
      loading: () => const LoadingIndicator(),
      error: (_, __) => const Center(child: Text('Could not load region stats.')),
      data: (region) {
        if (region == null) {
          return const Center(child: Text('Region not found.'));
        }
        return _StatsBody(region: region);
      },
    );
  }
}

class _StatsBody extends StatelessWidget {
  const _StatsBody({required this.region});
  final Region region;

  @override
  Widget build(BuildContext context) {
    final pct = (region.progressFraction * 100).round();
    final remaining = (region.memberThreshold - region.activeMemberCount)
        .clamp(0, region.memberThreshold);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Hero card ─────────────────────────────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(22),
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
                Text(
                  region.name,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'Supporting local businesses',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Every member helps independent businesses thrive and unlocks better local offers for the whole community.',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 13,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 20),

                // Progress bar
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '${region.activeMemberCount} members',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                      ),
                    ),
                    Text(
                      'Goal: ${region.memberThreshold}',
                      style: const TextStyle(
                        color: Colors.white60,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: region.progressFraction,
                    backgroundColor: Colors.white.withValues(alpha: 0.2),
                    valueColor: const AlwaysStoppedAnimation(Colors.white),
                    minHeight: 8,
                  ),
                ),
                const SizedBox(height: 8),

                if (region.hasReachedThreshold)
                  const Text(
                    'The community is growing — more local deals incoming.',
                    style: TextStyle(color: Colors.white, fontSize: 12),
                  )
                else
                  Text(
                    '$remaining more members until stronger local deals begin unlocking.',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                const SizedBox(height: 4),
                Text(
                  '$pct% of the way there',
                  style: const TextStyle(
                    color: Colors.white54,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // ── Stats row ─────────────────────────────────────────────────────
          Row(
            children: [
              _StatCard(
                icon: Icons.store_outlined,
                label: 'Retailers',
                value: '${region.activeRetailerCount}',
              ),
              const SizedBox(width: 12),
              _StatCard(
                icon: Icons.local_offer_outlined,
                label: 'Live offers',
                value: '${region.liveOfferCount}',
              ),
              const SizedBox(width: 12),
              _StatCard(
                icon: Icons.people_outline,
                label: 'Members',
                value: '${region.activeMemberCount}',
              ),
            ],
          ),

          const SizedBox(height: 16),

          // ── Referral integration ──────────────────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Invite friends, unlock more offers',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  remaining > 0
                      ? 'Invite friends and help ${region.name} unlock stronger local deals sooner. You\'ll both earn a free month of membership.'
                      : 'Keep inviting friends — every new member keeps money in the community and helps independent businesses thrive.',
                  style: const TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.push(RouteNames.referral),
                        icon: const Icon(Icons.card_giftcard_outlined, size: 16),
                        label: const Text('Refer a friend'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.primary,
                          side: const BorderSide(color: AppColors.primary),
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => _shareRegion(region),
                        icon: const Icon(Icons.share_outlined, size: 16),
                        label: const Text('Share link'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 11),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // ── Community tagline ─────────────────────────────────────────────
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.07),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'Together we\'re keeping money in ${region.name} and helping independent businesses thrive.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.primary,
                height: 1.4,
              ),
            ),
          ),

          const SizedBox(height: 16),

          // ── Why community size matters ────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.15)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'What your membership does',
                  style: AppTextStyles.titleMedium.copyWith(fontSize: 14),
                ),
                const SizedBox(height: 8),
                const _BulletPoint('Keeps money circulating in your local economy'),
                const _BulletPoint('Helps independent businesses attract more customers'),
                const _BulletPoint('Encourages more businesses to join and offer exclusive deals'),
                const _BulletPoint('Makes your membership more valuable as the community grows'),
              ],
            ),
          ),

          const SizedBox(height: 8),
        ],
      ),
    );
  }

  void _shareRegion(Region region) {
    Share.share(
      'I\'m part of Better Off Local in ${region.name} — supporting local businesses and saving money at the same time. '
      '${region.activeMemberCount} members and growing!\n'
      'Join us: https://betterofflocal.com/join',
      subject: 'Join Better Off Local in ${region.name}',
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Icon(icon, color: AppColors.primary, size: 20),
            const SizedBox(height: 6),
            Text(
              value,
              style: const TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                fontSize: 10,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BulletPoint extends StatelessWidget {
  const _BulletPoint(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 5),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 1),
            child: Icon(Icons.check_circle_outline,
                size: 13, color: AppColors.primary),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
