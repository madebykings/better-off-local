/// Base exception type for all app-level errors.
sealed class AppException implements Exception {
  const AppException(this.message);
  final String message;

  @override
  String toString() => '$runtimeType: $message';
}

class NetworkException extends AppException {
  const NetworkException([super.message = 'No internet connection']);
}

class AuthException extends AppException {
  const AuthException([super.message = 'Authentication failed']);
}

class ApiException extends AppException {
  const ApiException(super.message, {this.statusCode});
  final int? statusCode;
}

class NotFoundException extends AppException {
  const NotFoundException([super.message = 'Resource not found']);
}

class UnauthorisedException extends AppException {
  const UnauthorisedException([super.message = 'Unauthorised']);
}

class MembershipRequiredException extends AppException {
  const MembershipRequiredException(
      [super.message = 'Active membership required']);
}
