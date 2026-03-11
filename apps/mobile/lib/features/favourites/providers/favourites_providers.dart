import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../data/favourites_remote_data_source.dart';
import '../domain/favourite.dart';

final favouritesDataSourceProvider = Provider<FavouritesRemoteDataSource>(
  (ref) => FavouritesRemoteDataSource(ref.watch(supabaseClientProvider)),
);

/// All favourite rows for the current user.
final favouritesProvider = FutureProvider<List<Favourite>>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return [];
  final rows = await ref
      .read(favouritesDataSourceProvider)
      .fetchFavourites(session.user.id);
  return rows.map(Favourite.fromMap).toList();
});

/// Set of favourited offer IDs for the current user.
final favouriteOfferIdsProvider = Provider<Set<String>>((ref) {
  final favs = ref.watch(favouritesProvider).valueOrNull ?? [];
  return {
    for (final f in favs)
      if (f.offerId != null) f.offerId!,
  };
});

/// Set of favourited retailer IDs for the current user.
final favouriteRetailerIdsProvider = Provider<Set<String>>((ref) {
  final favs = ref.watch(favouritesProvider).valueOrNull ?? [];
  return {
    for (final f in favs)
      if (f.retailerId != null) f.retailerId!,
  };
});

/// Toggle a favourite offer on/off. Invalidates [favouritesProvider].
Future<void> toggleOfferFavourite(
    WidgetRef ref, String offerId, bool isCurrentlyFavourited) async {
  final session = ref.read(sessionProvider).valueOrNull;
  if (session == null) return;
  final ds = ref.read(favouritesDataSourceProvider);
  if (isCurrentlyFavourited) {
    await ds.removeOfferFavourite(
        profileId: session.user.id, offerId: offerId);
  } else {
    await ds.addOfferFavourite(
        profileId: session.user.id, offerId: offerId);
  }
  ref.invalidate(favouritesProvider);
}

/// Toggle a favourite retailer on/off. Invalidates [favouritesProvider].
Future<void> toggleRetailerFavourite(
    WidgetRef ref, String retailerId, bool isCurrentlyFavourited) async {
  final session = ref.read(sessionProvider).valueOrNull;
  if (session == null) return;
  final ds = ref.read(favouritesDataSourceProvider);
  if (isCurrentlyFavourited) {
    await ds.removeRetailerFavourite(
        profileId: session.user.id, retailerId: retailerId);
  } else {
    await ds.addRetailerFavourite(
        profileId: session.user.id, retailerId: retailerId);
  }
  ref.invalidate(favouritesProvider);
}
