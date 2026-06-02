import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../offers/presentation/widgets/offer_card.dart';
import '../../../offers/providers/offers_providers.dart';

class NearbyOffersSection extends ConsumerWidget {
  const NearbyOffersSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offersAsync = ref.watch(homeOffersProvider);

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
          // Height = image(100) + body padding(19) + title(~40) + gap(7) + redemption(~14) = ~180
          // Add 8px breathing room so the card shadow is never clipped.
          height: 188,
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
                itemBuilder: (context, i) => Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: OfferCard(
                    offer: offers[i],
                    compact: true,
                    onTap: () => context.push(
                      RouteNames.offerDetail.replaceAll(':offerId', offers[i].id),
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
