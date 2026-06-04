import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../domain/loyalty_card.dart';
import '../providers/loyalty_providers.dart';
import 'widgets/loyalty_stamp_grid.dart';

const _kTeal = Color(0xFF0D9488);

class MyLoyaltyCardsScreen extends ConsumerWidget {
  const MyLoyaltyCardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cardsAsync = ref.watch(myLoyaltyCardsProvider);

    return Scaffold(
      backgroundColor: AppColors.cream,
      appBar: AppBar(
        backgroundColor: AppColors.cream,
        elevation: 0,
        title: const Text('My loyalty cards'),
      ),
      body: cardsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Text('Could not load loyalty cards: $e'),
        ),
        data: (cards) {
          if (cards.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.card_giftcard_outlined,
                        size: 56, color: AppColors.textDisabled),
                    SizedBox(height: 16),
                    Text(
                      'No loyalty cards yet',
                      style: TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Visit a retailer with a loyalty stamp offer and scan your QR code to start collecting.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 14, color: AppColors.textSecondary),
                    ),
                  ],
                ),
              ),
            );
          }

          final active = cards.where((c) => c.status == LoyaltyCardStatus.active).toList();
          final completed = cards.where((c) => c.status == LoyaltyCardStatus.completed).toList();
          final claimed = cards.where((c) => c.status == LoyaltyCardStatus.claimed).toList();
          final expired = cards.where((c) => c.status == LoyaltyCardStatus.expired).toList();

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (active.isNotEmpty) ...[
                _SectionHeader('In progress'),
                ...active.map((c) => _CardTile(card: c)),
                const SizedBox(height: 8),
              ],
              if (completed.isNotEmpty) ...[
                _SectionHeader('Ready to claim'),
                ...completed.map((c) => _CardTile(card: c)),
                const SizedBox(height: 8),
              ],
              if (claimed.isNotEmpty) ...[
                _SectionHeader('Claimed'),
                ...claimed.map((c) => _CardTile(card: c)),
                const SizedBox(height: 8),
              ],
              if (expired.isNotEmpty) ...[
                _SectionHeader('Expired'),
                ...expired.map((c) => _CardTile(card: c)),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 8, 4, 6),
      child: Text(
        text.toUpperCase(),
        style: const TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: AppColors.textDisabled,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}

class _CardTile extends StatelessWidget {
  const _CardTile({required this.card});
  final LoyaltyCard card;

  @override
  Widget build(BuildContext context) {
    final isClaimed = card.status == LoyaltyCardStatus.claimed;
    final isCompleted = card.status == LoyaltyCardStatus.completed;
    final isExpired = card.status == LoyaltyCardStatus.expired;

    Color headerColor = _kTeal;
    if (isClaimed) headerColor = const Color(0xFF059669);
    if (isExpired) headerColor = AppColors.textDisabled;

    String statusLabel = '${card.stampsEarned} of ${card.stampsRequired} stamps';
    if (isCompleted) statusLabel = 'Complete — scan again to claim reward';
    if (isClaimed) statusLabel = 'Reward claimed';
    if (isExpired) statusLabel = 'Expired';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: headerColor.withValues(alpha: 0.08),
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(14)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        card.offerTitle,
                        style: const TextStyle(
                            fontSize: 15, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        card.retailerName,
                        style: TextStyle(
                            fontSize: 13, color: headerColor),
                      ),
                    ],
                  ),
                ),
                if (isClaimed)
                  const Icon(Icons.check_circle,
                      color: Color(0xFF059669), size: 24)
                else if (isCompleted)
                  const Icon(Icons.stars, color: _kTeal, size: 24),
              ],
            ),
          ),

          // Stamp grid
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: LoyaltyStampGrid(
              stampsEarned: card.stampsEarned,
              stampsRequired: card.stampsRequired,
            ),
          ),

          // Status row
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 14),
            child: Row(
              children: [
                Text(
                  statusLabel,
                  style: TextStyle(
                    fontSize: 13,
                    color: isExpired
                        ? AppColors.textDisabled
                        : isCompleted || isClaimed
                            ? headerColor
                            : AppColors.textSecondary,
                    fontWeight: (isCompleted || isClaimed)
                        ? FontWeight.w600
                        : FontWeight.normal,
                  ),
                ),
                const Spacer(),
                if (card.rewardDescription != null && !isExpired)
                  Text(
                    'Reward: ${card.rewardDescription}',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.textDisabled),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
