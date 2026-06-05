import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../core/constants/storage_keys.dart';
import '../core/providers/supabase_provider.dart';
import 'bootstrap/bootstrap.dart';
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
  StreamSubscription<String?>? _notifTapSub;
  StreamSubscription<dynamic>? _bgNotifSub;

  @override
  void initState() {
    super.initState();
    _initDeepLinks();
    _initNotifications();
  }

  @override
  void dispose() {
    _linkSub?.cancel();
    _notifTapSub?.cancel();
    _bgNotifSub?.cancel();
    super.dispose();
  }

  // ── Notification tap handling ────────────────────────────────────────────────

  void _initNotifications() {
    final notifSvc = ref.read(notificationServiceProvider);

    // 1. Foreground local notification tap (Android only via flutter_local_notifications)
    _notifTapSub = notifSvc.onNotificationTap.listen((route) {
      _navigateFromNotification(route);
    });

    // 2. Background→foreground tap (user tapped a system notification while app
    //    was in background; FCM delivers the triggering message here).
    _bgNotifSub = notifSvc.onMessageOpenedApp.listen((message) {
      _navigateFromNotification(message.data['route'] as String?);
    });

    // 3. Terminated-state tap (app was not running; launched by notification tap).
    //    Deferred to the next frame so all GoRouter redirects (auth gate, region
    //    selection, paywall) have settled before we push a new route on top.
    unawaited(
      notifSvc.getInitialMessage().then((message) {
        if (message != null && mounted) {
          SchedulerBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              _navigateFromNotification(message.data['route'] as String?);
            }
          });
        }
      }).catchError((Object e) {
        debugPrint('[App] getInitialMessage error (non-fatal): $e');
      }),
    );
  }

  /// Navigates to [route] if it is a recognised path, otherwise falls back to
  /// the notifications tab so the user always lands somewhere useful.
  void _navigateFromNotification(String? route) {
    if (!mounted) return;
    final router = ref.read(appRouterProvider);
    if (route != null && route.isNotEmpty) {
      try {
        router.go(route);
      } catch (_) {
        // route string was malformed or not recognised — fall back.
        router.go(RouteNames.notifications);
      }
    } else {
      router.go(RouteNames.notifications);
    }
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

      case '/venue-referral':
        // Venue referral share link: /venue-referral?t=TOKEN
        // Store the token for attribution; attribute immediately if already
        // authenticated, otherwise attribute on next profile completion.
        final token = uri.queryParameters['t'];
        if (token != null && token.isNotEmpty) {
          unawaited(_handleVenueReferralToken(token.trim().toUpperCase()));
        }

      default:
        // Platform referral join link: /join?ref=CODE
        if (path == '/join') {
          final code = uri.queryParameters['ref'];
          if (code != null && code.isNotEmpty) {
            // Fire-and-forget: storage write must not block the router.
            unawaited(_secureStorage.write(
              key: StorageKeys.pendingReferralCode,
              value: code.trim().toUpperCase(),
            ));
            debugPrint('[deep_link] referral code captured: $code');
          }
        }
    }
  }

  /// Persists a venue referral token and attributes it immediately if the
  /// user is already authenticated.  For unauthenticated users the token
  /// is consumed in [CompleteProfileScreen] after sign-up.
  Future<void> _handleVenueReferralToken(String token) async {
    await _secureStorage.write(
      key: StorageKeys.pendingVenueReferralToken,
      value: token,
    );
    debugPrint('[deep_link] venue referral token captured: $token');

    final profileId =
        ref.read(supabaseClientProvider).auth.currentUser?.id;
    if (profileId != null) {
      unawaited(_attributeVenueReferral(token, profileId));
    }
  }

  /// Calls the attribute_venue_referral RPC and clears the stored token on
  /// success.  Errors are non-fatal — the token stays in storage so the next
  /// launch can retry.
  Future<void> _attributeVenueReferral(
      String token, String profileId) async {
    try {
      final client = ref.read(supabaseClientProvider);
      await client.rpc('attribute_venue_referral', params: {
        'p_token': token,
        'p_invitee_profile_id': profileId,
      });
      await _secureStorage.delete(
          key: StorageKeys.pendingVenueReferralToken);
      debugPrint('[deep_link] venue referral attributed: $token');
    } catch (e) {
      debugPrint(
          '[deep_link] venue referral attribution error (non-fatal): $e');
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
