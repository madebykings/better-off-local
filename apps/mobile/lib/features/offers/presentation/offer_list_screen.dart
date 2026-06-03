import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/analytics_provider.dart';
import '../../../core/providers/session_provider.dart';
import '../../home/home_providers.dart';
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
    final retailersAsync = ref.watch(homeRetailersProvider);

    // Build mutually-exclusive open/closing-soon/closed sets.
    // homeRetailersProvider loads all live retailers; reuses data already
    // fetched for the home screen with no extra network request.
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
        loading: () => const _OfferListSkeleton(),
        error: (_, __) => _OfferListError(
          onRetry: () => ref.invalidate(liveOffersProvider),
        ),
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
                    _searchQuery.isEmpty ? 'No offers yet' : 'No results',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _searchQuery.isEmpty
                        ? 'Check back soon — offers are being added.'
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
                final isOpenNow = openNowIds.contains(offer.retailerId);
                final isClosingSoon = closingSoonIds.contains(offer.retailerId);
                final isClosed = closedIds.contains(offer.retailerId);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: OfferCard(
                    offer: offer,
                    isOpenNow: isOpenNow,
                    isClosingSoon: isClosingSoon,
                    isClosed: isClosed,
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

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loader — shown while offers are fetching
// ─────────────────────────────────────────────────────────────────────────────

class _OfferListSkeleton extends StatefulWidget {
  const _OfferListSkeleton();

  @override
  State<_OfferListSkeleton> createState() => _OfferListSkeletonState();
}

class _OfferListSkeletonState extends State<_OfferListSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);
    _opacity = Tween(begin: 0.35, end: 0.7).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacity,
      builder: (context, _) => ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: 5,
        itemBuilder: (_, __) => Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: _SkeletonCard(opacity: _opacity.value),
        ),
      ),
    );
  }
}

class _SkeletonCard extends StatelessWidget {
  const _SkeletonCard({required this.opacity});
  final double opacity;

  @override
  Widget build(BuildContext context) {
    final base = Color.lerp(
      const Color(0xFFE9ECEF),
      const Color(0xFFCED4DA),
      opacity,
    )!;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image placeholder
          Container(
            height: 130,
            decoration: BoxDecoration(
              color: base,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(12),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                    height: 14, width: double.infinity, color: base),
                const SizedBox(height: 6),
                Container(height: 14, width: 160, color: base),
                const SizedBox(height: 10),
                Container(height: 11, width: 120, color: base),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error state — friendly message, never exposes raw DB errors
// ─────────────────────────────────────────────────────────────────────────────

class _OfferListError extends StatelessWidget {
  const _OfferListError({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_outlined,
                size: 56, color: Color(0xFFADB5BD)),
            const SizedBox(height: 16),
            const Text(
              'Unable to load offers',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 6),
            const Text(
              'Check your connection and try again.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Color(0xFF6C757D)),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: onRetry,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding:
                    const EdgeInsets.symmetric(horizontal: 28, vertical: 11),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: const Text('Try again'),
            ),
          ],
        ),
      ),
    );
  }
}
