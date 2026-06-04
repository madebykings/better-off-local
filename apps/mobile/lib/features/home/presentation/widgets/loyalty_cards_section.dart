import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../loyalty/domain/loyalty_card.dart';
import '../../../loyalty/providers/loyalty_providers.dart';

class LoyaltyCardsSection extends ConsumerWidget {
  const LoyaltyCardsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardsAsync = ref.watch(myLoyaltyCardsProvider);

    return cardsAsync.when(
      loading: () => const SizedBox.shrink(),
      error: (_, __) => const SizedBox.shrink(),
      data: (cards) {
        final active = cards
            .where((c) =>
                c.status == LoyaltyCardStatus.active && c.stampsEarned > 0)
            .toList();
        if (active.isEmpty) return const SizedBox.shrink();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: SectionHeader(title: 'Your loyalty cards'),
            ),
            const SizedBox(height: 12),
            SizedBox(
              height: 110,
              child: ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: active.length,
                itemBuilder: (context, i) => Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: _LoyaltyCardTile(
                    card: active[i],
                    onTap: () => context.push(
                      RouteNames.offerDetail
                          .replaceAll(':offerId', active[i].offerId),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 28),
          ],
        );
      },
    );
  }
}

class _LoyaltyCardTile extends StatelessWidget {
  const _LoyaltyCardTile({required this.card, required this.onTap});

  final LoyaltyCard card;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 220,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                _RetailerLogo(logoUrl: card.retailerLogoUrl),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        card.retailerName,
                        style: AppTextStyles.labelSmall.copyWith(
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                          color: AppColors.textPrimary,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (card.rewardDescription != null) ...[
                        const SizedBox(height: 1),
                        Text(
                          card.rewardDescription!,
                          style: AppTextStyles.labelSmall.copyWith(
                            fontSize: 11,
                            color: AppColors.textSecondary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: card.progressFraction,
                minHeight: 6,
                backgroundColor: AppColors.cream,
                valueColor: const AlwaysStoppedAnimation<Color>(
                  AppColors.primary,
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '${card.stampsEarned} / ${card.stampsRequired} stamps',
              style: AppTextStyles.labelSmall.copyWith(
                fontSize: 11,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RetailerLogo extends StatelessWidget {
  const _RetailerLogo({required this.logoUrl});

  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    if (logoUrl != null && logoUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          logoUrl!,
          width: 36,
          height: 36,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _placeholder,
        ),
      );
    }
    return _placeholder;
  }

  Widget get _placeholder => Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: AppColors.primaryLight,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Icon(Icons.storefront_outlined, color: Colors.white, size: 20),
      );
}
