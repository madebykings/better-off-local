import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/location_provider.dart';
import '../../../features/offers/domain/offer_summary.dart';
import '../../../features/offers/providers/offers_providers.dart';
import '../../../features/retailers/domain/retailer.dart';
import '../../../features/retailers/providers/retailer_providers.dart';
import '../presentation/map_controller.dart';

export '../presentation/map_controller.dart';

// ── Enriched retailer list for the map ───────────────────────────────────────

/// Fetches live retailers and their best featured offers from the DB.
/// No location dependency — stable across GPS updates so DB is not re-queried
/// every time the user moves. Exposed publicly so callers can invalidate it
/// to trigger a retry after a load failure.
final mapBaseDataProvider = FutureProvider<
    ({List<Retailer> retailers, Map<String, OfferSummary> featured})>((ref) async {
  final retailers =
      await ref.read(retailerRepositoryProvider).getLiveRetailers();
  if (retailers.isEmpty) return (retailers: <Retailer>[], featured: <String, OfferSummary>{});

  final retailerIds = retailers.map((r) => r.id).toList();
  final featuredOffers = await ref
      .read(offersRepositoryProvider)
      .getFeaturedOffersByRetailers(retailerIds);

  return (retailers: retailers, featured: featuredOffers);
});

/// All live retailers enriched with their best featured offer and distance
/// from the current user position (if available). No radius filter — the map
/// shows the full dataset and lets the user pan freely.
///
/// Distance is recalculated in-memory when location changes; DB is not
/// re-queried on GPS updates.
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
    );
  }).toList();
});

// ── Map-filtered retailer list ────────────────────────────────────────────────

/// Live retailers that have coordinates, filtered by the current search query.
/// Used to populate both map markers and the bottom-sheet list.
final mapRetailersProvider = Provider<List<Retailer>>((ref) {
  final all = ref.watch(mapAllRetailersProvider);
  final query =
      ref.watch(mapControllerProvider.select((s) => s.searchQuery));

  final withCoords =
      all.where((r) => r.latitude != null && r.longitude != null).toList();

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

// ── Selected retailer ─────────────────────────────────────────────────────────

/// The currently-tapped retailer object, or null if nothing is selected.
final selectedMapRetailerProvider = Provider<Retailer?>((ref) {
  final selectedId =
      ref.watch(mapControllerProvider.select((s) => s.selectedRetailerId));
  if (selectedId == null) return null;
  final retailers = ref.watch(mapRetailersProvider);
  try {
    return retailers.firstWhere((r) => r.id == selectedId);
  } catch (_) {
    return null;
  }
});

// ── Base data load status — for error/loading UI in the map screen ────────────

/// Exposes the async state of the underlying retailer fetch so the map screen
/// can show a loading indicator or error banner rather than silently showing
/// an empty list when the query fails.
final mapRetailersLoadStateProvider =
    Provider<AsyncValue<void>>((ref) {
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
