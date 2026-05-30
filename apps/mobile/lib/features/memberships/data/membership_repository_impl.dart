import '../domain/membership.dart';
import '../domain/membership_repository.dart';
import 'membership_remote_data_source.dart';

class MembershipRepositoryImpl implements MembershipRepository {
  const MembershipRepositoryImpl(this._dataSource);

  final MembershipRemoteDataSource _dataSource;

  @override
  Future<Membership?> fetchMembership(String userId) async {
    final map = await _dataSource.fetchMembership(userId);
    if (map == null) return null;
    return Membership.fromMap(map);
  }

  @override
  Future<String> createCheckoutSession({required String plan}) =>
      _dataSource.createCheckoutSession(plan: plan);

  @override
  Future<String> createPortalSession() => _dataSource.createPortalSession();
}
