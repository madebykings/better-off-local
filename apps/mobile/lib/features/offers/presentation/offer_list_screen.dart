import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/analytics_provider.dart';
import '../../../core/providers/session_provider.dart';
import '../domain/offer.dart';
import '../providers/offers_providers.dart';
import 'widgets/category_chip_list.dart';
import 'widgets/offer_card.dart';

class OfferListScreen extends ConsumerStatefulWidget {
  const OfferListScreen({super.key});

  @override
  ConsumerState<OfferListScreen> createState() => _OfferListScreenState();
}

class _OfferListScreenState extends ConsumerState<OfferListScreen> {
  final _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    setState(() => _searchQuery = query);
    if (query.trim().length >= 2) {
      final session = ref.read(sessionProvider).valueOrNull;
      ref
          .read(discoveryAnalyticsProvider)
          .logSearchUsed(session?.user.id, query.trim());
    }
  }

  List<Offer> _filter(List<Offer> offers) {
    final q = _searchQuery.trim().toLowerCase();
    if (q.isEmpty) return offers;
    return offers.where((o) {
      if (o.title.toLowerCase().contains(q)) return true;
      if (o.retailerName.toLowerCase().contains(q)) return true;
      return false;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final offersAsync = ref.watch(liveOffersProvider);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: Padding(
          padding: const EdgeInsets.only(left: 16),
          child: TextField(
            controller: _searchController,
            onChanged: _onSearchChanged,
            textAlignVertical: TextAlignVertical.center,
            style: AppTextStyles.bodyMedium,
            decoration: InputDecoration(
              hintText: 'Search offers or retailers…',
              hintStyle: AppTextStyles.bodyMedium
                  .copyWith(color: AppColors.textDisabled),
              border: InputBorder.none,
              isDense: true,
              prefixIcon: const Icon(Icons.search,
                  color: AppColors.textDisabled, size: 20),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.close,
                          size: 18, color: AppColors.textSecondary),
                      onPressed: () {
                        _searchController.clear();
                        _onSearchChanged('');
                      },
                    )
                  : null,
            ),
          ),
        ),
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
          final filtered = _filter(offers);

          if (filtered.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.search_off,
                      size: 64, color: Color(0xFFADB5BD)),
                  const SizedBox(height: 12),
                  Text(
                    _searchQuery.isEmpty ? 'No offers found' : 'No results',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _searchQuery.isEmpty
                        ? 'Try a different category'
                        : 'Try a different search term',
                    style: const TextStyle(
                        fontSize: 14, color: Color(0xFF6C757D)),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              _searchController.clear();
              setState(() => _searchQuery = '');
              ref.invalidate(liveOffersProvider);
            },
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: filtered.length,
              itemBuilder: (context, i) {
                final offer = filtered[i];
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
