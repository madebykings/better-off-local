import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/location_provider.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../../../features/loyalty/domain/loyalty_card.dart';
import '../../../features/loyalty/providers/loyalty_providers.dart';
import '../../../features/offers/domain/offer_summary.dart';
import '../../../features/offers/providers/offers_providers.dart';
import '../../../features/region/providers/region_providers.dart';
import '../../../features/retailers/domain/retailer.dart';
import '../../../features/retailers/providers/retailer_providers.dart';
import '../../../features/follow/providers/retailer_follows_providers.dart';
import '../data/map_remote_data_source.dart';
import '../domain/map_event_pin.dart';
import '../presentation/map_controller.dart';

export '../presentation/map_controller.dart';

// ── Data source ───────────────────────────────────────────────────────────────

final mapDataSourceProvider = Provider<MapRemoteDataSource>(
  (ref) => MapRemoteDataSource(ref.watch(supabaseClientProvider)),
);

// ── Retailer base data ────────────────────────────────────────────────────────

/// Fetches live retailers and their best featured offers from the DB.
/// No location dependency — stable across GPS updates so DB is not re-queried
/// every time the user moves. Exposed publicly so callers can invalidate it
/// to trigger a retry after a load failure.
final mapBaseDataProvider = FutureProvider<
    ({List<Retailer> retailers, Map<String, OfferSummary> featured})>((ref) async {
  final retailers =
      await ref.read(retailerRepositoryProvider).getLiveRetailers();
  debugPrint('[MAP] DB retailer count: ${retailers.length}');
  if (retailers.isNotEmpty) {
    final r = retailers.first;
    debugPrint('[MAP] First retailer: "${r.name}", '
        'lat=${r.latitude}, lon=${r.longitude}, '
        'isPrimary location attached=${r.latitude != null}');
  }
  if (retailers.isEmpty) {
    return (retailers: <Retailer>[], featured: <String, OfferSummary>{});
  }

  final retailerIds = retailers.map((r) => r.id).toList();
  final featuredOffers = await ref
      .read(offersRepositoryProvider)
      .getFeaturedOffersByRetailers(retailerIds);

  return (retailers: retailers, featured: featuredOffers);
});

/// All live retailers enriched with distance from current user position.
/// DB is not re-queried on GPS updates — only the distance calculation changes.
final mapAllRetailersProvider = Provider<List<Retailer>>((ref) {
  final base = ref.watch(mapBaseDataProvider).valueOrNull;
  if (base == null || base.retailers.isEmpty) return [];

  final location = ref.watch(locationProvider);

  return base.retailers.map((r) {
    double? distKm;
    if (location != null && r.latitude != null && r.longitude != null) {
      distKm = _haversineKm(
        location.latitude,
        location.longitude,
        r.latitude!,
        r.longitude!,
      );
    }
    return Retailer(
      id: r.id,
      name: r.name,
      slug: r.slug,
      tagline: r.tagline,
      description: r.description,
      shortDescription: r.shortDescription,
      logoUrl: r.logoUrl,
      coverImageUrl: r.coverImageUrl,
      websiteUrl: r.websiteUrl,
      phone: r.phone,
      email: r.email,
      addressLine1: r.addressLine1,
      town: r.town,
      postcode: r.postcode,
      latitude: r.latitude,
      longitude: r.longitude,
      distanceKm: distKm,
      categories: r.categories,
      featuredOffer: base.featured[r.id],
      activeOfferCount: r.activeOfferCount,
      isFeatured: r.isFeatured,
      openingHours: r.openingHours,
      createdAt: r.createdAt,
      recentRedemptionCount: r.recentRedemptionCount,
      favouriteCount: r.favouriteCount,
      primaryLocationId: r.primaryLocationId,
    );
  }).toList();
});

// ── Event pins ────────────────────────────────────────────────────────────────

/// Live upcoming events with venue coordinates. Requires user session to
/// include reminder state; returns empty list if not signed in.
final mapEventsProvider = FutureProvider<List<MapEventPin>>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return [];
  final userId = session.user.id;
  final regionId = ref.watch(memberRegionIdProvider(userId)).valueOrNull;
  if (regionId == null) return [];
  return ref.read(mapDataSourceProvider).fetchMapEvents(
        regionId: regionId,
        consumerId: userId,
      );
});

// ── Filtered retailers ────────────────────────────────────────────────────────

