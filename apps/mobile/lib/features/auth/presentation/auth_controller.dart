import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;

import '../domain/auth_state.dart';
import '../providers/auth_providers.dart';

/// Parses Supabase [AuthException] messages into user-friendly strings.
String _parseAuthError(Object e) {
  if (e is AuthException) {
    return switch (e.message.toLowerCase()) {
      'invalid login credentials' => 'Incorrect email or password.',
      'email not confirmed' =>
        'Please verify your email address before signing in.',
      'user already registered' =>
        'An account with this email already exists.',
      'password should be at least 6 characters' =>
        'Password must be at least 8 characters.',
      'signup is disabled' =>
        'New registrations are currently disabled.',
      'email rate limit exceeded' =>
        'Too many attempts. Please wait a moment and try again.',
      _ => e.message,
    };
  }
  return 'Something went wrong. Please try again.';
}

class AuthController extends StateNotifier<AuthState> {
  AuthController(this._ref) : super(const AuthInitial());

  final Ref _ref;

  Future<void> signIn(String email, String password) async {
    state = const AuthLoading();
    try {
      await _ref.read(authRepositoryProvider).signInWithEmail(email, password);
      // Session change is propagated via sessionProvider stream → router redirect.
    } on AuthException catch (e) {
      state = AuthError(_parseAuthError(e));
    } catch (e) {
      state = AuthError(_parseAuthError(e));
    }
  }

  Future<void> signUp(String email, String password) async {
    state = const AuthLoading();
    try {
      final hasSession = await _ref
          .read(authRepositoryProvider)
          .signUpWithEmail(email, password);
      if (hasSession) {
        // Auto-confirmed — session stream fires and router redirects.
        state = const AuthInitial();
      } else {
        // Email confirmation required — no session yet, spinner must clear.
        state = AuthEmailConfirmationSent(email);
      }
    } on AuthException catch (e) {
      state = AuthError(_parseAuthError(e));
    } catch (e) {
      state = AuthError(_parseAuthError(e));
    }
  }

  Future<void> sendPasswordReset(String email) async {
    state = const AuthLoading();
    try {
      await _ref
          .read(authRepositoryProvider)
          .sendPasswordResetEmail(email);
      // Success — caller shows confirmation UI regardless of whether email exists.
      state = const AuthUnauthenticated();
    } on AuthException catch (e) {
      state = AuthError(_parseAuthError(e));
    } catch (e) {
      state = AuthError(_parseAuthError(e));
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
