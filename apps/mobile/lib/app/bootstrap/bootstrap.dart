import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/env.dart';
import '../../core/providers/analytics_provider.dart';
import '../../core/services/analytics_service.dart';
import '../../core/services/analytics_service_impl.dart';
import '../../core/services/analytics_service_noop.dart';
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
  Stream<RemoteMessage> get onMessageOpenedApp => Stream.empty();

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
  // Services on some Android builds, or missing config files).  We must not
  // block runApp on any Firebase call.
  //
  // Strategy: try to initialise Firebase with a timeout; if anything fails
  // fall back to no-op services and continue.  The permission request and
  // FCM token registration are always fire-and-forget.
  NotificationService notificationService = const _NoOpNotificationService();
  AnalyticsService analyticsService = const AnalyticsServiceNoop();

  try {
    await Firebase.initializeApp().timeout(const Duration(seconds: 10));
    debugPrint('[Bootstrap] Firebase initialized');

    // ── Crashlytics ────────────────────────────────────────────────────────
    // Collection is disabled in debug mode to avoid polluting the Firebase
    // Console with development crashes.  Enabled for all release builds.
    await FirebaseCrashlytics.instance
        .setCrashlyticsCollectionEnabled(!kDebugMode);

    // Flutter widget / framework errors (build failures, assertion errors).
    FlutterError.onError =
        FirebaseCrashlytics.instance.recordFlutterFatalError;

    // Unhandled async errors from the Flutter root zone (Flutter 3.3+).
    PlatformDispatcher.instance.onError = (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      return true;
    };

    debugPrint('[Bootstrap] Crashlytics wired');

    // ── Firebase Messaging ────────────────────────────────────────────────
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    final firebaseSvc = FirebaseNotificationServiceImpl();
    // Do NOT await — requestPermission() shows an OS dialog and can block
    // indefinitely.  runApp must not wait for it.
    unawaited(
      firebaseSvc.initialize().catchError((Object e) {
        debugPrint('[Bootstrap] Firebase notification init error: $e');
      }),
    );
    notificationService = firebaseSvc;

    // ── Firebase Analytics ─────────────────────────────────────────────────
    analyticsService = FirebaseAnalyticsServiceImpl();
    debugPrint('[Bootstrap] Firebase Analytics ready');
  } on TimeoutException {
    debugPrint(
        '[Bootstrap] Firebase init timed out — push/analytics/crash reporting disabled');
  } catch (e) {
    debugPrint(
        '[Bootstrap] Firebase unavailable — push/analytics/crash reporting disabled: $e');
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
        analyticsServiceProvider.overrideWithValue(analyticsService),
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
