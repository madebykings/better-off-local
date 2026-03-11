import '../domain/redemption.dart';
import '../domain/redemption_token.dart';
import '../domain/redemptions_repository.dart';
import 'redemptions_remote_data_source.dart';

class RedemptionsRepositoryImpl implements RedemptionsRepository {
  const RedemptionsRepositoryImpl(this._dataSource);
  final RedemptionsRemoteDataSource _dataSource;

  @override
  Future<RedemptionToken> requestRedemptionToken(String offerId) {
    throw UnimplementedError();
  }

  @override
  Future<List<Redemption>> getRedemptionHistory() {
    throw UnimplementedError();
  }
}
