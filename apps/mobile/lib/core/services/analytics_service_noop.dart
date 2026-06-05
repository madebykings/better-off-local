import 'analytics_service.dart';

/// No-op implementation used when Firebase is unavailable.
/// All methods are safe stubs that do nothing.
class AnalyticsServiceNoop implements AnalyticsService {
  const AnalyticsServiceNoop();

  @override
  Future<void> setUserId(String? userId) async {}

  @override
  Future<void> logMembershipPurchased({
    required String plan,
    required double amountGbp,
  }) async {}

  @override
  Future<void> logMembershipRenewed({
    required String plan,
    required double amountGbp,
  }) async {}

  @override
  Future<void> logOfferViewed({
    required String offerId,
    required String retailerId,
  }) async {}

  @override
  Future<void> logOfferRedeemed({
    required String offerId,
    required String retailerId,
    required String offerType,
  }) async {}

  @override
  Future<void> logLoyaltyStampEarned({
    required String cardId,
    required String retailerId,
    required int stampNumber,
    required int totalRequired,
  }) async {}

  @override
  Future<void> logLoyaltyCardCompleted({
    required String cardId,
    required String retailerId,
  }) async {}

  @override
  Future<void> logReferralShared() async {}

  @override
  Future<void> logReferralRewardUnlocked({required double amountGbp}) async {}

  @override
  Future<void> logEventViewed({required String eventId}) async {}

  @override
  Future<void> logEventReminderEnabled({required String eventId}) async {}

  @override
  Future<void> logRetailerFollowed({required String retailerId}) async {}

  @override
  Future<void> logStoryViewed({
    required String storyId,
    required String retailerId,
  }) async {}
}
