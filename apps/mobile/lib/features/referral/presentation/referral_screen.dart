import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/analytics_provider.dart';
import '../../../core/providers/supabase_provider.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../domain/referral.dart';
import '../providers/referral_providers.dart';

class ReferralScreen extends ConsumerWidget {
  const ReferralScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final client = ref.watch(supabaseClientProvider);
    final profileId = client.auth.currentUser?.id;

    if (profileId == null) {
      return const Scaffold(body: Center(child: Text('Sign in required')));
    }

    final statsAsync = ref.watch(referralStatsProvider(profileId));

    return Scaffold(
      backgroundColor: AppColors.cream,
      appBar: AppBar(
        backgroundColor: AppColors.cream,
        elevation: 0,
        title: const Text('Refer & earn'),
      ),
      body: statsAsync.when(
        loading: () => const Center(child: LoadingIndicator()),
        error: (e, _) => ErrorState(message: e.toString()),
        data: (stats) {
          if (stats == null) {
            return const Center(child: Text('Unable to load referral info.'));
          }
          return _ReferralBody(stats: stats, profileId: profileId);
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

class _ReferralBody extends ConsumerStatefulWidget {
  const _ReferralBody({required this.stats, required this.profileId});

  final ReferralStats stats;
  final String profileId;

  @override
  ConsumerState<_ReferralBody> createState() => _ReferralBodyState();
}

class _ReferralBodyState extends ConsumerState<_ReferralBody> {
  late final TextEditingController _paypalController;
  bool _savingPaypal = false;
  String? _paypalError;

  @override
  void initState() {
    super.initState();
    _paypalController = TextEditingController(text: widget.stats.paypalEmail ?? '');
  }

  @override
  void dispose() {
    _paypalController.dispose();
    super.dispose();
  }

  Future<void> _savePaypalEmail() async {
    final email = _paypalController.text.trim();
    if (email.isEmpty) {
      setState(() => _paypalError = 'Enter your PayPal email address.');
      return;
    }
    if (!email.contains('@')) {
      setState(() => _paypalError = 'Enter a valid email address.');
      return;
    }
    setState(() { _savingPaypal = true; _paypalError = null; });
    try {
      final ds = ref.read(referralDataSourceProvider);
      await ds.savePaypalEmail(profileId: widget.profileId, paypalEmail: email);
      ref.invalidate(referralStatsProvider(widget.profileId));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('PayPal email saved'), duration: Duration(seconds: 2)),
        );
      }
    } catch (_) {
      if (mounted) setState(() => _paypalError = 'Failed to save. Please try again.');
    } finally {
      if (mounted) setState(() => _savingPaypal = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final stats = widget.stats;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Hero card ───────────────────────────────────────────────────────
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
                const Icon(Icons.people_outline, color: Colors.white70, size: 32),
                const SizedBox(height: 14),
                const Text(
                  'Earn £2 per friend,\n£10 per venue',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    height: 1.3,
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Refer friends or local businesses to Better Off Local. '
                  'Once they\'ve been active for 30 days, you receive a '
                  'cash payout to your PayPal account.',
                  style: TextStyle(color: Colors.white70, fontSize: 14, height: 1.45),
                ),
                const SizedBox(height: 20),
                // Referral code
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'YOUR CODE',
                              style: TextStyle(
                                color: Colors.white60,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 1.2,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              stats.code,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 26,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 3,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.copy_outlined,
                            color: Colors.white70, size: 20),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: stats.referralUrl));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Referral link copied'),
                              duration: Duration(seconds: 2),
                            ),
                          );
                        },
                        tooltip: 'Copy link',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () => _share(stats),
                    icon: const Icon(Icons.share_outlined, size: 18),
                    label: const Text('Share your link'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // ── Earnings dashboard ──────────────────────────────────────────────
          Text('Your earnings', style: AppTextStyles.titleMedium),
          const SizedBox(height: 12),
          Row(
            children: [
              _EarningsTile(
                label: 'Pending',
                value: stats.pendingDisplay,
                sublabel: 'In 30-day window',
                color: const Color(0xFFF59E0B),
              ),
              const SizedBox(width: 10),
              _EarningsTile(
                label: 'Ready to pay',
                value: stats.eligibleDisplay,
                sublabel: 'PayPal payout due',
                color: const Color(0xFF22C55E),
              ),
              const SizedBox(width: 10),
              _EarningsTile(
                label: 'Paid out',
                value: stats.paidDisplay,
                sublabel: 'All time',
                color: AppColors.primary,
              ),
            ],
          ),

          if (stats.eligibleAmountPence > 0) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFFBBF7D0)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_outline,
                      size: 16, color: Color(0xFF16A34A)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      '${stats.eligibleDisplay} is ready to be paid — make sure your PayPal email is set below.',
                      style: const TextStyle(fontSize: 12, color: Color(0xFF166534)),
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: 24),

          // ── PayPal email ────────────────────────────────────────────────────
          Text('PayPal email', style: AppTextStyles.titleMedium),
          const SizedBox(height: 6),
          Text(
            'We send reward payouts to your PayPal account. '
            'Add your PayPal email so we know where to send it.',
            style: AppTextStyles.bodyMedium.copyWith(
              fontSize: 13,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: TextField(
                  controller: _paypalController,
                  keyboardType: TextInputType.emailAddress,
                  autocorrect: false,
                  style: AppTextStyles.bodyMedium,
                  decoration: InputDecoration(
                    hintText: 'your@paypal.com',
                    hintStyle: AppTextStyles.bodyMedium
                        .copyWith(color: AppColors.textDisabled),
                    errorText: _paypalError,
                    contentPadding:
                        const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Padding(
                padding: EdgeInsets.only(top: _paypalError != null ? 0 : 0),
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    onPressed: _savingPaypal ? null : _savePaypalEmail,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 18),
                    ),
                    child: _savingPaypal
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: Colors.white,
                            ),
                          )
                        : const Text('Save'),
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 28),

          // ── How it works ────────────────────────────────────────────────────
          Text('How it works', style: AppTextStyles.titleMedium),
          const SizedBox(height: 12),
          const _HowItWorksStep(
            icon: Icons.share_outlined,
            title: 'Share your code or link',
            body: 'Send your referral code or link to a friend or a local business.',
          ),
          const SizedBox(height: 10),
          const _HowItWorksStep(
            icon: Icons.person_add_outlined,
            title: 'They sign up and subscribe',
            body: 'Friends become paying members. Venues take out a Better Off Local listing.',
          ),
          const SizedBox(height: 10),
          const _HowItWorksStep(
            icon: Icons.hourglass_top_outlined,
            title: '30-day qualification window',
            body: 'Once they\'ve been active for 30 days without cancelling, your reward becomes eligible.',
          ),
          const SizedBox(height: 10),
          const _HowItWorksStep(
            icon: Icons.payments_outlined,
            title: 'Cash paid to your PayPal',
            body: '£2.00 per member referral. £10.00 per venue referral. Paid manually to your PayPal account.',
          ),

          const SizedBox(height: 20),
          Text(
            'Referral rewards are processed manually and paid within 5 working days of becoming eligible. '
            'Rewards are cancelled if the referred member or venue cancels within the 30-day window. '
            'Self-referrals are not permitted.',
            style: AppTextStyles.bodyMedium.copyWith(
              fontSize: 11,
              color: AppColors.textDisabled,
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  void _share(ReferralStats stats) {
    unawaited(ref.read(analyticsServiceProvider).logReferralShared());
    Share.share(
      'I\'ve been saving money with Better Off Local — supporting brilliant local businesses in my area. '
      'Join with my link and start exploring local offers!\n${stats.referralUrl}',
      subject: 'Join Better Off Local',
    );
  }
}

// ---------------------------------------------------------------------------
// Earnings tile
// ---------------------------------------------------------------------------

class _EarningsTile extends StatelessWidget {
  const _EarningsTile({
    required this.label,
    required this.value,
    required this.sublabel,
    required this.color,
  });

  final String label;
  final String value;
  final String sublabel;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w700,
                color: color,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 1),
            Text(
              sublabel,
              style: const TextStyle(
                fontSize: 9,
                color: AppColors.textDisabled,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// How it works step
// ---------------------------------------------------------------------------

class _HowItWorksStep extends StatelessWidget {
  const _HowItWorksStep({
    required this.icon,
    required this.title,
    required this.body,
  });

  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: AppColors.primary, size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title,
                  style: AppTextStyles.bodyMedium
                      .copyWith(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 2),
              Text(body,
                  style: AppTextStyles.bodyMedium
                      .copyWith(fontSize: 12, color: AppColors.textSecondary)),
            ],
          ),
        ),
      ],
    );
  }
}
