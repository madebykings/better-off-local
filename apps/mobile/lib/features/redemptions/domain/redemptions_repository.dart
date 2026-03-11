import 'redemption.dart';
import 'redemption_token.dart';

abstract class RedemptionsRepository {
  /// Request a short-lived redemption token from the server for a given offer.
  /// Server must validate membership entitlement before issuing the token.
  Future<RedemptionToken> requestRedemptionToken(String offerId);

  /// Fetch redemption history for the current user.
  Future<List<Redemption>> getRedemptionHistory();
}
