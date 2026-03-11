import 'package:flutter_riverpod/flutter_riverpod.dart';

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
    try {
      final url = await _ref
          .read(membershipRepositoryProvider)
          .createCheckoutSession(plan: plan);
      state = MembershipCheckoutReady(url);
    } catch (_) {
      state = const MembershipControllerError(
        'Could not start checkout. Please try again.',
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
