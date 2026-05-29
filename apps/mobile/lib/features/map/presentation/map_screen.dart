import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../app/router/route_names.dart';
import '../../../app/theme/app_colors.dart';
import '../../../app/theme/app_text_styles.dart';
import '../../../core/config/env.dart';
import '../../../core/providers/analytics_provider.dart';
import '../../../core/providers/location_provider.dart';
import '../../../core/providers/session_provider.dart';
import '../../../features/retailers/domain/retailer.dart';
import '../providers/map_providers.dart';
import 'widgets/map_offer_preview_card.dart';

// ── Default camera: centre of Clackmannanshire ───────────────────────────────

const _kDefaultCamera = CameraPosition(
  target: LatLng(56.116, -3.752),
  zoom: 11.5,
);

// ── Screen ────────────────────────────────────────────────────────────────────

class MapScreen extends ConsumerStatefulWidget {
  const MapScreen({super.key});

  @override
  ConsumerState<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends ConsumerState<MapScreen> {
  GoogleMapController? _mapController;
  final _sheetController = DraggableScrollableController();
  final _searchController = TextEditingController();
  bool _hasFitBounds = false;
  bool _mapCreated = false;
  bool _cameraMoved = false;

  @override
  void initState() {
    super.initState();
    debugPrint('[MAP KEY] Dart env value=${Env.googleMapsApiKey.isEmpty ? "MISSING" : "present (${Env.googleMapsApiKey.length} chars)"}');
    WidgetsBinding.instance.addPostFrameCallback((_) {
      // Check permission without prompting.
      ref.read(locationNotifierProvider.notifier).init();
      // Analytics: map viewed.
      final session = ref.read(sessionProvider).valueOrNull;
      ref
          .read(discoveryAnalyticsProvider)
          .logMapViewed(session?.user.id);
    });
  }

  @override
  void dispose() {
    _mapController?.dispose();
    _sheetController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  // ── Fit all marker bounds ────────────────────────────────────────────────

  void _fitMarkers(List<Retailer> retailers) {
    final mc = _mapController;
    if (mc == null || retailers.isEmpty) return;

    var minLat = retailers.first.latitude!;
    var maxLat = retailers.first.latitude!;
    var minLon = retailers.first.longitude!;
    var maxLon = retailers.first.longitude!;

    for (final r in retailers) {
      if (r.latitude! < minLat) minLat = r.latitude!;
      if (r.latitude! > maxLat) maxLat = r.latitude!;
      if (r.longitude! < minLon) minLon = r.longitude!;
      if (r.longitude! > maxLon) maxLon = r.longitude!;
    }

    const pad = 0.015;
    mc.animateCamera(
      CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(minLat - pad, minLon - pad),
          northeast: LatLng(maxLat + pad, maxLon + pad),
        ),
        72,
      ),
    );
  }

