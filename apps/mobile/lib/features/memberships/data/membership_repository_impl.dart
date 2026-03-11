import '../domain/membership.dart';
import '../domain/membership_repository.dart';
import 'membership_remote_data_source.dart';

class MembershipRepositoryImpl implements MembershipRepository {
  const MembershipRepositoryImpl(this._dataSource);
  final MembershipRemoteDataSource _dataSource;

  @override
  Future<Membership?> getCurrentMembership() {
    // TODO: implement
    throw UnimplementedError();
  }

  @override
  Future<Membership?> getMembership(String membershipId) {
    // TODO: implement
    throw UnimplementedError();
  }
}
