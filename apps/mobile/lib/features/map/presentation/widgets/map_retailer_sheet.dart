import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../follow/providers/retailer_follows_providers.dart';
import '../../../loyalty/domain/loyalty_card.dart';
import '../../../loyalty/providers/loyalty_providers.dart';
import '../../../retailers/domain/retailer.dart';

/// Rich bottom-sheet card shown when a retailer map marker is tapped.
///
/// Shows: logo, name, category, distance, open/closed, featured badge,
/// follow button, offer count, loyalty progress bar, and a View CTA.
class MapRetailerSheet extends ConsumerWidget {
  const MapRetailerSheet({
    super.key,
    required this.retailer,
    required this.onDismiss,
    this.onView,
  });

  final Retailer retailer;
  final VoidCallback onDismiss;
  final VoidCallback? onView;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final followedIds = ref.watch(followedRetailerIdsProvider);
    final isFollowing = followedIds.contains(retailer.id);

    // Find active loyalty card for this retailer.
    final loyaltyCards = ref.watch(myLoyaltyCardsProvider).valueOrNull ?? [];
    final loyaltyCard = loyaltyCards.cast<LoyaltyCard?>().firstWhere(
          (c) => c?.retailerId == retailer.id && c?.status == LoyaltyCardStatus.active,
          orElse: () => null,
        );

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
            // ── Cover strip ───────────────────────────────────────────────
            SizedBox(
              height: 68,
              width: double.infinity,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  retailer.coverImageUrl != null
                      ? Image.network(
                          retailer.coverImageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _coverPlaceholder(),
                        )
                      : _coverPlaceholder(),
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
                  // Featured badge
                  if (retailer.isFeatured)
                    Positioned(
                      top: 6,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: AppColors.accent,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          'Featured',
                          style: AppTextStyles.labelSmall.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: 10,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),

            // ── Info row ──────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 10, 0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _LogoBadge(
                      logoUrl: retailer.logoUrl, name: retailer.name),
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
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            if (retailer.distanceKm != null)
                              Text(
                                _fmtDistance(retailer.distanceKm!),
                                style: AppTextStyles.labelSmall
                                    .copyWith(color: AppColors.textDisabled),
                              )
                            else if (retailer.town != null)
                              Text(
                                retailer.town!,
                                style: AppTextStyles.labelSmall
                                    .copyWith(color: AppColors.textDisabled),
                              ),
                            if (retailer.openingHours?.statusLabel != null) ...[
                              if (retailer.distanceKm != null ||
                                  retailer.town != null)
                                Text(
                                  ' · ',
                                  style: AppTextStyles.labelSmall
                                      .copyWith(color: AppColors.textDisabled),
                                ),
                              Text(
                                retailer.openingHours!.statusLabel!,
                                style: AppTextStyles.labelSmall.copyWith(
                                  color: retailer.openingHours!.isOpenNow
                                      ? AppColors.success
                                      : AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  // Follow + View buttons
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      // Follow button
                      GestureDetector(
                        onTap: () => toggleRetailerFollow(
                            ref, retailer.id, isFollowing, context),
                        child: Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: isFollowing
                                ? AppColors.primary.withValues(alpha: 0.1)
                                : AppColors.background,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: isFollowing
                                  ? AppColors.primary
                                  : AppColors.border,
                            ),
                          ),
                          child: Icon(
                            isFollowing
                                ? Icons.favorite
                                : Icons.favorite_outline,
                            size: 16,
                            color: isFollowing
                                ? AppColors.primary
                                : AppColors.textSecondary,
                          ),
                        ),
                      ),
                      const SizedBox(height: 6),
                      ElevatedButton(
                        onPressed: onView,
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

            const SizedBox(height: 10),

            // ── Stats footer ─────────────────────────────────────────────
            if (retailer.activeOfferCount > 0 || loyaltyCard != null)
              Container(
                color: const Color(0xFFF0F7F4),
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (retailer.activeOfferCount > 0)
                      Row(
                        children: [
                          const Icon(Icons.local_offer_outlined,
                              size: 13, color: AppColors.primary),
                          const SizedBox(width: 6),
                          Text(
                            retailer.activeOfferCount == 1
                                ? '1 offer available'
                                : '${retailer.activeOfferCount} offers available',
                            style: AppTextStyles.labelSmall.copyWith(
                              color: AppColors.primary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    if (loyaltyCard != null) ...[
                      if (retailer.activeOfferCount > 0)
                        const SizedBox(height: 6),
                      _LoyaltyProgressBar(card: loyaltyCard),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  static Widget _coverPlaceholder() => Container(
        color: AppColors.primaryLight.withValues(alpha: 0.2),
        child: const Center(
          child: Icon(Icons.storefront_outlined,
              color: Colors.white54, size: 24),
        ),
      );

  static String _fmtDistance(double km) =>
      km < 1.0 ? '${(km * 1000).round()}m' : '${km.toStringAsFixed(1)}km';
}

// ── Loyalty progress bar ──────────────────────────────────────────────────────

class _LoyaltyProgressBar extends StatelessWidget {
  const _LoyaltyProgressBar({required this.card});
  final LoyaltyCard card;

  @override
  Widget build(BuildContext context) {
    final label = card.isComplete
        ? 'Loyalty card complete!'
        : '${card.stampsEarned}/${card.stampsRequired} stamps';

    return Row(
      children: [
        const Icon(Icons.card_giftcard_outlined,
            size: 13, color: AppColors.primary),
        const SizedBox(width: 6),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTextStyles.labelSmall.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 3),
              ClipRRect(
                borderRadius: BorderRadius.circular(2),
                child: LinearProgressIndicator(
                  value: card.progressFraction,
                  backgroundColor: AppColors.border,
                  valueColor: const AlwaysStoppedAnimation(AppColors.primary),
                  minHeight: 3,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
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
