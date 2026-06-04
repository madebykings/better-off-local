import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../data/retailer_follows_remote_data_source.dart';

final retailerFollowsDataSourceProvider =
    Provider<RetailerFollowsRemoteDataSource>(
  (ref) => RetailerFollowsRemoteDataSource(ref.watch(supabaseClientProvider)),
);

/// Raw server-confirmed followed retailer IDs.
final _confirmedFollowedRetailerIdsProvider =
    FutureProvider<Set<String>>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return {};
  final ids = await ref
      .read(retailerFollowsDataSourceProvider)
      .fetchFollowedRetailerIds(session.user.id);
  return ids.toSet();
});

// Optimistic pending-state providers — private, mutated only by toggle below.
final _pendingFollowAddsProvider =
    StateProvider.autoDispose<Set<String>>((ref) => {});
final _pendingFollowRemovesProvider =
    StateProvider.autoDispose<Set<String>>((ref) => {});

/// Set of followed retailer IDs with optimistic pending state applied.
final followedRetailerIdsProvider = Provider<Set<String>>((ref) {
  final confirmed =
      ref.watch(_confirmedFollowedRetailerIdsProvider).valueOrNull ?? {};
  final adds = ref.watch(_pendingFollowAddsProvider);
  final removes = ref.watch(_pendingFollowRemovesProvider);
  return {...confirmed, ...adds}.difference(removes);
});

/// Fetches full retailer rows for the Following screen.
final followedRetailersProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return [];
  // Re-fetch when confirmed IDs change (i.e. after toggle).
  ref.watch(_confirmedFollowedRetailerIdsProvider);
  return await ref
      .read(retailerFollowsDataSourceProvider)
      .fetchFollowedRetailers(session.user.id);
});

/// Toggles follow state for a retailer with optimistic UI updates.
///
/// Shows a snackbar on failure if [context] is provided.
Future<void> toggleRetailerFollow(
  WidgetRef ref,
  String retailerId,
  bool isCurrentlyFollowing, [
  BuildContext? context,
]) async {
  final session = ref.read(sessionProvider).valueOrNull;
  if (session == null) return;

  if (isCurrentlyFollowing) {
    ref
        .read(_pendingFollowRemovesProvider.notifier)
        .update((s) => {...s, retailerId});
  } else {
    ref
        .read(_pendingFollowAddsProvider.notifier)
        .update((s) => {...s, retailerId});
  }

  try {
    final ds = ref.read(retailerFollowsDataSourceProvider);
    if (isCurrentlyFollowing) {
      await ds.unfollowRetailer(
          profileId: session.user.id, retailerId: retailerId);
    } else {
      await ds.followRetailer(
          profileId: session.user.id, retailerId: retailerId);
    }
    ref.invalidate(_confirmedFollowedRetailerIdsProvider);
  } catch (_) {
    // Rollback optimistic update.
    if (isCurrentlyFollowing) {
      ref
          .read(_pendingFollowRemovesProvider.notifier)
          .update((s) => s.difference({retailerId}));
    } else {
      ref
          .read(_pendingFollowAddsProvider.notifier)
          .update((s) => s.difference({retailerId}));
    }
    if (context != null && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not update following. Please try again.'),
          duration: Duration(seconds: 3),
        ),
      );
    }
  }
}
