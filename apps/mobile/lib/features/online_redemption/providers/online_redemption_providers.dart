import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';
import '../data/online_redemption_remote_data_source.dart';
import '../data/online_redemption_repository_impl.dart';
import '../domain/online_redemption_repository.dart';

final onlineRedemptionRemoteDataSourceProvider =
    Provider<OnlineRedemptionRemoteDataSource>(
  (ref) => OnlineRedemptionRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final onlineRedemptionRepositoryProvider =
    Provider<OnlineRedemptionRepository>(
  (ref) => OnlineRedemptionRepositoryImpl(
    ref.watch(onlineRedemptionRemoteDataSourceProvider),
  ),
);
