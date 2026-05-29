import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../data/membership_remote_data_source.dart';
import '../data/membership_repository_impl.dart';
import '../domain/membership.dart';
import '../domain/membership_repository.dart';

final membershipRemoteDataSourceProvider =
    Provider<MembershipRemoteDataSource>(
  (ref) => MembershipRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final membershipRepositoryProvider = Provider<MembershipRepository>(
  (ref) =>
      MembershipRepositoryImpl(ref.watch(membershipRemoteDataSourceProvider)),
);

/// Fetches the current user's membership whenever the auth session changes.
/// Returns null when unauthenticated or when no membership row exists.
final currentMembershipProvider = FutureProvider<Membership?>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) {
    debugPrint('[Membership] no session — returning null');
    return null;
  }

  final membership = await ref
      .read(membershipRepositoryProvider)
      .fetchMembership(session.user.id);

  debugPrint('[Membership] fetched: id=${membership?.id}, '
      'status=${membership?.status}, entitled=${membership?.isEntitled}');
  return membership;
});
