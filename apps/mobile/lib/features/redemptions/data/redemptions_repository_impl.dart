import '../domain/redemption.dart';
import '../domain/redemption_token.dart';
import '../domain/redemptions_repository.dart';
import 'redemptions_remote_data_source.dart';

class RedemptionsRepositoryImpl implements RedemptionsRepository {
  const RedemptionsRepositoryImpl(this._dataSource, this._userId);
  final RedemptionsRemoteDataSource _dataSource;
  final String _userId;

  @override
  Future<RedemptionToken> requestRedemptionToken(String offerId) async {
    final map = await _dataSource.requestRedemptionToken(offerId);
    return RedemptionToken.fromMap(map);
  }

  /// Returns a membership-level pass token (no offer_id / retailer_id).
  ///
  /// Delegates to [RedemptionsRemoteDataSource.requestPassToken], which
  /// currently throws [UnimplementedError] until the backend edge function is
  /// ready. [PassQRController] catches [UnimplementedError] and transitions to
  /// [PassQRPending] — a non-error placeholder state — so the card screen
  /// remains fully usable.
  @override
  Future<RedemptionToken> requestPassToken() async {
    final map = await _dataSource.requestPassToken();
    return RedemptionToken.fromMap(map);
  }

  @override
  Future<List<Redemption>> getRedemptionHistory() async {
    final rows = await _dataSource.fetchRedemptionHistory(_userId);
    return rows.map(Redemption.fromMap).toList();
  }
}
