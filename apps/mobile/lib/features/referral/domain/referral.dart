class ReferralStats {
  const ReferralStats({
    required this.code,
    required this.referralUrl,
    required this.invitedCount,
    required this.convertedCount,
    required this.pendingAmountPence,
    required this.eligibleAmountPence,
    required this.paidAmountPence,
    this.paypalEmail,
  });

  final String code;
  final String referralUrl;
  final int invitedCount;
  final int convertedCount;

  /// Rewards pending the 30-day qualification window.
  final int pendingAmountPence;

  /// Rewards past the 30-day window, ready for PayPal payout.
  final int eligibleAmountPence;

  /// Rewards already paid out.
  final int paidAmountPence;

  /// Member's PayPal email for receiving payouts.
  final String? paypalEmail;

  String _fmt(int pence) {
    if (pence == 0) return '£0';
    final pounds = pence / 100;
    return '£${pounds.toStringAsFixed(pounds.truncateToDouble() == pounds ? 0 : 2)}';
  }

  String get pendingDisplay   => _fmt(pendingAmountPence);
  String get eligibleDisplay  => _fmt(eligibleAmountPence);
  String get paidDisplay      => _fmt(paidAmountPence);
  String get totalEarnedDisplay => _fmt(eligibleAmountPence + paidAmountPence);
}
