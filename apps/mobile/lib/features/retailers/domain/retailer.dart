import 'package:equatable/equatable.dart';
import 'package:flutter/foundation.dart';

import '../../offers/domain/offer_summary.dart';

// ---------------------------------------------------------------------------
// Safe field parsers — the consumer_discovery_retailers view can return
// unexpected types (e.g. a boolean where a string is expected). These helpers
// prevent runtime cast errors and surface a sensible fallback instead.
// ---------------------------------------------------------------------------

String? _parseString(dynamic v) {
  if (v == null) return null;
  if (v is String) return v;
  return v.toString();
}

bool _parseBool(dynamic v) {
  if (v is bool) return v;
  if (v is String) return v.toLowerCase() == 'true';
  if (v is num) return v != 0;
  return false;
}

// ---------------------------------------------------------------------------

/// A single day's opening hours.
///
/// The DB JSON shape (written by admin/retailer portals) is:
///   { "open": bool, "all_day": bool, "start": "HH:MM"|null, "end": "HH:MM"|null }
///
/// Field mapping:
///   closed  ← !map['open']      (DB 'open' is a boolean: is this day open?)
///   allDay  ← map['all_day']    (true = open 24 hours; open/close ignored)
///   open    ← map['start']      (open time string e.g. "09:00")
///   close   ← map['end']        (close time string e.g. "17:00")
class DayHours {
  const DayHours({
    required this.open,
    required this.close,
    required this.closed,
    this.allDay = false,
  });

  final String open;    // open time e.g. "09:00"; empty when closed or all_day
  final String close;   // close time e.g. "17:00"; empty when closed or all_day
  final bool closed;    // true when DB open == false
  final bool allDay;    // true when DB all_day == true (open 24 hours)

  factory DayHours.fromMap(Map<String, dynamic> map) => DayHours(
        // DB 'open' is the is-open boolean — negate to get 'closed'.
        closed: !_parseBool(map['open']),
        allDay: _parseBool(map['all_day']),
        // DB uses 'start'/'end', not 'open'/'close'.
        open:  _parseString(map['start']) ?? '',
        close: _parseString(map['end'])   ?? '',
      );
}

/// Parsed opening hours keyed by lowercase day name (monday … sunday).
class OpeningHours {
  const OpeningHours(this.days);
  final Map<String, DayHours> days;

  factory OpeningHours.fromJson(Map<String, dynamic> json) {
    final result = OpeningHours({
      for (final entry in json.entries)
        if (entry.value is Map<String, dynamic>)
          entry.key: DayHours.fromMap(entry.value as Map<String, dynamic>),
    });
    if (kDebugMode) {
      final todayKey = _dayKey(DateTime.now().weekday);
      final today = result.days[todayKey];
      debugPrint('[OpeningHours] parsed days: ${result.days.map((k, v) => MapEntry(k, v.closed ? 'closed' : v.allDay ? '24h' : '${v.open}–${v.close}'))}');
      debugPrint('[OpeningHours] today=$todayKey: ${today == null ? 'null' : 'closed=${today.closed} allDay=${today.allDay} open="${today.open}" close="${today.close}"'}');
      debugPrint('[OpeningHours] isOpenNow=${result.isOpenNow} statusLabel="${result.statusLabel}"');
    }
    return result;
  }

  /// Returns "Open now · Closes at HH:MM" / "Open 24 hours" /
  /// "Closed · Opens {next}" or null when hours are unavailable.
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

    if (today.allDay) return 'Open 24 hours';

    final openTime = _parseTime(today.open, now);
    final closeTime = _parseTime(today.close, now);
    if (openTime == null || closeTime == null) return null;

