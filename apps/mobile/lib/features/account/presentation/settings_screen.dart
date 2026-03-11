import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/constants/app_constants.dart';
import '../../auth/providers/auth_providers.dart';

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
          _NotificationPreferenceTile(
            title: 'New offers nearby',
            subtitle: 'Get notified when new offers are added',
            prefKey: 'notif_new_offers',
          ),
          _NotificationPreferenceTile(
            title: 'Membership updates',
            subtitle: 'Renewal reminders and membership changes',
            prefKey: 'notif_membership',
          ),
          _NotificationPreferenceTile(
            title: 'Redemption confirmations',
            subtitle: 'Confirmation when you redeem an offer',
            prefKey: 'notif_redemptions',
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
          ListTile(
            leading: const Icon(Icons.info_outline),
            title: const Text('Version'),
            trailing: Text(
              AppConstants.appVersion,
              style: const TextStyle(color: Colors.grey),
            ),
          ),
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

/// Simple toggle backed by a shared [StateProvider] keyed by [prefKey].
/// In production this would persist to Supabase profile preferences.
class _NotificationPreferenceTile extends ConsumerWidget {
  const _NotificationPreferenceTile({
    required this.title,
    required this.subtitle,
    required this.prefKey,
  });

  final String title;
  final String subtitle;
  final String prefKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final provider = _notifPrefProvider(prefKey);
    final enabled = ref.watch(provider);

    return SwitchListTile(
      title: Text(title),
      subtitle: Text(subtitle),
      value: enabled,
      onChanged: (val) => ref.read(provider.notifier).state = val,
    );
  }
}

/// Per-key notification preference state (in-memory; extend to persist later).
final _prefProviders = <String, StateProvider<bool>>{};

StateProvider<bool> _notifPrefProvider(String key) {
  return _prefProviders.putIfAbsent(key, () => StateProvider<bool>((_) => true));
}
