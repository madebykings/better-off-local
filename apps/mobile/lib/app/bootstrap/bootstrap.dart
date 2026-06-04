import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/config/env.dart';
import '../../core/services/notification_service_impl.dart';
import '../app.dart';

/// Top-level background message handler.
/// Must be a top-level function (not a closure or instance method) so that
/// Firebase can invoke it from an isolate when the app is terminated.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Firebase is already initialised before this handler is called.
  // Add any background processing here (e.g. updating local badge counts).
  debugPrint('FCM background message: ${message.messageId}');
}

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialise Firebase before Supabase so that FirebaseMessaging is ready
  // when the first auth state event fires.
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  await Supabase.initialize(
    url: Env.supabaseUrl,
    anonKey: Env.supabaseAnonKey,
    // Explicit options so session persistence behaviour is unambiguous.
    // persistSession=true (default) stores the session in SharedPreferences.
    // autoRefreshToken=true refreshes the JWT before it expires.
    authOptions: const FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
    ),
  );

  final notificationService = FirebaseNotificationServiceImpl();
  await notificationService.initialize();

  runApp(
    ProviderScope(
      overrides: [
        notificationServiceProvider.overrideWithValue(notificationService),
      ],
      child: const App(),
    ),
  );
}

/// Provides the singleton [FirebaseNotificationServiceImpl] to the widget tree.
/// Overridden in [bootstrap] with the already-initialised instance.
final notificationServiceProvider =
    Provider<FirebaseNotificationServiceImpl>((_) {
  throw UnimplementedError(
    'notificationServiceProvider was not overridden — '
    'ensure bootstrap() is called before runApp().',
  );
});
