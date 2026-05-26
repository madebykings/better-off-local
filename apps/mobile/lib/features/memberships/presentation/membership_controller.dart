import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/providers/supabase_provider.dart';
import '../providers/membership_providers.dart';

sealed class MembershipControllerState {
  const MembershipControllerState();
}

class MembershipIdle extends MembershipControllerState {
  const MembershipIdle();
}

class MembershipLoading extends MembershipControllerState {
  const MembershipLoading();
}

/// Checkout session created — caller should launch this URL in a browser.
class MembershipCheckoutReady extends MembershipControllerState {
  const MembershipCheckoutReady(this.url);
  final String url;
}

/// No active session found when checkout was attempted.
/// The caller should sign the user out and route them to sign-in.
class MembershipSessionExpired extends MembershipControllerState {
  const MembershipSessionExpired();
}

class MembershipControllerError extends MembershipControllerState {
  const MembershipControllerError(this.message);
  final String message;
}

class MembershipController
    extends StateNotifier<MembershipControllerState> {
  MembershipController(this._ref) : super(const MembershipIdle());

  final Ref _ref;

  /// Calls the create-checkout-session edge function for the given plan.
  /// On success, state becomes [MembershipCheckoutReady] with the URL.
  /// The PaywallScreen listener is responsible for launching the URL.
  Future<void> startCheckout({required String plan}) async {
    state = const MembershipLoading();

    // functions.invoke() sends Authorization: Bearer only when currentSession
    // is non-null. A null session means the anon key is sent alone and the
    // edge function immediately returns 401 Unauthorized before reaching Stripe.
    final auth = _ref.read(supabaseClientProvider).auth;
    final session = auth.currentSession;
    debugPrint('[Checkout] user=${auth.currentUser?.id}, '
        'hasSession=${session != null}, '
        'hasToken=${session?.accessToken != null}');

    if (session == null) {
      state = const MembershipSessionExpired();
      return;
    }

    try {
      final url = await _ref
          .read(membershipRepositoryProvider)
          .createCheckoutSession(plan: plan);
      state = MembershipCheckoutReady(url);
    } catch (e) {
      // A 401 from the edge function means the token was rejected server-side
      // (expired or otherwise invalid). Treat identically to a missing session.
      if (e is FunctionException && e.status == 401) {
        state = const MembershipSessionExpired();
        return;
      }
      final raw = e.toString();
      final message = raw.startsWith('Exception: ')
          ? raw.substring('Exception: '.length)
          : raw;
      state = MembershipControllerError(
        message.isNotEmpty ? message : 'Could not start checkout. Please try again.',
      );
    }
  }

  /// Re-fetches membership from the server.
  /// Call after returning from Stripe Checkout or on manual refresh.
  void refreshMembership() {
    _ref.invalidate(currentMembershipProvider);
    state = const MembershipIdle();
  }

  void reset() => state = const MembershipIdle();
}

final membershipControllerProvider =
    StateNotifierProvider<MembershipController, MembershipControllerState>(
  (ref) => MembershipController(ref),
);
