import 'membership.dart';

abstract interface class MembershipRepository {
  /// Fetch the most recent membership record for the given user.
  /// Returns null when the user has no membership row.
  Future<Membership?> fetchMembership(String userId);

  /// Calls the create-checkout-session edge function and returns
  /// the Stripe Checkout Session URL. The app opens this in a browser.
  Future<String> createCheckoutSession({required String plan});

  /// Calls the create-portal-session edge function and returns the
  /// Stripe Billing Portal URL so the user can manage or cancel their plan.
  Future<String> createPortalSession();
}
