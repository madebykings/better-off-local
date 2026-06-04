abstract class RouteNames {
  // Public
  static const splash = '/';
  static const welcome = '/welcome';
  static const signIn = '/sign-in';
  static const signUp = '/sign-up';
  static const forgotPassword = '/forgot-password';

  // Profile completion (authenticated, pre-home gate)
  static const completeProfile = '/complete-profile';

  // Membership gating
  static const paywall = '/paywall';
  static const activating = '/activating';
  static const subscriptionSuccess = '/subscription-success';

  // Authenticated shell tabs
  static const home = '/home';
  static const explore = '/explore';
  static const map = '/map';
  static const card = '/card';
  static const account = '/account';

  // Nested under explore
  static const offerDetail = '/explore/offer/:offerId';
  static const retailerDetail = '/explore/retailer/:retailerId';

  // Nested under account
  static const settings = '/account/settings';
  static const savings = '/account/savings';

  // Utility / cross-feature
  static const favourites = '/favourites';
  static const notifications = '/notifications';
  static const redemptionHistory = '/redemptions';
  static const redemptionQR = '/redemptions/qr/:offerId';
  static const redemptionConfirmation = '/redemptions/confirmation';
  static const redemptionFailed = '/redemptions/failed';

  // Referral programme
  static const referral = '/account/referral';

  // Region
  static const regionSelection = '/region-selection';
  static const regionProgress  = '/account/region';

  // Loyalty cards
  static const loyaltyCards = '/account/loyalty';

  // Venue referral rewards
  static const venueReferralRewards = '/account/venue-referral-rewards';

  // Following
  static const following = '/account/following';
}
