import 'package:equatable/equatable.dart';

/// Failure is a value-type representation of an error used at the domain layer.
sealed class Failure extends Equatable {
  const Failure(this.message);
  final String message;

  @override
  List<Object?> get props => [message];
}

class NetworkFailure extends Failure {
  const NetworkFailure([super.message = 'No internet connection']);
}

class AuthFailure extends Failure {
  const AuthFailure([super.message = 'Authentication failed']);
}

class ServerFailure extends Failure {
  const ServerFailure([super.message = 'Server error']);
}

class NotFoundFailure extends Failure {
  const NotFoundFailure([super.message = 'Not found']);
}

class MembershipFailure extends Failure {
  const MembershipFailure([super.message = 'Active membership required']);
}
