import 'redemption.dart';
import 'redemption_token.dart';

abstract class RedemptionsRepository {
  /// Request a short-lived redemption token from the server for a given offer.
  /// The server validates membership entitlement and offer rules before issuing.
  /// Throws if the consumer is not entitled or the offer is not redeemable.
  Future<RedemptionToken> requestRedemptionToken(String offerId);

  /// Fetch the authenticated user's redemption history, most recent first.
  Future<List<Redemption>> getRedemptionHistory();
}
