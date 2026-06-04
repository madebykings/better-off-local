import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/supabase_provider.dart';
import '../providers/venue_referral_providers.dart';

const _amber = Color(0xFFD97706);
const _amberLight = Color(0xFFFEF3C7);

class VenueReferralSection extends ConsumerWidget {
  const VenueReferralSection({
    super.key,
    required this.offerId,
    required this.offerTitle,
  });

  final String offerId;
  final String offerTitle;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileId = ref.watch(supabaseClientProvider).auth.currentUser?.id;
    if (profileId == null) return const SizedBox.shrink();

    final statusAsync = ref.watch(venueReferralStatusProvider(
      (offerId: offerId, profileId: profileId, offerTitle: offerTitle),
    ));

    return statusAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 12),
        child: Center(child: CircularProgressIndicator()),
      ),
      error: (_, __) => const SizedBox.shrink(),
      data: (status) => _VenueReferralBody(status: status),
    );
  }
}

class _VenueReferralBody extends StatelessWidget {
  const _VenueReferralBody({required this.status});

  final dynamic status;

  void _share(BuildContext context) {
    if (status.shareUrl.isEmpty) return;
    Share.share(
      'I thought you\'d love ${status.offerTitle} — check it out on Better Off Local! ${status.shareUrl}',
    );
  }

  void _copy(BuildContext context) {
    if (status.shareUrl.isEmpty) return;
    Clipboard.setData(ClipboardData(text: status.shareUrl));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Link copied to clipboard'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _amberLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: _amber.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.people_outline, color: _amber, size: 18),
              const SizedBox(width: 8),
              Text(
                'Refer a friend, earn a reward',
                style: AppTextStyles.labelSmall.copyWith(color: _amber),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            status.rewardTitle != null && status.rewardTitle!.isNotEmpty
                ? 'Share this offer. When a friend visits for the first time, you\'ll earn: ${status.rewardTitle}'
                : 'Share this offer. When a friend visits for the first time and redeems it, you\'ll earn a reward.',
            style: AppTextStyles.bodyMedium.copyWith(
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          // Stats row
          if (status.invitedCount > 0 || status.unlockedCount > 0) ...[
            Row(
              children: [
                _StatChip(label: 'Invited', value: status.invitedCount),
                const SizedBox(width: 8),
                _StatChip(label: 'Rewards earned', value: status.unlockedCount),
              ],
            ),
            const SizedBox(height: 12),
          ],
          // Action buttons
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _amber,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  onPressed: status.shareUrl.isNotEmpty
                      ? () => _share(context)
                      : null,
                  icon: const Icon(Icons.share_outlined, size: 16),
                  label: const Text('Share link'),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: _amber,
                  side: BorderSide(color: _amber.withValues(alpha: 0.5)),
                  padding: const EdgeInsets.symmetric(
                      vertical: 10, horizontal: 12),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                onPressed: status.shareUrl.isNotEmpty
                    ? () => _copy(context)
                    : null,
                child: const Icon(Icons.copy_outlined, size: 16),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({required this.label, required this.value});
  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: _amber.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            '$value',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: _amber,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