/// Retailers filtered by the active MapFilter and search query.
/// Only returns retailers that have map coordinates.
final mapFilteredRetailersProvider = Provider<List<Retailer>>((ref) {
  final all = ref.watch(mapAllRetailersProvider);
  final query =
      ref.watch(mapControllerProvider.select((s) => s.searchQuery));
  final filter =
      ref.watch(mapControllerProvider.select((s) => s.activeFilter));
  final followedIds = ref.watch(followedRetailerIdsProvider);
  final loyaltyCards =
      ref.watch(myLoyaltyCardsProvider).valueOrNull ?? <LoyaltyCard>[];

  final loyaltyRetailerIds = loyaltyCards
      .where((c) =>
          c.status == LoyaltyCardStatus.active && c.stampsEarned < c.stampsRequired)
      .map((c) => c.retailerId)
      .toSet();

  var withCoords =
      all.where((r) => r.latitude != null && r.longitude != null).toList();

  debugPrint(
      '[MAP] Retailers total: ${all.length}, with coordinates: ${withCoords.length}');

  // Events-only filter hides all retailer markers.
  if (filter == MapFilter.events) return [];

  switch (filter) {
    case MapFilter.offers:
      withCoords = withCoords.where((r) => r.activeOfferCount > 0).toList();
    case MapFilter.featured:
      withCoords = withCoords.where((r) => r.isFeatured).toList();
    case MapFilter.following:
      withCoords =
          withCoords.where((r) => followedIds.contains(r.id)).toList();
    case MapFilter.loyalty:
      withCoords =
          withCoords.where((r) => loyaltyRetailerIds.contains(r.id)).toList();
    case MapFilter.all:
    case MapFilter.events:
      break;
  }

  if (query.isEmpty) return withCoords;

  final lower = query.toLowerCase();
  return withCoords.where((r) {
    if (r.name.toLowerCase().contains(lower)) return true;
    if (r.town?.toLowerCase().contains(lower) ?? false) return true;
    for (final cat in r.categories) {
      if (cat.toLowerCase().contains(lower)) return true;
    }
    final offerTitle = r.featuredOffer?.title ?? '';
    if (offerTitle.toLowerCase().contains(lower)) return true;
    return false;
  }).toList();
});

/// Backwards-compatible alias — callers that used mapRetailersProvider
/// automatically get the filter-aware version.
final mapRetailersProvider = mapFilteredRetailersProvider;

// ── Filtered events ───────────────────────────────────────────────────────────

/// Events shown as map markers — only when filter is 'all' or 'events'.
final mapFilteredEventsProvider = Provider<List<MapEventPin>>((ref) {
  final filter =
      ref.watch(mapControllerProvider.select((s) => s.activeFilter));
  if (filter != MapFilter.all && filter != MapFilter.events) return [];
  return ref.watch(mapEventsProvider).valueOrNull ?? [];
});

// ── Selected items ────────────────────────────────────────────────────────────

/// The currently-tapped retailer, or null.
final selectedMapRetailerProvider = Provider<Retailer?>((ref) {
  final selectedId =
      ref.watch(mapControllerProvider.select((s) => s.selectedRetailerId));
  if (selectedId == null) return null;
  final retailers = ref.watch(mapFilteredRetailersProvider);
  try {
    return retailers.firstWhere((r) => r.id == selectedId);
  } catch (_) {
    // Fall back to full list in case the selected retailer is filtered out.
    final all = ref.watch(mapAllRetailersProvider);
    try {
      return all.firstWhere((r) => r.id == selectedId);
    } catch (_) {
      return null;
    }
  }
});

/// The currently-tapped event, or null.
final selectedMapEventProvider = Provider<MapEventPin?>((ref) {
  final selectedId =
      ref.watch(mapControllerProvider.select((s) => s.selectedEventId));
  if (selectedId == null) return null;
  final events = ref.watch(mapEventsProvider).valueOrNull ?? [];
  try {
    return events.firstWhere((e) => e.id == selectedId);
  } catch (_) {
    return null;
  }
});

// ── Load state ────────────────────────────────────────────────────────────────

/// Exposes the async state of the retailer fetch for error/loading UI.
final mapRetailersLoadStateProvider = Provider<AsyncValue<void>>((ref) {
  final async = ref.watch(mapBaseDataProvider);
  if (async.isLoading) return const AsyncLoading();
  if (async.hasError) return AsyncError(async.error!, async.stackTrace!);
  return const AsyncData(null);
});

// ── Haversine ─────────────────────────────────────────────────────────────────

double _haversineKm(double lat1, double lon1, double lat2, double lon2) {
  const r = 6371.0;
  final dLat = (lat2 - lat1) * math.pi / 180;
  final dLon = (lon2 - lon1) * math.pi / 180;
  final a = math.pow(math.sin(dLat / 2), 2) +
      math.cos(lat1 * math.pi / 180) *
          math.cos(lat2 * math.pi / 180) *
          math.pow(math.sin(dLon / 2), 2);
  return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}
