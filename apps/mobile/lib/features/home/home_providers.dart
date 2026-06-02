import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/location_provider.dart';
import '../offers/providers/offers_providers.dart';
import '../retailers/domain/retailer.dart';
import '../retailers/providers/retailer_providers.dart';

/// Home-screen enriched retailer list.
///
/// Fetches all live retailers, attaches their best featured offer, computes
/// haversine distance from the current [locationProvider], filters to
/// [HOME_DISCOVERY_RADIUS_KM] km (default 25), and sorts nearest-first
/// (retailers without a location are sorted last).
final homeRetailersProvider = FutureProvider<List<Retailer>>((ref) async {
  const radiusKm = int.fromEnvironment(
    'HOME_DISCOVERY_RADIUS_KM',
    defaultValue: 25,
  );

  final retailers = await ref.read(retailerRepositoryProvider).getLiveRetailers();
  if (retailers.isEmpty) return [];

  final retailerIds = retailers.map((r) => r.id).toList();
  final featuredOffers = await ref
      .read(offersRepositoryProvider)
      .getFeaturedOffersByRetailers(retailerIds);

  final location = ref.read(locationProvider);

  var enriched = retailers.map((r) {
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
      activeOfferCount: r.activeOfferCount,
      openingHours: r.openingHours,
      isFeatured: r.isFeatured,
    );
  }).toList();

  // Filter by radius when location is available.
  if (location != null) {
    enriched = enriched
        .where((r) => r.distanceKm == null || r.distanceKm! <= radiusKm)
        .toList();
  }

  // Sort nearest-first; retailers without location data go last.
  enriched.sort((a, b) {
    final da = a.distanceKm ?? double.infinity;
    final db = b.distanceKm ?? double.infinity;
    return da.compareTo(db);
  });

  return enriched;
});

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
