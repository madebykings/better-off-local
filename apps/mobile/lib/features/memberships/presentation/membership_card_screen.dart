import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/membership_providers.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/error_state.dart';

class MembershipCardScreen extends ConsumerWidget {
  const MembershipCardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final membership = ref.watch(currentMembershipProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My Card')),
      body: membership.when(
        loading: () => const LoadingIndicator(),
        error: (e, _) => ErrorState(message: e.toString()),
        data: (m) {
          if (m == null || !m.isActive) {
            // TODO: show paywall prompt
            return const Center(child: Text('TODO: show paywall prompt'));
          }
          // TODO: implement membership card UI with QR code
          return const Center(child: Text('TODO: Membership card UI'));
        },
      ),
    );
  }
}
