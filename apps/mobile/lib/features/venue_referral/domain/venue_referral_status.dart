import 'package:equatable/equatable.dart';

class VenueReferralStatus extends Equatable {
  const VenueReferralStatus({
    required this.offerId,
    required this.offerTitle,
    required this.shareToken,
    required this.shareUrl,
    required this.invitedCount,
    required this.unlockedCount,
    required this.redeemedCount,
    this.rewardTitle,
    this.platformReferralCode,
  });

  final String offerId;
  final String offerTitle;
  final String shareToken;
  final String shareUrl;
  final int invitedCount;
  final int unlockedCount;
  final int redeemedCount;
  final String? rewardTitle;
  final String? platformReferralCode;

  @override
  List<Object?> get props => [offerId, shareToken];
}

class VenueReferralReward extends Equatable {
  const VenueReferralReward({
    required this.id,
    required this.offerId,
    required this.offerTitle,
    required this.retailerName,
    required this.status,
    required this.unlockedAt,
    this.rewardTitle,
    this.redeemedAt,
  });

  final String id;
  final String offerId;
  final String offerTitle;
  final String retailerName;
  final String status;
  final DateTime unlockedAt;
  final String? rewardTitle;
  final DateTime? redeemedAt;

  factory VenueReferralReward.fromMap(Map<String, dynamic> map) {
    final offer = map['offer'] as Map<String, dynamic>?;
    final retailer = offer?['retailer'] as Map<String, dynamic>?;
    final config = map['config'] as Map<String, dynamic>?;
    return VenueReferralReward(
      id: map['id'] as String,
      offerId: map['offer_id'] as String,
      offerTitle: offer?['title'] as String? ?? 'Referral reward',
      retailerName: retailer?['name'] as String? ?? '',
      rewardTitle: config?['reward_title'] as String?,
      status: map['status'] as String? ?? 'unlocked',
      unlockedAt: DateTime.parse(map['unlocked_at'] as String),
      redeemedAt: map['redeemed_at'] != null
          ? DateTime.parse(map['redeemed_at'] as String)
          : null,
    );
  }

  bool get isUnlocked => status == 'unlocked';

  @override
  List<Object?> get props => [id, status];
}
