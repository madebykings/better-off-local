import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';

/// Compact activity summary pill overlaid on the map.
/// Shows retailer count, offer count, and nearby event count.
class MapActivitySummary extends StatelessWidget {
  const MapActivitySummary({
    super.key,
    required this.retailerCount,
    required this.offerCount,
    required this.eventCount,
  });

  final int retailerCount;
  final int offerCount;
  final int eventCount;

  @override
  Widget build(BuildContext context) {
    if (retailerCount == 0 && offerCount == 0 && eventCount == 0) {
      return const SizedBox.shrink();
    }

    final parts = <String>[];
    if (retailerCount > 0) parts.add('$retailerCount ${retailerCount == 1 ? 'place' : 'places'}');
    if (offerCount > 0) parts.add('$offerCount ${offerCount == 1 ? 'offer' : 'offers'}');
    if (eventCount > 0) parts.add('$eventCount ${eventCount == 1 ? 'event' : 'events'}');

    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.92),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.15),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Text(
          parts.join(' · '),
          style: AppTextStyles.labelSmall.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
