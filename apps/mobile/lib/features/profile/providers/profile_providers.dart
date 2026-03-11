import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../data/profile_remote_data_source.dart';
import '../data/profile_repository_impl.dart';
import '../domain/profile.dart';
import '../domain/profile_repository.dart';

final profileRemoteDataSourceProvider = Provider<ProfileRemoteDataSource>(
  (ref) => ProfileRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final profileRepositoryProvider = Provider<ProfileRepository>(
  (ref) => ProfileRepositoryImpl(ref.watch(profileRemoteDataSourceProvider)),
);

/// Fetches the current user's profile whenever the auth session changes.
/// Returns null when unauthenticated or when no profile row exists.
final profileProvider = FutureProvider<Profile?>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return null;

  return ref
      .read(profileRepositoryProvider)
      .fetchProfile(session.user.id);
});
