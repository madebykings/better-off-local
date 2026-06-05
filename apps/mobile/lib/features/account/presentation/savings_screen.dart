import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/supabase_provider.dart';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

final _savingsProvider = FutureProvider.autoDispose<_SavingsData>((ref) async {
  final client = ref.watch(supabaseClientProvider);
  final userId = client.auth.currentUser?.id;
  if (userId == null) return const _SavingsData(redemptions: []);

  final rows = await client
      .from('redemptions')
      .select('redeemed_at, offers(title, value_text, estimated_saving_pence), retailers(name)')
      .eq('profile_id', userId)
      .eq('status', 'success')
      .order('redeemed_at', ascending: false)
      .limit(100);

  final redemptions = (rows as List).map((r) {
    final offer = r['offers'] as Map<String, dynamic>?;
    final retailer = r['retailers'] as Map<String, dynamic>?;
    return _Redemption(
      offerTitle: offer?['title'] as String? ?? 'Offer',
      valueText: offer?['value_text'] as String?,
      estimatedSavingPence: (offer?['estimated_saving_pence'] as num?)?.toInt(),
      retailerName: retailer?['name'] as String? ?? '',
      redeemedAt: DateTime.tryParse(r['redeemed_at'] as String? ?? '') ??
          DateTime.now(),
    );
  }).toList();

  return _SavingsData(redemptions: redemptions);
});

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

class _SavingsData {
  const _SavingsData({required this.redemptions});
  final List<_Redemption> redemptions;

  int get totalCount => redemptions.length;

  int get thisMonthCount {
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month, 1);
    return redemptions.where((r) => r.redeemedAt.isAfter(monthStart)).length;
  }

  int get thisYearCount {
    final now = DateTime.now();
    final yearStart = DateTime(now.year, 1, 1);
    return redemptions.where((r) => r.redeemedAt.isAfter(yearStart)).length;
  }

  int get totalSavingsPence {
    int total = 0;
    for (final r in redemptions) {
      final p = r.savingPence;
      if (p != null) total += p;
    }
    return total;
  }

  int get thisMonthSavingsPence {
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month, 1);
    int total = 0;
    for (final r in redemptions) {
      if (r.redeemedAt.isAfter(monthStart)) {
        final p = r.savingPence;
        if (p != null) total += p;
      }
    }
    return total;
  }

  int get thisYearSavingsPence {
    final now = DateTime.now();
    final yearStart = DateTime(now.year, 1, 1);
    int total = 0;
    for (final r in redemptions) {
      if (r.redeemedAt.isAfter(yearStart)) {
        final p = r.savingPence;
        if (p != null) total += p;
      }
    }
    return total;
  }

  String get totalSavingsDisplay => _fmtPence(totalSavingsPence);
  String get thisMonthSavingsDisplay => _fmtPence(thisMonthSavingsPence);
  String get thisYearSavingsDisplay => _fmtPence(thisYearSavingsPence);

  String get averageSavingDisplay {
    final redeemed = redemptions.where((r) => r.savingPence != null).toList();
    if (redeemed.isEmpty) return '—';
    final avg = totalSavingsPence / redeemed.length;
    return _fmtPence(avg.round());
  }

  String? get topRetailerName {
    if (redemptions.isEmpty) return null;
    final counts = <String, int>{};
    for (final r in redemptions) {
      if (r.retailerName.isNotEmpty) {
        counts[r.retailerName] = (counts[r.retailerName] ?? 0) + 1;
      }
    }
    if (counts.isEmpty) return null;
    return counts.entries.reduce((a, b) => a.value >= b.value ? a : b).key;
  }

  static String _fmtPence(int pence) {
    if (pence == 0) return '£0';
    final pounds = pence / 100;
    return '£${pounds.toStringAsFixed(pounds.truncateToDouble() == pounds ? 0 : 2)}';
  }
}

class _Redemption {
  const _Redemption({
    required this.offerTitle,
    required this.retailerName,
    required this.redeemedAt,
    this.valueText,
    this.estimatedSavingPence,
  });
  final String offerTitle;
  final String? valueText;
  final int? estimatedSavingPence;
  final String retailerName;
  final DateTime redeemedAt;

