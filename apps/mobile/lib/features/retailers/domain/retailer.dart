import 'package:equatable/equatable.dart';

import '../../offers/domain/offer_summary.dart';

/// A single day's opening hours.
class DayHours {
  const DayHours({required this.open, required this.close, required this.closed});
  final String open;   // e.g. "09:00"
  final String close;  // e.g. "17:00"
  final bool closed;

  factory DayHours.fromMap(Map<String, dynamic> map) => DayHours(
        open: map['open'] as String? ?? '',
        close: map['close'] as String? ?? '',
        closed: map['closed'] as bool? ?? false,
      );
}

/// Parsed opening hours keyed by lowercase day name (monday … sunday).
class OpeningHours {
  const OpeningHours(this.days);
  final Map<String, DayHours> days;

  factory OpeningHours.fromJson(Map<String, dynamic> json) {
    return OpeningHours({
      for (final entry in json.entries)
        entry.key: DayHours.fromMap(entry.value as Map<String, dynamic>),
    });
  }

  /// Returns "Open now · Closes at HH:MM" or "Closed · Opens {next}" or null.
  String? get statusLabel {
    final now = DateTime.now();
    final dayKey = _dayKey(now.weekday);
    final today = days[dayKey];
    if (today == null) return null;

    if (today.closed) {
      final next = _nextOpenDay(now);
      if (next == null) return 'Closed';
      return 'Closed · Opens $next';
    }

    final openTime = _parseTime(today.open, now);
    final closeTime = _parseTime(today.close, now);
    if (openTime == null || closeTime == null) return null;

    if (now.isAfter(openTime) && now.isBefore(closeTime)) {
      return 'Open now · Closes at ${today.close}';
    }
    if (now.isBefore(openTime)) {
      return 'Closed · Opens today at ${today.open}';
    }
    // After close — find next open day.
    final next = _nextOpenDay(now);
    return 'Closed${next != null ? ' · Opens $next' : ''}';
  }

  bool get isOpenNow {
    final now = DateTime.now();
    final today = days[_dayKey(now.weekday)];
    if (today == null || today.closed) return false;
    final openTime = _parseTime(today.open, now);
    final closeTime = _parseTime(today.close, now);
    if (openTime == null || closeTime == null) return false;
    return now.isAfter(openTime) && now.isBefore(closeTime);
  }

  String? _nextOpenDay(DateTime from) {
    for (var i = 1; i <= 7; i++) {
      final next = from.add(Duration(days: i));
      final key = _dayKey(next.weekday);
      final h = days[key];
      if (h != null && !h.closed && h.open.isNotEmpty) {
        if (i == 1) return 'tomorrow at ${h.open}';
        return '${_capitalize(key)} at ${h.open}';
      }
    }
    return null;
  }

  DateTime? _parseTime(String t, DateTime base) {
    final parts = t.split(':');
    if (parts.length != 2) return null;
    final h = int.tryParse(parts[0]);
    final m = int.tryParse(parts[1]);
    if (h == null || m == null) return null;
    return DateTime(base.year, base.month, base.day, h, m);
  }

  static String _dayKey(int weekday) {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return days[weekday - 1];
  }

  static String _capitalize(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);
}

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
    this.openingHours,
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
  final OpeningHours? openingHours;

  String? get displayAddress {
    final parts = [addressLine1, town, postcode]
        .where((p) => p != null && p.isNotEmpty)
        .toList();
    return parts.isEmpty ? null : parts.join(', ');
  }

  /// Parses from the flat `consumer_discovery_retailers` view row.
  factory Retailer.fromMap(Map<String, dynamic> map) {
    final catNames = map['category_names'];
    final categories = <String>[];
    if (catNames is List) {
      for (final n in catNames) {
        if (n is String) categories.add(n);
      }
    }

    OpeningHours? openingHours;
    final ohJson = map['opening_hours_json'];
    if (ohJson is Map<String, dynamic>) {
      openingHours = OpeningHours.fromJson(ohJson);
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
      openingHours: openingHours,
    );
  }

  @override
  List<Object?> get props => [id, name, slug];
}
