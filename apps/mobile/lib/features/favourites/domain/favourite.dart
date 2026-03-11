import 'package:equatable/equatable.dart';

class Favourite extends Equatable {
  const Favourite({
    required this.id,
    required this.profileId,
    this.retailerId,
    this.offerId,
    required this.createdAt,
  });

  final String id;
  final String profileId;
  final String? retailerId;
  final String? offerId;
  final DateTime createdAt;

  bool get isOfferFavourite => offerId != null;
  bool get isRetailerFavourite => retailerId != null;

  factory Favourite.fromMap(Map<String, dynamic> map) {
    return Favourite(
      id: map['id'] as String,
      profileId: map['profile_id'] as String,
      retailerId: map['retailer_id'] as String?,
      offerId: map['offer_id'] as String?,
      createdAt: DateTime.parse(map['created_at'] as String),
    );
  }

  @override
  List<Object?> get props => [id, profileId, retailerId, offerId];
}
