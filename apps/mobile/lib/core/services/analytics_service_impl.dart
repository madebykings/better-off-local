import 'package:firebase_analytics/firebase_analytics.dart';

import 'analytics_service.dart';

/// Firebase Analytics implementation of [AnalyticsService].
///
/// Uses GA4 standard events where applicable (purchase, share) so that
/// Google Play and App Store revenue attribution work automatically.
/// All other events use the `noun_verb` custom-event naming convention.
class FirebaseAnalyticsServiceImpl implements AnalyticsService {
  FirebaseAnalyticsServiceImpl() : _analytics = FirebaseAnalytics.instance;

  final FirebaseAnalytics _analytics;

  @override
  Future<void> setUserId(String? userId) => _analytics.setUserId(id: userId);

  // ── Membership ──────────────────────────────────────────────────────────────

  @override
  Future<void> logMembershipPurchased({
    required String plan,
    required double amountGbp,
  }) =>
      _analytics.logPurchase(
        currency: 'GBP',
        value: amountGbp,
        items: [
          AnalyticsEventItem(
            itemName: 'Better Off Local $plan membership',
            itemCategory: 'membership',
            itemId: 'membership_$plan',
          ),
        ],
      );

  @override
  Future<void> logMembershipRenewed({
    required String plan,
    required double amountGbp,
  }) =>
      _analytics.logEvent(
        name: 'membership_renewed',
        parameters: {'plan': plan, 'amount_gbp': amountGbp},
      );

  // ── Offers & redemptions ────────────────────────────────────────────────────

  @override
  Future<void> logOfferViewed({
    required String offerId,
    required String retailerId,
  }) =>
      _analytics.logEvent(
        name: 'offer_viewed',
        parameters: {'offer_id': offerId, 'retailer_id': retailerId},
      );

  @override
  Future<void> logOfferRedeemed({
    required String offerId,
    required String retailerId,
    required String offerType,
  }) =>
      _analytics.logEvent(
        name: 'offer_redeemed',
        parameters: {
          'offer_id': offerId,
          'retailer_id': retailerId,
          'offer_type': offerType,
        },
      );

  // ── Loyalty ─────────────────────────────────────────────────────────────────

  @override
  Future<void> logLoyaltyStampEarned({
    required String cardId,
    required String retailerId,
    required int stampNumber,
    required int totalRequired,
  }) =>
      _analytics.logEvent(
        name: 'loyalty_stamp_earned',
        parameters: {
          'card_id': cardId,
          'retailer_id': retailerId,
          'stamp_number': stampNumber,
          'total_required': totalRequired,
        },
      );

  @override
  Future<void> logLoyaltyCardCompleted({
    required String cardId,
    required String retailerId,
  }) =>
      _analytics.logEvent(
        name: 'loyalty_card_completed',
        parameters: {'card_id': cardId, 'retailer_id': retailerId},
      );

  // ── Referral ────────────────────────────────────────────────────────────────

  @override
  Future<void> logReferralShared() => _analytics.logShare(
        contentType: 'referral_link',
        itemId: 'referral',
        method: 'share_sheet',
      );

  @override
  Future<void> logReferralRewardUnlocked({required double amountGbp}) =>
      _analytics.logEvent(
        name: 'referral_reward_unlocked',
        parameters: {'amount_gbp': amountGbp},
      );

  // ── Events ──────────────────────────────────────────────────────────────────

  @override
  Future<void> logEventViewed({required String eventId}) =>
      _analytics.logEvent(
        name: 'event_viewed',
        parameters: {'event_id': eventId},
      );

  @override
  Future<void> logEventReminderEnabled({required String eventId}) =>
      _analytics.logEvent(
        name: 'event_reminder_enabled',
        parameters: {'event_id': eventId},
      );

  // ── Social ──────────────────────────────────────────────────────────────────

  @override
  Future<void> logRetailerFollowed({required String retailerId}) =>
      _analytics.logEvent(
        name: 'retailer_followed',
        parameters: {'retailer_id': retailerId},
      );

  @override
  Future<void> logStoryViewed({
    required String storyId,
    required String retailerId,
  }) =>
      _analytics.logEvent(
        name: 'story_viewed',
        parameters: {'story_id': storyId, 'retailer_id': retailerId},
      );
}
