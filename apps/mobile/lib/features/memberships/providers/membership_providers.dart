import 'package:flutter_riverpod/flutter_riverpod.dart';

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

final currentMembershipProvider = FutureProvider<Membership?>((ref) async {
  return ref.watch(membershipRepositoryProvider).getCurrentMembership();
});
