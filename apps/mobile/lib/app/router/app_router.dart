import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/providers/session_provider.dart';
import '../../features/memberships/domain/membership.dart';
import '../../features/memberships/providers/membership_providers.dart';
import '../../features/profile/providers/profile_providers.dart';

import '../../features/follow/presentation/following_screen.dart';
import '../../features/loyalty/presentation/my_loyalty_cards_screen.dart';
import '../../features/referral/presentation/referral_screen.dart';
import '../../features/venue_referral/presentation/my_referral_rewards_screen.dart';
import '../../features/region/presentation/region_selection_screen.dart';
import '../../features/region/presentation/region_progress_screen.dart';
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
import '../../features/memberships/presentation/membership_activating_screen.dart';
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
import '../../features/retailers/presentation/retailer_detail_screen.dart';
import '../../features/shell/presentation/app_shell.dart';
import 'route_names.dart';

/// Listens to [sessionProvider], [profileProvider], and
/// [currentMembershipProvider] and notifies [GoRouter] to re-evaluate its
/// redirect whenever auth state, profile state, or membership state changes.
class _RouterNotifier extends ChangeNotifier {
  _RouterNotifier(this._ref) {
    _ref.listen<AsyncValue<Session?>>(
      sessionProvider,
      (_, __) => notifyListeners(),
    );
    _ref.listen(profileProvider, (_, __) => notifyListeners());
    _ref.listen(currentMembershipProvider, (_, __) => notifyListeners());
  }

  final Ref _ref;
}

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

      // Profile completion + region selection gates.
      if (isAuthenticated) {
        final profile = ref.read(profileProvider).valueOrNull;
        final isOnCompleteProfile =
            state.matchedLocation == RouteNames.completeProfile;
        final isOnRegionSelection =
            state.matchedLocation == RouteNames.regionSelection;

        // Gate 1: profile name is required before anything else.
        if (profile != null && !profile.isComplete && !isOnCompleteProfile) {
          return RouteNames.completeProfile;
        }

        if (profile != null && profile.isComplete && isOnCompleteProfile) {
          // After profile completion, check region next.
          if (!profile.hasRegion) return RouteNames.regionSelection;
          return RouteNames.home;
        }

        // Gate 2: region selection — required after profile, before home.
        // Skip for the profile completion and public routes.
        if (profile != null &&
            profile.isComplete &&
            !profile.hasRegion &&
            !isOnRegionSelection &&
            !isOnCompleteProfile) {
          return RouteNames.regionSelection;
        }

        // Gate 3: membership gate — expired or cancelled members are redirected
        // to the paywall. past_due is NOT gated (still a paying member; they see
        // a banner instead). We use valueOrNull so the gate is skipped while the
        // provider is still loading, avoiding blocking navigation on app start.
        //
        // Routes exempt from this gate (always accessible):
        //   - paywall, activating, subscriptionSuccess  (membership purchase flow)
        //   - account + its sub-routes                  (account/plan management)
        //   - card                                      (membership card screen)
        final membershipGatedRoutes = {
          RouteNames.home,
          RouteNames.explore,
          RouteNames.map,
          RouteNames.favourites,
          RouteNames.notifications,
          RouteNames.redemptionHistory,
          RouteNames.redemptionConfirmation,
          RouteNames.redemptionFailed,
        };

        final isOnMembershipGatedRoute =
            membershipGatedRoutes.contains(state.matchedLocation) ||
            state.matchedLocation.startsWith(RouteNames.explore + '/') ||
            state.matchedLocation.startsWith('/redemptions/');

        if (isOnMembershipGatedRoute) {
          final membership = ref.read(currentMembershipProvider).valueOrNull;
          if (membership != null) {
            final gated = membership.status == MembershipStatus.expired ||
                membership.status == MembershipStatus.cancelled;
            if (gated) return RouteNames.paywall;
          }
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

      // ── Region selection (authenticated, post-profile gate) ────────────
      GoRoute(
        path: RouteNames.regionSelection,
        builder: (context, state) {
          // extra = false means it's a change-region flow (pop on save).
          final isOnboarding = state.extra != false;
          return RegionSelectionScreen(isOnboarding: isOnboarding);
        },
      ),

      // ── Membership gating ──────────────────────────────────────────────
      GoRoute(
        path: RouteNames.paywall,
        builder: (context, state) => const PaywallScreen(),
      ),
      // Activation screen: shown immediately after Stripe redirects back.
      // Polls until the webhook confirms the membership is active, then
      // navigates to subscriptionSuccess. Sits outside the shell so there
      // is no bottom nav bar while the user waits.
      GoRoute(
        path: RouteNames.activating,
        builder: (context, state) => const MembershipActivatingScreen(),
      ),
      GoRoute(
        path: RouteNames.subscriptionSuccess,
        builder: (context, state) => const SubscriptionSuccessScreen(),
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
              GoRoute(
                path: 'referral',
                builder: (context, state) => const ReferralScreen(),
              ),
              GoRoute(
                path: 'region',
                builder: (context, state) => const RegionProgressScreen(),
              ),
              GoRoute(
                path: 'loyalty',
                builder: (context, state) => const MyLoyaltyCardsScreen(),
              ),
              GoRoute(
                path: 'venue-referral-rewards',
                builder: (context, state) => const MyReferralRewardsScreen(),
              ),
              GoRoute(
                path: 'following',
                builder: (context, state) => const FollowingScreen(),
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
