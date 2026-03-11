import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../data/redemptions_remote_data_source.dart';
import '../data/redemptions_repository_impl.dart';
import '../domain/redemption.dart';
import '../domain/redemptions_repository.dart';

final redemptionsRemoteDataSourceProvider =
    Provider<RedemptionsRemoteDataSource>(
  (ref) => RedemptionsRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final redemptionsRepositoryProvider = Provider<RedemptionsRepository>((ref) {
  final userId = ref.watch(sessionProvider).valueOrNull?.user.id ?? '';
  return RedemptionsRepositoryImpl(
    ref.watch(redemptionsRemoteDataSourceProvider),
    userId,
  );
});

/// Fetches the current user's redemption history, most recent first.
/// Re-fetches whenever the auth session changes.
final redemptionHistoryProvider = FutureProvider<List<Redemption>>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return [];
  return ref.read(redemptionsRepositoryProvider).getRedemptionHistory();
});