  void _animateToLocation() {
    final pos = ref.read(locationProvider);
    if (pos == null) return;
    _mapController?.animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(target: LatLng(pos.latitude, pos.longitude), zoom: 14),
      ),
    );
  }

  // ── Marker set ───────────────────────────────────────────────────────────

  Set<Marker> _buildMarkers(
    List<Retailer> retailers,
    String? selectedId,
    String? profileId,
  ) {
    debugPrint('[MAP] Building ${retailers.length} markers');
    return {
      for (final r in retailers)
        Marker(
          markerId: MarkerId(r.id),
          position: LatLng(r.latitude!, r.longitude!),
          icon: r.id == selectedId
              ? BitmapDescriptor.defaultMarkerWithHue(
                  BitmapDescriptor.hueOrange)
              : BitmapDescriptor.defaultMarkerWithHue(
                  BitmapDescriptor.hueGreen),
          infoWindow: InfoWindow(title: r.name),
          onTap: () {
            ref.read(mapControllerProvider.notifier).selectRetailer(r.id);
            ref.read(discoveryAnalyticsProvider).logMarkerOpened(
                  profileId,
                  r.id,
                );
          },
        ),
    };
  }

  // ── Build ────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final locationState = ref.watch(locationNotifierProvider);
    final retailers = ref.watch(mapRetailersProvider);
    final retailersLoadState = ref.watch(mapRetailersLoadStateProvider);
    final selectedRetailer = ref.watch(selectedMapRetailerProvider);
    final mapState = ref.watch(mapControllerProvider);
    final session = ref.watch(sessionProvider).valueOrNull;
    final profileId = session?.user.id;

    // Fit bounds once when retailers first load.
    ref.listen<List<Retailer>>(mapRetailersProvider, (_, next) {
      if (!_hasFitBounds && next.isNotEmpty && _mapController != null) {
        _hasFitBounds = true;
        _fitMarkers(next);
      }
    });

    // Expand sheet when a marker is selected.
    ref.listen<String?>(
      mapControllerProvider.select((s) => s.selectedRetailerId),
      (prev, next) {
        if (next != null && next != prev) {
          _sheetController.animateTo(
            0.42,
            duration: const Duration(milliseconds: 260),
            curve: Curves.easeOut,
          );
        }
      },
    );

    return Scaffold(
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          // ── Map ──────────────────────────────────────────────────────
          GoogleMap(
            onMapCreated: (controller) {
              _mapController = controller;
              setState(() => _mapCreated = true);
              debugPrint('[MAP] onMapCreated fired');
              final current = ref.read(mapRetailersProvider);
              if (!_hasFitBounds && current.isNotEmpty) {
                _hasFitBounds = true;
                _fitMarkers(current);
              }
            },
            onCameraMove: (_) {
              if (!_cameraMoved) setState(() => _cameraMoved = true);
            },
            initialCameraPosition: _kDefaultCamera,
            markers: _buildMarkers(retailers, mapState.selectedRetailerId, profileId),
            myLocationEnabled: locationState.isGranted,
            myLocationButtonEnabled: false,
            zoomControlsEnabled: false,
            mapToolbarEnabled: false,
            // Pad map so bottom sheet doesn't cover markers at default zoom.
            padding: EdgeInsets.only(
              top: MediaQuery.of(context).padding.top + 64,
              bottom: MediaQuery.of(context).size.height * 0.14,
            ),
            onTap: (_) => ref.read(mapControllerProvider.notifier).clearSelection(),
          ),

          // ── Search overlay ───────────────────────────────────────────
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: _SearchBar(
                controller: _searchController,
                onChanged: (q) =>
                    ref.read(mapControllerProvider.notifier).setSearchQuery(q),
                onClear: () {
                  _searchController.clear();
                  ref.read(mapControllerProvider.notifier).setSearchQuery('');
                },
              ),
            ),
          ),

          // ── Retailer bottom sheet ─────────────────────────────────────
          Positioned.fill(
            child: DraggableScrollableSheet(
              controller: _sheetController,
              initialChildSize: 0.12,
              minChildSize: 0.08,
              maxChildSize: 0.85,
              snap: true,
              snapSizes: const [0.12, 0.42, 0.85],
              builder: (context, scrollController) {
                if (retailersLoadState is AsyncError) {
                  return _RetailersErrorSheet(
                    scrollController: scrollController,
                    error: retailersLoadState.error.toString(),
                    onRetry: () => ref.invalidate(mapBaseDataProvider),
                  );
                }
                return _BottomSheet(
                  scrollController: scrollController,
                  retailers: retailers,
                  selectedRetailer: selectedRetailer,
                  locationState: locationState,
                  profileId: profileId,
                  isLoading: retailersLoadState is AsyncLoading,
                  onDismissSelected: () =>
                      ref.read(mapControllerProvider.notifier).clearSelection(),
                  onRetailerTap: (r) {
                    // Select the retailer (highlights its marker + shows preview).
                    ref.read(mapControllerProvider.notifier).selectRetailer(r.id);
                    // Pan map to the pin so the user can see it highlighted.
                    if (r.latitude != null && r.longitude != null) {
                      _mapController?.animateCamera(
                        CameraUpdate.newLatLng(
                            LatLng(r.latitude!, r.longitude!)),
                      );
                    }
                  },
                  onViewSelected: selectedRetailer != null
                      ? () {
                          final r = selectedRetailer;
                          ref
                              .read(discoveryAnalyticsProvider)
                              .logRetailerOpenedFromMap(profileId, r.id);
                          context.push(
                            RouteNames.retailerDetail
                                .replaceAll(':retailerId', r.id),
                          );
                        }
                      : null,
                  onEnableLocation: locationState.isDenied &&
                          locationState.status ==
                              LocationStatus.deniedForever
                      ? () =>
                          ref.read(locationNotifierProvider.notifier).openSettings()
                      : () =>
                          ref.read(locationNotifierProvider.notifier).requestAndFetch(),
                );
              },
            ),
          ),

          // ── My location FAB ───────────────────────────────────────────
          if (locationState.isGranted)
            Positioned(
              right: 12,
              bottom: MediaQuery.of(context).size.height * 0.14 + 8,
              child: FloatingActionButton.small(
                onPressed: _animateToLocation,
                backgroundColor: Colors.white,
                foregroundColor: AppColors.primary,
                elevation: 2,
                child: const Icon(Icons.my_location, size: 20),
              ),
            ),

          // ── Staging debug overlay (debug builds only) ─────────────────
          if (kDebugMode)
            Positioned(
              top: MediaQuery.of(context).padding.top + 62,
              right: 12,
              child: _MapDebugOverlay(
                mapCreated: _mapCreated,
                cameraMoved: _cameraMoved,
                markerCount: retailers.length,
                firstMarkerLat: retailers.isNotEmpty ? retailers.first.latitude : null,
                firstMarkerLng: retailers.isNotEmpty ? retailers.first.longitude : null,
              ),
            ),
        ],
      ),
    );
  }
}

