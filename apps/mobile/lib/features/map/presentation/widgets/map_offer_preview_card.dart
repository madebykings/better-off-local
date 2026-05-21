import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../retailers/domain/retailer.dart';

/// Bottom-sheet card shown when a map marker is tapped.
/// Displays retailer summary, featured offer value, and a "View" CTA.
class MapRetailerPreviewCard extends StatelessWidget {
  const MapRetailerPreviewCard({
    super.key,
    required this.retailer,
    required this.onDismiss,
    this.onView,
  });

  final Retailer retailer;
  final VoidCallback onDismiss;
  /// Called when the "View" button is tapped. If null the card falls back to
  /// a direct [context.push] navigation.
  final VoidCallback? onView;

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
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Cover strip ───────────────────────────────────────────────
            SizedBox(
              height: 72,
              width: double.infinity,
              child: retailer.coverImageUrl != null
                  ? Image.network(
                      retailer.coverImageUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _coverPlaceholder(),
                    )
                  : _coverPlaceholder(),
            ),
            // ── Info row ──────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 8, 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _LogoBadge(logoUrl: retailer.logoUrl, name: retailer.name),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          retailer.name,
                          style: AppTextStyles.titleMedium,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (retailer.categories.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            retailer.categories.take(2).join(' · '),
                            style: AppTextStyles.labelSmall
                                .copyWith(color: AppColors.textSecondary),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                        if (retailer.distanceKm != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            _fmtDistance(retailer.distanceKm!),
                            style: AppTextStyles.labelSmall
                                .copyWith(color: AppColors.textDisabled),
                          ),
                        ] else if (retailer.town != null) ...[
                          const SizedBox(height: 2),
                          Text(
                            retailer.town!,
                            style: AppTextStyles.labelSmall
                                .copyWith(color: AppColors.textDisabled),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Dismiss + View
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      GestureDetector(
                        onTap: onDismiss,
                        child: const Icon(Icons.close,
                            size: 18, color: AppColors.textDisabled),
                      ),
                      const SizedBox(height: 6),
                      ElevatedButton(
                        onPressed: onView ??
                            () => context.push(
                                  RouteNames.retailerDetail
                                      .replaceAll(':retailerId', retailer.id),
                                ),
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
            // ── Featured offer footer ─────────────────────────────────────
            if (retailer.featuredOffer?.valueText != null)
              Container(
                width: double.infinity,
                color: const Color(0xFFF0F7F4),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                child: Row(
                  children: [
                    const Icon(Icons.local_offer_outlined,
                        size: 13, color: AppColors.primary),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        retailer.featuredOffer!.valueText!,
                        style: AppTextStyles.labelSmall.copyWith(
                          color: AppColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  static Widget _coverPlaceholder() => Container(
        color: AppColors.primaryLight,
        child: const Center(
          child: Icon(Icons.storefront_outlined,
              color: Colors.white54, size: 24),
        ),
      );

  static String _fmtDistance(double km) =>
      km < 1.0 ? '${(km * 1000).round()}m away' : '${km.toStringAsFixed(1)}km away';
}

// ── Logo badge ────────────────────────────────────────────────────────────────

class _LogoBadge extends StatelessWidget {
  const _LogoBadge({required this.logoUrl, required this.name});
  final String? logoUrl;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: logoUrl != null
          ? Image.network(
              logoUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _Initials(name),
            )
          : _Initials(name),
    );
  }
}

class _Initials extends StatelessWidget {
  const _Initials(this.name);
  final String name;

  @override
  Widget build(BuildContext context) => Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
}
