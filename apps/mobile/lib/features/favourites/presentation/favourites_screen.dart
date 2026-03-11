import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../offers/domain/offer.dart';
import '../../offers/presentation/widgets/offer_card.dart';
import '../../retailers/domain/retailer.dart';
import '../data/favourites_remote_data_source.dart';
import '../providers/favourites_providers.dart';

class FavouritesScreen extends ConsumerStatefulWidget {
  const FavouritesScreen({super.key});

  @override
  ConsumerState<FavouritesScreen> createState() => _FavouritesScreenState();
}

class _FavouritesScreenState extends ConsumerState<FavouritesScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Favourites'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Offers'),
            Tab(text: 'Retailers'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          _FavouriteOffersTab(),
          _FavouriteRetailersTab(),
        ],
      ),
    );
  }
}

class _FavouriteOffersTab extends ConsumerWidget {
  const _FavouriteOffersTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ds = ref.read(favouritesDataSourceProvider);
    final session = ref.watch(
      favouritesProvider.select((_) => null), // just to ensure session is loaded
    );
    // Use FutureBuilder to load detailed favourite offers
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _loadFavouriteOffers(ref, ds),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final rows = snapshot.data ?? [];
        final offers = rows
            .map((r) {
              final offerMap = r['offers'] as Map<String, dynamic>?;
              return offerMap != null ? Offer.fromMap(offerMap) : null;
            })
            .whereType<Offer>()
            .toList();

        if (offers.isEmpty) {
          return _EmptyState(
            icon: Icons.favorite_border,
            message: 'No saved offers yet',
            subtitle: 'Tap the heart on any offer to save it here.',
          );
        }

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(favouritesProvider),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: offers.length,
            itemBuilder: (context, i) => Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: OfferCard(
                offer: offers[i],
                onTap: () => context.push(
                  RouteNames.offerDetail
                      .replaceAll(':offerId', offers[i].id),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Future<List<Map<String, dynamic>>> _loadFavouriteOffers(
      WidgetRef ref, FavouritesRemoteDataSource ds) async {
    final favs = await ref.read(favouritesProvider.future);
    if (favs.isEmpty) return [];
    // Refresh offer data from data source
    final profileId = favs.first.profileId;
    return ds.fetchFavouriteOffers(profileId);
  }
}

class _FavouriteRetailersTab extends ConsumerWidget {
  const _FavouriteRetailersTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ds = ref.read(favouritesDataSourceProvider);

    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _loadFavouriteRetailers(ref, ds),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        final rows = snapshot.data ?? [];
        final retailers = rows
            .map((r) {
              final rMap = r['retailers'] as Map<String, dynamic>?;
              return rMap != null ? Retailer.fromMap(rMap) : null;
            })
            .whereType<Retailer>()
            .toList();

        if (retailers.isEmpty) {
          return _EmptyState(
            icon: Icons.storefront_outlined,
            message: 'No saved retailers yet',
            subtitle: 'Tap the heart on any retailer to save it here.',
          );
        }

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(favouritesProvider),
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: retailers.length,
            itemBuilder: (context, i) {
              final r = retailers[i];
              return Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: const BorderSide(color: AppColors.border),
                ),
                child: ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 8),
                  leading: r.logoUrl != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.network(
                            r.logoUrl!,
                            width: 48,
                            height: 48,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => const Icon(
                              Icons.storefront_outlined,
                              color: AppColors.border,
                            ),
                          ),
                        )
                      : const Icon(Icons.storefront_outlined,
                          color: AppColors.border, size: 36),
                  title: Text(r.name, style: AppTextStyles.titleMedium),
                  subtitle: r.shortDescription != null
                      ? Text(
                          r.shortDescription!,
                          style: AppTextStyles.bodyMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        )
                      : null,
                  onTap: () => context.push(
                    RouteNames.retailerDetail
                        .replaceAll(':retailerId', r.id),
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  Future<List<Map<String, dynamic>>> _loadFavouriteRetailers(
      WidgetRef ref, FavouritesRemoteDataSource ds) async {
    final favs = await ref.read(favouritesProvider.future);
    if (favs.isEmpty) return [];
    final profileId = favs.first.profileId;
    return ds.fetchFavouriteRetailers(profileId);
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.message,
    required this.subtitle,
  });

  final IconData icon;
  final String message;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 64, color: AppColors.border),
          const SizedBox(height: 12),
          Text(message,
              style: AppTextStyles.titleMedium
                  .copyWith(color: AppColors.textSecondary)),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              subtitle,
              style: AppTextStyles.bodyMedium,
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}
