import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../data/offers_remote_data_source.dart';
import '../data/offers_repository_impl.dart';
import '../domain/category.dart';
import '../domain/offer.dart';
import '../domain/offer_availability.dart';
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

/// Home screen offers: featured first, then most redeemed, then newest. Limited to 10.
final homeOffersProvider = FutureProvider<List<Offer>>((ref) async {
  final client = ref.read(supabaseClientProvider);
  final now = DateTime.now().toUtc().toIso8601String();
  final rows = await client
      .from('consumer_discovery_offers')
      .select('id, retailer_id, title, short_summary, value_text, offer_type, '
              'start_at, end_at, is_featured, image_url, estimated_saving_pence, '
              'redemption_count')
      .or('end_at.is.null,end_at.gt.$now')
      .or('start_at.is.null,start_at.lte.$now')
      .order('is_featured', ascending: false)
      .order('redemption_count', ascending: false)
      .order('created_at', ascending: false)
      .limit(10);

  return (rows as List).map((r) => Offer.fromDiscoveryMap(r)).toList();
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

/// Availability states for all offers at a given retailer.
/// Keyed by offer_id. consumerId is taken from the current session
/// (null for unauthenticated — will return requires_membership for all offers).
final retailerOffersAvailabilityProvider =
    FutureProvider.family<Map<String, OfferAvailability>, String>(
        (ref, retailerId) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  final ds = ref.read(offersRemoteDataSourceProvider);
  final rows = await ds.fetchRetailerOffersAvailability(
    retailerId: retailerId,
    consumerId: session?.user.id,
  );
  return {
    for (final row in rows)
      row['offer_id'] as String: OfferAvailability.fromMap(row),
  };
});

/// Availability state for a single offer.
/// Used on the offer detail screen as a pre-redemption gate check.
/// Returns null if the RPC returns no row (offer not found or retailer inactive).
final offerAvailabilityProvider =
    FutureProvider.family<OfferAvailability?, String>((ref, offerId) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  // Require authentication — unauthenticated users see the paywall, not this.
  if (session == null) {
    return OfferAvailability(
      offerId: offerId,
      state: OfferAvailabilityState.requiresMembership,
    );
  }
  final ds = ref.read(offersRemoteDataSourceProvider);
  final row = await ds.fetchOfferAvailability(
    offerId: offerId,
    consumerId: session.user.id,
  );
  if (row == null) return null;
  return OfferAvailability(
    offerId: offerId,
    state: OfferAvailabilityStateX.fromString(
      row['availability_state'] as String? ?? '',
    ),
    availableAt: row['available_at'] != null
        ? DateTime.parse(row['available_at'] as String)
        : null,
  );
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
