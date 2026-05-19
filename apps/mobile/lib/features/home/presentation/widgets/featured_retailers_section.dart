import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../retailers/domain/retailer.dart';
import '../../../retailers/providers/retailer_providers.dart';

class FeaturedRetailersSection extends ConsumerWidget {
  const FeaturedRetailersSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final retailersAsync = ref.watch(liveRetailersProvider);

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
          height: 160,
          child: retailersAsync.when(
            loading: () =>
                const Center(child: CircularProgressIndicator()),
            error: (_, __) =>
                const Center(child: Text('Unable to load retailers')),
            data: (retailers) {
              if (retailers.isEmpty) {
                return Center(
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
                    isMemberFavourite: i.isEven,
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

class _RetailerCard extends StatelessWidget {
  const _RetailerCard({
    required this.retailer,
    required this.isMemberFavourite,
    required this.onTap,
  });

  final Retailer retailer;
  final bool isMemberFavourite;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 220,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.07),
              blurRadius: 10,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            // Cover image or logo-based placeholder
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
            // Dark gradient overlay for text legibility
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    stops: const [0.3, 1.0],
                    colors: [
                      Colors.transparent,
                      Colors.black.withOpacity(0.65),
                    ],
                  ),
                ),
              ),
            ),
            // Badge — top left
            Positioned(
              top: 10,
              left: 10,
              child: Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.92),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isMemberFavourite ? Icons.star : Icons.whatshot,
                      size: 12,
                      color: isMemberFavourite
                          ? AppColors.accent
                          : AppColors.error,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      isMemberFavourite ? 'Member favourite' : 'Trending',
                      style: AppTextStyles.labelSmall.copyWith(
                        fontSize: 10,
                        color: AppColors.textPrimary,
                        letterSpacing: 0,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            // Retailer name + location — bottom left
            Positioned(
              left: 12,
              right: 12,
              bottom: 12,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    retailer.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (retailer.shortDescription != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      retailer.shortDescription!,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 11,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ] else if (retailer.town != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      retailer.town!,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 11,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
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
