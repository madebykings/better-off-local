import 'package:equatable/equatable.dart';

sealed class AuthState extends Equatable {
  const AuthState();
  @override
  List<Object?> get props => [];
}

class AuthInitial extends AuthState {
  const AuthInitial();
}

class AuthLoading extends AuthState {
  const AuthLoading();
}

class AuthAuthenticated extends AuthState {
  const AuthAuthenticated(this.userId);
  final String userId;
  @override
  List<Object?> get props => [userId];
}

class AuthUnauthenticated extends AuthState {
  const AuthUnauthenticated();
}

class AuthEmailConfirmationSent extends AuthState {
  const AuthEmailConfirmationSent(this.email);
  final String email;
  @override
  List<Object?> get props => [email];
}

class AuthError extends AuthState {
  const AuthError(this.message);
  final String message;
  @override
  List<Object?> get props => [message];
}
