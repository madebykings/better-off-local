import 'package:flutter/material.dart';

class RedemptionConfirmationScreen extends StatelessWidget {
  const RedemptionConfirmationScreen({super.key});

  @override
  Widget build(BuildContext context) {
    // TODO: implement redemption success state (show outcome from server)
    return Scaffold(
      appBar: AppBar(title: const Text('Redeemed!')),
      body: const Center(child: Text('TODO: Redemption confirmation')),
    );
  }
}
