/// Thrown by [RedemptionsRemoteDataSource] when the server rejects a token
/// request with a structured error body.
///
/// [errorCode] is the machine-readable `error_code` field from the response
/// (e.g. `'membership_required'`). It is the primary signal for friendly-copy
/// mapping in [RedemptionController]. [message] is the raw server message and
/// serves as a fallback only.
class RedemptionException implements Exception {
  const RedemptionException({
    required this.message,
    required this.statusCode,
    this.errorCode,
  });

  final String message;
  final int statusCode;

  /// Machine-readable code from the server's `error_code` field.
  /// Null when the server returned an unstructured error or the field was absent.
  final String? errorCode;

  @override
  String toString() => message;
}
