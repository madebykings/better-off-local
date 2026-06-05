import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/widgets/section_header.dart';
import '../../events/presentation/widgets/event_card.dart';
import '../../events/providers/events_providers.dart';
import '../../profile/providers/profile_providers.dart';
import '../../region/providers/region_providers.dart';
import '../providers/community_providers.dart';

class CommunityScreen extends ConsumerStatefulWidget {
  const CommunityScreen({super.key});

  @override
  ConsumerState<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends ConsumerState<CommunityScreen> {
  void _refreshAll(String regionId) {
    ref.invalidate(upcomingEventsProvider(regionId));
    ref.invalidate(featuredEventsProvider(regionId));
    ref.invalidate(thisWeekendEventsProvider(regionId));
    ref.invalidate(newRetailersProvider(regionId));
    ref.invalidate(communitySavingsProvider(regionId));
    ref.invalidate(communityHighlightsProvider(regionId));
    ref.invalidate(communityActivityProvider(regionId));
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider).valueOrNull;
    final profileAsync = ref.watch(profileProvider);
    final userId = session?.user.id;

    // Derive region ID from the profile (same pattern as region providers).
    final regionId = profileAsync.valueOrNull?.regionId;

    if (regionId == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      backgroundColor: AppColors.cream,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            _refreshAll(regionId);
            // Await at least one provider to settle before completing.
            try {
              await ref.read(upcomingEventsProvider(regionId).future);
            } catch (_) {}
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // ── Header ───────────────────────────────────────────────
                _CommunityHeader(userId: userId),

                // ── Section 1: Upcoming Events ───────────────────────────
                _UpcomingEventsSection(regionId: regionId),

                // ── Section 2: Featured Events ───────────────────────────
                _FeaturedEventsSection(regionId: regionId),

                // ── Section 3: This Weekend ──────────────────────────────
                _ThisWeekendSection(regionId: regionId),

                // ── Section 4: New Businesses ────────────────────────────
                _NewBusinessesSection(regionId: regionId),

                // ── Section 5: Local Highlights ──────────────────────────
                _LocalHighlightsSection(regionId: regionId),

                // ── Section 6: Community Activity ────────────────────────
                _CommunityActivitySection(regionId: regionId),

                // ── My Impact CTA ────────────────────────────────────────
                _MyImpactCta(userId: userId),

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

class _CommunityHeader extends StatelessWidget {
  const _CommunityHeader({required this.userId});

  final String? userId;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.pagePadding,
        AppSpacing.md,
        AppSpacing.pagePadding,
        AppSpacing.sm,
      ),
      child: Text('Community', style: AppTextStyles.titleLarge),
    );
  }
}

// ---------------------------------------------------------------------------
// Section 1: Upcoming Events
// ---------------------------------------------------------------------------

class _UpcomingEventsSection extends ConsumerWidget {
  const _UpcomingEventsSection({required this.regionId});

  final String regionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(upcomingEventsProvider(regionId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.pagePadding,
          ),
          child: SectionHeader(
            title: 'Upcoming Events',
            action: TextButton(
              onPressed: () => context.push(RouteNames.community),
              child: Text(
                'See all',
                style: AppTextStyles.labelSmall.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
        SizedBox(
          height: 220,
          child: eventsAsync.when(
            loading: () => _HorizontalShimmer(),
            error: (_, __) =>
                const Center(child: Text('Could not load events')),
            data: (events) {
              if (events.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacing.pagePadding,
                  ),
                  child: Text(
                    'No upcoming events',
                    style: AppTextStyles.bodyMedium,
                  ),
                );
              }
              return ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.pagePadding,
                ),
                itemCount: events.length,
                itemBuilder: (context, i) => Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: EventCard(event: events[i]),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: AppSpacing.sectionGap),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Section 2: Featured Events (only shown if any exist)
// ---------------------------------------------------------------------------

class _FeaturedEventsSection extends ConsumerWidget {
  const _FeaturedEventsSection({required this.regionId});

  final String regionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(featuredEventsProvider(regionId));

    return eventsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (events) {
        if (events.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacing.pagePadding,
              ),
              child: SectionHeader(title: 'Featured Events'),
            ),
            ...events.take(3).map(
                  (e) => Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.pagePadding,
                      0,
                      AppSpacing.pagePadding,
                      12,
                    ),
                    child: EventCard(event: e, compact: false),
                  ),
                ),
            const SizedBox(height: AppSpacing.sectionGap),
          ],
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Section 3: This Weekend
// ---------------------------------------------------------------------------

class _ThisWeekendSection extends ConsumerWidget {
  const _ThisWeekendSection({required this.regionId});

  final String regionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(thisWeekendEventsProvider(regionId));

    return eventsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (events) {
        if (events.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacing.pagePadding,
              ),
              child: SectionHeader(title: 'This Weekend'),
            ),
            SizedBox(
              height: 220,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.pagePadding,
                ),
                itemCount: events.length,
                itemBuilder: (context, i) => Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: EventCard(event: events[i]),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sectionGap),
          ],
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Section 4: New Businesses
// ---------------------------------------------------------------------------

class _NewBusinessesSection extends ConsumerWidget {
  const _NewBusinessesSection({required this.regionId});

