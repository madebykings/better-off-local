class Region {
  const Region({
    required this.id,
    required this.name,
    required this.slug,
    required this.memberThreshold,
    required this.isActive,
    this.activeMemberCount = 0,
    this.payingMemberCount = 0,
    this.activeRetailerCount = 0,
    this.liveOfferCount = 0,
  });

  final String id;
  final String name;
  final String slug;
  final int memberThreshold;
  final bool isActive;
  final int activeMemberCount;
  final int payingMemberCount;
  final int activeRetailerCount;
  final int liveOfferCount;

  double get progressFraction =>
      (activeMemberCount / memberThreshold).clamp(0.0, 1.0);

  bool get hasReachedThreshold => activeMemberCount >= memberThreshold;

  factory Region.fromMap(Map<String, dynamic> map) {
    return Region(
      id: map['id'] as String,
      name: map['name'] as String,
      slug: map['slug'] as String,
      memberThreshold: (map['member_threshold'] as num?)?.toInt() ?? 100,
      isActive: map['is_active'] as bool? ?? true,
      activeMemberCount: (map['active_member_count'] as num?)?.toInt() ?? 0,
      payingMemberCount: (map['paying_member_count'] as num?)?.toInt() ?? 0,
      activeRetailerCount: (map['active_retailer_count'] as num?)?.toInt() ?? 0,
      liveOfferCount: (map['live_offer_count'] as num?)?.toInt() ?? 0,
    );
  }

  /// Simplified fromMap for the regions table (no computed counts).
  factory Region.fromTableMap(Map<String, dynamic> map) {
    return Region(
      id: map['id'] as String,
      name: map['name'] as String,
      slug: map['slug'] as String,
      memberThreshold: (map['member_threshold'] as num?)?.toInt() ?? 100,
      isActive: map['is_active'] as bool? ?? true,
    );
  }
}
