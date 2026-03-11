import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../data/notifications_remote_data_source.dart';
import '../providers/notifications_providers.dart';

class NotificationsController {
  const NotificationsController(this._ref);
  final Ref _ref;

  NotificationsRemoteDataSource get _ds =>
      _ref.read(notificationsDataSourceProvider);

  String? get _profileId =>
      _ref.read(sessionProvider).valueOrNull?.user.id;

  Future<void> markRead(String notificationId) async {
    await _ds.markRead(notificationId);
    _ref.invalidate(notificationsProvider);
  }

  Future<void> markAllRead() async {
    final id = _profileId;
    if (id == null) return;
    await _ds.markAllRead(id);
    _ref.invalidate(notificationsProvider);
  }
}

final notificationsControllerProvider = Provider<NotificationsController>(
  (ref) => NotificationsController(ref),
);
