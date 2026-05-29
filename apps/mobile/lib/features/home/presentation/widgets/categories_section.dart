import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/router/route_names.dart';
import '../../../../app/theme/app_colors.dart';
import '../../../../app/theme/app_text_styles.dart';
import '../../../../core/widgets/brand_logo.dart';
import '../../../../core/widgets/section_header.dart';
import '../../../offers/providers/offers_providers.dart';

class CategoriesSection extends ConsumerWidget {
  const CategoriesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categoriesAsync = ref.watch(categoriesProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20),
          child: SectionHeader(title: 'Browse by category'),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 82,
          child: categoriesAsync.when(
            loading: () => const SizedBox.shrink(),
            error: (_, __) => const SizedBox.shrink(),
            data: (categories) => ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              itemCount: categories.length,
              itemBuilder: (context, i) {
                final cat = categories[i];
                return Padding(
                  padding: const EdgeInsets.only(right: 10),
                  child: GestureDetector(
                    onTap: () {
                      ref.read(selectedCategoryProvider.notifier).state =
                          cat.id;
                      context.go(RouteNames.explore);
                    },
                    child: Container(
                      width: 72,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.06),
                            blurRadius: 6,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _categoryIconWidget(cat.name),
                          const SizedBox(height: 6),
                          Text(
                            _labelForCategory(cat.name),
                            style: AppTextStyles.labelSmall.copyWith(
                              fontSize: 10,
                              letterSpacing: 0,
                              color: AppColors.textPrimary,
                            ),
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
            ),
          ),
        ),
      ],
    );
  }
}

/// Returns a sized icon widget for the given category name.
/// Named categories use a tinted Material icon; unrecognised categories
/// show the Better Off Local icon mark so the tile still looks on-brand.
Widget _categoryIconWidget(String name) {
  final icon = _iconForCategory(name);
  if (icon != null) {
    return Icon(icon, color: AppColors.primary, size: 22);
  }
  return const BrandLogo(
    variant: BrandLogoVariant.icon,
    scheme: BrandLogoScheme.light,
    height: 22,
  );
}

IconData? _iconForCategory(String name) {
  final n = name.toLowerCase();
  if (n.contains('coffee') || n.contains('cafe') || n.contains('café')) {
    return Icons.coffee;
  }
  if (n.contains('food') || n.contains('restaurant') || n.contains('eat') ||
      n.contains('dining')) {
    return Icons.restaurant;
  }
  if (n.contains('bar') || n.contains('pub') || n.contains('drink') ||
      n.contains('beer') || n.contains('wine') || n.contains('cocktail')) {
    return Icons.sports_bar;
  }
  if (n.contains('health') || n.contains('wellbeing') ||
      n.contains('wellness')) {
    return Icons.favorite_border;
  }
  if (n.contains('fitness') || n.contains('gym') || n.contains('sport')) {
    return Icons.fitness_center;
  }
  if (n.contains('beauty') || n.contains('hair') || n.contains('salon') ||
      n.contains('spa') || n.contains('nail')) {
    return Icons.spa;
  }
  if (n.contains('shop') || n.contains('retail') || n.contains('boutique') ||
      n.contains('cloth')) {
    return Icons.shopping_bag_outlined;
  }
  if (n.contains('family') || n.contains('kid') || n.contains('child') ||
      n.contains('baby')) {
    return Icons.child_care;
  }
  if (n.contains('entertain') || n.contains('leisure') || n.contains('fun') ||
      n.contains('activit')) {
    return Icons.local_activity;
  }
  if (n.contains('trade') || n.contains('service') || n.contains('repair')) {
    return Icons.build_outlined;
  }
  if (n.contains('pet')) {
    return Icons.pets;
  }
  return null; // unrecognised → BrandLogo icon mark
}

/// Shorten long category names for the tile label.
String _labelForCategory(String name) {
  if (name.length <= 9) return name;
  final first = name.split(' ').first;
  if (first.length <= 9) return first;
  return '${name.substring(0, 8)}…';
}
