import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../favourites/providers/favourites_providers.dart';
import '../../domain/offer.dart';
import '../../domain/offer_availability.dart';

// ---------------------------------------------------------------------------
// OfferCard — single shared component for all offer surfaces.
//
// compact: true  → 180 px wide horizontal-scroll variant (Home nearby row).
// compact: false → full-width vertical-list variant (Explore, Retailer detail,
//                  Favourites, Search results).
//
// Card layout:
//   ┌──────────────────────┐
//   │  cover image         │  imageHeight
//   ├──────────────────────┤
//   │  title (max 2 lines) │  textBodyHeight (fixed)
//   │  retailer name       │
//   │           ⋮ spacer   │
//   │  ↩ redemption rule   │  ← always at bottom of text area
//   └──────────────────────┘
// ---------------------------------------------------------------------------

class OfferCard extends ConsumerWidget {
  const OfferCard({
    super.key,
    required this.offer,
    this.availability,
    this.onTap,
    this.compact = false,
  });

  final Offer offer;
  final OfferAvailability? availability;
  final VoidCallback? onTap;
  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFavourited =
        ref.watch(favouriteOfferIdsProvider).contains(offer.id);
    final isAvailable = compact ? true : (availability?.isAvailable ?? true);
    final opacity = compact ? 1.0 : (availability?.cardOpacity ?? 1.0);

    // Compact vs full sizing — only image height and font scale differ.
    // Text body uses natural height to prevent RenderFlex overflow.
    final double imageHeight = compact ? 100 : 130;
    final EdgeInsets bodyPadding = compact
        ? const EdgeInsets.fromLTRB(10, 9, 10, 10)
        : const EdgeInsets.fromLTRB(12, 10, 12, 12);
    final double? titleFontSize = compact ? 13 : null;
    final double retailerFontSize = compact ? 11 : 12;
    final double redemptionFontSize = compact ? 10 : 11;
    final double heartSize = compact ? 26 : 30;
    final double heartIconSize = compact ? 13 : 16;
    final EdgeInsets badgePadding = compact
        ? const EdgeInsets.symmetric(horizontal: 6, vertical: 3)
        : const EdgeInsets.symmetric(horizontal: 8, vertical: 4);
    final double badgeFontSize = compact ? 10 : 11;

    Widget card = Card(
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      margin: EdgeInsets.zero, // remove default Card margin to prevent overflow
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min, // collapse to content height
          children: [
            _OfferImageStack(
              offer: offer,
              isFavourited: isFavourited,
              isAvailable: isAvailable,
              availabilityBadgeLabel:
                  isAvailable ? null : availability?.state.badgeLabel,
              onFavouriteTap: () =>
                  toggleOfferFavourite(ref, offer.id, isFavourited, context),
              imageHeight: imageHeight,
              heartSize: heartSize,
              heartIconSize: heartIconSize,
              badgePadding: badgePadding,
              badgeFontSize: badgeFontSize,
            ),
            // Natural-height text body — no fixed SizedBox to avoid overflow.
            Padding(
              padding: bodyPadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    offer.title,
                    style: AppTextStyles.titleMedium
                        .copyWith(fontSize: titleFontSize),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    offer.retailerName,
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: AppColors.textSecondary,
                      fontSize: retailerFontSize,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 7),
                  _RedemptionLimitRow(
                      offer: offer, fontSize: redemptionFontSize),
                ],
              ),
            ),
          ],
        ),
      ),
    );

    // Compact cards have a fixed width; height is natural (no overflow risk).
    if (compact) {
      card = SizedBox(width: 176, child: card);
    }
    if (opacity < 1.0) card = Opacity(opacity: opacity, child: card);

    return card;
  }
}

// ---------------------------------------------------------------------------
// Shared image stack (cover + badge + heart + availability strip)
// ---------------------------------------------------------------------------

class _OfferImageStack extends StatelessWidget {
  const _OfferImageStack({
    required this.offer,
    required this.isFavourited,
    required this.isAvailable,
    required this.availabilityBadgeLabel,
    required this.onFavouriteTap,
    required this.imageHeight,
    this.heartSize = 30,
    this.heartIconSize = 16,
    this.badgePadding =
        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    this.badgeFontSize = 11,
  });

  final Offer offer;
  final bool isFavourited;
  final bool isAvailable;
  final String? availabilityBadgeLabel;
  final VoidCallback onFavouriteTap;
  final double imageHeight;
  final double heartSize;
  final double heartIconSize;
  final EdgeInsets badgePadding;
  final double badgeFontSize;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        SizedBox(
          height: imageHeight,
          width: double.infinity,
          child: offer.imageUrl != null
              ? Image.network(
                  offer.imageUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => _CoverPlaceholder(),
                )
              : _CoverPlaceholder(),
        ),

        if (offer.valueText != null)
          Positioned(
            top: 8,
            left: 8,
            child: Container(
              padding: badgePadding,
              decoration: BoxDecoration(
                color: offer.badgeColor(context),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                offer.valueText!,
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: badgeFontSize,
                  letterSpacing: 0.1,
                ),
              ),
            ),
          ),

        Positioned(
          top: 6,
          right: 6,
          child: GestureDetector(
            onTap: onFavouriteTap,
            child: Container(
              width: heartSize,
              height: heartSize,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.92),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.1),
                    blurRadius: 4,
                    offset: const Offset(0, 1),
                  ),
                ],
              ),
              child: Icon(
                isFavourited ? Icons.favorite : Icons.favorite_border,
                size: heartIconSize,
                color:
                    isFavourited ? AppColors.error : AppColors.textSecondary,
              ),
            ),
          ),
        ),

        if (!isAvailable && availabilityBadgeLabel != null)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              color: Colors.black.withValues(alpha: 0.55),
              child: Text(
                availabilityBadgeLabel!,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Redemption limit row
// ---------------------------------------------------------------------------

class _RedemptionLimitRow extends StatelessWidget {
  const _RedemptionLimitRow({required this.offer, this.fontSize = 11});

  final Offer offer;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(
          offer.redemptionLimitIcon,
          size: fontSize + 2,
          color: AppColors.textSecondary,
        ),
        const SizedBox(width: 4),
        Expanded(
          child: Text(
            offer.redemptionLimitLabel,
            style: TextStyle(
              fontSize: fontSize,
              color: AppColors.textSecondary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Cover placeholder
// ---------------------------------------------------------------------------

class _CoverPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.background,
      child: const Center(
        child: Icon(Icons.storefront_outlined,
            size: 36, color: AppColors.border),
      ),
    );
  }
}

