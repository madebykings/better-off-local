import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

class Offer extends Equatable {
  const Offer({
    required this.id,
    required this.retailerId,
    required this.retailerName,
    required this.title,
    required this.status,
    this.shortSummary,
    this.description,
    this.offerType,
    this.valueText,
    this.termsText,
    this.startAt,
    this.endAt,
    this.isFeatured = false,
    this.imageUrl,
    this.retailerLogoUrl,
    this.distanceKm,
    // Offer rules (nullable — offer may have no rules row)
    this.maxRedemptionsPerUser,
    this.maxRedemptionsPerDay,
    this.maxRedemptionsTotal,
    this.cooldownHours,
    this.newCustomersOnly = false,
  });

  final String id;
  final String retailerId;
  final String retailerName;
  final String title;
  final String status;
  final String? shortSummary;
  final String? description;
  final String? offerType;
  final String? valueText;
  final String? termsText;
  final DateTime? startAt;
  final DateTime? endAt;
  final bool isFeatured;
  final String? imageUrl;
  final String? retailerLogoUrl;
  final double? distanceKm;

  // Offer rules
  final int? maxRedemptionsPerUser;
  final int? maxRedemptionsPerDay;
  final int? maxRedemptionsTotal;
  final int? cooldownHours;
  final bool newCustomersOnly;

  bool get isLive => status == 'live';

  bool get isExpired =>
      endAt != null && endAt!.isBefore(DateTime.now().toUtc());

  /// Short label for the redemption limit row on offer cards.
  String get redemptionLimitLabel {
    if (newCustomersOnly) return 'New customers only';
    if (maxRedemptionsPerUser == 1) return 'One use per member';
    if (maxRedemptionsPerDay == 1) return 'Once per member per day';
    if (cooldownHours != null) {
      final days = (cooldownHours! / 24).round();
      return 'Available every $days day${days == 1 ? '' : 's'}';
    }
    if (maxRedemptionsTotal != null) {
      return 'Capped at $maxRedemptionsTotal uses total';
    }
    return 'Unlimited redemptions';
  }

  /// Icon for the redemption limit row.
  IconData get redemptionLimitIcon {
    if (newCustomersOnly) return Icons.star_outline;
    if (maxRedemptionsPerUser == 1) return Icons.person_outline;
    if (maxRedemptionsPerDay == 1) return Icons.today_outlined;
    if (cooldownHours != null) return Icons.schedule_outlined;
    if (maxRedemptionsTotal != null) return Icons.bar_chart_outlined;
    return Icons.all_inclusive;
  }

  /// Background color for the offer value badge on the card image.
  Color badgeColor(BuildContext context) {
    final type = offerType ?? '';
    final text = (valueText ?? '').toLowerCase();

    if (type == 'free_item' || text.startsWith('free')) {
      return const Color(0xFFF97316); // orange
    }
    if (type == 'fixed_discount' || text.contains('£')) {
      return const Color(0xFF3B82F6); // blue
    }
    if (type == 'bundle' || type == 'buy_one_get_one' ||
        text.contains('bogof') || text.contains('2 for') || text.contains('bogo')) {
      return const Color(0xFF8B5CF6); // purple
    }
    if (type == 'meal_deal' || text.contains('deal') || text.contains('meal')) {
      return const Color(0xFFEA580C); // deep orange
    }
    // Default: green (percentage_discount, other)
    return const Color(0xFF2D6A4F);
  }

  factory Offer.fromMap(Map<String, dynamic> map) {
    final retailers = map['retailers'] as Map<String, dynamic>?;
    final rules = map['offer_rules'] as Map<String, dynamic>?;

    return Offer(
      id: map['id'] as String,
      retailerId: map['retailer_id'] as String,
      retailerName: retailers?['name'] as String? ?? '',
      title: map['title'] as String,
      status: map['status'] as String? ?? 'draft',
      shortSummary: map['short_summary'] as String?,
      description: map['description'] as String?,
      offerType: map['offer_type'] as String?,
      valueText: map['value_text'] as String?,
      termsText: map['terms_text'] as String?,
      startAt: map['start_at'] != null
          ? DateTime.parse(map['start_at'] as String)
          : null,
      endAt: map['end_at'] != null
          ? DateTime.parse(map['end_at'] as String)
          : null,
      isFeatured: map['is_featured'] as bool? ?? false,
      imageUrl: map['image_url'] as String?,
      retailerLogoUrl: retailers?['logo_url'] as String?,
      // Rules (from joined offer_rules row; null if no rules set)
      maxRedemptionsPerUser: rules?['max_redemptions_per_user'] as int?,
      maxRedemptionsPerDay: rules?['max_redemptions_per_day'] as int?,
      maxRedemptionsTotal: rules?['max_redemptions_total'] as int?,
      cooldownHours: rules?['cooldown_hours'] as int?,
      newCustomersOnly: rules?['new_customers_only'] as bool? ?? false,
    );
  }

  /// Constructs from a `consumer_discovery_offers` view row.
  /// The view exposes flat retailer info and rules fields directly.
  factory Offer.fromDiscoveryMap(Map<String, dynamic> map) {
    return Offer(
      id: map['id'] as String,
      retailerId: map['retailer_id'] as String,
      retailerName: map['retailer_name'] as String? ?? '',
      title: map['title'] as String,
      status: 'live',
      shortSummary: map['short_summary'] as String?,
      offerType: map['offer_type'] as String?,
      valueText: map['value_text'] as String?,
      startAt: map['start_at'] != null
          ? DateTime.parse(map['start_at'] as String)
          : null,
      endAt: map['end_at'] != null
          ? DateTime.parse(map['end_at'] as String)
          : null,
      isFeatured: map['is_featured'] as bool? ?? false,
      imageUrl: map['image_url'] as String?,
      retailerLogoUrl: map['retailer_logo_url'] as String?,
      maxRedemptionsPerUser: map['max_redemptions_per_user'] as int?,
      maxRedemptionsPerDay: map['max_redemptions_per_day'] as int?,
      maxRedemptionsTotal: map['max_redemptions_total'] as int?,
      cooldownHours: map['cooldown_hours'] as int?,
      newCustomersOnly: map['new_customers_only'] as bool? ?? false,
    );
  }

  @override
  List<Object?> get props => [id, retailerId, title, status];
}
