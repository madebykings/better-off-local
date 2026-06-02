import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../retailers/domain/retailer.dart';
import '../../../retailers/presentation/widgets/business_card.dart';
import '../../home_providers.dart';

class FeaturedRetailersSection extends ConsumerWidget {
  const FeaturedRetailersSection({super.key});

  /// Derives the single most significant badge for a retailer.
  ///
  /// Priority: Featured > Member Favourite > Trending > New.
  /// Thresholds are intentionally low for a hyper-local launch.
  /// Returns the single most prominent badge for a retailer card.
  ///
  /// Priority: Featured > Member Favourite > Trending > New.
  ///
  /// Thresholds are calibrated for a hyper-local MVP launch:
  ///   - Trending: 5+ redemptions in the last 30 days (retailer-level;
  ///     venue-level impossible because many redemption rows have no location
  ///     tag. Equivalent to venue-level for single-venue retailers.)
  ///   - Member Favourite: 3+ saves (retailer-level; favourites table has no
  ///     location_id column so venue-level counts are not available.)
  ///   - New: venue or retailer created within the last 30 days.
  static String? _badgeFor(Retailer r) {
    if (r.isFeatured) return '⭐ Featured';
    if (r.favouriteCount >= 3) return '❤️ Member Favourite';
    if (r.recentRedemptionCount >= 5) return '🔥 Trending';
    if (r.createdAt != null) {
      final ageDays = DateTime.now().difference(r.createdAt!).inDays;
      if (ageDays <= 30) return '✨ New';
    }
    return null;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final retailersAsync = ref.watch(homeRetailersProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: SectionHeader(
            title: 'Nearby businesses',
            action: TextButton(
              onPressed: () => context.go(RouteNames.explore),
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
        const SizedBox(height: 12),
        SizedBox(
          height: 225,
          child: retailersAsync.when(
            loading: () =>
                const Center(child: CircularProgressIndicator()),
            error: (_, __) =>
                const Center(child: Text('Unable to load retailers')),
            data: (retailers) {
              if (retailers.isEmpty) {
                return const Center(
                  child: Text(
                    'No retailers yet',
                    style: AppTextStyles.bodyMedium,
                  ),
                );
              }
              final shown = retailers.take(8).toList();
              return ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: shown.length,
                itemBuilder: (context, i) => Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: BusinessCard(
                    retailer: shown[i],
                    badge: _badgeFor(shown[i]),
                    onTap: () => context.push(
                      RouteNames.retailerDetail
                          .replaceAll(':retailerId', shown[i].id),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
