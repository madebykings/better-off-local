import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ForgotPasswordScreen extends ConsumerWidget {
  const ForgotPasswordScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement password reset form
    return Scaffold(
      appBar: AppBar(title: const Text('Reset password')),
      body: const Center(
        child: Text('TODO: Forgot Password screen'),
      ),
    );
  }
}
