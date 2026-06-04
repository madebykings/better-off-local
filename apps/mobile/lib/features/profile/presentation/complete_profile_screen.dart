import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart' show HttpMethod;

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_spacing.dart';
import '../../../core/constants/storage_keys.dart';
import '../../../core/providers/supabase_provider.dart';
import '../../../core/widgets/primary_button.dart';
import 'profile_controller.dart';

class CompleteProfileScreen extends ConsumerStatefulWidget {
  const CompleteProfileScreen({super.key});

  @override
  ConsumerState<CompleteProfileScreen> createState() =>
      _CompleteProfileScreenState();
}

class _CompleteProfileScreenState extends ConsumerState<CompleteProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _tryAttributeReferral(WidgetRef ref) async {
    const storage = FlutterSecureStorage();
    try {
      final code = await storage.read(key: StorageKeys.pendingReferralCode);
      if (code == null || code.isEmpty) return;

      final client = ref.read(supabaseClientProvider);
      await client.functions.invoke(
        'attribute-referral',
        method: HttpMethod.post,
        body: {'code': code},
      );
      await storage.delete(key: StorageKeys.pendingReferralCode);
      debugPrint('[referral] attribution attempted for code: $code');
    } catch (e) {
      debugPrint('[referral] attribution error (non-fatal): $e');
    }
  }

  Future<void> _tryAttributeVenueReferral(WidgetRef ref) async {
    const storage = FlutterSecureStorage();
    try {
      final token =
          await storage.read(key: StorageKeys.pendingVenueReferralToken);
      if (token == null || token.isEmpty) return;

      final client = ref.read(supabaseClientProvider);
      final profileId = client.auth.currentUser?.id;
      if (profileId == null) return;

      await client.rpc('attribute_venue_referral', params: {
        'p_token': token,
        'p_invitee_profile_id': profileId,
      });
      await storage.delete(key: StorageKeys.pendingVenueReferralToken);
      debugPrint('[referral] venue referral attributed for token: $token');
    } catch (e) {
      debugPrint('[referral] venue referral attribution error (non-fatal): $e');
    }
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    await ref
        .read(profileControllerProvider.notifier)
        .completeProfile(fullName: _nameController.text);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profileControllerProvider);
    final isLoading = state is ProfileUpdateLoading;

    ref.listen<ProfileUpdateState>(profileControllerProvider, (_, next) {
      if (next is ProfileUpdateError) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(next.message)),
        );
      }
      if (next is ProfileUpdateSuccess) {
        // Attribute any pending deep-link referrals captured before sign-up.
        _tryAttributeReferral(ref);
        _tryAttributeVenueReferral(ref);
        // Router redirect will detect profile is now complete and navigate to home.
        context.go(RouteNames.home);
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Complete your profile')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: AppSpacing.lg),
                Text(
                  'What should we call you?',
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Your name is displayed on your membership card.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.xl),
                TextFormField(
                  controller: _nameController,
                  enabled: !isLoading,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Full name',
                    hintText: 'e.g. Alex Smith',
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) {
                      return 'Please enter your name';
                    }
                    if (v.trim().length < 2) {
                      return 'Name must be at least 2 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: AppSpacing.xl),
                PrimaryButton(
                  label: 'Continue',
                  isLoading: isLoading,
                  onPressed: _submit,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
