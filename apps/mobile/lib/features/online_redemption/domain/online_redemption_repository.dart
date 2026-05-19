import 'verification_session_result.dart';

abstract class OnlineRedemptionRepository {
  /// Approve a verification session initiated on the retailer website.
  ///
  /// [sessionToken] is the UUID extracted from the QR code scanned by the
  /// consumer. The server:
  ///
  /// 1. Looks up the session by token
  /// 2. Validates the consumer has an active/trialing membership
  /// 3. Atomically updates status to 'approved' (WHERE status = 'pending')
  /// 4. Returns retailer context for the confirmation screen
  ///
  /// Throws [Exception] with a descriptive message on any server-side
  /// rejection (membership inactive, session expired, already consumed, etc.).
  ///
  /// TODO: Implement the `approve-verification-session` Supabase edge function.
  /// Until then, implementations throw [UnimplementedError].
  Future<VerificationSessionResult> approveSession(String sessionToken);
}