// ── Search bar ────────────────────────────────────────────────────────────────

class _SearchBar extends StatefulWidget {
  const _SearchBar({
    required this.controller,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  State<_SearchBar> createState() => _SearchBarState();
}

class _SearchBarState extends State<_SearchBar> {
  bool _hasText = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onControllerChanged);
  }

  void _onControllerChanged() {
    final hasText = widget.controller.text.isNotEmpty;
    if (hasText != _hasText) setState(() => _hasText = hasText);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onControllerChanged);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.10),
            blurRadius: 12,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TextField(
        controller: widget.controller,
        onChanged: widget.onChanged,
        textAlignVertical: TextAlignVertical.center,
        style: AppTextStyles.bodyMedium,
        decoration: InputDecoration(
          hintText: 'Search retailers, offers, categories…',
          hintStyle: AppTextStyles.bodyMedium
              .copyWith(color: AppColors.textDisabled),
          prefixIcon: const Icon(Icons.search,
              color: AppColors.textDisabled, size: 20),
          suffixIcon: _hasText
              ? IconButton(
                  icon: const Icon(Icons.close,
                      size: 18, color: AppColors.textSecondary),
                  onPressed: widget.onClear,
                )
              : null,
          border: InputBorder.none,
          contentPadding: EdgeInsets.zero,
          isDense: true,
        ),
      ),
    );
  }
}

// ── Bottom sheet content ──────────────────────────────────────────────────────

// ── Error sheet — shown when the retailer fetch fails ─────────────────────────

class _RetailersErrorSheet extends StatelessWidget {
  const _RetailersErrorSheet({
    required this.scrollController,
    required this.error,
    required this.onRetry,
  });

