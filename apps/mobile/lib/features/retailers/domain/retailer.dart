import 'package:equatable/equatable.dart';

class Retailer extends Equatable {
  const Retailer({
    required this.id,
    required this.name,
    required this.slug,
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
  });

  final String id;
  final String name;
  final String slug;
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

  String? get displayAddress {
    final parts = [addressLine1, town, postcode]
        .where((p) => p != null && p.isNotEmpty)
        .toList();
    return parts.isEmpty ? null : parts.join(', ');
  }

  factory Retailer.fromMap(Map<String, dynamic> map) {
    Map<String, dynamic>? locationMap;
    final locations = map['retailer_locations'];
    if (locations is List && locations.isNotEmpty) {
      locationMap = (locations.firstWhere(
        (l) => l['is_primary'] == true,
        orElse: () => locations.first,
      ) as Map<String, dynamic>);
    } else if (locations is Map<String, dynamic>) {
      locationMap = locations;
    }

    return Retailer(
      id: map['id'] as String,
      name: map['name'] as String,
      slug: map['slug'] as String? ?? '',
      description: map['description'] as String?,
      shortDescription: map['short_description'] as String?,
      logoUrl: map['logo_url'] as String?,
      coverImageUrl: map['cover_image_url'] as String?,
      websiteUrl: map['website_url'] as String?,
      phone: map['phone'] as String?,
      email: map['email'] as String?,
      addressLine1: locationMap?['address_line_1'] as String?,
      town: locationMap?['town'] as String?,
      postcode: locationMap?['postcode'] as String?,
      latitude: locationMap?['latitude'] != null
          ? double.tryParse(locationMap!['latitude'].toString())
          : null,
      longitude: locationMap?['longitude'] != null
          ? double.tryParse(locationMap!['longitude'].toString())
          : null,
    );
  }

  @override
  List<Object?> get props => [id, name, slug];
}
