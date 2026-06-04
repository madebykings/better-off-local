import 'package:firebase_messaging/firebase_messaging.dart';

import 'notification_service.dart';

/// Firebase Messaging implementation of [NotificationService].
///
/// Usage: instantiate once and call [initialize] during app startup after
/// [Firebase.initializeApp()] completes.
class FirebaseNotificationServiceImpl implements NotificationService {
  FirebaseNotificationServiceImpl() : _messaging = FirebaseMessaging.instance;

  final FirebaseMessaging _messaging;

  @override
  Future<void> initialize() async {
    // Request OS-level permission (no-op on Android < 13 where permission is
    // granted at install time; shows system dialog on Android 13+ and iOS).
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    // Show heads-up notifications while the app is in the foreground on iOS.
    // On Android this is handled by the notification channel priority.
    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );
  }

  @override
  Future<String?> getFcmToken() => _messaging.getToken();

  @override
  Stream<String> get onTokenRefresh => _messaging.onTokenRefresh;

  @override
  Stream<RemoteMessage> get onMessage => FirebaseMessaging.onMessage;

  @override
  Future<RemoteMessage?> getInitialMessage() =>
      _messaging.getInitialMessage();
}
