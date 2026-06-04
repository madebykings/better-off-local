import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../offers/presentation/widgets/offer_card.dart';
import '../../../offers/providers/offers_providers.dart';
import '../../home_providers.dart';

class NearbyOffersSection extends ConsumerWidget {
  const NearbyOffersSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offersAsync = ref.watch(homeOffersProvider);
    final retailersAsync = ref.watch(homeRetailersProvider);

    // Build mutually-exclusive open/closing-soon/closed sets from the already-loaded
    // retailer data. homeRetailersProvider is watched by FeaturedRetailersSection on
    // the same screen so this adds no extra network requests.
    // Priority: closing soon > open now > closed (requires hours to be present).
    final openNowIds = <String>{};
    final closingSoonIds = <String>{};
    final closedIds = <String>{};
    if (retailersAsync.valueOrNull != null) {
      for (final r in retailersAsync.valueOrNull!) {
        final hours = r.openingHours;
        if (hours == null) continue;
        if (hours.isClosingSoon()) {
          closingSoonIds.add(r.id);
        } else if (hours.isOpenNow) {
          openNowIds.add(r.id);
        } else {
          closedIds.add(r.id);
        }
      }
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: SectionHeader(
            title: 'Nearby offers',
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
          // Height = image(120) + body(82) = 202 + 13px buffer.
          height: 215,
          child: offersAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (_, __) => const Center(child: Text('Unable to load offers')),
            data: (offers) {
              if (offers.isEmpty) {
                return const Center(
                  child: Text('No live offers yet', style: AppTextStyles.bodyMedium),
                );
              }
              return ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: offers.length,
                itemBuilder: (context, i) {
                  final offer = offers[i];
                  final isOpenNow = openNowIds.contains(offer.retailerId);
                  final isClosingSoon = closingSoonIds.contains(offer.retailerId);
                  final isClosed = closedIds.contains(offer.retailerId);
                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: OfferCard(
                      offer: offer,
                      compact: true,
                      isOpenNow: isOpenNow,
                      isClosingSoon: isClosingSoon,
                      isClosed: isClosed,
                      onTap: () => context.push(
                        RouteNames.offerDetail.replaceAll(':offerId', offer.id),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
