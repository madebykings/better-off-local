import 'category.dart';
import 'offer.dart';

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
}
