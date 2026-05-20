import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../favourites/providers/favourites_providers.dart';
import '../../offers/presentation/widgets/offer_card.dart';
import '../../offers/providers/offers_providers.dart';
import '../providers/retailer_providers.dart';

class RetailerDetailScreen extends ConsumerWidget {
  const RetailerDetailScreen({super.key, required this.retailerId});
  final String retailerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final retailerAsync = ref.watch(retailerProvider(retailerId));
    final offersAsync = ref.watch(retailerOffersProvider(retailerId));
    final favouriteIds = ref.watch(favouriteRetailerIdsProvider);

    return retailerAsync.when(
      loading: () =>
          const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: Center(child: Text('Failed to load retailer: $e')),
      ),
      data: (retailer) {
        final isFavourited = favouriteIds.contains(retailer.id);

        return Scaffold(
          body: CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: retailer.coverImageUrl != null ? 200 : 0,
                pinned: true,
                actions: [
                  IconButton(
                    icon: Icon(
                      isFavourited ? Icons.favorite : Icons.favorite_border,
                      color: isFavourited ? AppColors.error : null,
                    ),
                    onPressed: () => toggleRetailerFavourite(
                        ref, retailer.id, isFavourited),
                  ),
                ],
                flexibleSpace: retailer.coverImageUrl != null
                    ? FlexibleSpaceBar(
                        background: Image.network(
                          retailer.coverImageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const ColoredBox(color: AppColors.background),
                        ),
                      )
                    : null,
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          if (retailer.logoUrl != null)
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.network(
                                retailer.logoUrl!,
                                width: 56,
                                height: 56,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) =>
                                    const SizedBox.shrink(),
                              ),
                            ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(retailer.name,
                                    style: AppTextStyles.titleLarge),
                                if (retailer.displayAddress != null)
                                  Text(
                                    retailer.displayAddress!,
                                    style: AppTextStyles.bodyMedium,
                                  ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      if (retailer.categories.isNotEmpty) ...[
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: retailer.categories
                              .map(
                                (c) => Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: AppColors.background,
                                    borderRadius: BorderRadius.circular(20),
                                    border:
                                        Border.all(color: AppColors.border),
                                  ),
                                  child: Text(
                                    c,
                                    style: AppTextStyles.labelSmall.copyWith(
                                      color: AppColors.textSecondary,
                                      letterSpacing: 0,
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                        ),
                      ],
                      if (retailer.shortDescription != null) ...[
                        const SizedBox(height: 16),
                        Text(
                          retailer.shortDescription!,
                          style: AppTextStyles.bodyLarge,
                        ),
                      ],
                      if (retailer.description != null &&
                          retailer.description != retailer.shortDescription) ...[
                        const SizedBox(height: 8),
                        Text(
                          retailer.description!,
                          style: AppTextStyles.bodyMedium,
                        ),
                      ],
                      const SizedBox(height: 16),
                      _ContactRow(retailer: retailer),
                      const SizedBox(height: 28),
                      Text('Offers',
                          style: AppTextStyles.headlineMedium
                              .copyWith(fontSize: 20)),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),
              offersAsync.when(
                loading: () => const SliverToBoxAdapter(
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (_, __) =>
                    const SliverToBoxAdapter(child: SizedBox.shrink()),
                data: (offers) {
                  if (offers.isEmpty) {
                    return const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 20),
                        child: Text('No live offers at the moment.',
                            style: TextStyle(color: AppColors.textSecondary)),
                      ),
                    );
                  }
                  return SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, i) => Padding(
                          padding: const EdgeInsets.only(bottom: 16),
                          child: OfferCard(
                            offer: offers[i],
                            onTap: () => context.push(
                              RouteNames.offerDetail
                                  .replaceAll(':offerId', offers[i].id),
                            ),
                          ),
                        ),
                        childCount: offers.length,
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ContactRow extends StatelessWidget {
  const _ContactRow({required this.retailer});

  final dynamic retailer;

  @override
  Widget build(BuildContext context) {
    final items = <Widget>[];

    if (retailer.phone != null) {
      items.add(_ContactChip(
        icon: Icons.phone_outlined,
        label: retailer.phone!,
        onTap: () => launchUrl(Uri(scheme: 'tel', path: retailer.phone)),
      ));
    }
    if (retailer.websiteUrl != null) {
      items.add(_ContactChip(
        icon: Icons.language_outlined,
        label: 'Website',
        onTap: () => launchUrl(Uri.parse(retailer.websiteUrl!),
            mode: LaunchMode.externalApplication),
      ));
    }

    if (items.isEmpty) return const SizedBox.shrink();

    return Wrap(spacing: 8, runSpacing: 8, children: items);
  }
}

class _ContactChip extends StatelessWidget {
  const _ContactChip({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(icon, size: 16, color: AppColors.primary),
      label: Text(label, style: const TextStyle(fontSize: 13)),
      onPressed: onTap,
      backgroundColor: AppColors.background,
      side: const BorderSide(color: AppColors.border),
      padding: const EdgeInsets.symmetric(horizontal: 4),
    );
  }
}
