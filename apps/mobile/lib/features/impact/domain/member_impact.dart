class MemberImpact {
  const MemberImpact({
    required this.totalSavedPence,
    required this.offersRedeemed,
    required this.businessesSupported,
    required this.loyaltyCompletions,
    required this.referralsGenerated,
    required this.eventsAttended,
    required this.memberSince,
    this.favouriteRetailerName,
    this.favouriteRetailerId,
  });

  final int totalSavedPence;
  final int offersRedeemed;
  final int businessesSupported;
  final int loyaltyCompletions;
  final int referralsGenerated;
  final int eventsAttended;
  final DateTime? memberSince;
  final String? favouriteRetailerName;
  final String? favouriteRetailerId;

  String get formattedSavings {
    final pounds = totalSavedPence ~/ 100;
    final pence = totalSavedPence % 100;
    if (pence == 0) return '£$pounds';
    return '£$pounds.${pence.toString().padLeft(2, '0')}';
  }

  factory MemberImpact.fromMap(Map<String, dynamic> map) {
    return MemberImpact(
      totalSavedPence: (map['total_saved_pence'] as num?)?.toInt() ?? 0,
      offersRedeemed: (map['offers_redeemed'] as num?)?.toInt() ?? 0,
      businessesSupported: (map['businesses_supported'] as num?)?.toInt() ?? 0,
      loyaltyCompletions: (map['loyalty_completions'] as num?)?.toInt() ?? 0,
      referralsGenerated: (map['referrals_generated'] as num?)?.toInt() ?? 0,
      eventsAttended: (map['events_attended'] as num?)?.toInt() ?? 0,
      memberSince: map['member_since'] != null
          ? DateTime.parse(map['member_since'] as String)
          : null,
      favouriteRetailerName: map['favourite_retailer_name'] as String?,
      favouriteRetailerId: map['favourite_retailer_id'] as String?,
    );
  }
}
