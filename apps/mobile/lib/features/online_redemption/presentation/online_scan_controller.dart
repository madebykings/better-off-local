import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/verification_session_result.dart';
import '../providers/online_redemption_providers.dart';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

sealed class OnlineScanState {
  const OnlineScanState();
}

/// Camera is active and ready to scan.
class OnlineScanReady extends OnlineScanState {
  const OnlineScanReady();
}

/// A QR was detected; 300 ms grace period before the API call fires.
/// Keeps the scanner frozen to prevent re-scanning.
class OnlineScanDetected extends OnlineScanState {
  const OnlineScanDetected(this.rawToken);
  final String rawToken;
}

/// API call in flight. Camera is stopped.
class OnlineScanVerifying extends OnlineScanState {
  const OnlineScanVerifying(this.rawToken);
  final String rawToken;
}

/// Server approved the session. ~600 ms intermediate state showing retailer
/// context and a "Sending approval…" animation before full success screen.
class OnlineScanHandoff extends OnlineScanState {
  const OnlineScanHandoff(this.result);
  final VerificationSessionResult result;
}

/// Verification complete — member benefit activated.
class OnlineScanApproved extends OnlineScanState {
  const OnlineScanApproved(this.result);
  final VerificationSessionResult result;
}

/// Server rejected the session (membership inactive, expired, etc.).
class OnlineScanRejected extends OnlineScanState {
  const OnlineScanRejected({required this.reason, this.message});
  final OnlineRejectionReason reason;
  final String? message;
}

/// Backend edge function not yet deployed — expected, non-breaking.
/// The scan screen shows a clean placeholder; no retry is needed.
class OnlineScanPending extends OnlineScanState {
  const OnlineScanPending();
}

/// Unexpected error (network, auth, parse, etc.). Can be retried.
class OnlineScanError extends OnlineScanState {
  const OnlineScanError(this.message);
  final String message;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

/// UUID v4 pattern — validates that a scanned QR contains a BOL session token.
/// Prevents spurious API calls from accidentally scanned non-BOL QR codes.
final _uuidV4 = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
  caseSensitive: false,
);

class OnlineScanController extends StateNotifier<OnlineScanState> {
  OnlineScanController(this._ref) : super(const OnlineScanReady());

  final Ref _ref;
  Timer? _detectedTimer;
  Timer? _handoffTimer;

  /// Called by [MobileScanner] when a barcode is detected.
  ///
  /// Validates that [raw] is a UUID v4 before proceeding — non-BOL QR codes
  /// are silently ignored so the scanner keeps running.
  ///
  /// Valid tokens trigger a 300 ms [OnlineScanDetected] pause (visual
  /// confirmation the QR was seen) before calling [_verify].
  void onQRDetected(String raw) {
    // Only respond when actively scanning.
    if (state is! OnlineScanReady) return;

    final trimmed = raw.trim();
    if (!_uuidV4.hasMatch(trimmed)) return; // Not a BOL session token.

    state = OnlineScanDetected(trimmed);
    _detectedTimer = Timer(
      const Duration(milliseconds: 300),
      () => _verify(trimmed),
    );
  }

  Future<void> _verify(String sessionToken) async {
    state = OnlineScanVerifying(sessionToken);

    try {
      final result = await _ref
          .read(onlineRedemptionRepositoryProvider)
          .approveSession(sessionToken);

      // Handoff: brief animation before showing full success.
      state = OnlineScanHandoff(result);
      _handoffTimer = Timer(
        const Duration(milliseconds: 600),
        () => _completeHandoff(result),
      );
    } on UnimplementedError {
      // Backend edge function not yet deployed — expected, non-breaking.
      state = const OnlineScanPending();
    } catch (e) {
      final message = e.toString().replaceFirst('Exception: ', '');
      final reason = _parseRejectionReason(message);

      // Known rejection reasons (membership inactive, expired, etc.) use the
      // structured Rejected state. Truly unexpected failures use Error.
      if (reason != OnlineRejectionReason.unknown) {
        state = OnlineScanRejected(reason: reason, message: message);
      } else {
        state = OnlineScanError(message);
      }
    }
  }

  void _completeHandoff(VerificationSessionResult result) {
    state = OnlineScanApproved(result);
  }

  /// Reset scanner back to [OnlineScanReady] for retry after rejection or error.
  void reset() {
    _detectedTimer?.cancel();
    _handoffTimer?.cancel();
    state = const OnlineScanReady();
  }

  @override
  void dispose() {
    _detectedTimer?.cancel();
    _handoffTimer?.cancel();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  static OnlineRejectionReason _parseRejectionReason(String message) {
    final lower = message.toLowerCase();
    if (lower.contains('membership') ||
        lower.contains('not active') ||
        lower.contains('inactive') ||
        lower.contains('no active')) {
      return OnlineRejectionReason.membershipInactive;
    }
    if (lower.contains('expired')) return OnlineRejectionReason.sessionExpired;
    if (lower.contains('consumed') ||
        lower.contains('already used') ||
        lower.contains('already approved')) {
      return OnlineRejectionReason.sessionAlreadyConsumed;
    }
    if (lower.contains('not found') ||
        lower.contains('invalid session') ||
        lower.contains('no session')) {
      return OnlineRejectionReason.sessionNotFound;
    }
    return OnlineRejectionReason.unknown;
  }
}

final onlineScanControllerProvider =
    StateNotifierProvider.autoDispose<OnlineScanController, OnlineScanState>(
  (ref) => OnlineScanController(ref),
);
