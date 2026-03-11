import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../core/widgets/primary_button.dart';
import 'auth_controller.dart';

class SignInScreen extends ConsumerWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // TODO: implement sign-in form with email + password fields
    return Scaffold(
      appBar: AppBar(title: const Text('Sign in')),
      body: const Center(
        child: Text('TODO: Sign In screen'),
      ),
    );
  }
}
