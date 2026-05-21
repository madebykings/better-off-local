import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/location_provider.dart';
import '../../../features/offers/providers/offers_providers.dart';
import '../../../features/retailers/domain/retailer.dart';
import '../../../features/retailers/providers/retailer_providers.dart';
import '../presentation/map_controller.dart';

export '../presentation/map_controller.dart';

// ── Enriched retailer list for the map ───────────────────────────────────────

/// All live retailers enriched with their best featured offer and distance
/// from the current user position (if available). No radius filter — the map
/// shows the full dataset and lets the user pan freely.
///
/// Re-evaluates when location changes so distances update automatically.
final mapAllRetailersProvider = FutureProvider<List<Retailer>>((ref) async {
  final retailers =
      await ref.read(retailerRepositoryProvider).getLiveRetailers();
  if (retailers.isEmpty) return [];

  final retailerIds = retailers.map((r) => r.id).toList();
  final featuredOffers = await ref
      .read(offersRepositoryProvider)
      .getFeaturedOffersByRetailers(retailerIds);

  final location = ref.watch(locationProvider);

  return retailers.map((r) {
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
      featuredOffer: featuredOffers[r.id],
    );
  }).toList();
});

// ── Map-filtered retailer list ────────────────────────────────────────────────

/// Live retailers that have coordinates, filtered by the current search query.
/// Used to populate both map markers and the bottom-sheet list.
final mapRetailersProvider = Provider<List<Retailer>>((ref) {
  final allAsync = ref.watch(mapAllRetailersProvider);
  final query =
      ref.watch(mapControllerProvider.select((s) => s.searchQuery));
  final all = allAsync.valueOrNull ?? [];

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
