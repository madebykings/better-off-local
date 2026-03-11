import 'offer.dart';

abstract class OffersRepository {
  Future<List<Offer>> getOffers({String? categoryId, double? maxDistanceKm});
  Future<Offer> getOffer(String offerId);
  Future<List<Offer>> getNearbyOffers(double latitude, double longitude);
}
