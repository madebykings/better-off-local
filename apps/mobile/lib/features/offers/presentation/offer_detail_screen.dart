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
                      if (offer.offerType == 'loyalty_visits') ...[
                        const SizedBox(height: 20),
                        const Divider(),
                        const SizedBox(height: 16),
                        _LoyaltySection(offerId: offer.id),
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
              child: _buildCTA(context, offer.id, availability),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCTA(
    BuildContext context,
    String offerId,
    OfferAvailability? availability,
  ) {
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
