import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';
import '../data/redemptions_remote_data_source.dart';
import '../data/redemptions_repository_impl.dart';
import '../domain/redemptions_repository.dart';

final redemptionsRemoteDataSourceProvider =
    Provider<RedemptionsRemoteDataSource>(
  (ref) => RedemptionsRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final redemptionsRepositoryProvider = Provider<RedemptionsRepository>(
  (ref) => RedemptionsRepositoryImpl(
    ref.watch(redemptionsRemoteDataSourceProvider),
  ),
);
