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
  });

  final String offerId;
  final String offerTitle;
  final String shareToken;
  final String shareUrl;
  final int invitedCount;
  final int unlockedCount;
  final int redeemedCount;

  @override
  List<Object?> get props => [offerId, shareToken];
}

class VenueReferralReward extends Equatable {
  const VenueReferralReward({
    required this.id,
    required this.offerId,
    required this.offerTitle,
    required this.status,
    required this.unlockedAt,
    this.redeemedAt,
  });

  final String id;
  final String offerId;
  final String offerTitle;
  final String status;
  final DateTime unlockedAt;
  final DateTime? redeemedAt;

  factory VenueReferralReward.fromMap(Map<String, dynamic> map) {
    final offer = map['offer'] as Map<String, dynamic>?;
    return VenueReferralReward(
      id: map['id'] as String,
      offerId: map['offer_id'] as String,
      offerTitle: offer?['title'] as String? ?? 'Referral reward',
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
