import 'package:firebase_messaging/firebase_messaging.dart';

/// Abstract interface for push notification handling.
/// Implemented by [FirebaseNotificationServiceImpl].
abstract class NotificationService {
  /// Initialise push notification handling and request OS permission.
  /// Must be called once during app startup, after [FirebaseApp] is
  /// initialised.
  Future<void> initialize();

  /// Returns the FCM/APNs device token for this installation, or null if
  /// permission was denied or the token is not yet available.
  Future<String?> getFcmToken();

  /// Fires whenever the FCM token is refreshed. The app should re-register
  /// the new token with the backend.
  Stream<String> get onTokenRefresh;

  /// Emits [RemoteMessage] objects while the app is in the foreground.
  Stream<RemoteMessage> get onMessage;

  /// Returns the [RemoteMessage] that caused the app to open from a
  /// terminated state, or null if the app was not launched from a
  /// notification.
  Future<RemoteMessage?> getInitialMessage();

  /// Emits the route payload string when the user taps a foreground local
  /// notification (Android only — iOS uses system presentation).  The payload
  /// is the value of the FCM message's `data['route']` field.
  /// Returns null if no route is embedded in the notification data.
  Stream<String?> get onNotificationTap;
}