  final String regionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final retailersAsync = ref.watch(newRetailersProvider(regionId));

    return retailersAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (retailers) {
        if (retailers.isEmpty) return const SizedBox.shrink();
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacing.pagePadding,
              ),
              child: SectionHeader(title: 'New to Better Off Local'),
            ),
            SizedBox(
              height: 112,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.pagePadding,
                ),
                itemCount: retailers.length,
                itemBuilder: (context, i) {
                  final r = retailers[i];
                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: _RetailerLogoCard(retailer: r),
                  );
                },
              ),
            ),
            const SizedBox(height: AppSpacing.sectionGap),
          ],
        );
      },
    );
  }
}

class _RetailerLogoCard extends StatelessWidget {
  const _RetailerLogoCard({required this.retailer});

  final Map<String, dynamic> retailer;

  @override
  Widget build(BuildContext context) {
    final logoUrl = retailer['logo_url'] as String?;
    final name = retailer['name'] as String? ?? '';

    return SizedBox(
      width: 88,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: AppColors.background,
              borderRadius: BorderRadius.circular(12),
              border: const Border.fromBorderSide(
                BorderSide(color: AppColors.border),
              ),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: logoUrl != null
                  ? Image.network(
                      logoUrl,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          const Icon(Icons.storefront_outlined,
                              color: AppColors.border),
                    )
                  : const Icon(Icons.storefront_outlined,
                      color: AppColors.border),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            name,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w500,
              color: AppColors.textPrimary,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Section 5: Local Highlights
// ---------------------------------------------------------------------------

class _LocalHighlightsSection extends ConsumerWidget {
  const _LocalHighlightsSection({required this.regionId});

  final String regionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savingsAsync = ref.watch(communitySavingsProvider(regionId));
    final highlightsAsync = ref.watch(communityHighlightsProvider(regionId));

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
          child: SectionHeader(title: 'Local Highlights'),
        ),

        // Savings metric card
        savingsAsync.when(
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
          data: (savings) {
            if (savings.isEmpty) return const SizedBox.shrink();
            final totalSaved = savings['total_saved'];
            final regionName = savings['region_name'] as String? ?? 'your area';
            final formatted = totalSaved != null
                ? '£${_formatNumber(totalSaved)}'
                : null;
            if (formatted == null) return const SizedBox.shrink();
            return Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.pagePadding,
                0,
                AppSpacing.pagePadding,
                16,
              ),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.all(AppSpacing.md),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      formatted,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'saved by members in $regionName',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.85),
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),

        // Highlights grid (up to 3)
        highlightsAsync.when(
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
          data: (highlights) {
            if (highlights.isEmpty) return const SizedBox.shrink();
            final items = highlights.take(3).toList();
            return Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.pagePadding,
              ),
              child: GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                  childAspectRatio: 1.5,
                ),
                itemCount: items.length,
                itemBuilder: (context, i) {
                  final item = items[i] as Map<String, dynamic>? ?? {};
                  return _HighlightCard(data: item);
                },
              ),
            );
          },
        ),

        const SizedBox(height: AppSpacing.sectionGap),
      ],
    );
  }

  String _formatNumber(dynamic value) {
    final num = double.tryParse(value.toString()) ?? 0;
    if (num >= 1000) {
      return '${(num / 1000).toStringAsFixed(1)}k'
          .replaceAll('.0k', 'k');
    }
    return num.toStringAsFixed(0);
  }
}

