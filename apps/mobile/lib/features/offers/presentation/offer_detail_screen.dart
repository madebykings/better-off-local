import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/primary_button.dart';
import '../../favourites/providers/favourites_providers.dart';
import '../../loyalty/providers/loyalty_providers.dart';
import '../../loyalty/presentation/widgets/loyalty_stamp_grid.dart';
import '../../venue_referral/presentation/venue_referral_section.dart';
import '../domain/offer_availability.dart';
import '../providers/offers_providers.dart';

class OfferDetailScreen extends ConsumerStatefulWidget {
  const OfferDetailScreen({super.key, required this.offerId});
  final String offerId;

  @override
  ConsumerState<OfferDetailScreen> createState() => _OfferDetailScreenState();
}

class _OfferDetailScreenState extends ConsumerState<OfferDetailScreen> {
  @override
  void initState() {
    super.initState();
    // Log view fire-and-forget after first frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final offer = ref.read(offerProvider(widget.offerId)).valueOrNull;
      if (offer != null) {
        logOfferView(ref, offer.id, offer.retailerId);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final offerAsync = ref.watch(offerProvider(widget.offerId));
    final favouriteIds = ref.watch(favouriteOfferIdsProvider);

    return offerAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (e, _) => Scaffold(
        appBar: AppBar(),
        body: Center(child: Text('Failed to load offer: $e')),
      ),
      data: (offer) {
        final isFavourited = favouriteIds.contains(offer.id);
        final availabilityAsync =
            ref.watch(offerAvailabilityProvider(widget.offerId));
        final availability = availabilityAsync.valueOrNull;

        return Scaffold(
          body: CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: offer.imageUrl != null ? 240 : 0,
                pinned: true,
                actions: [
                  IconButton(
                    icon: Icon(
                      isFavourited
                          ? Icons.favorite
                          : Icons.favorite_border,
                      color: isFavourited
                          ? AppColors.error
                          : null,
                    ),
                    onPressed: () => toggleOfferFavourite(
                        ref, offer.id, isFavourited, context),
                  ),
                ],
                flexibleSpace: offer.imageUrl != null
                    ? FlexibleSpaceBar(
                        background: Image.network(
                          offer.imageUrl!,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) =>
                              const ColoredBox(color: AppColors.background),
                        ),
                      )
                    : null,
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (offer.valueText != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppColors.primary.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            offer.valueText!,
                            style: AppTextStyles.titleMedium.copyWith(
                              color: AppColors.primary,
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                      ],
                      Text(offer.title, style: AppTextStyles.headlineMedium),
                      const SizedBox(height: 4),
                      GestureDetector(
                        onTap: () => context.push(
                          RouteNames.retailerDetail
                              .replaceAll(':retailerId', offer.retailerId),
                        ),
                        child: Text(
                          offer.retailerName,
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppColors.primary,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                      if (offer.shortSummary != null) ...[
                        const SizedBox(height: 16),
                        Text(
                          offer.shortSummary!,
                          style: AppTextStyles.bodyLarge,
                        ),
                      ],
                      if (offer.description != null) ...[
                        const SizedBox(height: 12),
                        Text(
                          offer.description!,
                          style: AppTextStyles.bodyMedium,
                        ),
                      ],
                      if (offer.offerType == 'free_item' &&
                          offer.offerMeta?['free_item_name'] != null) ...[
                        const SizedBox(height: 20),
                        const Divider(),
                        const SizedBox(height: 16),
                        _FreeItemSection(meta: offer.offerMeta!),
                      ],
                      if (offer.offerType == 'buy_one_get_one' &&
                          (offer.offerMeta?['buy_item'] != null ||
                           offer.offerMeta?['receive_item'] != null)) ...[
                        const SizedBox(height: 20),
                        const Divider(),
                        const SizedBox(height: 16),
                        _BogofSection(meta: offer.offerMeta!),
                      ],
                      if (offer.offerType == 'meal_deal' &&
                          (offer.offerMeta?['bundle_price'] != null ||
                           (offer.offerMeta?['included_items'] is List &&
                            (offer.offerMeta!['included_items'] as List).isNotEmpty))) ...[
                        const SizedBox(height: 20),
                        const Divider(),
                        const SizedBox(height: 16),
                        _MealDealSection(meta: offer.offerMeta!),
                      ],
                      if (offer.offerType == 'loyalty_visits') ...[
                        const SizedBox(height: 20),
                        const Divider(),
                        const SizedBox(height: 16),
                        _LoyaltySection(offerId: offer.id),
                      ],
                      if (offer.offerType == 'venue_referral') ...[
                        const SizedBox(height: 20),
                        const Divider(),
                        const SizedBox(height: 16),
                        VenueReferralSection(
                          offerId: offer.id,
                          offerTitle: offer.title,
                        ),
                      ],
                      if (offer.endAt != null) ...[
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            const Icon(Icons.schedule,
                                size: 16, color: AppColors.textSecondary),
                            const SizedBox(width: 6),
                            Text(
                              'Valid until ${_formatDate(offer.endAt!)}',
                              style: AppTextStyles.bodyMedium,
                            ),
                          ],
                        ),
                      ],
                      if (offer.termsText != null) ...[
                        const SizedBox(height: 20),
                        const Divider(),
                        const SizedBox(height: 12),
                        Text('Terms & conditions',
                            style: AppTextStyles.labelSmall.copyWith(
                                letterSpacing: 1)),
                        const SizedBox(height: 6),
                        Text(
                          offer.termsText!,
                          style: AppTextStyles.bodyMedium,
                        ),
                      ],
                      const SizedBox(height: 100),
                    ],
                  ),
                ),
              ),
            ],
          ),
          bottomNavigationBar: SafeArea(
            child: Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: _buildCTA(
                context,
                offer.id,
                availability,
                isVenueReferral: offer.offerType == 'venue_referral',
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCTA(
    BuildContext context,
    String offerId,
    OfferAvailability? availability, {
    bool isVenueReferral = false,
  }) {
    // venue_referral offers don't use the QR redemption flow directly — the
    // VenueReferralSection in the body handles sharing. Show a scroll-to hint.
    if (isVenueReferral) {
      return const SizedBox.shrink();
    }

    // Still loading availability — show disabled button to avoid layout shift.
    if (availability == null) {
      return const PrimaryButton(label: 'Use this offer', onPressed: null);
    }

    final state = availability.state;

    // Use the instance getter so cooldown/not-started states show date context.
    final buttonLabel = availability.ctaButtonLabel;

    if (state.isAvailable) {
      return PrimaryButton(
        label: buttonLabel,
        onPressed: () => context.push(
          RouteNames.redemptionQR.replaceAll(':offerId', offerId),
        ),
      );
    }

    if (state.requiresMembership) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Active membership required to redeem',
            style: AppTextStyles.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          PrimaryButton(
            label: buttonLabel,
            onPressed: () => context.push(RouteNames.paywall),
          ),
        ],
      );
    }

    // Unavailable with a reason
    final explanation = state.ctaExplanation ?? 'This offer is not available.';
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          explanation,
          style: AppTextStyles.bodyMedium.copyWith(
            color: AppColors.textSecondary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 8),
        PrimaryButton(label: buttonLabel, onPressed: null),
      ],
    );
  }

  String _formatDate(DateTime dt) {
    return '${dt.day} ${_month(dt.month)} ${dt.year}';
  }

  String _month(int m) => const [
        '',
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ][m];
}

