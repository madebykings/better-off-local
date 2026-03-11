// TODO: implement using firebase_messaging or supabase realtime

abstract class NotificationService {
  /// Initialise push notification handling and request permission.
  Future<void> init();

  /// Get the FCM/APNs device token for registration with backend.
  Future<String?> getDeviceToken();

  /// Stream of incoming notification payloads while app is in foreground.
  Stream<Map<String, dynamic>> get onForegroundMessage;
}
