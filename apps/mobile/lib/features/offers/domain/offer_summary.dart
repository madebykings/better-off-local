import 'package:equatable/equatable.dart';

/// Lightweight offer model used for featured-offer display on retailer cards.
class OfferSummary extends Equatable {
  const OfferSummary({
    required this.id,
    required this.title,
    this.valueText,
    this.isFeatured = false,
  });

  final String id;
  final String title;
  final String? valueText;
  final bool isFeatured;

  factory OfferSummary.fromMap(Map<String, dynamic> map) {
    return OfferSummary(
      id: map['id'] as String,
      title: map['title'] as String,
      valueText: map['value_text'] as String?,
      isFeatured: map['is_featured'] as bool? ?? false,
    );
  }

  @override
  List<Object?> get props => [id];
}
