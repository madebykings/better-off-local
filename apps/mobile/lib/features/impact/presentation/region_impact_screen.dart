import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/supabase_provider.dart';
import '../../region/providers/region_providers.dart';
import '../domain/region_impact.dart';
import '../providers/impact_providers.dart';

class RegionImpactScreen extends ConsumerWidget {
  const RegionImpactScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userId = ref.watch(supabaseClientProvider).auth.currentUser?.id;
    if (userId == null) {
      return Scaffold(
        backgroundColor: AppColors.cream,
        appBar: AppBar(
          backgroundColor: AppColors.cream,
          elevation: 0,
          title: const Text('Region Impact'),
        ),
        body: const Center(child: Text('Not signed in.')),
      );
    }

    final regionIdAsync = ref.watch(memberRegionIdProvider(userId));

    return regionIdAsync.when(
      loading: () => Scaffold(
        backgroundColor: AppColors.cream,
        appBar: AppBar(
          backgroundColor: AppColors.cream,
          elevation: 0,
          title: const Text('Region Impact'),
        ),
        body: const Center(child: CircularProgressIndicator()),
      ),
      error: (_, __) => Scaffold(
        backgroundColor: AppColors.cream,
        appBar: AppBar(
          backgroundColor: AppColors.cream,
          elevation: 0,
          title: const Text('Region Impact'),
        ),
        body: _ErrorState(
          message: 'Could not load region data.',
          onRetry: () => ref.invalidate(memberRegionIdProvider(userId)),
        ),
      ),
      data: (regionId) {
        if (regionId == null) {
          return Scaffold(
            backgroundColor: AppColors.cream,
            appBar: AppBar(
              backgroundColor: AppColors.cream,
              elevation: 0,
              title: const Text('Region Impact'),
            ),
            body: const Center(
              child: Text('No region selected.'),
            ),
          );
        }
        return _RegionImpactView(regionId: regionId);
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Region impact view — requires a known regionId
// ---------------------------------------------------------------------------

class _RegionImpactView extends ConsumerWidget {
  const _RegionImpactView({required this.regionId});
  final String regionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final regionStatsAsync = ref.watch(regionStatsProvider(regionId));
    final impactAsync = ref.watch(regionImpactProvider(regionId));

    final regionName = regionStatsAsync.valueOrNull?.name;
    final title = regionName != null ? '$regionName Impact' : 'Region Impact';

    return Scaffold(
      backgroundColor: AppColors.cream,
      appBar: AppBar(
        backgroundColor: AppColors.cream,
        elevation: 0,
        title: Text(title),
      ),
      body: impactAsync.when(
        loading: () => const _LoadingShimmer(),
        error: (_, __) => _ErrorState(
          message: 'Unable to load region impact data.',
          onRetry: () => ref.invalidate(regionImpactProvider(regionId)),
        ),
        data: (impact) => _ImpactBody(
          impact: impact,
          onRefresh: () async {
            ref.invalidate(regionImpactProvider(regionId));
          },
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

class _ImpactBody extends StatelessWidget {
  const _ImpactBody({
    required this.impact,
    required this.onRefresh,
  });

  final RegionImpact impact;
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
        children: [
          // ── Hero savings card ──────────────────────────────────────────────
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
                Text(
                  impact.formattedSavings,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 48,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -1,
                  ),
                ),
                const SizedBox(height: 4),
                const Text(
                  'total saved by members',
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // ── Key metrics grid ───────────────────────────────────────────────
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 1.4,
            children: [
              _MetricCell(
                value: '${impact.activeMembers}',
                label: 'Members active',
                color: AppColors.primary,
              ),
              _MetricCell(
                value: '${impact.businessesParticipating}',
                label: 'Businesses participating',
                color: const Color(0xFF059669),
              ),
              _MetricCell(
                value: '${impact.eventsHosted}',
                label: 'Events hosted',
                color: const Color(0xFF3B82F6),
              ),
              _MetricCell(
                value: '${impact.loyaltyCompletions}',
                label: 'Loyalty cards completed',
                color: const Color(0xFF7C3AED),
              ),
              _MetricCell(
                value: '${impact.referralsGenerated}',
                label: 'Referrals generated',
                color: const Color(0xFFF59E0B),
              ),
              _MetricCell(
                value: '${impact.totalRedemptions}',
                label: 'Total redemptions',
                color: AppColors.primaryLight,
              ),
            ],
          ),

          // ── Top businesses ─────────────────────────────────────────────────
          if (impact.topBusinesses.isNotEmpty) ...[
            const SizedBox(height: 24),
            Text('Top Businesses', style: AppTextStyles.titleMedium),
            const SizedBox(height: 12),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: impact.topBusinesses.length > 5
                    ? 5
                    : impact.topBusinesses.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, i) {
                  final biz = impact.topBusinesses[i];
                  final name = biz['name'] as String? ?? 'Business';
                  final count = (biz['redemption_count'] as num?)?.toInt() ?? 0;
                  return ListTile(
                    dense: true,
                    leading: Container(
                      width: 28,
                      height: 28,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        '${i + 1}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      ),
                    ),
                    title: Text(
                      name,
                      style: const TextStyle(fontSize: 14),
                    ),
                    trailing: Text(
                      '$count redemptions',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  );
                },
              ),
            ),
          ],

          // ── Top categories ─────────────────────────────────────────────────
          if (impact.topCategories.isNotEmpty) ...[
            const SizedBox(height: 24),
            Text('Top Categories', style: AppTextStyles.titleMedium),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: impact.topCategories.map((cat) {
                final name = cat['category'] as String? ?? '';
                final count = (cat['count'] as num?)?.toInt() ?? 0;
                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: AppColors.primary.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Text(
                    '$name ($count)',
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: AppColors.primary,
                    ),
                  ),
                );
              }).toList(),
            ),
          ],

          // ── Monthly trend ──────────────────────────────────────────────────
          if (impact.monthlyRedemptions.isNotEmpty) ...[
            const SizedBox(height: 24),
            Text('Monthly Activity', style: AppTextStyles.titleMedium),
            const SizedBox(height: 12),
            _MonthlyTrend(monthlyRedemptions: impact.monthlyRedemptions),
          ],

          // ── Community milestones ───────────────────────────────────────────
          const SizedBox(height: 24),
          _MilestoneBanner(
            icon: Icons.local_offer_outlined,
            value: '${impact.totalRedemptions}',
            label: 'offers redeemed across the community',
          ),
          const SizedBox(height: 12),
          _MilestoneBanner(
            icon: Icons.savings_outlined,
            value: impact.formattedSavings,
            label: 'saved by members shopping local',
          ),

          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Metric cell
// ---------------------------------------------------------------------------

class _MetricCell extends StatelessWidget {
  const _MetricCell({
    required this.value,
    required this.label,
    required this.color,
  });

  final String value;
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Monthly trend bar chart (no external library)
// ---------------------------------------------------------------------------

class _MonthlyTrend extends StatelessWidget {
  const _MonthlyTrend({required this.monthlyRedemptions});
  final List<Map<String, dynamic>> monthlyRedemptions;

  @override
  Widget build(BuildContext context) {
    if (monthlyRedemptions.isEmpty) return const SizedBox.shrink();

    final counts = monthlyRedemptions
        .map((m) => (m['count'] as num?)?.toInt() ?? 0)
        .toList();
    final maxCount = counts.reduce((a, b) => a > b ? a : b);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          LayoutBuilder(
            builder: (context, constraints) {
              final barWidth = (constraints.maxWidth - 8.0 * (monthlyRedemptions.length - 1)) /
                  monthlyRedemptions.length;
              return Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: List.generate(monthlyRedemptions.length, (i) {
                  final count = counts[i];
                  final heightFraction = maxCount > 0 ? count / maxCount : 0.0;
                  final barHeight = 60.0 * heightFraction + 4.0;
                  return Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(left: i == 0 ? 0 : 4),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            height: barHeight,
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.7),
                              borderRadius: BorderRadius.circular(3),
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              );
            },
          ),
          const SizedBox(height: 6),
          Row(
            children: List.generate(monthlyRedemptions.length, (i) {
              final month = monthlyRedemptions[i]['month'] as String? ?? '';
              // Shorten to first 3 chars if it's a month name/label
              final shortLabel = month.length > 3 ? month.substring(0, 3) : month;
              return Expanded(
                child: Text(
                  shortLabel,
                  style: const TextStyle(
                    fontSize: 9,
                    color: AppColors.textDisabled,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Milestone banner
// ---------------------------------------------------------------------------

class _MilestoneBanner extends StatelessWidget {
  const _MilestoneBanner({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.15)),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textPrimary,
                ),
                children: [
                  TextSpan(
                    text: value,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                  TextSpan(text: ' $label'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Loading shimmer
// ---------------------------------------------------------------------------

class _LoadingShimmer extends StatelessWidget {
  const _LoadingShimmer();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      children: [
        _ShimmerBox(height: 140, borderRadius: 16),
        const SizedBox(height: 20),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1.4,
          children: List.generate(
            6,
            (_) => _ShimmerBox(height: 80, borderRadius: 12),
          ),
        ),
      ],
    );
  }
}

class _ShimmerBox extends StatefulWidget {
  const _ShimmerBox({required this.height, required this.borderRadius});
  final double height;
  final double borderRadius;

  @override
  State<_ShimmerBox> createState() => _ShimmerBoxState();
}

class _ShimmerBoxState extends State<_ShimmerBox>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.4, end: 0.9).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, _) => Container(
        height: widget.height,
        decoration: BoxDecoration(
          color: AppColors.border.withValues(alpha: _animation.value),
          borderRadius: BorderRadius.circular(widget.borderRadius),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.border),
            const SizedBox(height: 16),
            Text(message, style: AppTextStyles.bodyMedium, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: onRetry,
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}
