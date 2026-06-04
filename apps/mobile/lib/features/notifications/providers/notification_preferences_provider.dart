import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/session_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../data/notification_preferences_remote_data_source.dart';

final notificationPreferencesDataSourceProvider =
    Provider<NotificationPreferencesRemoteDataSource>(
  (ref) => NotificationPreferencesRemoteDataSource(
      ref.watch(supabaseClientProvider)),
);

/// Current user's notification preferences. Absent DB row = all defaults on.
final notificationPreferencesProvider =
    FutureProvider<NotifPrefs>((ref) async {
  final session = ref.watch(sessionProvider).valueOrNull;
  if (session == null) return NotifPrefs.defaults();
  final row = await ref
      .read(notificationPreferencesDataSourceProvider)
      .fetchPreferences(session.user.id);
  if (row == null) return NotifPrefs.defaults();
  return NotifPrefs(
    newOffers: row['new_offers'] as bool? ?? true,
    loyaltyProgrammes: row['loyalty_programmes'] as bool? ?? true,
    referralCampaigns: row['referral_campaigns'] as bool? ?? true,
  );
});

class NotifPrefs {
  const NotifPrefs({
    required this.newOffers,
    required this.loyaltyProgrammes,
    required this.referralCampaigns,
  });

  factory NotifPrefs.defaults() => const NotifPrefs(
        newOffers: true,
        loyaltyProgrammes: true,
        referralCampaigns: true,
      );

  final bool newOffers;
  final bool loyaltyProgrammes;
  final bool referralCampaigns;
}

/// Updates a single preference column and invalidates the cached provider.
Future<void> updateNotificationPreference(
  WidgetRef ref,
  String column,
  bool value,
) async {
  final session = ref.read(sessionProvider).valueOrNull;
  if (session == null) return;
  await ref
      .read(notificationPreferencesDataSourceProvider)
      .updatePreference(
        profileId: session.user.id,
        column: column,
        value: value,
      );
  ref.invalidate(notificationPreferencesProvider);
}
