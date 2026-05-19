import '../domain/online_redemption_repository.dart';
import '../domain/verification_session_result.dart';
import 'online_redemption_remote_data_source.dart';

class OnlineRedemptionRepositoryImpl implements OnlineRedemptionRepository {
  const OnlineRedemptionRepositoryImpl(this._dataSource);
  final OnlineRedemptionRemoteDataSource _dataSource;

  /// Approves a verification session and returns retailer context.
  ///
  /// Delegates to [OnlineRedemptionRemoteDataSource.approveSession].
  /// Currently throws [UnimplementedError] until the backend edge function is
  /// deployed. [OnlineScanController] catches [UnimplementedError] and
  /// transitions to [OnlineScanPending] — a non-error placeholder state.
  @override
  Future<VerificationSessionResult> approveSession(String sessionToken) async {
    final map = await _dataSource.approveSession(sessionToken);
    return VerificationSessionResult.fromMap(map);
  }
}
