import 'redemption.dart';
import 'redemption_token.dart';

abstract class RedemptionsRepository {
  /// Request a short-lived redemption token for a specific offer.
  ///
  /// The server validates membership entitlement and offer rules before issuing.
  /// The returned token has non-null [RedemptionToken.offerId] and
  /// [RedemptionToken.retailerId]. Throws if the consumer is not entitled or
  /// the offer is not redeemable.
  Future<RedemptionToken> requestRedemptionToken(String offerId);

  /// Request a short-lived membership pass token.
  ///
  /// This is a membership-level token — it proves the consumer is an active
  /// BOL member without being tied to a specific offer or retailer.
  /// Used by the digital membership pass QR on the Card tab.
  ///
  /// The returned token has null [RedemptionToken.offerId] and
  /// [RedemptionToken.retailerId].
  Future<RedemptionToken> requestPassToken();

  /// Fetch the authenticated user's redemption history, most recent first.
  Future<List<Redemption>> getRedemptionHistory();
}
