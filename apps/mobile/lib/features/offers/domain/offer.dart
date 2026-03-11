import 'package:equatable/equatable.dart';

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

  bool get isLive => status == 'live';

  bool get isExpired =>
      endAt != null && endAt!.isBefore(DateTime.now().toUtc());

  factory Offer.fromMap(Map<String, dynamic> map) {
    final retailers = map['retailers'] as Map<String, dynamic>?;
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
    );
  }

  @override
  List<Object?> get props => [id, retailerId, title, status];
}
