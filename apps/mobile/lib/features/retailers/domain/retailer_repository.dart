import 'retailer.dart';

abstract class RetailerRepository {
  Future<Retailer> getRetailer(String retailerId);
  Future<List<Retailer>> getNearbyRetailers(double latitude, double longitude);
}
