import 'package:flutter/material.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../map_controller.dart';

/// Horizontal chip filter bar overlaid on the map below the search bar.
/// Shows filter options: All, Offers, Events, Featured, Following, Loyalty.
class MapFilterBar extends StatelessWidget {
  const MapFilterBar({
    super.key,
    required this.activeFilter,
    required this.onFilterChanged,
  });

  final MapFilter activeFilter;
  final ValueChanged<MapFilter> onFilterChanged;

  static const _filters = [
    (MapFilter.all, 'All', null),
    (MapFilter.offers, 'Offers', Icons.local_offer_outlined),
    (MapFilter.events, 'Events', Icons.event_outlined),
    (MapFilter.featured, 'Featured', Icons.star_outline),
    (MapFilter.following, 'Following', Icons.favorite_outline),
    (MapFilter.loyalty, 'Loyalty', Icons.card_giftcard_outlined),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        itemCount: _filters.length,
        separatorBuilder: (_, __) => const SizedBox(width: 6),
        itemBuilder: (context, i) {
          final (filter, label, icon) = _filters[i];
          final isActive = activeFilter == filter;
          return _FilterChip(
            label: label,
            icon: icon,
            isActive: isActive,
            onTap: () => onFilterChanged(filter),
          );
        },
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.isActive,
    required this.onTap,
    this.icon,
  });

  final String label;
  final IconData? icon;
  final bool isActive;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
        decoration: BoxDecoration(
          color: isActive ? AppColors.primary : Colors.white,
          borderRadius: BorderRadius.circular(18),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isActive ? 0.15 : 0.08),
              blurRadius: isActive ? 8 : 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 14,
                color: isActive ? Colors.white : AppColors.textSecondary,
              ),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: AppTextStyles.labelSmall.copyWith(
                color: isActive ? Colors.white : AppColors.textPrimary,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
