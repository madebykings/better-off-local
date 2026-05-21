import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../favourites/providers/favourites_providers.dart';
import '../../../retailers/domain/retailer.dart';
import '../../home_providers.dart';

class FeaturedRetailersSection extends ConsumerWidget {
  const FeaturedRetailersSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final retailersAsync = ref.watch(homeRetailersProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: SectionHeader(
            title: 'Trending near you',
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
          height: 200,
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
                  child: _RetailerCard(
                    retailer: shown[i],
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

class _RetailerCard extends ConsumerWidget {
  const _RetailerCard({
    required this.retailer,
    required this.onTap,
  });

  final Retailer retailer;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFavourited =
        ref.watch(favouriteRetailerIdsProvider).contains(retailer.id);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 220,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.07),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // Cover image or placeholder
            Positioned.fill(
              child: retailer.coverImageUrl != null
                  ? Image.network(
                      retailer.coverImageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          _RetailerPlaceholder(retailer: retailer),
                    )
                  : _RetailerPlaceholder(retailer: retailer),
            ),
            // Dark gradient overlay
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: const [0.35, 1.0],
                    colors: [
                      Colors.transparent,
                      Colors.black.withValues(alpha: 0.72),
                    ],
                  ),
                ),
              ),
            ),
            // Favourite heart — top right
            Positioned(
              top: 8,
              right: 8,
              child: GestureDetector(
                onTap: () => toggleRetailerFavourite(
                    ref, retailer.id, isFavourited),
                child: Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.35),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isFavourited ? Icons.favorite : Icons.favorite_border,
                    size: 16,
                    color: isFavourited ? AppColors.error : Colors.white,
                  ),
                ),
              ),
            ),
            // Featured offer value badge — top left (if available)
            if (retailer.featuredOffer?.valueText != null)
              Positioned(
                top: 8,
                left: 8,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.accent,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    retailer.featuredOffer!.valueText!,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0,
                    ),
                  ),
                ),
              ),
            // Bottom info: logo + name + categories + distance
            Positioned(
              left: 10,
              right: 10,
              bottom: 10,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  // Logo / initials
                  _LogoBadge(retailer: retailer),
                  const SizedBox(width: 8),
                  // Name + categories + distance
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          retailer.name,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (retailer.categories.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            retailer.categories.take(2).join(' · '),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.75),
                              fontSize: 10,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ] else if (retailer.shortDescription != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            retailer.shortDescription!,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.75),
                              fontSize: 10,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        if (retailer.distanceKm != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            _formatDistance(retailer.distanceKm!),
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.6),
                              fontSize: 10,
                            ),
                          ),
                        ] else if (retailer.town != null &&
                            retailer.categories.isEmpty &&
                            retailer.shortDescription == null) ...[
                          const SizedBox(height: 2),
                          Text(
                            retailer.town!,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.6),
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDistance(double km) {
    if (km < 1.0) return '${(km * 1000).round()}m away';
    return '${km.toStringAsFixed(1)}km away';
  }
}

class _LogoBadge extends StatelessWidget {
  const _LogoBadge({required this.retailer});

  final Retailer retailer;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.white.withValues(alpha: 0.3), width: 1),
      ),
      clipBehavior: Clip.antiAlias,
      child: retailer.logoUrl != null
          ? Image.network(
              retailer.logoUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _Initials(retailer.name),
            )
          : _Initials(retailer.name),
    );
  }
}

class _Initials extends StatelessWidget {
  const _Initials(this.name);

  final String name;

  @override
  Widget build(BuildContext context) {
    final initials = name.isNotEmpty ? name[0].toUpperCase() : '?';
    return Center(
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 14,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _RetailerPlaceholder extends StatelessWidget {
  const _RetailerPlaceholder({required this.retailer});

  final Retailer retailer;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primaryLight,
      child: retailer.logoUrl != null
          ? Padding(
              padding: const EdgeInsets.all(24),
              child: Image.network(
                retailer.logoUrl!,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Icon(
                  Icons.storefront_outlined,
                  color: Colors.white54,
                  size: 40,
                ),
              ),
            )
          : const Center(
              child: Icon(
                Icons.storefront_outlined,
                color: Colors.white54,
                size: 40,
              ),
            ),
    );
  }
}
