import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/constants/storage_keys.dart';
import 'router/app_router.dart';
import 'router/route_names.dart';
import 'theme/app_theme.dart';

class App extends ConsumerStatefulWidget {
  const App({super.key});

  @override
  ConsumerState<App> createState() => _AppState();
}

class _AppState extends ConsumerState<App> {
  final _appLinks = AppLinks();
  final _secureStorage = const FlutterSecureStorage();
  StreamSubscription<Uri>? _linkSub;

  @override
  void initState() {
    super.initState();
    _initDeepLinks();
  }

  @override
  void dispose() {
    _linkSub?.cancel();
    super.dispose();
  }

  Future<void> _initDeepLinks() async {
    // ── Cold start ──────────────────────────────────────────────────────────
    // If the app was launched directly from a deep link (e.g. the user tapped
    // the Stripe redirect URL while the app was not running), handle it once
    // after the widget tree is ready.
    try {
      final initial = await _appLinks.getInitialLink();
      if (initial != null && mounted) _handleLink(initial);
    } catch (_) {
      // No initial link or platform error — continue normally.
    }

    // ── Foreground ──────────────────────────────────────────────────────────
    // The primary case for Stripe: the app is in the background while the
    // user completes checkout in the browser. When Stripe redirects, the OS
    // brings the app to the foreground and delivers the URI here.
    _linkSub = _appLinks.uriLinkStream.listen(
      (uri) {
        if (mounted) _handleLink(uri);
      },
      onError: (_) {
        // Ignore stream errors — they are non-fatal.
      },
    );
  }

  /// Routes an incoming deep link URI to the correct screen.
  ///
  /// Normalises both link types to a path string before switching:
  ///   Universal link  — https://app.betterofflocal.co.uk/subscription-success
  ///                     → uri.path == '/subscription-success'
  ///   Custom scheme   — betterofflocal://subscription-success
  ///                     → uri.host == 'subscription-success', uri.path == ''
  void _handleLink(Uri uri) {
    final path = uri.scheme == 'https' ? uri.path : '/${uri.host}';
    if (path.isEmpty) return;

    final router = ref.read(appRouterProvider);

    switch (path) {
      case '/subscription-success':
        // Route to the activation screen, not directly to success.
        // The activation screen polls until the webhook confirms the
        // membership is active, eliminating the timing race.
        router.go(RouteNames.activating);

      case '/paywall':
        // Stripe cancel_url — user abandoned checkout; return to plan selection.
        router.go(RouteNames.paywall);

      default:
        // Referral join link: /join?ref=CODE
        if (path == '/join') {
          final code = uri.queryParameters['ref'];
          if (code != null && code.isNotEmpty) {
            // Fire-and-forget: storage write must not block the router.
            // _handleLink is void (called from a stream listener lambda);
            // unawaited() is the explicit fire-and-forget pattern.
            unawaited(_secureStorage.write(
              key: StorageKeys.pendingReferralCode,
              value: code.trim().toUpperCase(),
            ));
            debugPrint('[deep_link] referral code captured: $code');
          }
        }
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Better Off Local',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
