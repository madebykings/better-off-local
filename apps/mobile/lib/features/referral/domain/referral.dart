class ReferralStats {
  const ReferralStats({
    required this.code,
    required this.referralUrl,
    required this.invitedCount,
    required this.convertedCount,
    required this.pendingMonths,
    required this.confirmedRewards,
    required this.freeMonthsEarned,
    required this.totalRewardPence,
  });

  final String code;
  final String referralUrl;
  final int invitedCount;
  final int convertedCount;
  final int pendingMonths;
  final int confirmedRewards;
  final int freeMonthsEarned;
  final int totalRewardPence;

  String get membershipValueDisplay {
    if (totalRewardPence == 0) return '£0';
    final pounds = totalRewardPence / 100;
    return '£${pounds.toStringAsFixed(pounds.truncateToDouble() == pounds ? 0 : 2)}';
  }

  String get freeMonthsDisplay =>
      freeMonthsEarned == 1 ? '1 month' : '$freeMonthsEarned months';
}
