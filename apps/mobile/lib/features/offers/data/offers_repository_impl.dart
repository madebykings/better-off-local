import '../domain/category.dart';
import '../domain/offer.dart';
import '../domain/offers_repository.dart';
import 'offers_remote_data_source.dart';

class OffersRepositoryImpl implements OffersRepository {
  const OffersRepositoryImpl(this._dataSource);
  final OffersRemoteDataSource _dataSource;

  @override
  Future<List<Offer>> getOffers({String? categoryId}) async {
    final rows = await _dataSource.fetchOffers(categoryId: categoryId);
    return rows.map(Offer.fromMap).toList();
  }

  @override
  Future<Offer> getOffer(String offerId) async {
    final row = await _dataSource.fetchOffer(offerId);
    return Offer.fromMap(row);
  }

  @override
  Future<List<Offer>> getOffersByRetailer(String retailerId) async {
    final rows = await _dataSource.fetchOffersByRetailer(retailerId);
    return rows.map(Offer.fromMap).toList();
  }

  @override
  Future<List<Category>> getCategories() async {
    final rows = await _dataSource.fetchCategories();
    return rows.map(Category.fromMap).toList();
  }

  @override
  Future<void> logOfferView({
    required String offerId,
    required String retailerId,
    String? profileId,
  }) {
    return _dataSource.logOfferView(
      offerId: offerId,
      retailerId: retailerId,
      profileId: profileId,
    );
  }
}
