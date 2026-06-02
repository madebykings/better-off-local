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
// compact: true  → 176 px wide horizontal-scroll variant (Home nearby row).
// compact: false → full-width vertical-list variant (Explore, Retailer detail,
//                  Favourites, Search results).
//
// Card layout:
//   ┌──────────────────────┐
//   │  [Open Now]   [♡]    │  cover image area
//   │                      │
//   │  [Save 20%]          │  savings badge bottom-left
//   ├──────────────────────┤
//   │  Offer title         │  content area
//   │  Redemption rule     │
//   └──────────────────────┘
// ---------------------------------------------------------------------------

class OfferCard extends ConsumerWidget {
  const OfferCard({
    super.key,
    required this.offer,
    this.availability,
    this.onTap,
    this.compact = false,
    this.isOpenNow = false,
  });

  final Offer offer;
  final OfferAvailability? availability;
  final VoidCallback? onTap;
  final bool compact;

  /// Shows an "Open now" badge top-left when true.
  final bool isOpenNow;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFavourited =
        ref.watch(favouriteOfferIdsProvider).contains(offer.id);
    final isAvailable = compact ? true : (availability?.isAvailable ?? true);
    final opacity = compact ? 1.0 : (availability?.cardOpacity ?? 1.0);

    final double imageHeight = compact ? 110.0 : 185.0;
    final EdgeInsets bodyPadding = compact
        ? const EdgeInsets.fromLTRB(10, 9, 10, 10)
        : const EdgeInsets.fromLTRB(12, 12, 12, 12);

    Widget card = Card(
      clipBehavior: Clip.antiAlias,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        onTap: onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            _OfferImageStack(
              offer: offer,
              isFavourited: isFavourited,
              isAvailable: isAvailable,
              isOpenNow: isOpenNow,
              availabilityBadgeLabel:
                  isAvailable ? null : availability?.state.badgeLabel,
              onFavouriteTap: () =>
                  toggleOfferFavourite(ref, offer.id, isFavourited, context),
              imageHeight: imageHeight,
              compact: compact,
            ),
            Padding(
              padding: bodyPadding,
              child: _OfferCardBody(
                offer: offer,
                compact: compact,
              ),
            ),
          ],
        ),
      ),
    );

    if (compact) {
      card = SizedBox(width: 176, child: card);
    }
    if (opacity < 1.0) card = Opacity(opacity: opacity, child: card);

    return card;
  }
}

// ---------------------------------------------------------------------------
// Image stack: cover + open-now badge + savings badge + heart + availability
// ---------------------------------------------------------------------------

class _OfferImageStack extends StatelessWidget {
  const _OfferImageStack({
    required this.offer,
    required this.isFavourited,
    required this.isAvailable,
    required this.isOpenNow,
    required this.availabilityBadgeLabel,
    required this.onFavouriteTap,
    required this.imageHeight,
    required this.compact,
  });

  final Offer offer;
  final bool isFavourited;
  final bool isAvailable;
  final bool isOpenNow;
  final String? availabilityBadgeLabel;
  final VoidCallback onFavouriteTap;
  final double imageHeight;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final double heartSize = compact ? 26 : 32;
    final double heartIconSize = compact ? 13 : 16;

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

        // Open now badge — top-left
        if (isOpenNow)
          Positioned(
            top: 8,
            left: 8,
            child: _OpenNowBadge(compact: compact),
          ),

        // Favourite heart — top-right
        Positioned(
          top: 8,
          right: 8,
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
                    color: Colors.black.withValues(alpha: 0.10),
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

        // Savings badge — bottom-left of image
        if (offer.valueText != null)
          Positioned(
            bottom: 8,
            left: 8,
            child: _SavingsBadge(
              label: offer.valueText!,
              color: offer.badgeColor(context),
              compact: compact,
            ),
          ),

        // Availability overlay strip — shown when offer is unavailable
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
// "Open now" badge — white pill with green status dot
// ---------------------------------------------------------------------------

class _OpenNowBadge extends StatelessWidget {
  const _OpenNowBadge({required this.compact});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 7 : 9,
        vertical: compact ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: compact ? 6 : 7,
            height: compact ? 6 : 7,
            decoration: const BoxDecoration(
              color: Color(0xFF22C55E),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            'Open now',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: compact ? 10 : 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Savings badge — dark pill with value text (e.g., "Save 20%", "BOGOF")
// ---------------------------------------------------------------------------

class _SavingsBadge extends StatelessWidget {
  const _SavingsBadge({
    required this.label,
    required this.color,
    required this.compact,
  });

  final String label;
  final Color color;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: compact ? 7 : 10,
        vertical: compact ? 3 : 5,
      ),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: Colors.white,
          fontSize: compact ? 10 : 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.1,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Card body: offer title + redemption rule
// ---------------------------------------------------------------------------

class _OfferCardBody extends StatelessWidget {
  const _OfferCardBody({required this.offer, required this.compact});

  final Offer offer;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          offer.title,
          style: AppTextStyles.titleMedium.copyWith(
            fontSize: compact ? 14.0 : 16.0,
            fontWeight: FontWeight.w700,
          ),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 4),
        _RedemptionRow(offer: offer, compact: compact),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Redemption limit row
// ---------------------------------------------------------------------------

class _RedemptionRow extends StatelessWidget {
  const _RedemptionRow({required this.offer, required this.compact});

  final Offer offer;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final double fontSize = compact ? 10 : 12;
    return Row(
      children: [
        Icon(
          offer.redemptionLimitIcon,
          size: fontSize + 1,
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
        child: Icon(Icons.storefront_outlined, size: 36, color: AppColors.border),
      ),
    );
  }
}
