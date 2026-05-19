import 'package:equatable/equatable.dart';

/// Short-lived token returned by the BOL backend for QR-based verification.
///
/// Two distinct uses:
///
/// 1. **Offer redemption** (via `create-redemption-token` edge function):
///    Issued for a specific [offerId] at a specific [retailerId]. Scanned by
///    the retailer portal to record a redemption. Both fields are non-null.
///
/// 2. **Membership pass** (via `create-membership-pass-token` edge function,
///    not yet implemented): Proves active BOL membership without tying to a
///    specific offer. [offerId] and [retailerId] are null in this case.
///
/// The raw [token] string is encoded into a QR code. It is never persisted —
/// only the SHA-256 hash lives in the database.
class RedemptionToken extends Equatable {
  const RedemptionToken({
    required this.token,
    required this.expiresAt,
    this.offerId,
    this.retailerId,
  });

  /// Raw UUID token — encode this value into the QR code.
  final String token;

  /// Non-null for offer-specific redemption tokens.
  /// Null for membership-level pass tokens.
  final String? offerId;

  /// Non-null for offer-specific redemption tokens.
  /// Null for membership-level pass tokens.
  final String? retailerId;

  final DateTime expiresAt;

  bool get isExpired => expiresAt.isBefore(DateTime.now().toUtc());

  Duration get remainingTime {
    final remaining = expiresAt.difference(DateTime.now().toUtc());
    return remaining.isNegative ? Duration.zero : remaining;
  }

  factory RedemptionToken.fromMap(Map<String, dynamic> map) {
    return RedemptionToken(
      token: map['token'] as String,
      offerId: map['offer_id'] as String?,
      retailerId: map['retailer_id'] as String?,
      expiresAt: DateTime.parse(map['expires_at'] as String).toUtc(),
    );
  }

  @override
  List<Object?> get props => [token, offerId, expiresAt];
}
