import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../domain/redemption.dart';
import '../providers/redemption_providers.dart';

class RedemptionHistoryScreen extends ConsumerWidget {
  const RedemptionHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(redemptionHistoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Redemption history')),
      body: historyAsync.when(
        loading: () => const LoadingIndicator(),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(redemptionHistoryProvider),
        ),
        data: (history) {
          if (history.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.receipt_long_outlined,
                      size: 64,
                      color: AppColors.textDisabled,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'No redemptions yet',
                      style: AppTextStyles.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      'Your redeemed offers will appear here.',
                      style: AppTextStyles.bodyMedium,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(redemptionHistoryProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.pagePadding),
              itemCount: history.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, index) =>
                  _RedemptionTile(redemption: history[index]),
            ),
          );
        },
      ),
    );
  }
}

class _RedemptionTile extends StatelessWidget {
  const _RedemptionTile({required this.redemption});
  final Redemption redemption;

  @override
  Widget build(BuildContext context) {
    final (label, color) = switch (redemption.status) {
      RedemptionStatus.success => ('Redeemed', AppColors.success),
      RedemptionStatus.expired => ('Expired', AppColors.textDisabled),
      RedemptionStatus.ruleBlocked => ('Blocked', AppColors.warning),
      RedemptionStatus.membershipInvalid =>
        ('Membership issue', AppColors.error),
      RedemptionStatus.rejected => ('Rejected', AppColors.error),
    };

    return Container(
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  redemption.offerTitle ?? 'Offer',
                  style: AppTextStyles.titleMedium,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  DateFormat('d MMM yyyy, HH:mm')
                      .format(redemption.redeemedAt.toLocal()),
                  style: AppTextStyles.labelSmall,
                ),
                if (redemption.rejectionReason != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    redemption.rejectionReason!,
                    style: AppTextStyles.labelSmall
                        .copyWith(color: AppColors.error),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: color.withOpacity(0.12),
              borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
              border: Border.all(color: color.withOpacity(0.4)),
            ),
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
