import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/app_constants.dart';
import '../../auth/providers/auth_providers.dart';
import '../../debug/presentation/firebase_diagnostics_screen.dart';
import '../../notifications/providers/notification_preferences_provider.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        children: [
          const _SectionHeader('Account'),
          ListTile(
            leading: const Icon(Icons.logout),
            title: const Text('Sign out'),
            onTap: () => _confirmSignOut(context, ref),
          ),

          const _SectionHeader('Notifications'),
          const _DbNotifPrefTile(
            title: 'New offers from followed partners',
            subtitle: 'Notified when a local partner you follow goes live',
            column: 'new_offers',
          ),
          const _DbNotifPrefTile(
            title: 'Loyalty programmes',
            subtitle: 'New loyalty card programmes from local partners',
            column: 'loyalty_programmes',
          ),
          const _DbNotifPrefTile(
            title: 'Referral campaigns',
            subtitle: 'Referral offer campaigns from local partners you follow',
            column: 'referral_campaigns',
          ),

          const _SectionHeader('Legal'),
          ListTile(
            leading: const Icon(Icons.privacy_tip_outlined),
            title: const Text('Privacy Policy'),
            trailing: const Icon(Icons.open_in_new, size: 16),
            onTap: () => _launchUrl(AppConstants.privacyPolicyUrl),
          ),
          ListTile(
            leading: const Icon(Icons.description_outlined),
            title: const Text('Terms & Conditions'),
            trailing: const Icon(Icons.open_in_new, size: 16),
            onTap: () => _launchUrl(AppConstants.termsUrl),
          ),

          const _SectionHeader('App'),
          const ListTile(
            leading: Icon(Icons.info_outline),
            title: Text('Version'),
            trailing: Text(
              AppConstants.appVersion,
              style: TextStyle(color: Colors.grey),
            ),
          ),

          // Debug-only section — stripped from release builds via kDebugMode.
          if (kDebugMode) ...[
            const _SectionHeader('Developer'),
            ListTile(
              leading: const Icon(Icons.bug_report_outlined),
              title: const Text('Firebase Diagnostics'),
              subtitle: const Text('Push, Analytics, Crashlytics status'),
              trailing: const Icon(Icons.chevron_right, size: 18),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => const FirebaseDiagnosticsScreen(),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _confirmSignOut(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Sign out', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ref.read(authRepositoryProvider).signOut();
    }
  }

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.title);
  final String title;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 4),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: Colors.grey,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

/// Database-backed notification preference toggle.
class _DbNotifPrefTile extends ConsumerWidget {
  const _DbNotifPrefTile({
    required this.title,
    required this.subtitle,
    required this.column,
  });

  final String title;
  final String subtitle;

  /// Column name in the notification_preferences table.
  final String column;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefsAsync = ref.watch(notificationPreferencesProvider);

    final enabled = prefsAsync.when(
      data: (prefs) => switch (column) {
        'new_offers'         => prefs.newOffers,
        'loyalty_programmes' => prefs.loyaltyProgrammes,
        'referral_campaigns' => prefs.referralCampaigns,
        _                    => true,
      },
      loading: () => true,
      error: (_, __) => true,
    );

    return SwitchListTile(
      title: Text(title),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12)),
      value: enabled,
      onChanged: prefsAsync.isLoading
          ? null
          : (val) => updateNotificationPreference(ref, column, val),
    );
  }
}
