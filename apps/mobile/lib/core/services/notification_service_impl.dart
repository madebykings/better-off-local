import 'dart:async';
import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'notification_service.dart';

// ── Channel constants — must match AndroidManifest.xml meta-data ──────────────
const _kChannelId = 'bol_offers';
const _kChannelName = 'Offers & Updates';
const _kChannelDesc = 'New offers, loyalty updates, and local news from Better Off Local.';

/// Firebase Messaging implementation of [NotificationService].
///
/// Usage: instantiate once and call [initialize] during app startup after
/// [Firebase.initializeApp()] completes.  [initialize] is called without
/// awaiting in bootstrap so it never blocks [runApp].
class FirebaseNotificationServiceImpl implements NotificationService {
  FirebaseNotificationServiceImpl()
      : _messaging = FirebaseMessaging.instance,
        _localNotifications = FlutterLocalNotificationsPlugin(),
        _tapController = StreamController<String?>.broadcast();

  final FirebaseMessaging _messaging;
  final FlutterLocalNotificationsPlugin _localNotifications;
  final StreamController<String?> _tapController;

  @override
  Stream<String?> get onNotificationTap => _tapController.stream;

  @override
  Future<void> initialize() async {
    // ── Android: create high-importance notification channel ─────────────────
    //
    // Android 8+ requires a channel before any notification can be shown.
    // We create the channel here (idempotent — safe to call on every launch).
    // The channel ID must match:
    //   • AndroidManifest.xml:  default_notification_channel_id = bol_offers
    //   • FCM server payload:   android.notification.channel_id = bol_offers
    if (Platform.isAndroid) {
      const channel = AndroidNotificationChannel(
        _kChannelId,
        _kChannelName,
        description: _kChannelDesc,
        importance: Importance.high,
        playSound: true,
        enableVibration: true,
      );

      final androidPlugin = _localNotifications
          .resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();
      await androidPlugin?.createNotificationChannel(channel);
    }

    // ── Initialise flutter_local_notifications ───────────────────────────────
    //
    // Used on Android to display foreground FCM messages as visible
    // notifications.  On iOS, setForegroundNotificationPresentationOptions
    // handles foreground display via the system — flutter_local_notifications
    // is initialised here for cross-platform consistency but is not used to
    // show notifications on iOS.
    await _localNotifications.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@drawable/ic_notification'),
        iOS: DarwinInitializationSettings(
          // Permission is requested via firebase_messaging.requestPermission()
          // below; do not double-request here.
          requestAlertPermission: false,
          requestBadgePermission: false,
          requestSoundPermission: false,
        ),
      ),
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        // Foreground local notification tapped — emit the route payload.
        _tapController.add(response.payload);
      },
    );

    // ── Request OS-level notification permission ──────────────────────────────
    //
    // No-op on Android < 13 (permission granted at install time).
    // Shows system dialog on Android 13+ (API 33+) and iOS.
    await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    // ── iOS: show notifications while app is in foreground ───────────────────
    await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
      alert: true,
      badge: true,
      sound: true,
    );

    // ── Android: display foreground FCM messages as local notifications ───────
    //
    // On Android, FCM does not surface a visible notification when the app is
    // in the foreground — we must display one ourselves.  On iOS this is
    // handled by setForegroundNotificationPresentationOptions above.
    if (Platform.isAndroid) {
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        final notification = message.notification;
        if (notification == null) return;

        _localNotifications.show(
          // Use messageId hash as a stable notification ID.
          (message.messageId ?? notification.title ?? '').hashCode,
          notification.title,
          notification.body,
          const NotificationDetails(
            android: AndroidNotificationDetails(
              _kChannelId,
              _kChannelName,
              channelDescription: _kChannelDesc,
              importance: Importance.high,
              priority: Priority.high,
              icon: '@drawable/ic_notification',
            ),
          ),
          // Embed the target route so the tap handler can navigate.
          payload: message.data['route'] as String?,
        );
      });
    }

    debugPrint('[NotificationService] initialized');
  }

  @override
  Future<String?> getFcmToken() => _messaging.getToken();

  @override
  Stream<String> get onTokenRefresh => _messaging.onTokenRefresh;

  @override
  Stream<RemoteMessage> get onMessage => FirebaseMessaging.onMessage;

  @override
  Stream<RemoteMessage> get onMessageOpenedApp =>
      FirebaseMessaging.onMessageOpenedApp;

  @override
  Future<RemoteMessage?> getInitialMessage() => _messaging.getInitialMessage();
}
