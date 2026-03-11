// TODO: implement connectivity monitoring
// Recommended package: connectivity_plus
// This service should expose a stream of connectivity status and a sync check.

abstract class ConnectivityService {
  Future<bool> isConnected();
  Stream<bool> get onConnectivityChanged;
}
