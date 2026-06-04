import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/widgets/brand_logo.dart';
import '../../../core/widgets/error_state.dart';
import '../../../core/widgets/primary_button.dart';
import '../../profile/providers/profile_providers.dart';
import '../domain/membership.dart';
import '../providers/membership_providers.dart';
import '../../redemptions/domain/redemption_token.dart';
import 'membership_controller.dart';
import 'pass_qr_controller.dart';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class MembershipCardScreen extends ConsumerStatefulWidget {
  const MembershipCardScreen({super.key});

  @override
  ConsumerState<MembershipCardScreen> createState() =>
      _MembershipCardScreenState();
}

class _MembershipCardScreenState extends ConsumerState<MembershipCardScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _entranceCtrl;

  @override
  void initState() {
    super.initState();
    _entranceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _entranceCtrl.forward();

      // Request QR immediately if membership is already resolved (cached).
      final membership = ref.read(currentMembershipProvider).valueOrNull;
      debugPrint('[MembershipCard] initState: membership=${membership?.status}, '
          'entitled=${membership?.isEntitled}');
      if (membership != null && membership.isEntitled) {
        debugPrint('[MembershipCard] initState: data cached — requesting QR');
        ref.read(passQRControllerProvider.notifier).requestToken();
      } else {
        debugPrint('[MembershipCard] initState: membership not yet resolved — '
            'ref.listen will trigger QR once loaded');
      }
    });
  }

  @override
  void dispose() {
    _entranceCtrl.dispose();
    super.dispose();
  }

  /// Opens the Stripe Customer Portal so the user can update their
  /// payment method. Follows the same pattern as AccountScreen._managePlan.
  Future<void> _openPortal(BuildContext context) async {
    if (!mounted) return;
    final scaffold = ScaffoldMessenger.of(context);
    try {
      final url = await ref
          .read(membershipRepositoryProvider)
          .createPortalSession();
      if (!mounted) return;
      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (e) {
      if (!mounted) return;
      scaffold.showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final membershipAsync = ref.watch(currentMembershipProvider);
    final profileAsync = ref.watch(profileProvider);
    final qrState = ref.watch(passQRControllerProvider);

    // When membership resolves asynchronously (common on first open), trigger
    // the QR fetch if the controller is still idle. The initState check handles
    // the case where data is already cached; this covers the async load path.
    ref.listen<AsyncValue<Membership?>>(currentMembershipProvider, (_, next) {
      debugPrint('[MembershipCard] provider update: ${next.runtimeType}, '
          'value=${next.valueOrNull?.status}, '
          'entitled=${next.valueOrNull?.isEntitled}');
      final membership = next.valueOrNull;
      if (membership != null && membership.isEntitled) {
        final currentQr = ref.read(passQRControllerProvider);
        debugPrint('[MembershipCard] membership entitled, QR state: ${currentQr.runtimeType}');
        if (currentQr is PassQRIdle) {
          debugPrint('[MembershipCard] requesting QR after async membership load');
          ref.read(passQRControllerProvider.notifier).requestToken();
        }
      }
    });

    return Scaffold(
      backgroundColor: AppColors.cream,
      body: SafeArea(
        child: membershipAsync.when(
          loading: () => const _PassSkeleton(),
          error: (e, _) => ErrorState(message: e.toString()),
          data: (membership) {
            // past_due: user still has access but payment is failing — show
            // a dedicated warning screen rather than the generic no-plan prompt.
            if (membership != null &&
                membership.status == MembershipStatus.pastDue) {
              return _PastDuePrompt(
                onUpdatePayment: () => _openPortal(context),
              );
            }

            if (membership == null || !membership.isEntitled) {
              return _NoPlanPrompt(
                onSubscribe: () => context.push(RouteNames.paywall),
              );
            }

            final memberName =
                profileAsync.valueOrNull?.fullName ?? 'Member';

            // Entrance slide-up + fade.
            return AnimatedBuilder(
              animation: _entranceCtrl,
              builder: (context, child) => FadeTransition(
                opacity: _entranceCtrl,
                child: SlideTransition(
                  position: Tween<Offset>(
                    begin: const Offset(0, 0.05),
                    end: Offset.zero,
                  ).animate(CurvedAnimation(
                    parent: _entranceCtrl,
                    curve: Curves.easeOutCubic,
                  )),
                  child: child,
                ),
              ),
              child: RefreshIndicator(
                onRefresh: () async {
                  ref
                      .read(membershipControllerProvider.notifier)
                      .refreshMembership();
                  await ref.read(currentMembershipProvider.future);
                },
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Padding(
                        padding: EdgeInsets.fromLTRB(20, 20, 20, 20),
                        child: Text(
                          'My Pass',
                          style: AppTextStyles.headlineMedium,
                        ),
                      ),
                      _PassCard(
                        membership: membership,
                        memberName: memberName,
                        qrState: qrState,
                        onRefreshQR: () => ref
                            .read(passQRControllerProvider.notifier)
                            .refresh(),
                      ),
                      const SizedBox(height: 24),
                      const _QuickActions(),
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Pass card — outer container with shadow and clip
// ---------------------------------------------------------------------------

class _PassCard extends StatelessWidget {
  const _PassCard({
    required this.membership,
    required this.memberName,
    required this.qrState,
    required this.onRefreshQR,
  });

  final Membership membership;
  final String memberName;
  final PassQRState qrState;
  final VoidCallback onRefreshQR;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.22),
              blurRadius: 28,
              offset: const Offset(0, 14),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(20),
          child: Column(
            children: [
              _PassHeader(
                membership: membership,
                memberName: memberName,
              ),
              const _PerforationDivider(),
              _PassQRZone(
                qrState: qrState,
                onRefresh: onRefreshQR,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Pass header — green gradient zone with holographic overlay
// ---------------------------------------------------------------------------

class _PassHeader extends StatelessWidget {
  const _PassHeader({
    required this.membership,
    required this.memberName,
  });

  final Membership membership;
  final String memberName;

  String _planLabel(MembershipPlanInterval? interval) =>
      interval == MembershipPlanInterval.annual ? 'Annual member' : 'Monthly member';

  String _formatDate(DateTime? dt) {
    if (dt == null) return '—';
    return DateFormat('d MMM yyyy').format(dt.toLocal());
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.primaryLight],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Issuer + status row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const BrandLogo(
                    variant: BrandLogoVariant.horizontal,
                    scheme: BrandLogoScheme.dark,
                    height: 18,
                  ),
                  _StatusChip(status: membership.status),
                ],
              ),

              const SizedBox(height: 28),

              // Member name
              Text(
                memberName,
                style: AppTextStyles.headlineMedium.copyWith(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                ),
              ),

              const SizedBox(height: 4),

              Text(
                _planLabel(membership.planInterval),
                style: AppTextStyles.bodyMedium.copyWith(
                  color: Colors.white.withValues(alpha: 0.65),
                  fontSize: 13,
                ),
              ),

              const SizedBox(height: 22),

              // Metadata row
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        membership.cancelAtPeriodEnd ? 'ENDS' : 'RENEWS',
                        style: const TextStyle(
                          color: Colors.white38,
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _formatDate(membership.currentPeriodEnd),
                        style: AppTextStyles.bodyMedium.copyWith(
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  if (membership.cancelAtPeriodEnd)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.warning.withValues(alpha: 0.18),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: AppColors.warning.withValues(alpha: 0.45),
                        ),
                      ),
                      child: const Text(
                        'Cancelling',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.warning,
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),

        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Perforated divider — boarding-pass tear-line aesthetic
// ---------------------------------------------------------------------------

class _PerforationDivider extends StatelessWidget {
  const _PerforationDivider();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 18,
      child: CustomPaint(
        painter: _PerforationPainter(),
        size: Size.infinite,
      ),
    );
  }
}

class _PerforationPainter extends CustomPainter {
  const _PerforationPainter();

  @override
  void paint(Canvas canvas, Size size) {
    // Green background (continues from the header).
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = AppColors.primary,
    );

    // White bottom half — start of the QR zone.
    canvas.drawRect(
      Rect.fromLTWH(0, size.height / 2, size.width, size.height / 2),
      Paint()..color = Colors.white,
    );

    // Cream circles punched across the full width.
    final dotPaint = Paint()..color = AppColors.cream;
    const r = 5.5;
    const spacing = 16.0;
    double x = 0;
    while (x <= size.width) {
      canvas.drawCircle(Offset(x, size.height / 2), r, dotPaint);
      x += spacing;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter _) => false;
}

// ---------------------------------------------------------------------------
// QR zone — white panel with live QR + countdown text
// ---------------------------------------------------------------------------

class _PassQRZone extends StatefulWidget {
  const _PassQRZone({required this.qrState, required this.onRefresh});

  final PassQRState qrState;
  final VoidCallback onRefresh;

  @override
  State<_PassQRZone> createState() => _PassQRZoneState();
}

class _PassQRZoneState extends State<_PassQRZone>
    with SingleTickerProviderStateMixin {
  /// Pulse animation — active only when the countdown is ≤ 30 seconds.
  late AnimationController _pulseCtrl;

  Duration _remaining = Duration.zero;
  Timer? _countdownTimer;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    )..repeat(reverse: true);

    _syncFromState(widget.qrState, null);
  }

  @override
  void didUpdateWidget(_PassQRZone old) {
    super.didUpdateWidget(old);
    // Only restart the countdown when a genuinely new token arrives.
    final prevToken =
        old.qrState is PassQRReady ? (old.qrState as PassQRReady).token : null;
    _syncFromState(widget.qrState, prevToken);
  }

  void _syncFromState(PassQRState state, RedemptionToken? prevToken) {
    if (state is PassQRReady) {
      final token = state.token;
      if (prevToken?.token != token.token) {
        _remaining = token.remainingTime;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _startCountdown(token.expiresAt);
        });
      }
    }
  }

  void _startCountdown(DateTime expiresAt) {
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final remaining = expiresAt.difference(DateTime.now().toUtc());
      setState(() {
        _remaining = remaining.isNegative ? Duration.zero : remaining;
      });
    });
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _countdownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 28, 24, 28),
      child: switch (widget.qrState) {
        PassQRIdle() || PassQRLoading() => const SizedBox(
            height: 240,
            child: Center(child: CircularProgressIndicator()),
          ),

        PassQRReady(:final token) => Column(
            children: [
              // QR crossfades when a new token arrives (key changes).
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 350),
                transitionBuilder: (child, animation) => FadeTransition(
                  opacity: animation,
                  child: ScaleTransition(
                    scale: Tween<double>(begin: 0.96, end: 1.0)
                        .animate(animation),
                    child: child,
                  ),
                ),
                child: QrImageView(
                  key: ValueKey(token.token),
                  data: token.token,
                  version: QrVersions.auto,
                  size: 220,
                  backgroundColor: Colors.white,
                  eyeStyle: const QrEyeStyle(
                    eyeShape: QrEyeShape.square,
                    color: AppColors.primary,
                  ),
                  dataModuleStyle: const QrDataModuleStyle(
                    dataModuleShape: QrDataModuleShape.square,
                    color: AppColors.primary,
                  ),
                  padding: const EdgeInsets.all(8),
                ),
              ),
              const SizedBox(height: 16),
              _CountdownLabel(
                remaining: _remaining,
                pulseAnimation: _pulseCtrl,
              ),
            ],
          ),

        // Unexpected error — allow manual retry.
        PassQRError() => SizedBox(
            height: 240,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.qr_code_2, size: 64, color: AppColors.textDisabled),
                const SizedBox(height: 14),
                const Text(
                  'Could not load QR',
                  style: AppTextStyles.bodyMedium,
                ),
                const SizedBox(height: 14),
                GestureDetector(
                  onTap: widget.onRefresh,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.primary),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Retry',
                      style: AppTextStyles.labelSmall.copyWith(
                        color: AppColors.primary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Countdown label — color-coded, pulses red when ≤ 30 s
// ---------------------------------------------------------------------------

class _CountdownLabel extends StatelessWidget {
  const _CountdownLabel({
    required this.remaining,
    required this.pulseAnimation,
  });

  final Duration remaining;
  final Animation<double> pulseAnimation;

  Color get _color {
    final secs = remaining.inSeconds;
    if (secs <= 30) return AppColors.error;
    if (secs <= 60) return AppColors.warning;
    return AppColors.primary;
  }

  String get _label {
    final m = remaining.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = remaining.inSeconds.remainder(60).toString().padLeft(2, '0');
    return 'Refreshes in $m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final isUrgent = remaining.inSeconds <= 30;
    final color = _color;

    final text = Text(
      _label,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: color,
        letterSpacing: 0.2,
      ),
    );

    if (isUrgent) {
      // Pulse opacity between 50 % and 100 % when under 30 s.
      return AnimatedBuilder(
        animation: pulseAnimation,
        builder: (_, __) => Opacity(
          opacity: 0.5 + 0.5 * pulseAnimation.value,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.timer_outlined, size: 12, color: color),
              const SizedBox(width: 4),
              text,
            ],
          ),
        ),
      );
    }

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.refresh_outlined, size: 12, color: color),
        const SizedBox(width: 4),
        text,
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Status chip — ported from original screen
// ---------------------------------------------------------------------------

/// Status chip rendered on the green gradient card header.
/// Uses a solid white background for all states so the chip is always
/// legible against the background, with coloured text per state.
class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});

  final MembershipStatus status;

  @override
  Widget build(BuildContext context) {
    final isActive = status == MembershipStatus.active;
    final (label, textColor) = switch (status) {
      MembershipStatus.active   => ('Active',   AppColors.success),
      MembershipStatus.trialing => ('Trial',    AppColors.info),
      MembershipStatus.pastDue  => ('Past due', AppColors.warning),
      MembershipStatus.cancelled=> ('Cancelled',AppColors.error),
      MembershipStatus.expired  => ('Expired',  AppColors.error),
      MembershipStatus.inactive => ('Inactive', AppColors.textSecondary),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.12),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isActive) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: textColor,
              ),
            ),
            const SizedBox(width: 5),
          ],
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Quick actions — 2-row × 3-column grid of shortcuts below the card
// ---------------------------------------------------------------------------

