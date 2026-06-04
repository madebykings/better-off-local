import 'package:equatable/equatable.dart';

enum LoyaltyCardStatus { active, completed, claimed, expired }

class LoyaltyCard extends Equatable {
  const LoyaltyCard({
    required this.id,
    required this.offerId,
    required this.offerTitle,
    required this.retailerId,
    required this.retailerName,
    required this.stampsEarned,
    required this.stampsRequired,
    required this.status,
    required this.createdAt,
    this.rewardDescription,
    this.completedAt,
    this.claimedAt,
  });

  final String id;
  final String offerId;
  final String offerTitle;
  final String retailerId;
  final String retailerName;
  final int stampsEarned;
  final int stampsRequired;
  final LoyaltyCardStatus status;
  final DateTime createdAt;
  final String? rewardDescription;
  final DateTime? completedAt;
  final DateTime? claimedAt;

  bool get isComplete => status == LoyaltyCardStatus.completed || status == LoyaltyCardStatus.claimed;
  bool get isClaimed => status == LoyaltyCardStatus.claimed;

  double get progressFraction =>
      stampsRequired > 0 ? (stampsEarned / stampsRequired).clamp(0.0, 1.0) : 0.0;

  factory LoyaltyCard.fromMap(Map<String, dynamic> map) {
    final offers = map['offers'] as Map<String, dynamic>?;
    final retailers = map['retailers'] as Map<String, dynamic>?;
    final loyaltyConfig = offers?['offer_loyalty_config'] as Map<String, dynamic>?;

    LoyaltyCardStatus parseStatus(String s) => switch (s) {
          'completed' => LoyaltyCardStatus.completed,
          'claimed'   => LoyaltyCardStatus.claimed,
          'expired'   => LoyaltyCardStatus.expired,
          _           => LoyaltyCardStatus.active,
        };

    return LoyaltyCard(
      id:                map['id'] as String,
      offerId:           map['offer_id'] as String,
      offerTitle:        offers?['title'] as String? ?? '',
      retailerId:        map['retailer_id'] as String,
      retailerName:      retailers?['name'] as String? ?? '',
      stampsEarned:      map['stamps_earned'] as int? ?? 0,
      stampsRequired:    map['stamps_required'] as int? ?? 0,
      status:            parseStatus(map['status'] as String? ?? 'active'),
      createdAt:         DateTime.parse(map['created_at'] as String),
      rewardDescription: loyaltyConfig?['reward_description'] as String?,
      completedAt:       map['completed_at'] != null
          ? DateTime.parse(map['completed_at'] as String)
          : null,
      claimedAt:         map['claimed_at'] != null
          ? DateTime.parse(map['claimed_at'] as String)
          : null,
    );
  }

  @override
  List<Object?> get props => [id, stampsEarned, status];
}
