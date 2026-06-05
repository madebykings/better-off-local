import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/env.dart';
import '../../core/services/notification_service.dart';
import '../../core/services/notification_service_impl.dart';
import '../app.dart';

/// Top-level background message handler.
/// Must be a top-level function so Firebase can invoke it from an isolate.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('[FCM] background message: ${message.messageId}');
}

/// No-op notification service used when Firebase is unavailable.
/// All methods are safe stubs that return empty/null values.
class _NoOpNotificationService implements NotificationService {
  const _NoOpNotificationService();

  @override
  Future<void> initialize() async {}

  @override
  Future<String?> getFcmToken() async => null;

  @override
  Stream<String> get onTokenRefresh => Stream.empty();

  @override
  Stream<RemoteMessage> get onMessage => Stream.empty();

  @override
  Future<RemoteMessage?> getInitialMessage() async => null;

  @override
  Stream<String?> get onNotificationTap => Stream.empty();
}

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();
  debugPrint('[Bootstrap] Starting');

  // ── Firebase — best-effort, must never block startup ────────────────────
  //
  // Firebase may be unavailable (emulator, unconfigured project, no Play
  // Services on some Android builds).  We must not block runApp on:
  //   • Firebase.initializeApp()   — can throw if google-services.json absent
  //   • requestPermission()        — shows OS dialog; can hang indefinitely
  //
  // Strategy: try to initialise Firebase with a timeout; if anything fails
  // fall back to a no-op service and continue.  The permission request and
  // FCM token registration are always fire-and-forget.
  NotificationService notificationService = const _NoOpNotificationService();
  try {
    await Firebase.initializeApp()
        .timeout(const Duration(seconds: 10));
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    debugPrint('[Bootstrap] Firebase initialized');

    final firebaseSvc = FirebaseNotificationServiceImpl();

    // Do NOT await initialize() — requestPermission() shows an OS dialog and
    // can hang indefinitely.  runApp must not wait for it.
    unawaited(
      firebaseSvc.initialize().catchError((Object e) {
        debugPrint('[Bootstrap] Firebase notification init error: $e');
      }),
    );

    notificationService = firebaseSvc;
  } on TimeoutException {
    debugPrint('[Bootstrap] Firebase init timed out — push notifications disabled');
  } catch (e) {
    debugPrint('[Bootstrap] Firebase unavailable — push notifications disabled: $e');
  }

  // ── Supabase ─────────────────────────────────────────────────────────────
  debugPrint('[Bootstrap] Initializing Supabase');
  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );
  debugPrint('[Bootstrap] Supabase initialized');

  // ── Launch ───────────────────────────────────────────────────────────────
  debugPrint('[Bootstrap] Running app');
  runApp(
    ProviderScope(
      overrides: [
        notificationServiceProvider.overrideWithValue(notificationService),
      ],
      child: const App(),
    ),
  );
}

/// Provides the [NotificationService] singleton to the widget tree.
/// Overridden in [bootstrap] with the initialized instance (real or no-op).
final notificationServiceProvider = Provider<NotificationService>((_) {
  throw UnimplementedError(
    'notificationServiceProvider was not overridden — '
    'ensure bootstrap() is called before runApp().',
  );
});
