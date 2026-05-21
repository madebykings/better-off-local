import 'package:geolocator/geolocator.dart';

import 'location_service.dart';

class GeolocatorLocationService implements LocationService {
  const GeolocatorLocationService();

  @override
  Future<bool> requestPermission() async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.deniedForever) return false;
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.whileInUse ||
        permission == LocationPermission.always;
  }

  @override
  Future<({double latitude, double longitude})?> getCurrentPosition() async {
    try {
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.reduced,
        timeLimit: const Duration(seconds: 10),
      );
      return (latitude: pos.latitude, longitude: pos.longitude);
    } catch (_) {
      return null;
    }
  }

  @override
  Stream<({double latitude, double longitude})> get positionStream {
    return Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.reduced,
        distanceFilter: 100, // metres — avoids excessive updates while walking
      ),
    ).map((pos) => (latitude: pos.latitude, longitude: pos.longitude));
  }
}
