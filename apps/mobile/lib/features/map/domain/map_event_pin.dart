class MapEventPin {
  const MapEventPin({
    required this.id,
    required this.title,
    required this.eventType,
    required this.venueLat,
    required this.venueLng,
    required this.retailerId,
    required this.startAt,
    required this.hasReminder,
    this.imageUrl,
    this.shortSummary,
    this.venueName,
    this.endAt,
  });

  final String id;
  final String title;
  final String eventType;
  final double venueLat;
  final double venueLng;
  final String retailerId;
  final DateTime startAt;
  final bool hasReminder;
  final String? imageUrl;
  final String? shortSummary;
  final String? venueName;
  final DateTime? endAt;

  factory MapEventPin.fromMap(Map<String, dynamic> map) {
    return MapEventPin(
      id: map['event_id'] as String,
      title: map['title'] as String,
      eventType: map['event_type'] as String? ?? 'other',
      venueLat: double.parse(map['venue_lat'].toString()),
      venueLng: double.parse(map['venue_lng'].toString()),
      retailerId: map['retailer_id'] as String,
      startAt: DateTime.parse(map['start_at'] as String),
      hasReminder: map['has_reminder'] as bool? ?? false,
      imageUrl: map['image_url'] as String?,
      shortSummary: map['short_summary'] as String?,
      venueName: map['venue_name'] as String?,
      endAt: map['end_at'] != null ? DateTime.parse(map['end_at'] as String) : null,
    );
  }

  /// Returns a formatted date string, e.g. "Sat 14 Jun".
  String get formattedDate {
    final d = startAt.toLocal();
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${days[d.weekday - 1]} ${d.day} ${months[d.month - 1]}';
  }

  /// Returns a formatted time string, e.g. "7:00pm".
  String get formattedTime {
    final d = startAt.toLocal();
    final h = d.hour > 12 ? d.hour - 12 : (d.hour == 0 ? 12 : d.hour);
    final m = d.minute.toString().padLeft(2, '0');
    final ampm = d.hour >= 12 ? 'pm' : 'am';
    return '$h:${m}$ampm';
  }
}
