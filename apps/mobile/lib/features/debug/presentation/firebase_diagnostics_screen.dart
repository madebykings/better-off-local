import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/supabase_provider.dart';

/// Developer-only screen showing the status of all Firebase integrations.
///
/// Access: Settings → Developer → Firebase Diagnostics (debug builds only).
/// Uses direct Firebase SDK calls so results reflect real runtime state
/// independently of the provider overrides set in bootstrap.
class FirebaseDiagnosticsScreen extends ConsumerStatefulWidget {
  const FirebaseDiagnosticsScreen({super.key});

  @override
  ConsumerState<FirebaseDiagnosticsScreen> createState() =>
      _FirebaseDiagnosticsScreenState();
}

class _FirebaseDiagnosticsScreenState
    extends ConsumerState<FirebaseDiagnosticsScreen> {
  _DiagnosticsResult? _result;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _runChecks();
  }

  Future<void> _runChecks() async {
    setState(() => _loading = true);

    bool firebaseInitialized = false;
    String? fcmToken;
    String? fcmTokenError;
    String? analyticsInstanceId;
    String? analyticsError;
    bool? crashlyticsEnabled;
    String? crashlyticsError;
    bool pushTokenSaved = false;
    String? pushTokenError;

    // ── 1. Firebase initialized ─────────────────────────────────────────────
    firebaseInitialized = Firebase.apps.isNotEmpty;

    // ── 2. FCM token ────────────────────────────────────────────────────────
    if (firebaseInitialized) {
      try {
        fcmToken = await FirebaseMessaging.instance.getToken();
        if (fcmToken == null) fcmTokenError = 'Token is null — permission denied?';
      } catch (e) {
        fcmTokenError = e.toString();
      }
    } else {
      fcmTokenError = 'Firebase not initialized';
    }

    // ── 3. Push token saved in Supabase ─────────────────────────────────────
    if (fcmToken != null) {
      try {
        final client = ref.read(supabaseClientProvider);
        final session = client.auth.currentSession;
        if (session == null) {
          pushTokenError = 'Not signed in';
        } else {
          final rows = await client
              .from('push_tokens')
              .select('token')
              .eq('profile_id', session.user.id)
              .eq('token', fcmToken)
              .limit(1);
          pushTokenSaved = (rows as List).isNotEmpty;
          if (!pushTokenSaved) pushTokenError = 'Token not found in push_tokens table';
        }
      } catch (e) {
        pushTokenError = e.toString();
      }
    }

    // ── 4. Firebase Analytics ───────────────────────────────────────────────
    if (firebaseInitialized) {
      try {
        analyticsInstanceId = await FirebaseAnalytics.instance.appInstanceId;
      } catch (e) {
        analyticsError = e.toString();
      }
    } else {
      analyticsError = 'Firebase not initialized';
    }

    // ── 5. Crashlytics ──────────────────────────────────────────────────────
    if (firebaseInitialized) {
      try {
        crashlyticsEnabled =
            await FirebaseCrashlytics.instance.isCrashlyticsCollectionEnabled;
      } catch (e) {
        crashlyticsError = e.toString();
      }
    } else {
      crashlyticsError = 'Firebase not initialized';
    }

    if (mounted) {
      setState(() {
        _result = _DiagnosticsResult(
          firebaseInitialized: firebaseInitialized,
          fcmToken: fcmToken,
          fcmTokenError: fcmTokenError,
          analyticsInstanceId: analyticsInstanceId,
          analyticsError: analyticsError,
          crashlyticsEnabled: crashlyticsEnabled,
          crashlyticsError: crashlyticsError,
          pushTokenSaved: pushTokenSaved,
          pushTokenError: pushTokenError,
          timestamp: DateTime.now(),
        );
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Firebase Diagnostics'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Re-run checks',
            onPressed: _loading ? null : _runChecks,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : result == null
              ? const Center(child: Text('No results'))
              : _DiagnosticsBody(result: result),
    );
  }
}

// ── Result model ─────────────────────────────────────────────────────────────

class _DiagnosticsResult {
  const _DiagnosticsResult({
    required this.firebaseInitialized,
    required this.fcmToken,
    required this.fcmTokenError,
    required this.analyticsInstanceId,
    required this.analyticsError,
    required this.crashlyticsEnabled,
    required this.crashlyticsError,
    required this.pushTokenSaved,
    required this.pushTokenError,
    required this.timestamp,
  });

  final bool firebaseInitialized;
  final String? fcmToken;
  final String? fcmTokenError;
  final String? analyticsInstanceId;
  final String? analyticsError;
  final bool? crashlyticsEnabled;
  final String? crashlyticsError;
  final bool pushTokenSaved;
  final String? pushTokenError;
  final DateTime timestamp;
}

// ── Results body ─────────────────────────────────────────────────────────────

class _DiagnosticsBody extends StatelessWidget {
  const _DiagnosticsBody({required this.result});

  final _DiagnosticsResult result;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 8),
      children: [
        _timestamp(result.timestamp),
        const _SectionHeader('Core'),
        _StatusTile(
          label: 'Firebase initialized',
          ok: result.firebaseInitialized,
          detail: result.firebaseInitialized
              ? 'Firebase.apps.isNotEmpty ✓'
              : 'google-services.json missing or Firebase.initializeApp() failed',
        ),
        const _SectionHeader('Push Notifications'),
        _StatusTile(
          label: 'FCM token',
          ok: result.fcmToken != null,
          detail: result.fcmToken != null
              ? result.fcmToken!
              : result.fcmTokenError ?? 'Unknown error',
          copiable: result.fcmToken,
        ),
        _StatusTile(
          label: 'Push token saved to Supabase',
          ok: result.pushTokenSaved,
          detail: result.pushTokenSaved
              ? 'Token present in push_tokens table'
              : result.pushTokenError ?? 'Not saved',
        ),
        const _SectionHeader('Analytics'),
        _StatusTile(
          label: 'Firebase Analytics',
          ok: result.analyticsInstanceId != null,
          detail: result.analyticsInstanceId != null
              ? 'Instance ID: ${result.analyticsInstanceId}'
              : result.analyticsError ?? 'Unknown error',
        ),
        const _SectionHeader('Crash Reporting'),
        _StatusTile(
          label: 'Crashlytics collection',
          ok: result.crashlyticsEnabled != null,
          detail: switch (result.crashlyticsEnabled) {
            true => 'Collection ENABLED (release mode)',
            false => 'Collection disabled (debug mode — expected)',
            null => result.crashlyticsError ?? 'Unknown error',
          },
          warning: result.crashlyticsEnabled == false,
        ),
        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            result.firebaseInitialized
                ? '✓ Firebase is running. Add google-services.json for Android production builds.'
                : '⚠ Firebase not running. Download google-services.json from Firebase Console '
                    '(project: better-off-local-e302e), add app with package '
                    'uk.co.betterofflocal.app, and place the file at '
                    'apps/mobile/android/app/google-services.json.',
            style: const TextStyle(fontSize: 12, color: Colors.grey, height: 1.5),
          ),
        ),
      ],
    );
  }

  Widget _timestamp(DateTime ts) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Text(
        'Checked at ${ts.hour.toString().padLeft(2, '0')}:${ts.minute.toString().padLeft(2, '0')}:${ts.second.toString().padLeft(2, '0')}',
        style: const TextStyle(fontSize: 11, color: Colors.grey),
      ),
    );
  }
}

