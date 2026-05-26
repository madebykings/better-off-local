import 'package:supabase_flutter/supabase_flutter.dart';

class AuthRemoteDataSource {
  const AuthRemoteDataSource(this._client);
  final SupabaseClient _client;

  Future<void> signInWithEmail(String email, String password) async {
    await _client.auth.signInWithPassword(email: email, password: password);
  }

  /// Returns true when a session was created (email auto-confirmed),
  /// false when Supabase requires email confirmation before granting a session.
  Future<bool> signUpWithEmail(String email, String password) async {
    final response = await _client.auth.signUp(email: email, password: password);
    return response.session != null;
  }

  Future<void> sendPasswordResetEmail(String email) async {
    await _client.auth.resetPasswordForEmail(email);
  }

  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  String? get currentUserId => _client.auth.currentUser?.id;
}
