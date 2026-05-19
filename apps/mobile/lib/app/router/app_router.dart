import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/providers/session_provider.dart';
import '../../features/profile/providers/profile_providers.dart';

/// Listens to [sessionProvider] and [profileProvider] and notifies [GoRouter]
/// to re-evaluate its redirect whenever auth state or profile state changes.
class _RouterNotifier extends ChangeNotifier {
  _RouterNotifier(this._ref) {
    _ref.listen<AsyncValue<Session?>>(
      sessionProvider,
      (_, __) => notifyListeners(),
    );
    _ref.listen(profileProvider, (_, __) => notifyListeners());
  }

  final Ref _ref;
}

import '../../features/auth/presentation/forgot_password_screen.dart';
import '../../features/auth/presentation/sign_in_screen.dart';
import '../../features/auth/presentation/sign_up_screen.dart';
import '../../features/account/presentation/account_screen.dart';
import '../../features/account/presentation/savings_screen.dart';
import '../../features/account/presentation/settings_screen.dart';
import '../../features/favourites/presentation/favourites_screen.dart';
import '../../features/home/presentation/home_screen.dart';
import '../../features/map/presentation/map_screen.dart';
import '../../features/memberships/presentation/membership_card_screen.dart';
import '../../features/memberships/presentation/paywall_screen.dart';
import '../../features/memberships/presentation/subscription_success_screen.dart';
import '../../features/notifications/presentation/notifications_screen.dart';
import '../../features/offers/presentation/offer_detail_screen.dart';
import '../../features/offers/presentation/offer_list_screen.dart';
import '../../features/onboarding/presentation/splash_screen.dart';
import '../../features/onboarding/presentation/welcome_screen.dart';
import '../../features/profile/presentation/complete_profile_screen.dart';
import '../../features/redemptions/presentation/redemption_confirmation_screen.dart';
import '../../features/redemptions/presentation/redemption_failed_screen.dart';
import '../../features/redemptions/presentation/redemption_history_screen.dart';
import '../../features/redemptions/presentation/redemption_qr_screen.dart';
import '../../features/online_redemption/presentation/online_scan_screen.dart';
import '../../features/retailers/presentation/retailer_detail_screen.dart';
import '../../features/shell/presentation/app_shell.dart';
import 'route_names.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final notifier = _RouterNotifier(ref);

  return GoRouter(
    initialLocation: RouteNames.splash,
    refreshListenable: notifier,
    redirect: (context, state) {
      // Safely extract session from AsyncValue — loading is treated as unauthenticated.
      final sessionAsync = ref.read(sessionProvider);
      final isAuthenticated = sessionAsync.valueOrNull != null;

      final publicRoutes = {
        RouteNames.splash,
        RouteNames.welcome,
        RouteNames.signIn,
        RouteNames.signUp,
        RouteNames.forgotPassword,
      };

      final isOnPublicRoute = publicRoutes.contains(state.matchedLocation);

      if (!isAuthenticated && !isOnPublicRoute) {
        return RouteNames.signIn;
      }

      if (isAuthenticated &&
          isOnPublicRoute &&
          state.matchedLocation != RouteNames.splash) {
        return RouteNames.home;
      }

      // Profile completion gate: only runs when authenticated.
      if (isAuthenticated) {
        final profile = ref.read(profileProvider).valueOrNull;
        final isOnCompleteProfile =
            state.matchedLocation == RouteNames.completeProfile;

        // While profile is loading (null async), do not redirect yet.
        // Only redirect if we have a confirmed incomplete profile.
        if (profile != null && !profile.isComplete && !isOnCompleteProfile) {
          return RouteNames.completeProfile;
        }

        if (profile != null && profile.isComplete && isOnCompleteProfile) {
          return RouteNames.home;
        }
      }

      return null;
    },
    routes: [
      // ── Public routes ──────────────────────────────────────────────────
      GoRoute(
        path: RouteNames.splash,
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: RouteNames.welcome,
        builder: (context, state) => const WelcomeScreen(),
      ),
      GoRoute(
        path: RouteNames.signIn,
        builder: (context, state) => const SignInScreen(),
      ),
      GoRoute(
        path: RouteNames.signUp,
        builder: (context, state) => const SignUpScreen(),
      ),
      GoRoute(
        path: RouteNames.forgotPassword,
        builder: (context, state) => const ForgotPasswordScreen(),
      ),

      // ── Profile completion (authenticated, pre-home gate) ──────────────
      GoRoute(
        path: RouteNames.completeProfile,
        builder: (context, state) => const CompleteProfileScreen(),
      ),

      // ── Membership gating ──────────────────────────────────────────────
      GoRoute(
        path: RouteNames.paywall,
        builder: (context, state) => const PaywallScreen(),
      ),
      GoRoute(
        path: RouteNames.subscriptionSuccess,
        builder: (context, state) => const SubscriptionSuccessScreen(),
      ),

      // ── Online checkout scan — full-screen, no bottom nav ─────────────
      GoRoute(
        path: RouteNames.onlineScan,
        builder: (context, state) => const OnlineScanScreen(),
      ),

      // ── Authenticated shell ────────────────────────────────────────────
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: RouteNames.home,
            builder: (context, state) => const HomeScreen(),
          ),
          GoRoute(
            path: RouteNames.explore,
            builder: (context, state) => const OfferListScreen(),
            routes: [
              GoRoute(
                path: 'offer/:offerId',
                builder: (context, state) => OfferDetailScreen(
                  offerId: state.pathParameters['offerId']!,
                ),
              ),
              GoRoute(
                path: 'retailer/:retailerId',
                builder: (context, state) => RetailerDetailScreen(
                  retailerId: state.pathParameters['retailerId']!,
                ),
              ),
            ],
          ),
          GoRoute(
            path: RouteNames.map,
            builder: (context, state) => const MapScreen(),
          ),
          GoRoute(
            path: RouteNames.card,
            builder: (context, state) => const MembershipCardScreen(),
          ),
          GoRoute(
            path: RouteNames.account,
            builder: (context, state) => const AccountScreen(),
            routes: [
              GoRoute(
                path: 'settings',
                builder: (context, state) => const SettingsScreen(),
              ),
              GoRoute(
                path: 'savings',
                builder: (context, state) => const SavingsScreen(),
              ),
            ],
          ),
          GoRoute(
            path: RouteNames.favourites,
            builder: (context, state) => const FavouritesScreen(),
          ),
          GoRoute(
            path: RouteNames.notifications,
            builder: (context, state) => const NotificationsScreen(),
          ),
          GoRoute(
            path: RouteNames.redemptionHistory,
            builder: (context, state) => const RedemptionHistoryScreen(),
          ),
          GoRoute(
            path: '/redemptions/qr/:offerId',
            builder: (context, state) => RedemptionQRScreen(
              offerId: state.pathParameters['offerId']!,
            ),
          ),
          GoRoute(
            path: RouteNames.redemptionConfirmation,
            builder: (context, state) {
              final offerTitle = state.extra as String?;
              return RedemptionConfirmationScreen(offerTitle: offerTitle);
            },
          ),
          GoRoute(
            path: RouteNames.redemptionFailed,
            builder: (context, state) {
              final reason = state.extra as String?;
              return RedemptionFailedScreen(reason: reason);
            },
          ),
        ],
      ),
    ],
  );
});
