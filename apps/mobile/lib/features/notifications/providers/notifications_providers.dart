import 'package:flutter_riverpod/flutter_riverpod.dart';

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

/// Count of unread notifications for badge display.
final unreadNotificationCountProvider = Provider<int>((ref) {
  return ref.watch(notificationsProvider).maybeWhen(
    data: (list) => list.where((n) => !n.isRead).length,
    orElse: () => 0,
  );
});

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