class _HighlightCard extends StatelessWidget {
  const _HighlightCard({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = data['title'] as String? ?? '';
    final value = data['value']?.toString() ?? '';

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
        border: const Border.fromBorderSide(
          BorderSide(color: AppColors.border),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
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
// Section 6: Community Activity
// ---------------------------------------------------------------------------

class _CommunityActivitySection extends ConsumerWidget {
  const _CommunityActivitySection({required this.regionId});

  final String regionId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activityAsync = ref.watch(communityActivityProvider(regionId));

    return activityAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (activity) {
        if (activity.isEmpty) return const SizedBox.shrink();
        final shown = activity.take(8).toList();
        final hasMore = activity.length > 8;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(
                horizontal: AppSpacing.pagePadding,
              ),
              child: SectionHeader(title: "What's Happening"),
            ),
            ...shown.map(
              (item) {
                final data = item as Map<String, dynamic>? ?? {};
                return _ActivityItem(data: data);
              },
            ),
            if (hasMore)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.pagePadding,
                ),
                child: TextButton(
                  onPressed: () {},
                  child: const Text('View all'),
                ),
              ),
            const SizedBox(height: AppSpacing.sectionGap),
          ],
        );
      },
    );
  }
}

class _ActivityItem extends StatelessWidget {
  const _ActivityItem({required this.data});

  final Map<String, dynamic> data;

  @override
  Widget build(BuildContext context) {
    final title = data['title'] as String? ?? '';
    final subtitle = data['subtitle'] as String? ?? '';
    final timeStr = data['created_at'] as String?;
    final iconName = data['icon'] as String?;

    String relativeTime = '';
    if (timeStr != null) {
      try {
        final dt = DateTime.parse(timeStr);
        final diff = DateTime.now().difference(dt);
        if (diff.inMinutes < 60) {
          relativeTime = '${diff.inMinutes}m ago';
        } else if (diff.inHours < 24) {
          relativeTime = '${diff.inHours}h ago';
        } else {
          relativeTime = '${diff.inDays}d ago';
        }
      } catch (_) {}
    }

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppColors.background,
        child: Icon(
          _iconFromName(iconName),
          size: 18,
          color: AppColors.primary,
        ),
      ),
      title: Text(
        title,
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w500,
          color: AppColors.textPrimary,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text(
        subtitle,
        style: const TextStyle(
          fontSize: 12,
          color: AppColors.textSecondary,
        ),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: Text(
        relativeTime,
        style: const TextStyle(
          fontSize: 11,
          color: AppColors.textDisabled,
        ),
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.pagePadding,
        vertical: 0,
      ),
    );
  }

  IconData _iconFromName(String? name) {
    return switch (name) {
      'event' => Icons.event_outlined,
      'offer' => Icons.local_offer_outlined,
      'retailer' => Icons.storefront_outlined,
      'redemption' => Icons.qr_code_outlined,
      'milestone' => Icons.emoji_events_outlined,
      _ => Icons.notifications_outlined,
    };
  }
}

// ---------------------------------------------------------------------------
// My Impact CTA
// ---------------------------------------------------------------------------

class _MyImpactCta extends StatelessWidget {
  const _MyImpactCta({required this.userId});

  final String? userId;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
      child: GestureDetector(
        onTap: () => context.push(RouteNames.memberImpact),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
            border: const Border.fromBorderSide(
              BorderSide(color: AppColors.border),
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primaryLight.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.bar_chart_outlined,
                  color: AppColors.primary,
                  size: 22,
                ),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'See your impact',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    SizedBox(height: 2),
                    Text(
                      'Track your savings and local contributions',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                color: AppColors.textSecondary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shimmer placeholder for horizontal scroll loading state
// ---------------------------------------------------------------------------

class _HorizontalShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      scrollDirection: Axis.horizontal,
      padding:
          const EdgeInsets.symmetric(horizontal: AppSpacing.pagePadding),
      itemCount: 3,
      itemBuilder: (context, i) => Padding(
        padding: const EdgeInsets.only(right: 12),
        child: Container(
          width: 176,
          decoration: BoxDecoration(
            color: AppColors.border,
            borderRadius: BorderRadius.circular(12),
          ),
        ),
      ),
    );
  }
}
