import '../domain/category.dart';
import '../domain/offer.dart';
import '../domain/offer_summary.dart';
import '../domain/offers_repository.dart';
import 'offers_remote_data_source.dart';

class OffersRepositoryImpl implements OffersRepository {
  const OffersRepositoryImpl(this._dataSource);
  final OffersRemoteDataSource _dataSource;

  @override
  Future<List<Offer>> getOffers({String? categoryId}) async {
    final rows = await _dataSource.fetchOffers(categoryId: categoryId);
    return rows.map(Offer.fromDiscoveryMap).toList();
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

  @override
  Future<Map<String, OfferSummary>> getFeaturedOffersByRetailers(
      List<String> retailerIds) async {
    if (retailerIds.isEmpty) return {};
    final rows =
        await _dataSource.fetchFeaturedOfferForRetailers(retailerIds);
    final result = <String, OfferSummary>{};
    for (final row in rows) {
      final retailerId = row['retailer_id'] as String;
      // First result per retailer wins (ordered: featured desc, created_at asc).
      if (!result.containsKey(retailerId)) {
        result[retailerId] = OfferSummary.fromMap(row);
      }
    }
    return result;
  }
}