  int? get savingPence {
    if (estimatedSavingPence != null) return estimatedSavingPence;
    return _parsePence(valueText);
  }

  static int? _parsePence(String? text) {
    if (text == null) return null;
    final match = RegExp(r'£(\d+(?:\.\d{1,2})?)').firstMatch(text);
    if (match == null) return null;
    final pounds = double.tryParse(match.group(1)!);
    if (pounds == null) return null;
    return (pounds * 100).round();
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class SavingsScreen extends ConsumerWidget {
  const SavingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savingsAsync = ref.watch(_savingsProvider);

    return Scaffold(
      backgroundColor: AppColors.cream,
      appBar: AppBar(
        backgroundColor: AppColors.cream,
        elevation: 0,
        title: const Text('My savings'),
      ),
      body: savingsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) => Center(
          child: Text('Unable to load redemptions.', style: AppTextStyles.bodyMedium),
        ),
        data: (data) {
          if (data.totalCount == 0) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.savings_outlined, size: 56, color: AppColors.border),
                  const SizedBox(height: 16),
                  Text('No redemptions yet', style: AppTextStyles.titleMedium),
                  const SizedBox(height: 6),
                  Text(
                    'Start redeeming offers and your savings will appear here.',
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: AppColors.textSecondary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            );
          }
          return _SavingsBody(data: data);
        },
      ),
    );
  }
}

class _SavingsBody extends StatelessWidget {
  const _SavingsBody({required this.data});
  final _SavingsData data;

  @override
  Widget build(BuildContext context) {
    final hasSavings = data.totalSavingsPence > 0;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      children: [
        // ── Total savings hero ──────────────────────────────────────────────
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.primary, AppColors.primaryLight],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Total savings',
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                hasSavings ? data.totalSavingsDisplay : '£—',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 42,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1,
                ),
              ),
              if (!hasSavings) ...[
                const SizedBox(height: 4),
                const Text(
                  'Estimated savings appear once retailers add pricing details.',
                  style: TextStyle(
                    color: Colors.white60,
                    fontSize: 12,
                    height: 1.4,
                  ),
                ),
              ],
            ],
          ),
        ),

        const SizedBox(height: 16),

        // ── Stats grid ──────────────────────────────────────────────────────
        Row(
          children: [
            _StatCard(
              value: data.thisMonthSavingsPence > 0
                  ? data.thisMonthSavingsDisplay
                  : '${data.thisMonthCount}',
              label: 'This month',
              sub: data.thisMonthSavingsPence > 0 ? 'saved' : 'offers redeemed',
              color: const Color(0xFF3B82F6),
            ),
            const SizedBox(width: 12),
            _StatCard(
              value: data.thisYearSavingsPence > 0
                  ? data.thisYearSavingsDisplay
                  : '${data.thisYearCount}',
              label: 'This year',
              sub: data.thisYearSavingsPence > 0 ? 'saved' : 'offers redeemed',
              color: const Color(0xFF7C3AED),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _StatCard(
              value: data.averageSavingDisplay,
              label: 'Per redemption',
              sub: 'average saving',
              color: const Color(0xFF059669),
            ),
            const SizedBox(width: 12),
            _StatCard(
              value: '${data.totalCount}',
              label: 'All time',
              sub: 'offers redeemed',
              color: AppColors.primary,
            ),
          ],
        ),

        // ── Milestones ───────────────────────────────────────────────────────
        if (data.totalSavingsPence > 0) ...[
          const SizedBox(height: 28),
          Text('Savings milestones', style: AppTextStyles.titleMedium),
          const SizedBox(height: 12),
          _MilestonesPanel(totalPence: data.totalSavingsPence),
        ],

        if (data.topRetailerName != null) ...[
          const SizedBox(height: 28),
          Text('Your favourite spot', style: AppTextStyles.titleMedium),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B).withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.25),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.star_outlined,
                    color: Color(0xFFF59E0B), size: 22),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    data.topRetailerName!,
                    style: AppTextStyles.titleMedium,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 28),
        Text('Redemption history', style: AppTextStyles.titleMedium),
        const SizedBox(height: 12),

        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: data.redemptions.length,
            separatorBuilder: (_, __) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final r = data.redemptions[i];
              final saving = r.savingPence;
              return ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                leading: Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.local_offer_outlined,
                      color: AppColors.primary, size: 20),
                ),
                title: Text(
                  r.offerTitle,
                  style: AppTextStyles.bodyMedium.copyWith(fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                subtitle: Text(
                  r.retailerName,
                  style: AppTextStyles.bodyMedium.copyWith(
                    fontSize: 11,
                    color: AppColors.textSecondary,
                  ),
                ),
                trailing: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    if (saving != null)
                      Text(
                        'Saved ${_fmtPence(saving)}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
                        ),
                      )
                    else if (r.valueText != null)
                      Text(
                        r.valueText!,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textSecondary,
                        ),
                      ),
                    Text(
                      _fmtDate(r.redeemedAt),
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.textDisabled,
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),

        const SizedBox(height: 12),
        Text(
          'Savings figures are based on retailer-provided estimated values where available.',
          style: AppTextStyles.bodyMedium.copyWith(
            fontSize: 11,
            color: AppColors.textDisabled,
          ),
        ),
      ],
    );
  }

  static String _fmtPence(int pence) {
    final pounds = pence / 100;
    return '£${pounds.toStringAsFixed(pounds.truncateToDouble() == pounds ? 0 : 2)}';
  }

  static String _fmtDate(DateTime dt) {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final d = DateTime(dt.year, dt.month, dt.day);
    if (d == today) return 'Today';
    if (d == today.subtract(const Duration(days: 1))) return 'Yesterday';
    const months = [
      '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${dt.day} ${months[dt.month]}';
  }
}

