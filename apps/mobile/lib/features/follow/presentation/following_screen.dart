import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../providers/retailer_follows_providers.dart';

class FollowingScreen extends ConsumerWidget {
  const FollowingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final retailersAsync = ref.watch(followedRetailersProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Following')),
      body: retailersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (_, __) =>
            const Center(child: Text('Unable to load followed partners')),
        data: (rows) {
          if (rows.isEmpty) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.notifications_outlined,
                        size: 48, color: AppColors.textDisabled),
                    SizedBox(height: 16),
                    Text(
                      'Not following any local partners yet',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPrimary,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Follow a local partner from its profile page to get notified when new offers go live.',
                      style: TextStyle(
                          fontSize: 13, color: AppColors.textSecondary),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.symmetric(vertical: 8),
            itemCount: rows.length,
            separatorBuilder: (_, __) =>
                const Divider(height: 1, indent: 72, endIndent: 0),
            itemBuilder: (context, i) {
              final row = rows[i];
              final retailer =
                  row['retailers'] as Map<String, dynamic>? ?? {};
              final retailerId = retailer['id'] as String? ??
                  row['retailer_id'] as String;
              final name = retailer['name'] as String? ?? '';
              final logoUrl = retailer['logo_url'] as String?;
              final shortDesc = retailer['short_description'] as String?;
              final followedIds = ref.watch(followedRetailerIdsProvider);
              final isFollowing = followedIds.contains(retailerId);

              return ListTile(
                leading: _RetailerLogo(logoUrl: logoUrl),
                title: Text(
                  name,
                  style: AppTextStyles.titleMedium.copyWith(fontSize: 15),
                ),
                subtitle: shortDesc != null
                    ? Text(
                        shortDesc,
                        style: AppTextStyles.bodyMedium.copyWith(fontSize: 12),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      )
                    : null,
                trailing: SizedBox(
                  width: 84,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      side: BorderSide(
                        color: isFollowing
                            ? AppColors.textDisabled
                            : AppColors.primary,
                      ),
                      foregroundColor: isFollowing
                          ? AppColors.textSecondary
                          : AppColors.primary,
                    ),
                    onPressed: () => toggleRetailerFollow(
                        ref, retailerId, isFollowing, context),
                    child: Text(
                      isFollowing ? 'Following' : 'Follow',
                      style: const TextStyle(fontSize: 12),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
                onTap: () => context.push(
                  RouteNames.retailerDetail
                      .replaceAll(':retailerId', retailerId),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _RetailerLogo extends StatelessWidget {
  const _RetailerLogo({required this.logoUrl});

  final String? logoUrl;

  @override
  Widget build(BuildContext context) {
    if (logoUrl != null && logoUrl!.isNotEmpty) {
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.network(
          logoUrl!,
          width: 44,
          height: 44,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _placeholder,
        ),
      );
    }
    return _placeholder;
  }

  Widget get _placeholder => Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: AppColors.primaryLight,
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Icon(Icons.storefront_outlined,
            color: Colors.white, size: 22),
      );
}
