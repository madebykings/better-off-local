import 'package:equatable/equatable.dart';

/// Reason a verification session was rejected by the server.
enum OnlineRejectionReason {
  /// Consumer does not have an active or trialing membership.
  membershipInactive,

  /// The session token has passed its TTL and can no longer be approved.
  sessionExpired,

  /// The session was already approved or consumed by a prior scan.
  sessionAlreadyConsumed,

  /// No matching session found — token may be invalid or non-BOL QR.
  sessionNotFound,

  /// Catch-all for unexpected server errors.
  unknown,
}

/// Result returned after the server successfully approves a verification session.
///
/// The server resolves the session token to retailer context so the app can
/// display a confirmation screen with retailer branding.
class VerificationSessionResult extends Equatable {
  const VerificationSessionResult({
    required this.sessionToken,
    required this.retailerName,
    this.retailerLogoUrl,
    this.offerTitle,
  });

  /// The UUID token that was scanned and approved.
  final String sessionToken;

  /// Display name of the retailer who initiated the session.
  final String retailerName;

  /// Optional retailer logo URL for branding in the confirmation screen.
  final String? retailerLogoUrl;

  /// Optional offer title if the session is tied to a specific offer.
  /// Null for general membership verification sessions.
  final String? offerTitle;

  factory VerificationSessionResult.fromMap(Map<String, dynamic> map) {
    return VerificationSessionResult(
      sessionToken: map['session_token'] as String,
      retailerName: map['retailer_name'] as String,
      retailerLogoUrl: map['retailer_logo_url'] as String?,
      offerTitle: map['offer_title'] as String?,
    );
  }

  @override
  List<Object?> get props =>
      [sessionToken, retailerName, retailerLogoUrl, offerTitle];
}
