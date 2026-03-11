import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../providers/offers_providers.dart';
import 'widgets/category_chip_list.dart';
import 'widgets/offer_card.dart';

class OfferListScreen extends ConsumerWidget {
  const OfferListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offersAsync = ref.watch(liveOffersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Explore offers'),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(52),
          child: Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: CategoryChipList(),
          ),
        ),
      ),
      body: offersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Failed to load offers: $e')),
        data: (offers) {
          if (offers.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.search_off, size: 64, color: Color(0xFFADB5BD)),
                  SizedBox(height: 12),
                  Text('No offers found',
                      style: TextStyle(
                          fontSize: 16, fontWeight: FontWeight.w600)),
                  SizedBox(height: 4),
                  Text('Try a different category',
                      style: TextStyle(
                          fontSize: 14, color: Color(0xFF6C757D))),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(liveOffersProvider),
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: offers.length,
              itemBuilder: (context, i) {
                final offer = offers[i];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: OfferCard(
                    offer: offer,
                    onTap: () => context.push(
                      RouteNames.offerDetail
                          .replaceAll(':offerId', offer.id),
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