    if (now.isAfter(openTime) && now.isBefore(closeTime)) {
      return 'Open now · Closes at ${today.close}';
    }
    if (now.isBefore(openTime)) {
      return 'Closed · Opens today at ${today.open}';
    }
    final next = _nextOpenDay(now);
    return 'Closed${next != null ? ' · Opens $next' : ''}';
  }

  bool get isOpenNow {
    final now = DateTime.now();
    final today = days[_dayKey(now.weekday)];
    if (today == null || today.closed) return false;
    if (today.allDay) return true;
    final openTime = _parseTime(today.open, now);
    final closeTime = _parseTime(today.close, now);
    if (openTime == null || closeTime == null) return false;
    return now.isAfter(openTime) && now.isBefore(closeTime);
  }

  /// True when the venue is open but closes within the next [minutesThreshold] minutes.
  bool isClosingSoon({int minutesThreshold = 30}) {
    final now = DateTime.now();
    final today = days[_dayKey(now.weekday)];
    // 24-hour venues never "close soon".
    if (today == null || today.closed || today.allDay) return false;
    final closeTime = _parseTime(today.close, now);
    if (closeTime == null) return false;
    return now.isBefore(closeTime) &&
        now.isAfter(closeTime.subtract(Duration(minutes: minutesThreshold)));
  }

  String? _nextOpenDay(DateTime from) {
    for (var i = 1; i <= 7; i++) {
      final next = from.add(Duration(days: i));
      final key = _dayKey(next.weekday);
      final h = days[key];
      if (h == null || h.closed) continue;
      final when = i == 1 ? 'tomorrow' : _capitalize(key);
      if (h.allDay) return when;
      if (h.open.isNotEmpty) return '$when at ${h.open}';
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
    this.isFeatured = false,
    this.createdAt,
    this.recentRedemptionCount = 0,
    this.favouriteCount = 0,
    this.primaryLocationId,
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

  /// True when the retailer is marked as featured in the backend.
  final bool isFeatured;

  /// When the retailer joined the platform — used for the ✨ New badge.
  final DateTime? createdAt;

  /// Successful redemptions at this retailer in the last 30 days — used for 🔥 Trending.
  /// Counted at retailer level (not venue-level) because many redemption rows
  /// have retailer_location_id = NULL. Equivalent to venue-level for
  /// single-venue retailers.
  final int recentRedemptionCount;

  /// Times saved as a favourite by consumers — used for ❤️ Member Favourite.
  final int favouriteCount;

  /// The primary venue's ID from the discovery view.
  /// Passed to toggleRetailerFavourite so each save is venue-attributed.
  final String? primaryLocationId;

  String? get displayAddress {
    final parts = [addressLine1, town, postcode]
        .where((p) => p != null && p.isNotEmpty)
        .toList();
    return parts.isEmpty ? null : parts.join(', ');
  }

  /// Parses from the flat `consumer_discovery_retailers` view row.
  /// Uses defensive helpers (_parseString, _parseBool) to survive any view
  /// columns that return unexpected types (e.g. bool where String is expected).
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
    if (kDebugMode) {
      debugPrint('[Retailer] "${map['name']}": raw opening_hours_json=$ohJson');
    }
    if (ohJson is Map<String, dynamic>) {
      openingHours = OpeningHours.fromJson(ohJson);
    }

    return Retailer(
      id: map['id'] as String,
      name: map['name'] as String,
      slug: _parseString(map['slug']) ?? '',
      tagline: _parseString(map['tagline']),
      description: _parseString(map['description']),
      shortDescription: _parseString(map['short_description']),
      logoUrl: _parseString(map['logo_url']),
      coverImageUrl: _parseString(map['cover_image_url']),
      websiteUrl: _parseString(map['website_url']),
      phone: _parseString(map['phone']),
      email: _parseString(map['email']),
      addressLine1: _parseString(map['address_line_1']),
      town: _parseString(map['town']),
      postcode: _parseString(map['postcode']),
      latitude: map['latitude'] != null
          ? double.tryParse(map['latitude'].toString())
          : null,
      longitude: map['longitude'] != null
          ? double.tryParse(map['longitude'].toString())
          : null,
      categories: categories,
      activeOfferCount: (map['active_offer_count'] as num?)?.toInt() ?? 0,
      openingHours: openingHours,
      isFeatured: _parseBool(map['is_featured']),
      createdAt: map['created_at'] != null
          ? DateTime.tryParse(map['created_at'].toString())
          : null,
      recentRedemptionCount:
          (map['recent_redemption_count'] as num?)?.toInt() ?? 0,
      favouriteCount: (map['favourite_count'] as num?)?.toInt() ?? 0,
      primaryLocationId: _parseString(map['primary_location_id']),
    );
  }

  @override
  List<Object?> get props => [id, name, slug];
}