  final ScrollController scrollController;
  final String error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      clipBehavior: Clip.antiAlias,
      elevation: 8,
      shadowColor: Colors.black26,
      child: CustomScrollView(
        controller: scrollController,
        slivers: [
          SliverToBoxAdapter(
            child: Center(
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 10),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),
          SliverFillRemaining(
            hasScrollBody: false,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.wifi_off_outlined,
                      size: 40, color: AppColors.textSecondary),
                  const SizedBox(height: 12),
                  const Text(
                    'Could not load retailers',
                    style: AppTextStyles.titleMedium,
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    error,
                    style: AppTextStyles.bodyMedium
                        .copyWith(color: AppColors.textSecondary),
                    textAlign: TextAlign.center,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 20),
                  TextButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Bottom sheet content ──────────────────────────────────────────────────────

class _BottomSheet extends StatelessWidget {
  const _BottomSheet({
    required this.scrollController,
    required this.retailers,
    required this.selectedRetailer,
    required this.locationState,
    required this.profileId,
    required this.isLoading,
    required this.onDismissSelected,
    required this.onRetailerTap,
    required this.onViewSelected,
    required this.onEnableLocation,
  });

  final ScrollController scrollController;
  final List<Retailer> retailers;
  final Retailer? selectedRetailer;
  final LocationState locationState;
  final String? profileId;
  final bool isLoading;
  final VoidCallback onDismissSelected;
  /// Selects a retailer from the list (highlights its marker).
  final ValueChanged<Retailer> onRetailerTap;
  /// Navigates to the selected retailer's detail page from the preview card.
  final VoidCallback? onViewSelected;
  final VoidCallback onEnableLocation;

  @override
  Widget build(BuildContext context) {
    final showNudge =
        locationState.isInitial || locationState.isDenied;

    return Material(
      color: Colors.white,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      clipBehavior: Clip.antiAlias,
      elevation: 8,
      shadowColor: Colors.black26,
      child: CustomScrollView(
        controller: scrollController,
        slivers: [
          // Drag handle
          SliverToBoxAdapter(
            child: Center(
              child: Container(
                margin: const EdgeInsets.symmetric(vertical: 10),
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          ),

          // Selected retailer preview
          if (selectedRetailer != null)
            SliverToBoxAdapter(
              child: MapRetailerPreviewCard(
                retailer: selectedRetailer!,
                onDismiss: onDismissSelected,
                onView: onViewSelected,
              ),
            ),

          // Location nudge
          if (showNudge && selectedRetailer == null)
            SliverToBoxAdapter(
              child: _LocationNudge(
                isDeniedForever:
                    locationState.status == LocationStatus.deniedForever,
                onEnable: onEnableLocation,
              ),
            ),

          // Retailer count header
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: isLoading
                  ? const SizedBox(
                      height: 16,
                      width: 16,
                      child: Center(
                        child: LinearProgressIndicator(),
                      ),
                    )
                  : Text(
                      retailers.isEmpty
                          ? 'No retailers found'
                          : '${retailers.length} '
                              '${retailers.length == 1 ? 'place' : 'places'} on map',
                      style: AppTextStyles.labelSmall
                          .copyWith(color: AppColors.textSecondary),
                    ),
            ),
          ),

          // Retailer list
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, i) => _RetailerListTile(
                  retailer: retailers[i],
                  isSelected: retailers[i].id == selectedRetailer?.id,
                  onTap: () => onRetailerTap(retailers[i]),
                ),
                childCount: retailers.length,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Location nudge ────────────────────────────────────────────────────────────

class _LocationNudge extends StatelessWidget {
  const _LocationNudge({
    required this.isDeniedForever,
    required this.onEnable,
  });

  final bool isDeniedForever;
  final VoidCallback onEnable;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: AppColors.background,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            const Icon(Icons.location_on_outlined,
                size: 18, color: AppColors.primary),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                'Find offers and businesses near you',
                style: AppTextStyles.labelSmall
                    .copyWith(color: AppColors.textSecondary),
              ),
            ),
            const SizedBox(width: 8),
            TextButton(
              onPressed: onEnable,
              style: TextButton.styleFrom(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                isDeniedForever ? 'Open settings' : 'Enable',
                style: AppTextStyles.labelSmall.copyWith(
                  color: AppColors.primary,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Retailer list tile ────────────────────────────────────────────────────────

class _RetailerListTile extends StatelessWidget {
  const _RetailerListTile({
    required this.retailer,
    required this.isSelected,
    required this.onTap,
  });

  final Retailer retailer;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: ListTile(
        onTap: onTap,
        selected: isSelected,
        selectedTileColor: AppColors.background,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: isSelected
              ? const BorderSide(color: AppColors.primary, width: 1.5)
              : BorderSide.none,
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        leading: _LogoBadge(logoUrl: retailer.logoUrl, name: retailer.name),
        title: Text(
          retailer.name,
          style: AppTextStyles.titleMedium.copyWith(fontSize: 14),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: retailer.categories.isNotEmpty
            ? Text(
                retailer.categories.take(2).join(' · '),
                style: AppTextStyles.labelSmall
                    .copyWith(color: AppColors.textSecondary),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              )
            : null,
        trailing: retailer.distanceKm != null
            ? Text(
                _fmtDistance(retailer.distanceKm!),
                style: AppTextStyles.labelSmall
                    .copyWith(color: AppColors.textDisabled),
              )
            : retailer.town != null
                ? Text(
                    retailer.town!,
                    style: AppTextStyles.labelSmall
                        .copyWith(color: AppColors.textDisabled),
                  )
                : null,
      ),
    );
  }

  static String _fmtDistance(double km) =>
      km < 1.0 ? '${(km * 1000).round()}m' : '${km.toStringAsFixed(1)}km';
}

// ── Logo badge (shared) ───────────────────────────────────────────────────────

class _LogoBadge extends StatelessWidget {
  const _LogoBadge({required this.logoUrl, required this.name});
  final String? logoUrl;
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: AppColors.primaryLight,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: logoUrl != null
          ? Image.network(
              logoUrl!,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => _Initials(name),
            )
          : _Initials(name),
    );
  }
}

class _Initials extends StatelessWidget {
  const _Initials(this.name);
  final String name;

  @override
  Widget build(BuildContext context) => Center(
        child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : '?',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      );
}

// ── Staging debug overlay (kDebugMode only) ───────────────────────────────────

class _MapDebugOverlay extends StatelessWidget {
  const _MapDebugOverlay({
    required this.mapCreated,
    required this.cameraMoved,
    required this.markerCount,
    required this.firstMarkerLat,
    required this.firstMarkerLng,
  });

  final bool mapCreated;
  final bool cameraMoved;
  final int markerCount;
  final double? firstMarkerLat;
  final double? firstMarkerLng;

  @override
  Widget build(BuildContext context) {
    const key = Env.googleMapsApiKey;
    final keyLabel = key.isEmpty
        ? 'MISSING'
        : 'YES (…${key.substring(key.length > 4 ? key.length - 4 : 0)})';

    final pinLabel = firstMarkerLat != null
        ? '${firstMarkerLat!.toStringAsFixed(4)}, ${firstMarkerLng!.toStringAsFixed(4)}'
        : 'none';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(8),
      ),
      child: DefaultTextStyle(
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontFamily: 'monospace',
          height: 1.5,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('MAP DEBUG'),
            Text('key: $keyLabel'),
            Text('onMapCreated: ${mapCreated ? "YES" : "NO"}'),
            Text('cameraMoved: ${cameraMoved ? "YES" : "NO"}'),
            Text('markers: $markerCount'),
            Text('pin[0]: $pinLabel'),
          ],
        ),
      ),
    );
  }
}
