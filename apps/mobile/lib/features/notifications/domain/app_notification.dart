import 'package:equatable/equatable.dart';

enum NotificationType {
  offer,
  system,
  membership,
  redemption,
  referral,
  region,
}

class AppNotification extends Equatable {
  const AppNotification({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    this.isRead = false,
    this.payload,
  });

  final String id;
  final NotificationType type;
  final String title;
  final String body;
  final DateTime createdAt;
  final bool isRead;
  final Map<String, dynamic>? payload;

  @override
  List<Object?> get props => [id, type, isRead];
}
