import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class SignUpScreen extends ConsumerWidget {
  const SignUpScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement sign-up form
    return Scaffold(
      appBar: AppBar(title: const Text('Create account')),
      body: const Center(
        child: Text('TODO: Sign Up screen'),
      ),
    );
  }
}