// ---------------------------------------------------------------------------
// Structured offer detail sections — shown when offer_meta is populated
// ---------------------------------------------------------------------------

class _FreeItemSection extends StatelessWidget {
  const _FreeItemSection({required this.meta});
  final Map<String, dynamic> meta;

  @override
  Widget build(BuildContext context) {
    final itemName = (meta['free_item_name'] as String? ?? '').toUpperCase();
    final qualifying = meta['qualifying_purchase'] as String?;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'FREE $itemName',
          style: const TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w800,
            color: Color(0xFFF97316),
            letterSpacing: 0.5,
          ),
        ),
        if (qualifying != null && qualifying.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(
            'with $qualifying',
            style: const TextStyle(fontSize: 14, color: AppColors.textSecondary),
          ),
        ],
      ],
    );
  }
}

class _BogofSection extends StatelessWidget {
  const _BogofSection({required this.meta});
  final Map<String, dynamic> meta;

  @override
  Widget build(BuildContext context) {
    final buyItem = meta['buy_item'] as String?;
    final receiveItem = meta['receive_item'] as String?;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.shopping_bag_outlined, size: 16, color: Color(0xFF8B5CF6)),
            const SizedBox(width: 6),
            const Text(
              'Buy one get one',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF8B5CF6),
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFFEDE9FE)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            children: [
              _BogofRow(label: 'BUY', value: buyItem ?? 'one item', color: const Color(0xFF8B5CF6)),
              const Divider(height: 1, color: Color(0xFFEDE9FE)),
              _BogofRow(label: 'GET', value: receiveItem ?? 'one free', color: const Color(0xFF6D28D9)),
            ],
          ),
        ),
      ],
    );
  }
}

