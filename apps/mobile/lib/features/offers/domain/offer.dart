import 'package:equatable/equatable.dart';

class Offer extends Equatable {
  const Offer({
    required this.id,
    required this.retailerId,
    required this.title,
    required this.description,
    required this.categoryId,
    required this.discountDisplay,
    required this.expiresAt,
    this.imageUrl,
    this.distanceKm,
  });

  final String id;
  final String retailerId;
  final String title;
  final String description;
  final String categoryId;
  final String discountDisplay;
  final DateTime expiresAt;
  final String? imageUrl;
  final double? distanceKm;

  bool get isExpired => expiresAt.isBefore(DateTime.now());

  @override
  List<Object?> get props => [id, retailerId, title, expiresAt];
}