class _QuickActions extends StatelessWidget {
  const _QuickActions();

  @override
  Widget build(BuildContext context) {
    final tiles = [
      _TileData(
        icon: Icons.favorite_border,
        label: 'Favourites',
        onTap: () => context.push(RouteNames.favourites),
      ),
      _TileData(
        icon: Icons.map_outlined,
        label: 'My Region',
        onTap: () => context.push(RouteNames.regionProgress),
      ),
      _TileData(
        icon: Icons.savings_outlined,
        label: 'My Savings',
        onTap: () => context.push(RouteNames.savings),
      ),
      _TileData(
        icon: Icons.receipt_long_outlined,
        label: 'History',
        onTap: () => context.push(RouteNames.redemptionHistory),
      ),
      _TileData(
        icon: Icons.share_outlined,
        label: 'Refer a Friend',
        onTap: () => context.push(RouteNames.referral),
      ),
      _TileData(
        icon: Icons.manage_accounts_outlined,
        label: 'Manage Plan',
        onTap: () => context.go(RouteNames.account),
      ),
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        children: [
          Row(children: _buildRow(tiles.sublist(0, 3))),
          const SizedBox(height: 10),
          Row(children: _buildRow(tiles.sublist(3, 6))),
        ],
      ),
    );
  }

  List<Widget> _buildRow(List<_TileData> row) {
    final widgets = <Widget>[];
    for (var i = 0; i < row.length; i++) {
      if (i > 0) widgets.add(const SizedBox(width: 10));
      widgets.add(Expanded(child: _ActionTile(data: row[i])));
    }
    return widgets;
  }
}

