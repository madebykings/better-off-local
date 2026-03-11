// TODO: implement using geolocator package

abstract class LocationService {
  /// Request location permission and return whether it was granted.
  Future<bool> requestPermission();

  /// Get the current device position.
  Future<({double latitude, double longitude})?> getCurrentPosition();

  /// Stream of position updates.
  Stream<({double latitude, double longitude})> get positionStream;
}
