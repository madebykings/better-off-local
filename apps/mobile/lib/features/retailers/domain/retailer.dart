import 'package:equatable/equatable.dart';

class Retailer extends Equatable {
  const Retailer({
    required this.id,
    required this.name,
    required this.categoryId,
    required this.isActive,
    this.logoUrl,
    this.coverUrl,
    this.shortDescription,
    this.distanceKm,
  });

  final String id;
  final String name;
  final String categoryId;
  final bool isActive;
  final String? logoUrl;
  final String? coverUrl;
  final String? shortDescription;
  final double? distanceKm;

  @override
  List<Object?> get props => [id, name, isActive];
}
