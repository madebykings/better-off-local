import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../favourites/providers/favourites_providers.dart';
import '../../offers/domain/offer.dart';
import '../../offers/domain/offer_availability.dart';
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
    final availabilityAsync =
        ref.watch(retailerOffersAvailabilityProvider(retailerId));
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

        // Combine offers + availability into a sorted, filtered list.
        // We show the list regardless of availability load state (graceful degrade).
        final availabilityMap =
            availabilityAsync.valueOrNull ?? <String, OfferAvailability>{};

        final allOffers = offersAsync.valueOrNull ?? <Offer>[];
        final visibleOffers = _buildVisibleOffers(allOffers, availabilityMap);
        final availableOffers = visibleOffers
            .where((o) =>
                (availabilityMap[o.id]?.state ??
                    OfferAvailabilityState.available) ==
                OfferAvailabilityState.available)
            .toList();

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
                        ref, retailer.id, isFavourited, context),
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
                          retailer.description !=
                              retailer.shortDescription) ...[
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
              // Offer list
              offersAsync.when(
                loading: () => const SliverToBoxAdapter(
                  child: Center(child: CircularProgressIndicator()),
                ),
                error: (_, __) =>
                    const SliverToBoxAdapter(child: SizedBox.shrink()),
                data: (_) {
                  if (visibleOffers.isEmpty) {
                    return const SliverToBoxAdapter(
                      child: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 20),
                        child: Text(
                          'No offers available at the moment.',
                          style:
                              TextStyle(color: AppColors.textSecondary),
                        ),
                      ),
                    );
                  }
                  return SliverPadding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, i) {
                          final offer = visibleOffers[i];
                          final avail = availabilityMap[offer.id];
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 16),
                            child: OfferCard(
                              offer: offer,
                              availability: avail,
                              onTap: () => context.push(
                                RouteNames.offerDetail
                                    .replaceAll(':offerId', offer.id),
                              ),
                            ),
                          );
                        },
                        childCount: visibleOffers.length,
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
          // Sticky bottom CTA
          bottomNavigationBar: offersAsync.valueOrNull != null
              ? _OfferCTA(
                  availableOffers: availableOffers,
                  visibleOffers: visibleOffers,
                  availabilityMap: availabilityMap,
                  retailerId: retailerId,
                )
              : null,
        );
      },
    );
  }

  /// Filters out hidden availability states and sorts remaining offers:
  /// available → requires_membership → timed → permanent caps → expired.
  /// Preserves the RPC ordering (featured first, then created_at asc) within
  /// each sort tier.
  static List<Offer> _buildVisibleOffers(
    List<Offer> offers,
    Map<String, OfferAvailability> availabilityMap,
  ) {
    return offers
        .where((o) =>
            availabilityMap[o.id]?.isVisible ??
            true) // no availability data = show
        .toList()
      ..sort((a, b) {
        final wa = availabilityMap[a.id]?.state.sortWeight ?? 0;
        final wb = availabilityMap[b.id]?.state.sortWeight ?? 0;
        return wa.compareTo(wb);
      });
  }
}

// ── Sticky CTA ─────────────────────────────────────────────────────────────

class _OfferCTA extends ConsumerWidget {
  const _OfferCTA({
    required this.availableOffers,
    required this.visibleOffers,
    required this.availabilityMap,
    required this.retailerId,
  });

  final List<Offer> availableOffers;
  final List<Offer> visibleOffers;
  final Map<String, OfferAvailability> availabilityMap;
  final String retailerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Determine whether any offer requires membership — if all unavailable
    // offers are behind a paywall, show the paywall CTA.
    final allRequireMembership = visibleOffers.isNotEmpty &&
        visibleOffers.every((o) =>
            availabilityMap[o.id]?.state ==
            OfferAvailabilityState.requiresMembership);

    if (allRequireMembership) {
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              backgroundColor: AppColors.primary,
            ),
            onPressed: () => context.push(RouteNames.paywall),
            child: const Text('Join to use offers'),
          ),
        ),
      );
    }

    if (availableOffers.isEmpty) {
      // All visible offers are unavailable (non-membership reason)
      return SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            style: FilledButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              backgroundColor: AppColors.textDisabled,
            ),
            onPressed: null,
            child: const Text('No offers available right now'),
          ),
        ),
      );
    }

    final label = availableOffers.length == 1
        ? 'Use offer'
        : 'Use an offer';

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
        child: FilledButton(
          style: FilledButton.styleFrom(
            minimumSize: const Size.fromHeight(52),
            backgroundColor: AppColors.primary,
          ),
          onPressed: () => _handleUseTap(context),
          child: Text(label),
        ),
      ),
    );
  }

  void _handleUseTap(BuildContext context) {
    if (availableOffers.length == 1) {
      context.push(
        RouteNames.redemptionQR
            .replaceAll(':offerId', availableOffers.first.id),
      );
    } else {
      showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (_) => _OfferPickerSheet(
          visibleOffers: visibleOffers,
          availabilityMap: availabilityMap,
        ),
      );
    }
  }
}

// ── Offer Picker Bottom Sheet ───────────────────────────────────────────────

class _OfferPickerSheet extends StatelessWidget {
  const _OfferPickerSheet({
    required this.visibleOffers,
    required this.availabilityMap,
  });

  final List<Offer> visibleOffers;
  final Map<String, OfferAvailability> availabilityMap;

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.92,
      expand: false,
      builder: (context, scrollController) {
        return Column(
          children: [
            const SizedBox(height: 12),
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 16),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                'Choose an offer',
                style: AppTextStyles.titleLarge,
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.separated(
                controller: scrollController,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: visibleOffers.length,
                separatorBuilder: (_, __) => const SizedBox(height: 1),
                itemBuilder: (context, i) {
                  final offer = visibleOffers[i];
                  final avail = availabilityMap[offer.id];
                  final isAvailable = avail?.isAvailable ?? true;
                  final badgeLabel = avail?.state.badgeLabel;

                  return ListTile(
                    enabled: isAvailable,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 4, vertical: 4),
                    leading: offer.imageUrl != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Image.network(
                              offer.imageUrl!,
                              width: 56,
                              height: 56,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) =>
                                  _imagePlaceholder(),
                            ),
                          )
                        : _imagePlaceholder(),
                    title: Text(
                      offer.title,
                      style: AppTextStyles.titleMedium.copyWith(
                        fontSize: 15,
                        color: isAvailable
                            ? null
                            : AppColors.textDisabled,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    subtitle: badgeLabel != null
                        ? Text(
                            badgeLabel,
                            style: AppTextStyles.labelSmall.copyWith(
                              color: AppColors.textSecondary,
                            ),
                          )
                        : offer.valueText != null
                            ? Text(
                                offer.valueText!,
                                style: AppTextStyles.labelSmall.copyWith(
                                  color: AppColors.primary,
                                  fontWeight: FontWeight.w700,
                                ),
                              )
                            : null,
                    trailing: isAvailable
                        ? const Icon(Icons.chevron_right,
                            color: AppColors.textSecondary)
                        : null,
                    onTap: isAvailable
                        ? () {
                            Navigator.of(context).pop();
                            context.push(
                              RouteNames.redemptionQR
                                  .replaceAll(':offerId', offer.id),
                            );
                          }
                        : null,
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _imagePlaceholder() => Container(
        width: 56,
        height: 56,
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.border),
        ),
        child: const Icon(Icons.local_offer_outlined,
            size: 24, color: AppColors.border),
      );
}

// ── Contact row ─────────────────────────────────────────────────────────────

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