class _TileData {
  const _TileData({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.data});
  final _TileData data;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: data.onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(data.icon, color: AppColors.primary, size: 22),
            const SizedBox(height: 6),
            Text(
              data.label,
              style: AppTextStyles.labelSmall.copyWith(
                fontSize: 10,
                color: AppColors.textPrimary,
                letterSpacing: 0,
                height: 1.3,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Skeleton — grey placeholder while membership loads
// ---------------------------------------------------------------------------

class _PassSkeleton extends StatelessWidget {
  const _PassSkeleton();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Title placeholder
          Container(
            height: 28,
            width: 120,
            decoration: BoxDecoration(
              color: AppColors.border,
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 24),
          // Card placeholder
          Container(
            height: 400,
            decoration: BoxDecoration(
              color: AppColors.border,
              borderRadius: BorderRadius.circular(20),
            ),
          ),
          const SizedBox(height: 24),
          // Action tiles placeholder — 2 rows of 3
          ...List.generate(2, (row) => Padding(
            padding: EdgeInsets.only(top: row == 0 ? 0 : 10),
            child: Row(
              children: List.generate(3, (col) {
                return Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(right: col < 2 ? 10 : 0),
                    child: Container(
                      height: 68,
                      decoration: BoxDecoration(
                        color: AppColors.border,
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                  ),
                );
              }),
            ),
          )),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Past-due prompt — payment failed, still has access, needs to update card
// ---------------------------------------------------------------------------

class _PastDuePrompt extends StatelessWidget {
  const _PastDuePrompt({required this.onUpdatePayment});

  final VoidCallback onUpdatePayment;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Warning banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: AppColors.warning.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: AppColors.warning.withValues(alpha: 0.5),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.warning_amber_rounded,
                  color: AppColors.warning,
                  size: 22,
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Text(
                    'Payment failed — please update your payment method to keep access',
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textPrimary,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          PrimaryButton(
            label: 'Update payment method',
            onPressed: onUpdatePayment,
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// No plan prompt — unchanged from prior version
// ---------------------------------------------------------------------------

class _NoPlanPrompt extends StatelessWidget {
  const _NoPlanPrompt({required this.onSubscribe});

  final VoidCallback onSubscribe;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.pagePadding),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(
            Icons.card_membership_outlined,
            size: 64,
            color: AppColors.textDisabled,
          ),
          const SizedBox(height: AppSpacing.lg),
          const Text(
            'No active membership',
            style: AppTextStyles.headlineMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          const Text(
            'Subscribe to access exclusive local discounts\nand get your digital membership card.',
            style: AppTextStyles.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xl),
          PrimaryButton(
            label: 'See membership plans',
            onPressed: onSubscribe,
          ),
        ],
      ),
    );
  }
}