// ── Shared tiles ─────────────────────────────────────────────────────────────

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

class _StatusTile extends StatelessWidget {
  const _StatusTile({
    required this.label,
    required this.ok,
    required this.detail,
    this.warning = false,
    this.copiable,
  });

  final String label;
  final bool ok;
  final String detail;
  final bool warning;
  final String? copiable;

  Color get _iconColor {
    if (!ok) return Colors.red;
    if (warning) return Colors.orange;
    return Colors.green;
  }

  IconData get _icon {
    if (!ok) return Icons.cancel_outlined;
    if (warning) return Icons.warning_amber_outlined;
    return Icons.check_circle_outline;
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(_icon, color: _iconColor, size: 22),
      title: Text(label, style: const TextStyle(fontSize: 14)),
      subtitle: Text(
        detail,
        style: const TextStyle(fontSize: 11, fontFamily: 'monospace'),
        maxLines: 3,
        overflow: TextOverflow.ellipsis,
      ),
      trailing: copiable != null
          ? IconButton(
              icon: const Icon(Icons.copy, size: 18),
              tooltip: 'Copy token',
              onPressed: () {
                Clipboard.setData(ClipboardData(text: copiable!));
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Copied to clipboard'),
                    duration: Duration(seconds: 2),
                  ),
                );
              },
            )
          : null,
    );
  }
}
