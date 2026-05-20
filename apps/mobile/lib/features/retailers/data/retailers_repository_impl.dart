import 'dart:math' as math;

import '../domain/retailer.dart';
import '../domain/retailer_repository.dart';
import 'retailers_remote_data_source.dart';

class RetailersRepositoryImpl implements RetailerRepository {
  const RetailersRepositoryImpl(this._dataSource);
  final RetailersRemoteDataSource _dataSource;

  @override
  Future<Retailer> getRetailer(String retailerId) async {
    final row = await _dataSource.fetchRetailer(retailerId);
    return Retailer.fromMap(row);
  }

  @override
  Future<List<Retailer>> getLiveRetailers() async {
    final rows = await _dataSource.fetchLiveRetailers();
    return rows.map(Retailer.fromMap).toList();
  }

  @override
  Future<List<Retailer>> getNearbyRetailers(
      double latitude, double longitude) async {
    // For hyper-local launch: fetch all live retailers and sort client-side.
    final all = await getLiveRetailers();
    final withDistance = all
        .map((r) {
          if (r.latitude == null || r.longitude == null) {
            return r;
          }
          final dist = _haversineKm(
              latitude, longitude, r.latitude!, r.longitude!);
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
            distanceKm: dist,
            categories: r.categories,
            featuredOffer: r.featuredOffer,
          );
        })
        .toList()
      ..sort((a, b) =>
          (a.distanceKm ?? double.infinity)
              .compareTo(b.distanceKm ?? double.infinity));
    return withDistance;
  }
}

/// Haversine formula: returns distance in km between two lat/lng points.
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
