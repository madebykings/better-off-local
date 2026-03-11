import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/auth_state.dart';
import '../providers/auth_providers.dart';

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._ref) : super(const AuthInitial());

  final Ref _ref;

  Future<void> signIn(String email, String password) async {
    state = const AuthLoading();
    try {
      await _ref.read(authRepositoryProvider).signInWithEmail(email, password);
      // Session update is handled via sessionProvider stream / router redirect
    } catch (e) {
      state = AuthError(e.toString());
    }
  }

  Future<void> signUp(String email, String password) async {
    state = const AuthLoading();
    try {
      await _ref.read(authRepositoryProvider).signUpWithEmail(email, password);
    } catch (e) {
      state = AuthError(e.toString());
    }
  }

  Future<void> sendPasswordReset(String email) async {
    state = const AuthLoading();
    try {
      await _ref
          .read(authRepositoryProvider)
          .sendPasswordResetEmail(email);
      state = const AuthUnauthenticated();
    } catch (e) {
      state = AuthError(e.toString());
    }
  }

  Future<void> signOut() async {
    await _ref.read(authRepositoryProvider).signOut();
    state = const AuthUnauthenticated();
  }
}

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>(
  (ref) => AuthController(ref),
);
