import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
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
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: SectionHeader(
            title: 'Live offers',
            action: TextButton(
              onPressed: () => context.go(RouteNames.explore),
              child: const Text('See all'),
            ),
          ),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 220,
          child: offersAsync.when(
            loading: () =>
                const Center(child: CircularProgressIndicator()),
            error: (_, __) =>
                const Center(child: Text('Unable to load offers')),
            data: (offers) {
              if (offers.isEmpty) {
                return const Center(
                  child: Text('No live offers yet',
                      style: TextStyle(color: Color(0xFF6C757D))),
                );
              }
              return ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: offers.length,
                itemBuilder: (context, i) => Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: OfferCardCompact(
                    offer: offers[i],
                    onTap: () => context.push(
                      RouteNames.offerDetail
                          .replaceAll(':offerId', offers[i].id),
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
