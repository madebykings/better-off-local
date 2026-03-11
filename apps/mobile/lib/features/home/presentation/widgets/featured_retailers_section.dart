import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../retailers/providers/retailer_providers.dart';

class FeaturedRetailersSection extends ConsumerWidget {
  const FeaturedRetailersSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final retailersAsync = ref.watch(liveRetailersProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16),
          child: SectionHeader(title: 'Local retailers'),
        ),
        const SizedBox(height: 8),
        SizedBox(
          height: 100,
          child: retailersAsync.when(
            loading: () =>
                const Center(child: CircularProgressIndicator()),
            error: (_, __) =>
                const Center(child: Text('Unable to load retailers')),
            data: (retailers) {
              if (retailers.isEmpty) {
                return const Center(
                  child: Text('No retailers yet',
                      style: TextStyle(color: Color(0xFF6C757D))),
                );
              }
              final shown = retailers.take(8).toList();
              return ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: shown.length,
                itemBuilder: (context, i) {
                  final r = shown[i];
                  return Padding(
                    padding: const EdgeInsets.only(right: 12),
                    child: GestureDetector(
                      onTap: () => context.push(
                        RouteNames.retailerDetail
                            .replaceAll(':retailerId', r.id),
                      ),
                      child: SizedBox(
                        width: 80,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 56,
                              height: 56,
                              decoration: BoxDecoration(
                                color: AppColors.background,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                    color: AppColors.border),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: r.logoUrl != null
                                  ? Image.network(r.logoUrl!,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) =>
                                          const Icon(
                                              Icons.storefront_outlined,
                                              size: 28,
                                              color: AppColors.border))
                                  : const Icon(Icons.storefront_outlined,
                                      size: 28, color: AppColors.border),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              r.name,
                              style:
                                  AppTextStyles.labelSmall.copyWith(
                                      fontSize: 10),
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
