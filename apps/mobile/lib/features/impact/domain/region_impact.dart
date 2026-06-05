class RegionImpact {
  const RegionImpact({
    required this.totalSavingsPence,
    required this.totalRedemptions,
    required this.activeMembers,
    required this.businessesParticipating,
    required this.eventsHosted,
    required this.loyaltyCompletions,
    required this.referralsGenerated,
    this.topBusinesses = const [],
    this.topCategories = const [],
    this.monthlyRedemptions = const [],
  });

  final int totalSavingsPence;
  final int totalRedemptions;
  final int activeMembers;
  final int businessesParticipating;
  final int eventsHosted;
  final int loyaltyCompletions;
  final int referralsGenerated;
  final List<Map<String, dynamic>> topBusinesses;
  final List<Map<String, dynamic>> topCategories;
  final List<Map<String, dynamic>> monthlyRedemptions;

  String get formattedSavings {
    final pounds = totalSavingsPence ~/ 100;
    if (pounds >= 1000) {
      return '£${(pounds / 1000).toStringAsFixed(1)}k';
    }
    return '£$pounds';
  }

  factory RegionImpact.fromMap(Map<String, dynamic> map) {
    return RegionImpact(
      totalSavingsPence: (map['total_savings_pence'] as num?)?.toInt() ?? 0,
      totalRedemptions: (map['total_redemptions'] as num?)?.toInt() ?? 0,
      activeMembers: (map['active_members'] as num?)?.toInt() ?? 0,
      businessesParticipating:
          (map['businesses_participating'] as num?)?.toInt() ?? 0,
      eventsHosted: (map['events_hosted'] as num?)?.toInt() ?? 0,
      loyaltyCompletions: (map['loyalty_completions'] as num?)?.toInt() ?? 0,
      referralsGenerated: (map['referrals_generated'] as num?)?.toInt() ?? 0,
      topBusinesses: List<Map<String, dynamic>>.from(
          map['top_businesses'] as List? ?? []),
      topCategories: List<Map<String, dynamic>>.from(
          map['top_categories'] as List? ?? []),
      monthlyRedemptions: List<Map<String, dynamic>>.from(
          map['monthly_redemptions'] as List? ?? []),
    );
  }
}
