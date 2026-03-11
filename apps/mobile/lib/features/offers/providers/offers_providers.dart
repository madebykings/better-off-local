import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';
import '../data/offers_remote_data_source.dart';
import '../data/offers_repository_impl.dart';
import '../domain/offers_repository.dart';

final offersRemoteDataSourceProvider = Provider<OffersRemoteDataSource>(
  (ref) => OffersRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final offersRepositoryProvider = Provider<OffersRepository>(
  (ref) => OffersRepositoryImpl(ref.watch(offersRemoteDataSourceProvider)),
);
