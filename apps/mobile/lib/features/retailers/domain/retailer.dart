import 'package:equatable/equatable.dart';

import '../../offers/domain/offer_summary.dart';

class Retailer extends Equatable {
  const Retailer({
    required this.id,
    required this.name,
    required this.slug,
    this.tagline,
    this.description,
    this.shortDescription,
    this.logoUrl,
    this.coverImageUrl,
    this.websiteUrl,
    this.phone,
    this.email,
    this.addressLine1,
    this.town,
    this.postcode,
    this.latitude,
    this.longitude,
    this.distanceKm,
    this.categories = const [],
    this.featuredOffer,
    this.activeOfferCount = 0,
  });

  final String id;
  final String name;
  final String slug;
  final String? tagline;
  final String? description;
  final String? shortDescription;
  final String? logoUrl;
  final String? coverImageUrl;
  final String? websiteUrl;
  final String? phone;
  final String? email;
  final String? addressLine1;
  final String? town;
  final String? postcode;
  final double? latitude;
  final double? longitude;
  final double? distanceKm;
  final List<String> categories;
  final OfferSummary? featuredOffer;
  final int activeOfferCount;

  String? get displayAddress {
    final parts = [addressLine1, town, postcode]
        .where((p) => p != null && p.isNotEmpty)
        .toList();
    return parts.isEmpty ? null : parts.join(', ');
  }

  /// Parses from the flat `consumer_discovery_retailers` view row.
  ///
  /// Location fields (`address_line_1`, `town`, `postcode`, `latitude`,
  /// `longitude`) are top-level columns. Categories arrive as a JSON array
  /// of name strings in `category_names`.
  factory Retailer.fromMap(Map<String, dynamic> map) {
    // category_names is a JSON array of strings from the view's json_agg.
    // PostgREST deserialises JSON columns as List<dynamic>.
    final catNames = map['category_names'];
    final categories = <String>[];
    if (catNames is List) {
      for (final n in catNames) {
        if (n is String) categories.add(n);
      }
    }

    return Retailer(
      id: map['id'] as String,
      name: map['name'] as String,
      slug: map['slug'] as String? ?? '',
      tagline: map['tagline'] as String?,
      description: map['description'] as String?,
      shortDescription: map['short_description'] as String?,
      logoUrl: map['logo_url'] as String?,
      coverImageUrl: map['cover_image_url'] as String?,
      websiteUrl: map['website_url'] as String?,
      phone: map['phone'] as String?,
      email: map['email'] as String?,
      addressLine1: map['address_line_1'] as String?,
      town: map['town'] as String?,
      postcode: map['postcode'] as String?,
      latitude: map['latitude'] != null
          ? double.tryParse(map['latitude'].toString())
          : null,
      longitude: map['longitude'] != null
          ? double.tryParse(map['longitude'].toString())
          : null,
      categories: categories,
      activeOfferCount: (map['active_offer_count'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [id, name, slug];
}