class _BogofRow extends StatelessWidget {
  const _BogofRow({required this.label, required this.value, required this.color});
  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Container(
            width: 36,
            alignment: Alignment.center,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: color,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 14, color: AppColors.textPrimary)),
          ),
        ],
      ),
    );
  }
}

class _MealDealSection extends StatelessWidget {
  const _MealDealSection({required this.meta});
  final Map<String, dynamic> meta;

  @override
  Widget build(BuildContext context) {
    final price = meta['bundle_price'] as String?;
    final rawItems = meta['included_items'];
    final items = rawItems is List ? rawItems.cast<String>() : <String>[];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.restaurant_menu_outlined, size: 16, color: Color(0xFFEA580C)),
            const SizedBox(width: 6),
            const Text(
              'Meal deal',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFFEA580C),
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
        if (price != null && price.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            '£$price',
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Color(0xFFEA580C),
            ),
          ),
        ],
        if (items.isNotEmpty) ...[
          const SizedBox(height: 8),
          ...items.map((item) => Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Row(
              children: [
                const Text('• ', style: TextStyle(color: AppColors.textSecondary)),
                Text(item, style: const TextStyle(fontSize: 14, color: AppColors.textPrimary)),
              ],
            ),
          )),
        ],
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Loyalty stamp progress section — shown on loyalty_visits offers
// ---------------------------------------------------------------------------

class _LoyaltySection extends ConsumerWidget {
  const _LoyaltySection({required this.offerId});
  final String offerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardAsync = ref.watch(loyaltyCardForOfferProvider(offerId));
    final configAsync = ref.watch(loyaltyConfigProvider(offerId));

    final config = configAsync.valueOrNull;
    final card = cardAsync.valueOrNull;

    final stampsRequired = card?.stampsRequired ??
        (config?['stamps_required'] as int? ?? 8);
    final stampsEarned = card?.stampsEarned ?? 0;
    final rewardDescription = card?.rewardDescription ??
        config?['reward_description'] as String?;

    final isClaimed = card?.isClaimed ?? false;
    final isComplete = card?.isComplete ?? false;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.card_giftcard_outlined,
                size: 18, color: Color(0xFF0D9488)),
            const SizedBox(width: 8),
            const Text(
              'Loyalty stamp card',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0D9488),
              ),
            ),
            const Spacer(),
            if (!isClaimed)
              Text(
                '$stampsEarned / $stampsRequired stamps',
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary),
              ),
          ],
        ),
        const SizedBox(height: 12),
        LoyaltyStampGrid(
          stampsEarned: stampsEarned,
          stampsRequired: stampsRequired,
        ),
        const SizedBox(height: 12),
        if (isClaimed) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFD1FAE5),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              children: [
                Icon(Icons.check_circle,
                    size: 16, color: Color(0xFF059669)),
                SizedBox(width: 8),
                Text(
                  'Reward claimed — start again to earn another',
                  style: TextStyle(
                      fontSize: 13, color: Color(0xFF065F46)),
                ),
              ],
            ),
          ),
        ] else if (isComplete) ...[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFCCFBF1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Row(
              children: [
                Icon(Icons.stars, size: 16, color: Color(0xFF0D9488)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Card complete! Scan your QR code at the retailer to claim your reward.',
                    style: TextStyle(
                        fontSize: 13, color: Color(0xFF134E4A)),
                  ),
                ),
              ],
            ),
          ),
        ] else if (card == null) ...[
          const Text(
            'Visit this retailer and scan your QR code to start collecting stamps.',
            style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
        ] else ...[
          Text(
            '${stampsRequired - stampsEarned} more stamp${stampsRequired - stampsEarned == 1 ? '' : 's'} to complete your card.',
            style: const TextStyle(
                fontSize: 13, color: AppColors.textSecondary),
          ),
        ],
        if (rewardDescription != null) ...[
          const SizedBox(height: 8),
          Text(
            'Reward: $rewardDescription',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textDisabled,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ],
    );
  }
}
