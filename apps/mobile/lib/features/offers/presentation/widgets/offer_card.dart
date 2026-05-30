import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../favourites/providers/favourites_providers.dart';
import '../../domain/offer.dart';
import '../../domain/offer_availability.dart';

// ---------------------------------------------------------------------------
// Full offer card — used in Explore list and Retailer detail
// ---------------------------------------------------------------------------

class OfferCard extends ConsumerWidget {
  const OfferCard({
    super.key,
    required this.offer,
    this.availability,
    this.onTap,
  });

  final Offer offer;
  final OfferAvailability? availability;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFavourited =
        ref.watch(favouriteOfferIdsProvider).contains(offer.id);
    final isAvailable = availability?.isAvailable ?? true;
    final opacity = availability?.cardOpacity ?? 1.0;

    return Opacity(
      opacity: opacity,
      child: Card(
        clipBehavior: Clip.antiAlias,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border),
        ),
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image + overlays
              _OfferImageStack(
                offer: offer,
                isFavourited: isFavourited,
                isAvailable: isAvailable,
                availabilityBadgeLabel: isAvailable
                    ? null
                    : availability?.state.badgeLabel,
                onFavouriteTap: () =>
                    toggleOfferFavourite(ref, offer.id, isFavourited, context),
                imageHeight: 130,
              ),

              // Text body
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Offer title
                    Text(
                      offer.title,
                      style: AppTextStyles.titleMedium,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 3),
                    // Retailer name
                    Text(
                      offer.retailerName,
                      style: AppTextStyles.bodyMedium.copyWith(
                        color: AppColors.textSecondary,
                        fontSize: 12,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    // Redemption limit row
                    _RedemptionLimitRow(offer: offer),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Compact card — used in horizontal scrolling rows (Home nearby/trending)
// ---------------------------------------------------------------------------

class OfferCardCompact extends ConsumerWidget {
  const OfferCardCompact({
    super.key,
    required this.offer,
    this.onTap,
  });

  final Offer offer;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFavourited =
        ref.watch(favouriteOfferIdsProvider).contains(offer.id);

    return SizedBox(
      width: 180,
      child: Card(
        clipBehavior: Clip.antiAlias,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: AppColors.border),
        ),
        child: InkWell(
          onTap: onTap,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image + overlays (compact height)
              _OfferImageStack(
                offer: offer,
                isFavourited: isFavourited,
                isAvailable: true,
                availabilityBadgeLabel: null,
                onFavouriteTap: () =>
                    toggleOfferFavourite(ref, offer.id, isFavourited, context),
                imageHeight: 96,
                heartSize: 24,
                heartIconSize: 12,
                badgePadding:
                    const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                badgeFontSize: 10,
              ),

              // Text body
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      offer.title,
                      style: AppTextStyles.titleMedium.copyWith(fontSize: 13),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      offer.retailerName,
                      style: AppTextStyles.bodyMedium.copyWith(
                        fontSize: 11,
                        color: AppColors.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 6),
                    _RedemptionLimitRow(offer: offer, fontSize: 10),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
        // Cover image
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

        // Offer value badge — top left
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

        // Favourite heart — top right
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
                color: isFavourited ? AppColors.error : AppColors.textSecondary,
              ),
            ),
          ),
        ),

        // Availability strip — bottom of image, only when not available
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
