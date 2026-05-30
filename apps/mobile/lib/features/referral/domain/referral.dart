class ReferralStats {
  const ReferralStats({
    required this.code,
    required this.referralUrl,
    required this.invitedCount,
    required this.convertedCount,
    required this.pendingRewards,
    required this.confirmedRewards,
    required this.totalRewardPence,
  });

  final String code;
  final String referralUrl;
  final int invitedCount;
  final int convertedCount;
  final int pendingRewards;
  final int confirmedRewards;
  final int totalRewardPence;

  String get totalRewardDisplay {
    final pounds = totalRewardPence / 100;
    return '£${pounds.toStringAsFixed(pounds.truncateToDouble() == pounds ? 0 : 2)}';
  }
}
