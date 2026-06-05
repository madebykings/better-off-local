abstract class AnalyticsService {
  /// Associates subsequent events with the authenticated user.
  /// Pass null to clear the association on sign-out.
  Future<void> setUserId(String? userId);

  // ── Membership ──────────────────────────────────────────────────────────────

  Future<void> logMembershipPurchased({
    required String plan,
    required double amountGbp,
  });

  Future<void> logMembershipRenewed({
    required String plan,
    required double amountGbp,
  });

  // ── Offers & redemptions ────────────────────────────────────────────────────

  Future<void> logOfferViewed({
    required String offerId,
    required String retailerId,
  });

  Future<void> logOfferRedeemed({
    required String offerId,
    required String retailerId,
    required String offerType,
  });

  // ── Loyalty ─────────────────────────────────────────────────────────────────

  Future<void> logLoyaltyStampEarned({
    required String cardId,
    required String retailerId,
    required int stampNumber,
    required int totalRequired,
  });

  Future<void> logLoyaltyCardCompleted({
    required String cardId,
    required String retailerId,
  });

  // ── Referral ────────────────────────────────────────────────────────────────

  Future<void> logReferralShared();

  Future<void> logReferralRewardUnlocked({required double amountGbp});

  // ── Events ──────────────────────────────────────────────────────────────────

  Future<void> logEventViewed({required String eventId});

  Future<void> logEventReminderEnabled({required String eventId});

  // ── Social ──────────────────────────────────────────────────────────────────

  Future<void> logRetailerFollowed({required String retailerId});

  Future<void> logStoryViewed({
    required String storyId,
    required String retailerId,
  });
}
