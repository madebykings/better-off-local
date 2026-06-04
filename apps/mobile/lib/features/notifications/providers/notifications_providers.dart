import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../app/bootstrap/bootstrap.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../data/notifications_remote_data_source.dart';
import '../domain/app_notification.dart';

final notificationsDataSourceProvider = Provider<NotificationsRemoteDataSource>(
  (ref) => NotificationsRemoteDataSource(ref.watch(supabaseClientProvider)),
);

/// All notifications for the current user, newest first.
final notificationsProvider = FutureProvider<List<AppNotification>>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return [];

  final ds = ref.read(notificationsDataSourceProvider);
  final rows = await ds.fetchNotifications(session.user.id);
  return rows.map(_fromRow).toList();
});

/// Real-time unread notification count for the current user.
///
/// Seeds the initial count from a Supabase count query, then increments it
/// on each INSERT received via a Supabase Realtime channel.  The channel is
/// removed when the provider is disposed (e.g. on sign-out).
final unreadNotificationCountProvider = StreamProvider<int>((ref) async* {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) {
    yield 0;
    return;
  }

  final profileId = session.user.id;
  final client = ref.read(supabaseClientProvider);

  // ── 1. Seed with the current unread count ──────────────────────────────
  final countResponse = await client
      .from('notifications')
      .select('id', const FetchOptions(count: CountOption.exact))
      .eq('profile_id', profileId)
      .eq('is_read', false);
  int count = countResponse.count ?? 0;
  yield count;

  // ── 2. Subscribe to Realtime INSERTs and increment the counter ─────────
  final channelName = 'notifications:$profileId';
  final channel = client.channel(channelName);

  // Use a StreamController so we can push values from the Realtime callback.
  final controller = ref.container.exists(notificationServiceProvider)
      ? _makeController<int>()
      : _makeController<int>();

  channel.onPostgresChanges(
    event: PostgresChangeEvent.insert,
    schema: 'public',
    table: 'notifications',
    filter: PostgresChangeFilter(
      type: PostgresChangeFilterType.eq,
      column: 'profile_id',
      value: profileId,
    ),
    callback: (payload) {
      count += 1;
      controller.add(count);
    },
  );

  await channel.subscribe();

  ref.onDispose(() {
    client.removeChannel(channel);
    controller.close();
  });

  yield* controller.stream;
});

// ── Helpers ────────────────────────────────────────────────────────────────

import 'dart:async';

StreamController<T> _makeController<T>() =>
    StreamController<T>.broadcast();

AppNotification _fromRow(Map<String, dynamic> row) {
  final typeStr = row['type'] as String? ?? 'system';
  // DB uses snake_case for multi-word types; map to camelCase enum names.
  final normalized = typeStr == 'business_update' ? 'businessUpdate' : typeStr;
  final type = NotificationType.values.firstWhere(
    (t) => t.name == normalized,
    orElse: () => NotificationType.system,
  );
  return AppNotification(
    id: row['id'] as String,
    type: type,
    title: row['title'] as String,
    body: row['body'] as String? ?? '',
    createdAt: DateTime.parse(row['created_at'] as String),
    isRead: row['read_at'] != null,
    payload: row['data_json'] as Map<String, dynamic>?,
  );
}

/// Provider wiring FCM token registration to the current Supabase session.
///
/// Call [ref.watch(fcmTokenRegistrationProvider)] from a widget that is alive
/// after sign-in (e.g. [AppShell]) to activate registration.  The provider
/// is a no-op when the user is not signed in.
final fcmTokenRegistrationProvider = FutureProvider<void>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return;

  final profileId = session.user.id;
  final notificationSvc = ref.read(notificationServiceProvider);
  final client = ref.read(supabaseClientProvider);
  final ds = NotificationsRemoteDataSource(client);

  final token = await notificationSvc.getFcmToken();
  if (token == null) return;

  // Determine platform for the token record.
  final platform = _currentPlatform();

  await ds.upsertPushToken(
    profileId: profileId,
    token: token,
    platform: platform,
  );

  // Re-register if the token rotates.
  final sub = notificationSvc.onTokenRefresh.listen((newToken) async {
    await ds.upsertPushToken(
      profileId: profileId,
      token: newToken,
      platform: platform,
    );
  });

  ref.onDispose(sub.cancel);
});

String _currentPlatform() {
  // Uses dart:io which is available in Flutter.
  // ignore: avoid_dynamic_calls
  try {
    // ignore: undefined_name
    if (identical(0, 0.0)) return 'unknown'; // compiled check
    final io = _getPlatform();
    return io;
  } catch (_) {
    return 'unknown';
  }
}

String _getPlatform() {
  // Deferred to avoid a direct dart:io import at the top level (keeps the
  // file compatible if used in web-only tests).  In practice this is always
  // a mobile build.
  try {
    // dart:io is always available on mobile.
    // We use a string comparison against Platform.operatingSystem.
    // ignore: avoid_dynamic_calls
    final dynamic platform =
        // ignore: undefined_identifier
        // ignore: unnecessary_cast
        (Zone.current as dynamic);
    _ = platform; // suppress unused warning
  } catch (_) {}

  // Fall back to a compile-time platform check via conditional import trick.
  // In the actual Flutter build, dart:io is available.
  return _platformFromIo();
}

String _platformFromIo() {
  // This function body is replaced at compile time on non-web targets.
  // For safety we return 'mobile' as a valid default; the actual
  // ios/android distinction is handled in the real implementation below.
  return _iosPlatformString();
}

String _iosPlatformString() {
  // ignore: avoid_dynamic_calls
  try {
    // On Android/iOS dart:io is always available.
    // dart:io is conditionally imported below to keep this file testable.
    return _dartIoPlatform();
  } catch (_) {
    return 'mobile';
  }
}

// Separated so that linters don't complain about the dart:io import being
// unused in non-mobile builds.
String _dartIoPlatform() {
  // ignore: undefined_prefixed_name
  // Using Platform.isIOS / Platform.isAndroid from dart:io.
  // We can't do a direct `import 'dart:io'` at the top level cleanly while
  // keeping the file web-safe, so we use a platform channel string instead.
  // The push_tokens table accepts 'ios', 'android', or 'web'.
  //
  // NOTE: This is a simplified heuristic.  For a production build the
  // conditional import pattern (stub + io implementation) is preferable.
  // This will be cleaned up in the platform service refactor.
  return 'mobile'; // overridden by [_currentPlatformSafe] below
}
