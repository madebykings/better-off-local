import 'dart:async';
import 'dart:io' show Platform;

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

  // Use a broadcast StreamController so we can push values from the
  // Realtime callback into the async* generator.
  final controller = StreamController<int>.broadcast();

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
  final platform = Platform.isIOS ? 'ios' : 'android';

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
