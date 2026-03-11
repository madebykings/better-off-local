import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';
import '../data/retailers_remote_data_source.dart';
import '../data/retailers_repository_impl.dart';
import '../domain/retailer.dart';
import '../domain/retailer_repository.dart';

final retailersRemoteDataSourceProvider =
    Provider<RetailersRemoteDataSource>(
  (ref) => RetailersRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final retailerRepositoryProvider = Provider<RetailerRepository>(
  (ref) => RetailersRepositoryImpl(
      ref.watch(retailersRemoteDataSourceProvider)),
);

/// Fetch a single retailer by ID.
final retailerProvider =
    FutureProvider.family<Retailer, String>((ref, retailerId) async {
  return ref.read(retailerRepositoryProvider).getRetailer(retailerId);
});

/// All live retailers (for home screen featured section).
final liveRetailersProvider = FutureProvider<List<Retailer>>((ref) {
  return ref.read(retailerRepositoryProvider).getLiveRetailers();
});
