import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/primary_button.dart';
import '../../favourites/providers/favourites_providers.dart';
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
                        ref, offer.id, isFavourited),
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

    if (state.isAvailable) {
      return PrimaryButton(
        label: 'Use this offer',
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
            label: 'Get membership',
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
        const PrimaryButton(label: 'Use this offer', onPressed: null),
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
