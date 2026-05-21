import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../domain/redemption.dart';
import '../providers/redemption_providers.dart';

// ── Group labels in display order ────────────────────────────────────────────

enum _HistoryGroup { today, yesterday, thisWeek, earlier }

extension _HistoryGroupX on _HistoryGroup {
  String get label {
    switch (this) {
      case _HistoryGroup.today:
        return 'Today';
      case _HistoryGroup.yesterday:
        return 'Yesterday';
      case _HistoryGroup.thisWeek:
        return 'This week';
      case _HistoryGroup.earlier:
        return 'Earlier';
    }
  }
}

_HistoryGroup _groupFor(DateTime dt, DateTime now) {
  final today = DateTime(now.year, now.month, now.day);
  final date = DateTime(dt.year, dt.month, dt.day);
  if (date == today) return _HistoryGroup.today;
  if (date == today.subtract(const Duration(days: 1))) {
    return _HistoryGroup.yesterday;
  }
  // Same ISO week (Monday-based)
  final weekStart = today.subtract(Duration(days: today.weekday - 1));
  if (!date.isBefore(weekStart)) return _HistoryGroup.thisWeek;
  return _HistoryGroup.earlier;
}

// ── Screen ────────────────────────────────────────────────────────────────────

class RedemptionHistoryScreen extends ConsumerWidget {
  const RedemptionHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final historyAsync = ref.watch(redemptionHistoryProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My offers')),
      body: historyAsync.when(
        loading: () => const LoadingIndicator(),
        error: (e, _) => ErrorState(
          message: e.toString(),
          onRetry: () => ref.invalidate(redemptionHistoryProvider),
        ),
        data: (history) {
          if (history.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.xl),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.receipt_long_outlined,
                      size: 64,
                      color: AppColors.textDisabled,
                    ),
                    SizedBox(height: AppSpacing.md),
                    Text('No offers used yet',
                        style: AppTextStyles.titleMedium),
                    SizedBox(height: AppSpacing.sm),
                    Text(
                      'Offers you redeem will appear here.',
                      style: AppTextStyles.bodyMedium,
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }

          final now = DateTime.now();
          final grouped = _buildGroups(history, now);

          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(redemptionHistoryProvider),
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.pagePadding, vertical: AppSpacing.md),
              itemCount: _itemCount(grouped),
              itemBuilder: (context, index) =>
                  _buildItem(context, grouped, index),
            ),
          );
        },
      ),
    );
  }

  // ── Group construction ───────────────────────────────────────────────────

  static Map<_HistoryGroup, List<Redemption>> _buildGroups(
    List<Redemption> items,
    DateTime now,
  ) {
    final result = <_HistoryGroup, List<Redemption>>{};
    for (final item in items) {
      final group = _groupFor(item.redeemedAt.toLocal(), now);
      (result[group] ??= []).add(item);
    }
    return result;
  }

  // ── Flat list index helpers ─────────────────────────────────────────────

  static int _itemCount(Map<_HistoryGroup, List<Redemption>> groups) {
    var count = 0;
    for (final g in _HistoryGroup.values) {
      final items = groups[g];
      if (items != null && items.isNotEmpty) count += 1 + items.length;
    }
    return count;
  }

  static Widget _buildItem(
    BuildContext context,
    Map<_HistoryGroup, List<Redemption>> grouped,
    int index,
  ) {
    var cursor = 0;
    for (final g in _HistoryGroup.values) {
      final items = grouped[g];
      if (items == null || items.isEmpty) continue;
      if (index == cursor) {
        return _SectionHeader(label: g.label);
      }
      cursor++;
      final itemIndex = index - cursor;
      if (itemIndex < items.length) {
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: _RedemptionTile(redemption: items[itemIndex]),
        );
      }
      cursor += items.length;
    }
    return const SizedBox.shrink();
  }
}

// ── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.md, bottom: AppSpacing.sm),
      child: Text(
        label,
        style: AppTextStyles.labelSmall.copyWith(
          color: AppColors.textSecondary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

// ── Tile ──────────────────────────────────────────────────────────────────────

class _RedemptionTile extends StatelessWidget {
  const _RedemptionTile({required this.redemption});
  final Redemption redemption;

  @override
  Widget build(BuildContext context) {
    final (statusLabel, statusColor) = _statusDisplay(redemption.status);
    final timeLabel = DateFormat('HH:mm').format(redemption.redeemedAt.toLocal());
    final isSuccess = redemption.isSuccess;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppSpacing.radiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Main row ───────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(AppSpacing.cardPadding),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Retailer logo
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: redemption.retailerLogoUrl != null
                      ? Image.network(
                          redemption.retailerLogoUrl!,
                          width: 44,
                          height: 44,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => _logoPlaceholder(),
                        )
                      : _logoPlaceholder(),
                ),
                const SizedBox(width: AppSpacing.sm),
                // Title + metadata
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        redemption.offerTitle ?? 'Offer',
                        style: AppTextStyles.titleMedium,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (redemption.retailerName != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          redemption.retailerName!,
                          style: AppTextStyles.bodyMedium.copyWith(
                            color: AppColors.textSecondary,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      const SizedBox(height: 4),
                      Text(
                        timeLabel,
                        style: AppTextStyles.labelSmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                // Status chip
                _StatusChip(label: statusLabel, color: statusColor),
              ],
            ),
          ),
          // ── Rejection reason ───────────────────────────────────────────
          if (!isSuccess && redemption.rejectionReason != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.cardPadding,
                0,
                AppSpacing.cardPadding,
                AppSpacing.sm,
              ),
              child: Text(
                _humanReason(redemption.status, redemption.rejectionReason),
                style: AppTextStyles.labelSmall
                    .copyWith(color: AppColors.textSecondary),
              ),
            ),
          // ── Visit retailer CTA ─────────────────────────────────────────
          if (redemption.retailerId.isNotEmpty) ...[
            const Divider(height: 1),
            InkWell(
              onTap: () => context.push(
                RouteNames.retailerDetail
                    .replaceAll(':retailerId', redemption.retailerId),
              ),
              borderRadius: const BorderRadius.vertical(
                bottom: Radius.circular(AppSpacing.radiusMd),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.cardPadding,
                  vertical: 10,
                ),
                child: Row(
                  children: [
                    Text(
                      redemption.retailerName != null
                          ? 'Visit ${redemption.retailerName}'
                          : 'Visit retailer',
                      style: AppTextStyles.labelSmall.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(
                      Icons.arrow_forward_ios,
                      size: 11,
                      color: AppColors.primary,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  static Widget _logoPlaceholder() => Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColors.border),
        ),
        child: const Icon(Icons.storefront_outlined,
            size: 20, color: AppColors.textDisabled),
      );

  static (String, Color) _statusDisplay(RedemptionStatus status) =>
      switch (status) {
        RedemptionStatus.success => ('Redeemed', AppColors.success),
        RedemptionStatus.expired => ('Expired', AppColors.textDisabled),
        RedemptionStatus.ruleBlocked => ('Unavailable', AppColors.warning),
        RedemptionStatus.membershipInvalid =>
          ('Membership issue', AppColors.error),
        RedemptionStatus.rejected => ('Not valid', AppColors.error),
      };

  /// Returns a human-friendly explanation for non-success states.
  /// Technical error strings from the server are never shown directly.
  static String _humanReason(RedemptionStatus status, String? raw) {
    switch (status) {
      case RedemptionStatus.ruleBlocked:
        return 'This offer wasn\'t available at the time of scanning.';
      case RedemptionStatus.membershipInvalid:
        return 'Your membership wasn\'t active when this was scanned.';
      case RedemptionStatus.rejected:
        return 'This code was not accepted.';
      case RedemptionStatus.expired:
        return 'The QR code expired before it was scanned.';
      default:
        return raw ?? '';
    }
  }
}

// ── Status chip ───────────────────────────────────────────────────────────────

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppSpacing.radiusSm),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }
}
