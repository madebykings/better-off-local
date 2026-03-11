import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:better_off_local/features/auth/domain/auth_repository.dart';
import 'package:better_off_local/features/auth/domain/auth_state.dart';
import 'package:better_off_local/features/auth/presentation/auth_controller.dart';
import 'package:better_off_local/features/auth/providers/auth_providers.dart';

class MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  late MockAuthRepository mockRepository;
  late ProviderContainer container;

  setUp(() {
    mockRepository = MockAuthRepository();
    container = ProviderContainer(
      overrides: [
        authRepositoryProvider.overrideWithValue(mockRepository),
      ],
    );
    addTearDown(container.dispose);
  });

  group('AuthController', () {
    test('initial state is AuthInitial', () {
      expect(
        container.read(authControllerProvider),
        isA<AuthInitial>(),
      );
    });

    group('signIn', () {
      test('emits AuthLoading then returns to initial on success', () async {
        when(() => mockRepository.signInWithEmail(any(), any()))
            .thenAnswer((_) async {});

        final states = <AuthState>[];
        final sub = container.listen(
          authControllerProvider,
          (_, next) => states.add(next),
          fireImmediately: false,
        );

        await container
            .read(authControllerProvider.notifier)
            .signIn('user@example.com', 'password123');

        // Loading → back to AuthInitial (session stream drives the authenticated state)
        expect(states, [isA<AuthLoading>(), isA<AuthInitial>()]);
        sub.close();
      });

      test('emits AuthError on failure', () async {
        when(() => mockRepository.signInWithEmail(any(), any()))
            .thenThrow(Exception('network error'));

        final states = <AuthState>[];
        final sub = container.listen(
          authControllerProvider,
          (_, next) => states.add(next),
          fireImmediately: false,
        );

        await container
            .read(authControllerProvider.notifier)
            .signIn('user@example.com', 'wrong');

        expect(states, [isA<AuthLoading>(), isA<AuthError>()]);
        sub.close();
      });

      test('AuthError contains a non-empty message', () async {
        when(() => mockRepository.signInWithEmail(any(), any()))
            .thenThrow(Exception('boom'));

        await container
            .read(authControllerProvider.notifier)
            .signIn('user@example.com', 'x');

        final state = container.read(authControllerProvider);
        expect(state, isA<AuthError>());
        expect((state as AuthError).message, isNotEmpty);
      });
    });

    group('signUp', () {
      test('emits AuthLoading then back to initial on success', () async {
        when(() => mockRepository.signUpWithEmail(any(), any()))
            .thenAnswer((_) async {});

        final states = <AuthState>[];
        final sub = container.listen(
          authControllerProvider,
          (_, next) => states.add(next),
          fireImmediately: false,
        );

        await container
            .read(authControllerProvider.notifier)
            .signUp('new@example.com', 'password123');

        expect(states, [isA<AuthLoading>(), isA<AuthInitial>()]);
        sub.close();
      });

      test('emits AuthError on failure', () async {
        when(() => mockRepository.signUpWithEmail(any(), any()))
            .thenThrow(Exception('already registered'));

        await container
            .read(authControllerProvider.notifier)
            .signUp('existing@example.com', 'password123');

        expect(container.read(authControllerProvider), isA<AuthError>());
      });
    });

    group('sendPasswordReset', () {
      test('emits AuthUnauthenticated on success', () async {
        when(() => mockRepository.sendPasswordResetEmail(any()))
            .thenAnswer((_) async {});

        await container
            .read(authControllerProvider.notifier)
            .sendPasswordReset('user@example.com');

        expect(
          container.read(authControllerProvider),
          isA<AuthUnauthenticated>(),
        );
      });
    });

    group('signOut', () {
      test('emits AuthUnauthenticated', () async {
        when(() => mockRepository.signOut()).thenAnswer((_) async {});

        await container.read(authControllerProvider.notifier).signOut();

        expect(
          container.read(authControllerProvider),
          isA<AuthUnauthenticated>(),
        );
      });
    });
  });
}
