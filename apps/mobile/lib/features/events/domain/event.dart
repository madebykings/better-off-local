class Event {
  const Event({
    required this.id,
    required this.retailerId,
    required this.regionId,
    required this.title,
    required this.eventType,
    required this.startAt,
    this.venueId,
    this.venueName,
    this.venueAddress,
    this.retailerName,
    this.retailerLogoUrl,
    this.shortSummary,
    this.description,
    this.endAt,
    this.imageUrl,
    this.bookingUrl,
    this.isFeatured = false,
  });

  final String id;
  final String retailerId;
  final String regionId;
  final String title;
  final String eventType;
  final DateTime startAt;
  final String? venueId;
  final String? venueName;
  final String? venueAddress;
  final String? retailerName;
  final String? retailerLogoUrl;
  final String? shortSummary;
  final String? description;
  final DateTime? endAt;
  final String? imageUrl;
  final String? bookingUrl;
  final bool isFeatured;

  factory Event.fromMap(Map<String, dynamic> map) {
    final venue = map['venue'] as Map<String, dynamic>?;
    final retailer = map['retailer'] as Map<String, dynamic>?;
    return Event(
      id: map['id'] as String,
      retailerId: map['retailer_id'] as String,
      regionId: map['region_id'] as String,
      title: map['title'] as String,
      eventType: map['event_type'] as String? ?? 'other',
      startAt: DateTime.parse(map['start_at'] as String),
      venueId: map['venue_id'] as String?,
      venueName: venue?['name'] as String?,
      venueAddress: venue?['address_line1'] as String?,
      retailerName: retailer?['name'] as String?,
      retailerLogoUrl: retailer?['logo_url'] as String?,
      shortSummary: map['short_summary'] as String?,
      description: map['description'] as String?,
      endAt: map['end_at'] != null
          ? DateTime.parse(map['end_at'] as String)
          : null,
      imageUrl: map['image_url'] as String?,
      bookingUrl: map['booking_url'] as String?,
      isFeatured: map['is_featured'] as bool? ?? false,
    );
  }

  /// Returns a formatted date string, e.g. "Sat 14 Jun".
  String get formattedDate {
    final d = startAt.toLocal();
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    return '${days[d.weekday - 1]} ${d.day} ${months[d.month - 1]}';
  }

  /// Returns a formatted time string, e.g. "7:00pm".
  String get formattedTime {
    final d = startAt.toLocal();
    final h = d.hour > 12
        ? d.hour - 12
        : (d.hour == 0 ? 12 : d.hour);
    final m = d.minute.toString().padLeft(2, '0');
    final ampm = d.hour >= 12 ? 'pm' : 'am';
    return '$h:${m}$ampm';
  }
}
