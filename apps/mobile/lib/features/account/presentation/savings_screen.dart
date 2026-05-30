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
                  Text('No redemptions yet',
                      style: AppTextStyles.titleMedium),
                  const SizedBox(height: 6),
                  Text(
                    'Offers you redeem will appear here.',
                    style: AppTextStyles.bodyMedium,
                  ),
                ],
              ),
            );
          }

          return ListView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
            children: [
              // Summary card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle_outline,
                        color: Colors.white70, size: 32),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${data.total}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          'offer${data.total == 1 ? '' : 's'} redeemed',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),
              Text('Recent redemptions',
                  style: AppTextStyles.titleMedium),
              const SizedBox(height: 12),

              // Redemption list
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
                        style:
                            AppTextStyles.bodyMedium.copyWith(fontSize: 13),
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
        },
      ),
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
