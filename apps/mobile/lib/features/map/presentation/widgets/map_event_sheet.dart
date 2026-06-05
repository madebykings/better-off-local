import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../domain/map_event_pin.dart';

/// Bottom-sheet card shown when an event map marker is tapped.
///
/// Manages reminder state locally so the card doesn't disappear during a
/// server round-trip. [onReminderToggled] is called after the optimistic
/// local update — callers should make the server call and need not
/// invalidate the global events provider.
class MapEventSheet extends StatefulWidget {
  const MapEventSheet({
    super.key,
    required this.event,
    required this.hasReminder,
    required this.onDismiss,
    required this.onViewEvent,
    required this.onReminderToggled,
  });

  final MapEventPin event;
  final bool hasReminder;
  final VoidCallback onDismiss;
  final VoidCallback onViewEvent;
  final ValueChanged<bool> onReminderToggled;

  @override
  State<MapEventSheet> createState() => _MapEventSheetState();
}

class _MapEventSheetState extends State<MapEventSheet> {
  late bool _hasReminder;

  @override
  void initState() {
    super.initState();
    _hasReminder = widget.hasReminder;
  }

  @override
  void didUpdateWidget(MapEventSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Sync when the sheet switches to a different event.
    if (oldWidget.event.id != widget.event.id) {
      _hasReminder = widget.hasReminder;
    }
  }

  void _toggleReminder() {
    final next = !_hasReminder;
    setState(() => _hasReminder = next);
    widget.onReminderToggled(next);
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.border),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.07),
              blurRadius: 12,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Image / header ────────────────────────────────────────────
            SizedBox(
              height: 72,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  event.imageUrl != null
                      ? Image.network(
                          event.imageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _eventPlaceholder(),
                        )
                      : _eventPlaceholder(),
                  // Event type badge
                  Positioned(
                    bottom: 6,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.55),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        _formatEventType(event.eventType),
                        style: AppTextStyles.labelSmall.copyWith(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                  // Dismiss button
                  Positioned(
                    top: 6,
                    right: 8,
                    child: GestureDetector(
                      onTap: onDismiss,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.4),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.close,
                            size: 14, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ── Info ──────────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 10, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          event.title,
                          style: AppTextStyles.titleMedium,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.calendar_today_outlined,
                                size: 12, color: AppColors.textSecondary),
                            const SizedBox(width: 4),
                            Text(
                              '${event.formattedDate} · ${event.formattedTime}',
                              style: AppTextStyles.labelSmall
                                  .copyWith(color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                        if (event.venueName != null) ...[
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              const Icon(Icons.location_on_outlined,
                                  size: 12, color: AppColors.textSecondary),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  event.venueName!,
                                  style: AppTextStyles.labelSmall
                                      .copyWith(color: AppColors.textSecondary),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      // Remind me toggle
                      GestureDetector(
                        onTap: _toggleReminder,
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: _hasReminder
                                ? AppColors.info.withValues(alpha: 0.1)
                                : AppColors.background,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: _hasReminder
                                  ? AppColors.info
                                  : AppColors.border,
                            ),
                          ),
                          child: Icon(
                            _hasReminder
                                ? Icons.notifications_active_outlined
                                : Icons.notifications_outlined,
                            size: 16,
                            color: _hasReminder
                                ? AppColors.info
                                : AppColors.textSecondary,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      ElevatedButton(
                        onPressed: onViewEvent,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 8),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                          elevation: 0,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          minimumSize: Size.zero,
                        ),
                        child: const Text(
                          'View',
                          style: TextStyle(
                              fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  static Widget _eventPlaceholder() => Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF0D6EFD), Color(0xFF6EA8FE)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: const Center(
          child: Icon(Icons.event_outlined, color: Colors.white54, size: 24),
        ),
      );

  static String _formatEventType(String type) {
    return switch (type) {
      'workshop' => 'Workshop',
      'live_music' => 'Live Music',
      'food_drink' => 'Food & Drink',
      'market' => 'Market',
      'community' => 'Community',
      'sport' => 'Sport',
      'art' => 'Art & Culture',
      'family' => 'Family',
      'networking' => 'Networking',
      _ => 'Event',
    };
  }
}
