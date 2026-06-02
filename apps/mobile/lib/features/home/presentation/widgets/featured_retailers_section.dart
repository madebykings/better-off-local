import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../retailers/presentation/widgets/business_card.dart';
import '../../home_providers.dart';

class FeaturedRetailersSection extends ConsumerWidget {
  const FeaturedRetailersSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final retailersAsync = ref.watch(homeRetailersProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: SectionHeader(
            title: 'Trending near you',
            action: TextButton(
              onPressed: () => context.go(RouteNames.explore),
              child: Text(
                'See all',
                style: AppTextStyles.labelSmall.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 218,
          child: retailersAsync.when(
            loading: () =>
                const Center(child: CircularProgressIndicator()),
            error: (_, __) =>
                const Center(child: Text('Unable to load retailers')),
            data: (retailers) {
              if (retailers.isEmpty) {
                return const Center(
                  child: Text(
                    'No retailers yet',
                    style: AppTextStyles.bodyMedium,
                  ),
                );
              }
              final shown = retailers.take(8).toList();
              return ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: shown.length,
                itemBuilder: (context, i) => Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: BusinessCard(
                    retailer: shown[i],
                    badge: 'Trending',
                    onTap: () => context.push(
                      RouteNames.retailerDetail
                          .replaceAll(':retailerId', shown[i].id),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
