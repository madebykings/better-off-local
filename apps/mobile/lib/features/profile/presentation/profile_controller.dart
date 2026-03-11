import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../providers/profile_providers.dart';

sealed class ProfileUpdateState {
  const ProfileUpdateState();
}

class ProfileUpdateIdle extends ProfileUpdateState {
  const ProfileUpdateIdle();
}

class ProfileUpdateLoading extends ProfileUpdateState {
  const ProfileUpdateLoading();
}

class ProfileUpdateSuccess extends ProfileUpdateState {
  const ProfileUpdateSuccess();
}

class ProfileUpdateError extends ProfileUpdateState {
  const ProfileUpdateError(this.message);
  final String message;
}

class ProfileController extends StateNotifier<ProfileUpdateState> {
  ProfileController(this._ref) : super(const ProfileUpdateIdle());

  final Ref _ref;

  Future<void> completeProfile({required String fullName}) async {
    state = const ProfileUpdateLoading();
    try {
      final session = _ref.read(sessionProvider).valueOrNull;
      if (session == null) {
        state = const ProfileUpdateError('Session expired. Please sign in again.');
        return;
      }

      await _ref.read(profileRepositoryProvider).updateProfile(
            userId: session.user.id,
            fullName: fullName.trim(),
          );

      // Invalidate profileProvider so the router re-evaluates after update.
      _ref.invalidate(profileProvider);
      state = const ProfileUpdateSuccess();
    } catch (_) {
      state = const ProfileUpdateError('Failed to save profile. Please try again.');
    }
  }

  Future<void> updateProfile({
    String? fullName,
    String? phone,
    String? avatarUrl,
  }) async {
    state = const ProfileUpdateLoading();
    try {
      final session = _ref.read(sessionProvider).valueOrNull;
      if (session == null) {
        state = const ProfileUpdateError('Session expired. Please sign in again.');
        return;
      }

      await _ref.read(profileRepositoryProvider).updateProfile(
            userId: session.user.id,
            fullName: fullName,
            phone: phone,
            avatarUrl: avatarUrl,
          );

      _ref.invalidate(profileProvider);
      state = const ProfileUpdateSuccess();
    } catch (_) {
      state = const ProfileUpdateError('Failed to save profile. Please try again.');
    }
  }
}

final profileControllerProvider =
    StateNotifierProvider<ProfileController, ProfileUpdateState>(
  (ref) => ProfileController(ref),
);
