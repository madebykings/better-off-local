import 'dart:math';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../domain/verification_session_result.dart';
import 'online_scan_controller.dart';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

class OnlineScanScreen extends ConsumerStatefulWidget {
  const OnlineScanScreen({super.key});

  @override
  ConsumerState<OnlineScanScreen> createState() => _OnlineScanScreenState();
}

class _OnlineScanScreenState extends ConsumerState<OnlineScanScreen>
    with TickerProviderStateMixin {
  /// Scanning line that sweeps vertically through the clear window.
  late AnimationController _scanLineCtrl;

  /// Expanding pulse rings for the handoff state.
  late AnimationController _pulseCtrl;

  /// Progressive checkmark draw for the approved state.
  late AnimationController _checkCtrl;

  /// Horizontal shake for the rejected state.
  late AnimationController _shakeCtrl;

  @override
  void initState() {
    super.initState();
    _scanLineCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();

    _checkCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );

    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );
  }

  @override
  void dispose() {
    _scanLineCtrl.dispose();
    _pulseCtrl.dispose();
    _checkCtrl.dispose();
    _shakeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(onlineScanControllerProvider);

    ref.listen<OnlineScanState>(onlineScanControllerProvider, (_, next) {
      if (next is OnlineScanApproved) _checkCtrl.forward(from: 0);
      if (next is OnlineScanRejected) _shakeCtrl.forward(from: 0);
    });

    return Scaffold(
      backgroundColor: Colors.black,
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 350),
        transitionBuilder: (child, animation) => FadeTransition(
          opacity: animation,
          child: child,
        ),
        child: switch (state) {
          OnlineScanReady() || OnlineScanDetected() => _ScannerView(
              key: const ValueKey('scanner'),
              scanLineAnimation: _scanLineCtrl,
              onClose: () => context.pop(),
            ),
          OnlineScanVerifying() => const _VerifyingView(
              key: ValueKey('verifying'),
            ),
          OnlineScanHandoff(:final result) => _HandoffView(
              key: const ValueKey('handoff'),
              result: result,
              pulseAnimation: _pulseCtrl,
            ),
          OnlineScanApproved(:final result) => _ApprovedView(
              key: const ValueKey('approved'),
              result: result,
              checkAnimation: _checkCtrl,
              onDone: () => context.pop(),
            ),
          OnlineScanRejected(:final reason, :final message) => _RejectedView(
              key: const ValueKey('rejected'),
              reason: reason,
              message: message,
              shakeAnimation: _shakeCtrl,
              onRetry: () =>
                  ref.read(onlineScanControllerProvider.notifier).reset(),
              onClose: () => context.pop(),
            ),
          OnlineScanPending() => _PendingView(
              key: const ValueKey('pending'),
              onClose: () => context.pop(),
            ),
          OnlineScanError(:final message) => _ErrorView(
              key: const ValueKey('error'),
              message: message,
              onRetry: () =>
                  ref.read(onlineScanControllerProvider.notifier).reset(),
              onClose: () => context.pop(),
            ),
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Scanner view — camera + dark overlay + scan line + instructions
// ---------------------------------------------------------------------------

class _ScannerView extends ConsumerWidget {
  const _ScannerView({
    super.key,
    required this.scanLineAnimation,
    required this.onClose,
  });

  final Animation<double> scanLineAnimation;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Camera feed
        MobileScanner(
          onDetect: (capture) {
            final raw = capture.barcodes.firstOrNull?.rawValue;
            if (raw != null) {
              ref
                  .read(onlineScanControllerProvider.notifier)
                  .onQRDetected(raw);
            }
          },
        ),

        // Dark overlay with transparent scan window (punched via blendMode)
        const CustomPaint(
          painter: _ScanOverlayPainter(),
          size: Size.infinite,
          child: SizedBox.expand(),
        ),

        // Animated scan line within the clear window
        LayoutBuilder(
          builder: (context, constraints) {
            const windowSize = 240.0;
            final cy = constraints.maxHeight * 0.42;
            final cx = constraints.maxWidth / 2;
            final windowTop = cy - windowSize / 2;
            final windowLeft = cx - windowSize / 2;

            return AnimatedBuilder(
              animation: scanLineAnimation,
              builder: (_, __) {
                final lineY =
                    windowTop + 8 + (windowSize - 16) * scanLineAnimation.value;
                return CustomPaint(
                  painter: _ScanLinePainter(
                    lineY: lineY,
                    windowLeft: windowLeft,
                    windowWidth: windowSize,
                  ),
                );
              },
            );
          },
        ),

        // Top bar: title + close
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Scan Online Checkout',
                    style: AppTextStyles.titleMedium.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: onClose,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.close, color: Colors.white, size: 18),
                  ),
                ),
              ],
            ),
          ),
        ),

        // Bottom instructions
        Align(
          alignment: Alignment.bottomCenter,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 64),
              child: Text(
                'Point your camera at the QR code\non the online checkout page',
                style: AppTextStyles.bodyMedium.copyWith(
                  color: Colors.white.withValues(alpha: 0.75),
                  fontSize: 14,
                ),
                textAlign: TextAlign.center,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Overlay painter — dark surround + corner brackets
// ---------------------------------------------------------------------------

class _ScanOverlayPainter extends CustomPainter {
  const _ScanOverlayPainter();

  @override
  void paint(Canvas canvas, Size size) {
    const windowSize = 240.0;
    final cx = size.width / 2;
    final cy = size.height * 0.42;

    final clearRect = Rect.fromCenter(
      center: Offset(cx, cy),
      width: windowSize,
      height: windowSize,
    );

    // Punch transparent hole through dark overlay using saveLayer + BlendMode.clear.
    canvas.saveLayer(Rect.largest, Paint());
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = Colors.black.withValues(alpha: 0.68),
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(clearRect, const Radius.circular(10)),
      Paint()..blendMode = BlendMode.clear,
    );
    canvas.restore();

    // Corner brackets — white L-shapes framing the scan window.
    final bracket = Paint()
      ..color = Colors.white
      ..strokeWidth = 3.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    const len = 22.0;

    // Top-left
    _drawBracket(canvas, bracket, clearRect.topLeft, len, 1, 1);
    // Top-right
    _drawBracket(canvas, bracket, clearRect.topRight, len, -1, 1);
    // Bottom-left
    _drawBracket(canvas, bracket, clearRect.bottomLeft, len, 1, -1);
    // Bottom-right
    _drawBracket(canvas, bracket, clearRect.bottomRight, len, -1, -1);
  }

  void _drawBracket(
    Canvas canvas,
    Paint paint,
    Offset corner,
    double len,
    double dx,
    double dy,
  ) {
    canvas.drawLine(corner, corner + Offset(dx * len, 0), paint);
    canvas.drawLine(corner, corner + Offset(0, dy * len), paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter _) => false;
}

// ---------------------------------------------------------------------------
// Scan line painter — horizontal gradient line sweeping vertically
// ---------------------------------------------------------------------------

class _ScanLinePainter extends CustomPainter {
  const _ScanLinePainter({
    required this.lineY,
    required this.windowLeft,
    required this.windowWidth,
  });

  final double lineY;
  final double windowLeft;
  final double windowWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..shader = LinearGradient(
        colors: [
          Colors.transparent,
          AppColors.primary.withValues(alpha: 0.9),
          Colors.transparent,
        ],
      ).createShader(
        Rect.fromLTWH(windowLeft, lineY - 1, windowWidth, 2),
      )
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;

    canvas.drawLine(
      Offset(windowLeft, lineY),
      Offset(windowLeft + windowWidth, lineY),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant _ScanLinePainter old) => old.lineY != lineY;
}

// ---------------------------------------------------------------------------
// Verifying view — arc spinner
// ---------------------------------------------------------------------------

class _VerifyingView extends StatelessWidget {
  const _VerifyingView({super.key});

  @override
  Widget build(BuildContext context) {
    return _DarkFullScreen(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(
            width: 56,
            height: 56,
            child: CircularProgressIndicator(
              color: Colors.white,
              strokeWidth: 2.5,
            ),
          ),
          const SizedBox(height: 28),
          Text(
            'Verifying…',
            style: AppTextStyles.titleMedium.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            'Checking your membership',
            style: AppTextStyles.bodyMedium.copyWith(
              color: Colors.white.withValues(alpha: 0.55),
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Handoff view — retailer context + pulse rings + "Sending approval…"
// ---------------------------------------------------------------------------

class _HandoffView extends StatelessWidget {
  const _HandoffView({
    super.key,
    required this.result,
    required this.pulseAnimation,
  });

  final VerificationSessionResult result;
  final Animation<double> pulseAnimation;

  @override
  Widget build(BuildContext context) {
    return _DarkFullScreen(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Pulse rings with retailer logo at center
          SizedBox(
            width: 120,
            height: 120,
            child: Stack(
              alignment: Alignment.center,
              children: [
                _PulseRing(animation: pulseAnimation, delay: 0.0, size: 110),
                _PulseRing(animation: pulseAnimation, delay: 0.5, size: 110),
                // Retailer logo or fallback store icon
                Container(
                  width: 60,
                  height: 60,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    shape: BoxShape.circle,
                  ),
                  child: ClipOval(
                    child: result.retailerLogoUrl != null
                        ? CachedNetworkImage(
                            imageUrl: result.retailerLogoUrl!,
                            fit: BoxFit.cover,
                            errorWidget: (_, __, ___) => const Icon(
                              Icons.store_outlined,
                              color: Colors.white,
                              size: 28,
                            ),
                          )
                        : const Icon(
                            Icons.store_outlined,
                            color: Colors.white,
                            size: 28,
                          ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),

          Text(
            'Sending approval…',
            style: AppTextStyles.titleMedium.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            result.retailerName,
            style: AppTextStyles.bodyMedium.copyWith(
              color: Colors.white.withValues(alpha: 0.65),
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          if (result.offerTitle != null) ...[
            const SizedBox(height: 4),
            Text(
              result.offerTitle!,
              style: AppTextStyles.bodyMedium.copyWith(
                color: Colors.white.withValues(alpha: 0.45),
                fontSize: 13,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PulseRing extends StatelessWidget {
  const _PulseRing({
    required this.animation,
    required this.delay,
    required this.size,
  });

  final Animation<double> animation;
  final double delay;
  final double size;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (_, __) {
        final t = (animation.value + delay) % 1.0;
        final scale = 0.35 + 0.65 * Curves.easeOut.transform(t);
        final opacity = 0.55 * (1 - t);
        return Transform.scale(
          scale: scale,
          child: Opacity(
            opacity: opacity,
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 1.5),
              ),
            ),
          ),
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Approved view — success circle + progressive checkmark + retailer context
// ---------------------------------------------------------------------------

class _ApprovedView extends StatelessWidget {
  const _ApprovedView({
    super.key,
    required this.result,
    required this.checkAnimation,
    required this.onDone,
  });

  final VerificationSessionResult result;
  final Animation<double> checkAnimation;
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return _DarkFullScreen(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          // Checkmark circle
          AnimatedBuilder(
            animation: checkAnimation,
            builder: (_, __) {
              return Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                  border: Border.all(color: AppColors.success, width: 2),
                ),
                child: CustomPaint(
                  painter: _CheckmarkPainter(
                    progress: CurvedAnimation(
                      parent: checkAnimation,
                      curve: const Interval(0.3, 1.0, curve: Curves.easeOut),
                    ).value,
                    color: AppColors.success,
                  ),
                ),
              );
            },
          ),

          const SizedBox(height: 28),

          Text(
            'Member Benefit Activated',
            style: AppTextStyles.headlineMedium.copyWith(
              color: Colors.white,
              fontSize: 22,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'Your discount has been applied at',
            style: AppTextStyles.bodyMedium.copyWith(
              color: Colors.white.withValues(alpha: 0.55),
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            result.retailerName,
            style: AppTextStyles.titleMedium.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
          if (result.offerTitle != null) ...[
            const SizedBox(height: 4),
            Text(
              result.offerTitle!,
              style: AppTextStyles.bodyMedium.copyWith(
                color: Colors.white.withValues(alpha: 0.45),
                fontSize: 13,
              ),
            ),
          ],

          const SizedBox(height: 40),

          SizedBox(
            width: 160,
            child: TextButton(
              onPressed: onDone,
              style: TextButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Colors.white38),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Done',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _CheckmarkPainter extends CustomPainter {
  const _CheckmarkPainter({required this.progress, required this.color});

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (progress == 0) return;

    final cx = size.width / 2;
    final cy = size.height / 2;
    const r = 20.0;

    final path = Path();
    path.moveTo(cx - r * 0.42, cy + r * 0.02);
    path.lineTo(cx - r * 0.05, cy + r * 0.42);
    path.lineTo(cx + r * 0.48, cy - r * 0.32);

    final metric = path.computeMetrics().first;
    final drawn = metric.extractPath(0, metric.length * progress);

    canvas.drawPath(
      drawn,
      Paint()
        ..style = PaintingStyle.stroke
        ..color = color
        ..strokeWidth = 3.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(covariant _CheckmarkPainter old) =>
      old.progress != progress;
}

// ---------------------------------------------------------------------------
// Rejected view — reason-specific message + shake + retry
// ---------------------------------------------------------------------------

class _RejectedView extends StatelessWidget {
  const _RejectedView({
    super.key,
    required this.reason,
    required this.message,
    required this.shakeAnimation,
    required this.onRetry,
    required this.onClose,
  });

  final OnlineRejectionReason reason;
  final String? message;
  final Animation<double> shakeAnimation;
  final VoidCallback onRetry;
  final VoidCallback onClose;

  String get _displayMessage => switch (reason) {
        OnlineRejectionReason.membershipInactive =>
          'Your membership is not active.\nRenew to access online benefits.',
        OnlineRejectionReason.sessionExpired =>
          'This session has expired.\nRefresh the checkout page and try again.',
        OnlineRejectionReason.sessionAlreadyConsumed =>
          'This discount has already been applied.',
        OnlineRejectionReason.sessionNotFound =>
          'Could not find this session.\nMake sure you\'re scanning a Better Off Local QR code.',
        OnlineRejectionReason.unknown =>
          message ?? 'Something went wrong.\nPlease try again.',
      };

  @override
  Widget build(BuildContext context) {
    return _DarkFullScreen(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          AnimatedBuilder(
            animation: shakeAnimation,
            builder: (_, child) {
              final shakeX = sin(shakeAnimation.value * pi * 5) *
                  12 *
                  (1 - shakeAnimation.value);
              return Transform.translate(
                offset: Offset(shakeX, 0),
                child: child,
              );
            },
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.error.withValues(alpha: 0.12),
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.error, width: 2),
              ),
              child: const Icon(Icons.close, color: AppColors.error, size: 32),
            ),
          ),

          const SizedBox(height: 28),

          Text(
            'Not approved',
            style: AppTextStyles.titleMedium.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              _displayMessage,
              style: AppTextStyles.bodyMedium.copyWith(
                color: Colors.white.withValues(alpha: 0.6),
                fontSize: 14,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ),

          const SizedBox(height: 36),

          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton(
                onPressed: onClose,
                style: TextButton.styleFrom(
                  foregroundColor: Colors.white54,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                ),
                child: const Text('Close'),
              ),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: onRetry,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Scan again',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Pending view — backend not yet deployed
// ---------------------------------------------------------------------------

class _PendingView extends StatelessWidget {
  const _PendingView({super.key, required this.onClose});

  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return _DarkFullScreen(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.qr_code_scanner_outlined,
            color: Colors.white38,
            size: 64,
          ),
          const SizedBox(height: 24),
          Text(
            'Online scanning coming soon',
            style: AppTextStyles.titleMedium.copyWith(color: Colors.white),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 48),
            child: Text(
              'The online checkout feature is being set up.\nCheck back soon.',
              style: AppTextStyles.bodyMedium.copyWith(
                color: Colors.white.withValues(alpha: 0.5),
                fontSize: 14,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 40),
          TextButton(
            onPressed: onClose,
            style: TextButton.styleFrom(
              foregroundColor: Colors.white54,
              side: const BorderSide(color: Colors.white24),
              padding:
                  const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Error view — unexpected failure
// ---------------------------------------------------------------------------

class _ErrorView extends StatelessWidget {
  const _ErrorView({
    super.key,
    required this.message,
    required this.onRetry,
    required this.onClose,
  });

  final String message;
  final VoidCallback onRetry;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    return _DarkFullScreen(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.wifi_off_outlined,
            color: Colors.white38,
            size: 56,
          ),
          const SizedBox(height: 24),
          Text(
            'Something went wrong',
            style: AppTextStyles.titleMedium.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 40),
            child: Text(
              message,
              style: AppTextStyles.bodyMedium.copyWith(
                color: Colors.white.withValues(alpha: 0.5),
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 36),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextButton(
                onPressed: onClose,
                style: TextButton.styleFrom(
                  foregroundColor: Colors.white38,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                ),
                child: const Text('Close'),
              ),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: onRetry,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Try again',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Shared scaffold wrapper — dark full-screen container
// ---------------------------------------------------------------------------

class _DarkFullScreen extends StatelessWidget {
  const _DarkFullScreen({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF0D1F17), // Very dark green — matches brand
      width: double.infinity,
      height: double.infinity,
      child: SafeArea(child: child),
    );
  }
}
