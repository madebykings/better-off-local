import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:timeago/timeago.dart' as timeago;

import '../../../app/router/route_names.dart';
import '../../../core/widgets/empty_state.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../domain/app_notification.dart';
import '../providers/notifications_providers.dart';
import 'notifications_controller.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notificationsAsync = ref.watch(notificationsProvider);
    final controller = ref.read(notificationsControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          notificationsAsync.maybeWhen(
            data: (list) => list.any((n) => !n.isRead)
                ? TextButton(
                    onPressed: () => controller.markAllRead(),
                    child: const Text('Mark all read'),
                  )
                : const SizedBox.shrink(),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      body: notificationsAsync.when(
        loading: () => const LoadingIndicator(),
        error: (e, _) => ErrorState(
          message: 'Could not load notifications.',
          onRetry: () => ref.invalidate(notificationsProvider),
        ),
        data: (notifications) {
          if (notifications.isEmpty) {
            return const EmptyState(
              icon: Icons.notifications_none_outlined,
              title: 'No notifications yet',
              message: 'We\'ll let you know when something needs your attention.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(notificationsProvider),
            child: ListView.separated(
              itemCount: notifications.length,
              separatorBuilder: (_, __) =>
                  const Divider(height: 1, indent: 56),
              itemBuilder: (context, i) =>
                  _NotificationTile(notification: notifications[i]),
            ),
          );
        },
      ),
    );
  }
}

class _NotificationTile extends ConsumerWidget {
  const _NotificationTile({required this.notification});
  final AppNotification notification;

  IconData _icon(NotificationType type) {
    switch (type) {
      case NotificationType.offer:
        return Icons.local_offer_outlined;
      case NotificationType.businessUpdate:
        return Icons.notifications_active_outlined;
      case NotificationType.membership:
        return Icons.card_membership_outlined;
      case NotificationType.redemption:
        return Icons.qr_code_outlined;
      case NotificationType.referral:
        return Icons.card_giftcard_outlined;
      case NotificationType.region:
        return Icons.map_outlined;
      case NotificationType.system:
        return Icons.info_outline;
    }
  }

  void _handleTap(BuildContext context, NotificationsController controller) {
    if (!notification.isRead) {
      controller.markRead(notification.id);
    }
    final offerId = notification.payload?['offer_id'] as String?;
    if (offerId != null &&
        (notification.type == NotificationType.offer ||
            notification.type == NotificationType.businessUpdate)) {
      context.push(
        RouteNames.offerDetail.replaceAll(':offerId', offerId),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = !notification.isRead;
    final controller = ref.read(notificationsControllerProvider);

    return ListTile(
      leading: CircleAvatar(
        backgroundColor: unread
            ? Theme.of(context).colorScheme.primaryContainer
            : Colors.grey.shade100,
        child: Icon(
          _icon(notification.type),
          size: 20,
          color: unread
              ? Theme.of(context).colorScheme.primary
              : Colors.grey.shade400,
        ),
      ),
      title: Text(
        notification.title,
        style: TextStyle(
          fontWeight: unread ? FontWeight.w600 : FontWeight.normal,
        ),
      ),
      subtitle: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (notification.body.isNotEmpty)
            Text(notification.body, maxLines: 2, overflow: TextOverflow.ellipsis),
          Text(
            timeago.format(notification.createdAt),
            style: const TextStyle(fontSize: 11, color: Colors.grey),
          ),
        ],
      ),
      isThreeLine: notification.body.isNotEmpty,
      onTap: () => _handleTap(context, controller),
    );
  }
}
