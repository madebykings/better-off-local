import '../domain/auth_repository.dart';
import 'auth_remote_data_source.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl(this._dataSource);
  final AuthRemoteDataSource _dataSource;

  @override
  Future<void> signInWithEmail(String email, String password) =>
      _dataSource.signInWithEmail(email, password);

  @override
  Future<bool> signUpWithEmail(String email, String password) =>
      _dataSource.signUpWithEmail(email, password);

  @override
  Future<void> sendPasswordResetEmail(String email) =>
      _dataSource.sendPasswordResetEmail(email);

  @override
  Future<void> signOut() => _dataSource.signOut();

  @override
  String? get currentUserId => _dataSource.currentUserId;
}
