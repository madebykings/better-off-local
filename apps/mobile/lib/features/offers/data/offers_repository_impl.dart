import '../domain/offer.dart';
import '../domain/offers_repository.dart';
import 'offers_remote_data_source.dart';

class OffersRepositoryImpl implements OffersRepository {
  const OffersRepositoryImpl(this._dataSource);
  final OffersRemoteDataSource _dataSource;

  @override
  Future<List<Offer>> getOffers({String? categoryId, double? maxDistanceKm}) {
    throw UnimplementedError();
  }

  @override
  Future<Offer> getOffer(String offerId) {
    throw UnimplementedError();
  }

  @override
  Future<List<Offer>> getNearbyOffers(double latitude, double longitude) {
    throw UnimplementedError();
  }
}
