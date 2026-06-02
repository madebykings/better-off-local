import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../favourites/providers/favourites_providers.dart';
import '../../domain/retailer.dart';

// ---------------------------------------------------------------------------
// BusinessCard — single shared component for all retailer card surfaces.
//
// compact: true  → 200 px wide horizontal-scroll variant (Home trending row).
// compact: false → full-width vertical-list variant (Favourites, category
//                  listings, etc).
//
// Card layout:
//   ┌──────────────────────┐
//   │  [Badge]    [♡]      │  cover image area (rounded top corners)
//   │  [N offers]          │
//   ├──────────────────────┤
//   │  ● Name              │  content area — logo overlaps image boundary
//   │    Tagline           │
//   │    📍 distance       │
//   └──────────────────────┘
// ---------------------------------------------------------------------------

class BusinessCard extends ConsumerWidget {
  const BusinessCard({
    super.key,
    required this.retailer,
    this.badge,
    this.onTap,
    this.compact = true,
  });

  final Retailer retailer;

  /// Optional status badge label shown top-left of the image.
  /// Examples: "Trending", "Featured", "Member favourite", "Open Now", "New".
  final String? badge;

  final VoidCallback? onTap;
  final bool compact;

  static const double _logoSize = 42.0;
  static const double _logoOverlap = 20.0;
  static const double _logoLeftMargin = 12.0;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isFavourited =
        ref.watch(favouriteRetailerIdsProvider).contains(retailer.id);

    final double imageHeight = compact ? 115.0 : 160.0;

    final Widget card = GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Image area ─────────────────────────────────────────────────
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(14),
              ),
              child: Stack(
                children: [
                  SizedBox(
                    height: imageHeight,
                    width: double.infinity,
                    child: _CoverImage(retailer: retailer),
                  ),
                  if (badge != null)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: _StatusBadge(label: badge!),
                    ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: _HeartButton(
                      isFavourited: isFavourited,
                      onTap: () => toggleRetailerFavourite(
                          ref, retailer.id, isFavourited, context),
                    ),
                  ),
                  if (retailer.activeOfferCount > 0)
                    Positioned(
                      bottom: 8,
                      left: 8,
                      child:
                          _OfferCountPill(count: retailer.activeOfferCount),
                    ),
                ],
              ),
            ),

            // ── Content area — logo overlaps image boundary ─────────────
            Stack(
              clipBehavior: Clip.none,
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    _logoLeftMargin + _logoSize + 8,
                    6,
                    12,
                    12,
                  ),
                  child: _BusinessInfo(retailer: retailer, compact: compact),
                ),
                Positioned(
                  top: -_logoOverlap,
                  left: _logoLeftMargin,
                  child: _CircularLogo(
                    retailer: retailer,
                    size: _logoSize,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );

    if (compact) {
      return SizedBox(width: 200, child: card);
    }
    return card;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cover image
// ─────────────────────────────────────────────────────────────────────────────

class _CoverImage extends StatelessWidget {
  const _CoverImage({required this.retailer});

  final Retailer retailer;

  @override
  Widget build(BuildContext context) {
    if (retailer.coverImageUrl != null) {
      return Image.network(
        retailer.coverImageUrl!,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _CoverPlaceholder(retailer: retailer),
      );
    }
    return _CoverPlaceholder(retailer: retailer);
  }
}

class _CoverPlaceholder extends StatelessWidget {
  const _CoverPlaceholder({required this.retailer});

  final Retailer retailer;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.primaryLight,
      child: retailer.logoUrl != null
          ? Padding(
              padding: const EdgeInsets.all(24),
              child: Image.network(
                retailer.logoUrl!,
                fit: BoxFit.contain,
                errorBuilder: (_, __, ___) => const Center(
                  child: Icon(
                    Icons.storefront_outlined,
                    color: Colors.white54,
                    size: 40,
                  ),
                ),
              ),
            )
          : const Center(
              child: Icon(
                Icons.storefront_outlined,
                color: Colors.white54,
                size: 40,
              ),
            ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Status badge (Trending / Featured / Member favourite / etc.)
// ─────────────────────────────────────────────────────────────────────────────

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xE6000000),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.1,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Heart / favourite button
// ─────────────────────────────────────────────────────────────────────────────

class _HeartButton extends StatelessWidget {
  const _HeartButton({required this.isFavourited, required this.onTap});

  final bool isFavourited;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 30,
        height: 30,
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
          size: 14,
          color: isFavourited ? AppColors.error : AppColors.textSecondary,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Offer count pill
// ─────────────────────────────────────────────────────────────────────────────

class _OfferCountPill extends StatelessWidget {
  const _OfferCountPill({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        '$count ${count == 1 ? 'offer' : 'offers'} available',
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.1,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Circular logo with initials fallback
// ─────────────────────────────────────────────────────────────────────────────

class _CircularLogo extends StatelessWidget {
  const _CircularLogo({required this.retailer, required this.size});

  final Retailer retailer;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: AppColors.primaryLight,
        border: Border.all(color: Colors.white, width: 2.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: retailer.logoUrl != null
          ? Image.network(
              retailer.logoUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) =>
                  _LogoInitials(name: retailer.name, size: size),
            )
          : _LogoInitials(name: retailer.name, size: size),
    );
  }
}

class _LogoInitials extends StatelessWidget {
  const _LogoInitials({required this.name, required this.size});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final words = name.trim().split(' ').where((w) => w.isNotEmpty).toList();
    final initials = words.isEmpty
        ? '?'
        : words.take(3).map((w) => w[0].toUpperCase()).join();
    return Center(
      child: Text(
        initials,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.33,
          fontWeight: FontWeight.w700,
          letterSpacing: -0.5,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Business info column (name, tagline, distance)
// ─────────────────────────────────────────────────────────────────────────────

class _BusinessInfo extends StatelessWidget {
  const _BusinessInfo({required this.retailer, required this.compact});

  final Retailer retailer;
  final bool compact;

  String _formatDistance(double km) {
    final mi = km * 0.621371;
    if (mi < 0.05) return '${(km * 1000).round()}m';
    if (mi < 10) return '${mi.toStringAsFixed(1)} mi';
    return '${mi.round()} mi';
  }

  @override
  Widget build(BuildContext context) {
    final subtitle = retailer.tagline ??
        retailer.shortDescription ??
        (retailer.categories.isNotEmpty
            ? retailer.categories.take(2).join(' · ')
            : null);

    final distanceText = retailer.distanceKm != null
        ? _formatDistance(retailer.distanceKm!)
        : retailer.town;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          retailer.name,
          style: TextStyle(
            color: AppColors.textPrimary,
            fontSize: compact ? 13.0 : 15.0,
            fontWeight: FontWeight.w700,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 2),
          Text(
            subtitle,
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: compact ? 11.0 : 12.0,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
        if (distanceText != null) ...[
          const SizedBox(height: 5),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.place_outlined,
                size: 11,
                color: AppColors.textSecondary,
              ),
              const SizedBox(width: 2),
              Flexible(
                child: Text(
                  distanceText,
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: compact ? 10.0 : 11.0,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}
