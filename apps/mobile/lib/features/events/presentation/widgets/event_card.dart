import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../domain/event.dart';

// ---------------------------------------------------------------------------
// EventCard — used in horizontal-scroll lists and as a full-width featured card.
//
// compact: true  → 176 px wide, 120 px image (horizontal scroll variant).
// compact: false → full width, 200 px image (featured / section variant).
// ---------------------------------------------------------------------------

class EventCard extends StatelessWidget {
  const EventCard({
    super.key,
    required this.event,
    this.compact = true,
  });

  final Event event;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final double imageHeight = compact ? 120.0 : 200.0;
    final double cardWidth = compact ? 176.0 : double.infinity;

    Widget card = Card(
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: () => context.push(
          RouteNames.communityEventDetail.replaceAll(':eventId', event.id),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _EventImageStack(
              event: event,
              imageHeight: imageHeight,
              compact: compact,
            ),
            _EventCardBody(event: event, compact: compact),
          ],
        ),
      ),
    );

    if (compact) {
      card = SizedBox(width: cardWidth, child: card);
    }

    return card;
  }
}

// ---------------------------------------------------------------------------
// Image stack: cover + date chip (bottom-left) + event type badge (top-right)
// ---------------------------------------------------------------------------

class _EventImageStack extends StatelessWidget {
  const _EventImageStack({
    required this.event,
    required this.imageHeight,
    required this.compact,
  });

  final Event event;
  final double imageHeight;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Cover image
        SizedBox(
          height: imageHeight,
          width: double.infinity,
          child: event.imageUrl != null
              ? Image.network(
                  event.imageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const _EventImagePlaceholder(),
                )
              : const _EventImagePlaceholder(),
        ),

        // Event type badge — top-right
        Positioned(
          top: 8,
          right: 8,
          child: _EventTypeBadge(eventType: event.eventType, compact: compact),
        ),

        // Date chip — bottom-left
        Positioned(
          bottom: 8,
          left: 8,
          child: _DateChip(event: event, compact: compact),
        ),

        // "Featured" pill — top-left (only for featured events on wide cards)
        if (event.isFeatured && !compact)
          Positioned(
            top: 8,
            left: 8,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.accent,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Text(
                'Featured',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _DateChip extends StatelessWidget {
  const _DateChip({required this.event, required this.compact});

  final Event event;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 7 : 9,
        vertical: compact ? 4 : 5,
      ),
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.20),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Text(
        event.formattedDate.toUpperCase(),
        style: TextStyle(
          color: Colors.white,
          fontSize: compact ? 9 : 11,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}

class _EventTypeBadge extends StatelessWidget {
  const _EventTypeBadge({required this.eventType, required this.compact});

  final String eventType;
  final bool compact;

  String get _label {
    return switch (eventType) {
      'workshop' => 'Workshop',
      'exhibition' => 'Exhibition',
      'performance' => 'Performance',
      'market' => 'Market',
      'sports' => 'Sports',
      'food_drink' => 'Food & Drink',
      'community' => 'Community',
      _ => 'Event',
    };
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 6 : 8,
        vertical: compact ? 3 : 4,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.90),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.10),
            blurRadius: 3,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Text(
        _label,
        style: TextStyle(
          color: AppColors.textPrimary,
          fontSize: compact ? 9 : 10,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Card body — title + retailer/venue info
// ---------------------------------------------------------------------------

class _EventCardBody extends StatelessWidget {
  const _EventCardBody({required this.event, required this.compact});

  final Event event;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(compact ? 10.0 : 12.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            event.title,
            style: AppTextStyles.titleMedium.copyWith(
              fontSize: compact ? 13.0 : 15.0,
              fontWeight: FontWeight.w700,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          _EventSubtitle(event: event, compact: compact),
        ],
      ),
    );
  }
}

class _EventSubtitle extends StatelessWidget {
  const _EventSubtitle({required this.event, required this.compact});

  final Event event;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final parts = <String>[
      if (event.retailerName != null) event.retailerName!,
      if (event.venueName != null) event.venueName!,
    ];

    if (parts.isEmpty) {
      return Text(
        event.formattedTime,
        style: TextStyle(
          fontSize: compact ? 11 : 12,
          color: AppColors.textSecondary,
        ),
      );
    }

    return Text(
      parts.join(' · '),
      style: TextStyle(
        fontSize: compact ? 11 : 12,
        color: AppColors.textSecondary,
      ),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}

// ---------------------------------------------------------------------------
// Placeholder
// ---------------------------------------------------------------------------

class _EventImagePlaceholder extends StatelessWidget {
  const _EventImagePlaceholder();

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.background,
      child: const Center(
        child: Icon(
          Icons.event_outlined,
          size: 36,
          color: AppColors.border,
        ),
      ),
    );
  }
}
