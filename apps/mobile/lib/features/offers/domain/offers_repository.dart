import 'category.dart';
import 'offer.dart';
import 'offer_summary.dart';

abstract class OffersRepository {
  Future<List<Offer>> getOffers({String? categoryId});
  Future<Offer> getOffer(String offerId);
  Future<List<Offer>> getOffersByRetailer(String retailerId);
  Future<List<Category>> getCategories();
  Future<void> logOfferView({
    required String offerId,
    required String retailerId,
    String? profileId,
  });

  /// Home screen offers: featured → most redeemed → newest, capped at 10.
  Future<List<Offer>> getHomeOffers();

  /// Returns the best live offer per retailer, keyed by retailer ID.
  /// Featured offers take priority; oldest live offer is the fallback.
  Future<Map<String, OfferSummary>> getFeaturedOffersByRetailers(
      List<String> retailerIds);
}
