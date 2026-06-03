import '../domain/profile.dart';
import '../domain/profile_repository.dart';
import 'profile_remote_data_source.dart';

class ProfileRepositoryImpl implements ProfileRepository {
  const ProfileRepositoryImpl(this._dataSource);

  final ProfileRemoteDataSource _dataSource;

  @override
  Future<Profile?> fetchProfile(String userId) =>
      _dataSource.fetchProfile(userId);

  @override
  Future<void> updateProfile({
    required String userId,
    String? fullName,
    String? phone,
    String? avatarUrl,
    String? paypalEmail,
  }) =>
      _dataSource.updateProfile(
        userId: userId,
        fullName: fullName,
        phone: phone,
        avatarUrl: avatarUrl,
        paypalEmail: paypalEmail,
      );
}
