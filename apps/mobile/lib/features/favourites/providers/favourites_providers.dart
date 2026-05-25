import 'package:flutter/material.dart';
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

// ---------------------------------------------------------------------------
// Optimistic pending-state providers
// ---------------------------------------------------------------------------

// Private — only mutated by toggle functions below.
final _pendingOfferAddsProvider =
    StateProvider.autoDispose<Set<String>>((ref) => {});
final _pendingOfferRemovesProvider =
    StateProvider.autoDispose<Set<String>>((ref) => {});
final _pendingRetailerAddsProvider =
    StateProvider.autoDispose<Set<String>>((ref) => {});
final _pendingRetailerRemovesProvider =
    StateProvider.autoDispose<Set<String>>((ref) => {});

/// Set of favourited offer IDs — includes optimistic pending state so the UI
/// updates instantly before the server call completes.
final favouriteOfferIdsProvider = Provider<Set<String>>((ref) {
  final confirmed = <String>{
    for (final f in ref.watch(favouritesProvider).valueOrNull ?? [])
      if (f.offerId != null) f.offerId!,
  };
  final adds = ref.watch(_pendingOfferAddsProvider);
  final removes = ref.watch(_pendingOfferRemovesProvider);
  return {...confirmed, ...adds}.difference(removes);
});

/// Set of favourited retailer IDs — includes optimistic pending state.
final favouriteRetailerIdsProvider = Provider<Set<String>>((ref) {
  final confirmed = <String>{
    for (final f in ref.watch(favouritesProvider).valueOrNull ?? [])
      if (f.retailerId != null) f.retailerId!,
  };
  final adds = ref.watch(_pendingRetailerAddsProvider);
  final removes = ref.watch(_pendingRetailerRemovesProvider);
  return {...confirmed, ...adds}.difference(removes);
});

// ---------------------------------------------------------------------------
// Toggle helpers
// ---------------------------------------------------------------------------

/// Toggle a favourite offer on/off.
///
/// Updates the UI instantly via pending-state providers. If the server call
/// fails, the optimistic change is rolled back and a snackbar is shown if
/// [context] is provided.
Future<void> toggleOfferFavourite(
  WidgetRef ref,
  String offerId,
  bool isCurrentlyFavourited, [
  BuildContext? context,
]) async {
  final session = ref.read(sessionProvider).valueOrNull;
  if (session == null) return;

  // Optimistic update — immediate UI feedback.
  if (isCurrentlyFavourited) {
    ref
        .read(_pendingOfferRemovesProvider.notifier)
        .update((s) => {...s, offerId});
  } else {
    ref
        .read(_pendingOfferAddsProvider.notifier)
        .update((s) => {...s, offerId});
  }

  try {
    final ds = ref.read(favouritesDataSourceProvider);
    if (isCurrentlyFavourited) {
      await ds.removeOfferFavourite(
          profileId: session.user.id, offerId: offerId);
    } else {
      await ds.addOfferFavourite(
          profileId: session.user.id, offerId: offerId);
    }
    ref.invalidate(favouritesProvider);
  } catch (_) {
    // Rollback optimistic update.
    if (isCurrentlyFavourited) {
      ref
          .read(_pendingOfferRemovesProvider.notifier)
          .update((s) => s.difference({offerId}));
    } else {
      ref
          .read(_pendingOfferAddsProvider.notifier)
          .update((s) => s.difference({offerId}));
    }
    if (context != null && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not update favourites. Please try again.'),
          duration: Duration(seconds: 3),
        ),
      );
    }
  }
}

/// Toggle a favourite retailer on/off.
///
/// Updates the UI instantly via pending-state providers. If the server call
/// fails, the optimistic change is rolled back and a snackbar is shown if
/// [context] is provided.
Future<void> toggleRetailerFavourite(
  WidgetRef ref,
  String retailerId,
  bool isCurrentlyFavourited, [
  BuildContext? context,
]) async {
  final session = ref.read(sessionProvider).valueOrNull;
  if (session == null) return;

  // Optimistic update — immediate UI feedback.
  if (isCurrentlyFavourited) {
    ref
        .read(_pendingRetailerRemovesProvider.notifier)
        .update((s) => {...s, retailerId});
  } else {
    ref
        .read(_pendingRetailerAddsProvider.notifier)
        .update((s) => {...s, retailerId});
  }

  try {
    final ds = ref.read(favouritesDataSourceProvider);
    if (isCurrentlyFavourited) {
      await ds.removeRetailerFavourite(
          profileId: session.user.id, retailerId: retailerId);
    } else {
      await ds.addRetailerFavourite(
          profileId: session.user.id, retailerId: retailerId);
    }
    ref.invalidate(favouritesProvider);
  } catch (_) {
    // Rollback optimistic update.
    if (isCurrentlyFavourited) {
      ref
          .read(_pendingRetailerRemovesProvider.notifier)
          .update((s) => s.difference({retailerId}));
    } else {
      ref
          .read(_pendingRetailerAddsProvider.notifier)
          .update((s) => s.difference({retailerId}));
    }
    if (context != null && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not update favourites. Please try again.'),
          duration: Duration(seconds: 3),
        ),
      );
    }
  }
}
