import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/widgets/loading_indicator.dart';
import '../../../core/widgets/primary_button.dart';
import '../domain/region.dart';
import '../providers/region_providers.dart';

/// Mandatory region selection shown during onboarding and accessible from
/// Account settings. Members without a region are gated here by the router.
class RegionSelectionScreen extends ConsumerStatefulWidget {
  const RegionSelectionScreen({super.key, this.isOnboarding = true});

  /// When true, navigates to home on completion.
  /// When false (from account settings), pops instead.
  final bool isOnboarding;

  @override
  ConsumerState<RegionSelectionScreen> createState() =>
      _RegionSelectionScreenState();
}

class _RegionSelectionScreenState extends ConsumerState<RegionSelectionScreen> {
  String? _selectedId;
  bool _saving = false;

  Future<void> _save() async {
    final session = ref.read(sessionProvider).valueOrNull;
    if (_selectedId == null || session == null) return;

    setState(() => _saving = true);
    try {
      await ref.read(regionDataSourceProvider).setRegion(
            profileId: session.user.id,
            regionId: _selectedId!,
          );
      // Invalidate profile so router redirect re-evaluates
      ref.invalidate(sessionProvider);
      if (mounted) {
        if (widget.isOnboarding) {
          context.go(RouteNames.home);
        } else {
          context.pop();
        }
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not save region. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final regionsAsync = ref.watch(activeRegionsProvider);

    return Scaffold(
      backgroundColor: AppColors.cream,
      appBar: widget.isOnboarding
          ? null
          : AppBar(
              backgroundColor: AppColors.cream,
              elevation: 0,
              title: const Text('Change region'),
            ),
      body: SafeArea(
        child: regionsAsync.when(
          loading: () => const LoadingIndicator(),
          error: (_, __) => Center(
            child: Text('Could not load regions.', style: AppTextStyles.bodyMedium),
          ),
          data: (regions) => _RegionBody(
            regions: regions,
            selectedId: _selectedId,
            saving: _saving,
            isOnboarding: widget.isOnboarding,
            onSelect: (id) => setState(() => _selectedId = id),
            onSave: _save,
          ),
        ),
      ),
    );
  }
}

class _RegionBody extends StatelessWidget {
  const _RegionBody({
    required this.regions,
    required this.selectedId,
    required this.saving,
    required this.isOnboarding,
    required this.onSelect,
    required this.onSave,
  });

  final List<Region> regions;
  final String? selectedId;
  final bool saving;
  final bool isOnboarding;
  final ValueChanged<String> onSelect;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (isOnboarding) ...[
            const SizedBox(height: 16),
            Text('Where are you based?', style: AppTextStyles.headlineMedium),
            const SizedBox(height: 8),
            Text(
              'Select your area so we can show you local offers and keep you updated on your community\'s progress.',
              style: AppTextStyles.bodyMedium.copyWith(color: AppColors.textSecondary),
            ),
            const SizedBox(height: 32),
          ],

          Expanded(
            child: ListView.separated(
              itemCount: regions.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final r = regions[i];
                final selected = r.id == selectedId;
                return GestureDetector(
                  onTap: () => onSelect(r.id),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: selected
                          ? AppColors.primary.withValues(alpha: 0.08)
                          : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: selected ? AppColors.primary : AppColors.border,
                        width: selected ? 2 : 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 22,
                          height: 22,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: selected ? AppColors.primary : AppColors.border,
                              width: 2,
                            ),
                            color: selected
                                ? AppColors.primary
                                : Colors.transparent,
                          ),
                          child: selected
                              ? const Icon(Icons.check,
                                  size: 13, color: Colors.white)
                              : null,
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(r.name,
                                  style: AppTextStyles.titleMedium.copyWith(
                                    color: selected
                                        ? AppColors.primary
                                        : AppColors.textPrimary,
                                  )),
                              Text(
                                'Scotland',
                                style: AppTextStyles.bodyMedium.copyWith(
                                  fontSize: 12,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (selected)
                          const Icon(Icons.location_on,
                              color: AppColors.primary, size: 18),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),

          const SizedBox(height: 16),
          PrimaryButton(
            label: saving
                ? 'Saving…'
                : (isOnboarding ? 'Continue' : 'Save region'),
            enabled: selectedId != null && !saving,
            isLoading: saving,
            onPressed: onSave,
          ),
        ],
      ),
    );
  }
}
