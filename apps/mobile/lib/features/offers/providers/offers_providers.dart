import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../data/offers_remote_data_source.dart';
import '../data/offers_repository_impl.dart';
import '../domain/category.dart';
import '../domain/offer.dart';
import '../domain/offers_repository.dart';

final offersRemoteDataSourceProvider = Provider<OffersRemoteDataSource>(
  (ref) => OffersRemoteDataSource(ref.watch(supabaseClientProvider)),
);

final offersRepositoryProvider = Provider<OffersRepository>(
  (ref) => OffersRepositoryImpl(ref.watch(offersRemoteDataSourceProvider)),
);

/// Currently selected category filter (null = all categories).
final selectedCategoryProvider = StateProvider<String?>((ref) => null);

/// Live offers, optionally filtered by [selectedCategoryProvider].
final liveOffersProvider = FutureProvider<List<Offer>>((ref) {
  final categoryId = ref.watch(selectedCategoryProvider);
  return ref
      .read(offersRepositoryProvider)
      .getOffers(categoryId: categoryId);
});

/// Home screen offers: featured first, limited to 10.
final homeOffersProvider = FutureProvider<List<Offer>>((ref) async {
  final all = await ref.read(offersRepositoryProvider).getOffers();
  return all.take(10).toList();
});

/// Single offer detail by ID.
final offerProvider =
    FutureProvider.family<Offer, String>((ref, offerId) async {
  return ref.read(offersRepositoryProvider).getOffer(offerId);
});

/// Offers for a specific retailer.
final retailerOffersProvider =
    FutureProvider.family<List<Offer>, String>((ref, retailerId) async {
  return ref.read(offersRepositoryProvider).getOffersByRetailer(retailerId);
});

/// All active categories.
final categoriesProvider = FutureProvider<List<Category>>((ref) {
  return ref.read(offersRepositoryProvider).getCategories();
});

/// Logs an offer view fire-and-forget; reads profileId from session.
void logOfferView(WidgetRef ref, String offerId, String retailerId) {
  final session = ref.read(sessionProvider).valueOrNull;
  ref.read(offersRepositoryProvider).logOfferView(
        offerId: offerId,
        retailerId: retailerId,
        profileId: session?.user.id,
      );
}
