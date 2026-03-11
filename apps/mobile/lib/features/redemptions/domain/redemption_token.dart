import 'package:equatable/equatable.dart';

/// Short-lived token returned by the `create-redemption-token` edge function.
/// The raw [token] string is encoded into a QR code for the retailer to scan.
/// It is never persisted — only the SHA-256 hash lives in the database.
class RedemptionToken extends Equatable {
  const RedemptionToken({
    required this.token,
    required this.offerId,
    required this.retailerId,
    required this.expiresAt,
  });

  /// Raw UUID token — encode this value into the QR code.
  final String token;
  final String offerId;
  final String retailerId;
  final DateTime expiresAt;

  bool get isExpired => expiresAt.isBefore(DateTime.now().toUtc());

  Duration get remainingTime {
    final remaining = expiresAt.difference(DateTime.now().toUtc());
    return remaining.isNegative ? Duration.zero : remaining;
  }

  factory RedemptionToken.fromMap(Map<String, dynamic> map) {
    return RedemptionToken(
      token: map['token'] as String,
      offerId: map['offer_id'] as String,
      retailerId: map['retailer_id'] as String,
      expiresAt: DateTime.parse(map['expires_at'] as String).toUtc(),
    );
  }

  @override
  List<Object?> get props => [token, offerId, expiresAt];
}
