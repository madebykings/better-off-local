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
      .select(
        'redeemed_at, offers(title, value_text), retailers(name)',
      )
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

  int get total => redemptions.length;

  int get thisMonth {
    final now = DateTime.now();
    final monthStart = DateTime(now.year, now.month, 1);
    return redemptions.where((r) => r.redeemedAt.isAfter(monthStart)).length;
  }

  /// Estimated savings from offers with parseable £X amounts.
  int get estimatedSavingsPence {
    int total = 0;
    for (final r in redemptions) {
      final p = _parsePence(r.valueText);
      if (p != null) total += p;
    }
    return total;
  }

  String get estimatedSavingsDisplay {
    final p = estimatedSavingsPence;
    if (p == 0) return '£—';
    final pounds = p / 100;
    return '£${pounds.toStringAsFixed(pounds.truncateToDouble() == pounds ? 0 : 2)}';
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

  static int? _parsePence(String? text) {
    if (text == null) return null;
    // Match "£X" or "£X.XX" patterns
    final match = RegExp(r'£(\d+(?:\.\d{1,2})?)').firstMatch(text);
    if (match == null) return null;
    final pounds = double.tryParse(match.group(1)!);
    if (pounds == null) return null;
    return (pounds * 100).round();
  }
}

class _Redemption {
  const _Redemption({
    required this.offerTitle,
    required this.retailerName,
    required this.redeemedAt,
    this.valueText,
  });
  final String offerTitle;
  final String? valueText;
  final String retailerName;
  final DateTime redeemedAt;
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
          child: Text(
            'Unable to load redemptions.',
            style: AppTextStyles.bodyMedium,
          ),
        ),
        data: (data) {
          if (data.total == 0) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.savings_outlined,
                      size: 56, color: AppColors.border),
                  const SizedBox(height: 16),
                  Text('No redemptions yet', style: AppTextStyles.titleMedium),
                  const SizedBox(height: 6),
                  Text(
                    'Offers you redeem will appear here.',
                    style: AppTextStyles.bodyMedium,
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
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      children: [
        // Stats grid
        Row(
          children: [
            _StatCard(
              value: '${data.total}',
              label: 'All time',
              sub: 'offers redeemed',
              color: AppColors.primary,
            ),
            const SizedBox(width: 12),
            _StatCard(
              value: '${data.thisMonth}',
              label: 'This month',
              sub: 'offers redeemed',
              color: const Color(0xFF3B82F6),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _StatCard(
              value: data.estimatedSavingsDisplay,
              label: 'Estimated saved',
              sub: 'from fixed discounts',
              color: const Color(0xFF059669),
            ),
            const SizedBox(width: 12),
            if (data.topRetailerName != null)
              _StatCard(
                value: '⭐',
                label: 'Top retailer',
                sub: data.topRetailerName!,
                color: const Color(0xFFF59E0B),
              )
            else
              const Expanded(child: SizedBox()),
          ],
        ),

        const SizedBox(height: 24),
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
              return ListTile(
                contentPadding: const EdgeInsets.symmetric(
                    horizontal: 16, vertical: 6),
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
                    if (r.valueText != null)
                      Text(
                        r.valueText!,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppColors.primary,
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
      ],
    );
  }

  String _fmtDate(DateTime dt) {
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
