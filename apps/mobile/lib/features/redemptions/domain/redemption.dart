import 'package:equatable/equatable.dart';

enum RedemptionStatus {
  success,
  rejected,
  expired,
  ruleBlocked,
  membershipInvalid,
}

RedemptionStatus _statusFromString(String value) => switch (value) {
      'success' => RedemptionStatus.success,
      'expired' => RedemptionStatus.expired,
      'rule_blocked' => RedemptionStatus.ruleBlocked,
      'membership_invalid' => RedemptionStatus.membershipInvalid,
      _ => RedemptionStatus.rejected,
    };

class Redemption extends Equatable {
  const Redemption({
    required this.id,
    required this.offerId,
    required this.retailerId,
    required this.status,
    required this.redeemedAt,
    this.offerTitle,
    this.retailerName,
    this.retailerLogoUrl,
    this.rejectionReason,
  });

  final String id;
  final String offerId;
  final String? offerTitle;
  final String retailerId;
  final String? retailerName;
  final String? retailerLogoUrl;
  final RedemptionStatus status;
  final String? rejectionReason;
  final DateTime redeemedAt;

  bool get isSuccess => status == RedemptionStatus.success;

  factory Redemption.fromMap(Map<String, dynamic> map) {
    final offerData = map['offers'] as Map<String, dynamic>?;
    final retailerData = map['retailers'] as Map<String, dynamic>?;
    return Redemption(
      id: map['id'] as String,
      offerId: map['offer_id'] as String,
      offerTitle: offerData?['title'] as String?,
      retailerId: map['retailer_id'] as String,
      retailerName: retailerData?['name'] as String?,
      retailerLogoUrl: retailerData?['logo_url'] as String?,
      status: _statusFromString(map['status'] as String? ?? 'rejected'),
      rejectionReason: map['rejection_reason'] as String?,
      redeemedAt: DateTime.parse(map['redeemed_at'] as String),
    );
  }

  @override
  List<Object?> get props => [id, offerId, status, redeemedAt];
}