// ---------------------------------------------------------------------------
// Milestones panel
// ---------------------------------------------------------------------------

class _MilestonesPanel extends StatelessWidget {
  const _MilestonesPanel({required this.totalPence});

  final int totalPence;

  static const _milestones = [100, 250, 500, 1000, 2500, 5000];

  @override
  Widget build(BuildContext context) {
    final totalPounds = totalPence / 100;

    // Find the next milestone to achieve
    int? nextMilestone;
    for (final m in _milestones) {
      if (totalPounds < m) {
        nextMilestone = m;
        break;
      }
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ..._milestones.map((milestone) {
            final achieved = totalPounds >= milestone;
            final isNext = milestone == nextMilestone;
            return Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: achieved
                          ? AppColors.primary.withValues(alpha: 0.12)
                          : isNext
                              ? const Color(0xFFF59E0B).withValues(alpha: 0.1)
                              : AppColors.background,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      achieved
                          ? Icons.check_circle_rounded
                          : isNext
                              ? Icons.radio_button_unchecked
                              : Icons.lock_outline,
                      size: 16,
                      color: achieved
                          ? AppColors.primary
                          : isNext
                              ? const Color(0xFFF59E0B)
                              : AppColors.textDisabled,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '£$milestone saved',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: achieved || isNext
                            ? FontWeight.w600
                            : FontWeight.w400,
                        color: achieved
                            ? AppColors.textPrimary
                            : isNext
                                ? const Color(0xFFF59E0B)
                                : AppColors.textDisabled,
                      ),
                    ),
                  ),
                  if (achieved)
                    const Text(
                      'Achieved ✓',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    )
                  else if (isNext) ...[
                    Text(
                      '£${(milestone - totalPounds).ceil()} to go',
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFFF59E0B),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ],
              ),
            );
          }),
          if (nextMilestone != null) ...[
            const SizedBox(height: 4),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: (totalPounds / nextMilestone).clamp(0.0, 1.0),
                backgroundColor: AppColors.background,
                valueColor:
                    const AlwaysStoppedAnimation<Color>(Color(0xFFF59E0B)),
                minHeight: 6,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              '£${totalPounds.toStringAsFixed(totalPounds.truncateToDouble() == totalPounds ? 0 : 2)} of £$nextMilestone',
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.textDisabled,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.value,
    required this.label,
    required this.sub,
    required this.color,
  });

  final String value;
  final String label;
  final String sub;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withValues(alpha: 0.2)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            Text(
              sub,
              style: const TextStyle(
                fontSize: 10,
                color: AppColors.textSecondary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
