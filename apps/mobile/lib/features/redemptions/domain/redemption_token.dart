import 'package:equatable/equatable.dart';

/// Short-lived token issued by the server that encodes redemption intent.
/// The retailer scans this and the server validates and records the redemption.
class RedemptionToken extends Equatable {
  const RedemptionToken({
    required this.token,
    required this.offerId,
    required this.expiresAt,
  });

  final String token;
  final String offerId;
  final DateTime expiresAt;

  bool get isExpired => expiresAt.isBefore(DateTime.now());

  @override
  List<Object?> get props => [token, offerId, expiresAt];
}
