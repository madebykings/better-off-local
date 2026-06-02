import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';

import '../services/location_service.dart';
import '../services/location_service_impl.dart';

// ── Position type alias ───────────────────────────────────────────────────────

typedef Position = ({double latitude, double longitude});

// ── Permission / lifecycle state ──────────────────────────────────────────────

enum LocationStatus { initial, loading, granted, denied, deniedForever }

class LocationState {
  const LocationState({required this.status, this.position});
  final LocationStatus status;
  final Position? position;

  bool get isGranted => status == LocationStatus.granted;
  bool get isDenied =>
      status == LocationStatus.denied ||
      status == LocationStatus.deniedForever;
  bool get isLoading => status == LocationStatus.loading;
  bool get isInitial => status == LocationStatus.initial;
}

// ── Service provider ──────────────────────────────────────────────────────────

final locationServiceProvider = Provider<LocationService>(
  (_) => const GeolocatorLocationService(),
);

// ── Notifier ──────────────────────────────────────────────────────────────────

/// Manages the full permission + position lifecycle for the map screen.
///
/// Call [init] on map screen entry — it checks existing permission status
/// without prompting. If already granted it fetches the position immediately.
/// Call [requestAndFetch] when the user taps "Enable location" in the nudge.
class LocationNotifier extends StateNotifier<LocationState> {
  LocationNotifier(this._ref)
      : super(const LocationState(status: LocationStatus.initial));

  final Ref _ref;
  LocationService get _service => _ref.read(locationServiceProvider);

  /// Checks current permission; fetches position if already granted.
  /// Does NOT request permission — call [requestAndFetch] for that.
  Future<void> init() async {
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.whileInUse ||
        permission == LocationPermission.always) {
      await _fetchPosition();
    } else if (permission == LocationPermission.deniedForever) {
      state = const LocationState(status: LocationStatus.deniedForever);
    }
    // else: stays initial — map shows location nudge
  }

  /// Called when the user explicitly taps "Enable location".
  /// Shows the OS permission dialog, then fetches position if granted.
  Future<void> requestAndFetch() async {
    state = const LocationState(status: LocationStatus.loading);
    final granted = await _service.requestPermission();
    if (!granted) {
      final perm = await Geolocator.checkPermission();
      state = LocationState(
        status: perm == LocationPermission.deniedForever
            ? LocationStatus.deniedForever
            : LocationStatus.denied,
      );
      return;
    }
    await _fetchPosition();
  }

  /// Opens device settings so the user can re-enable location.
  void openSettings() => Geolocator.openAppSettings();

  Future<void> _fetchPosition() async {
    state = const LocationState(status: LocationStatus.loading);
    final pos = await _service.getCurrentPosition();
    if (pos != null) {
      state = LocationState(status: LocationStatus.granted, position: pos);
      // Also update the simple provider used by homeRetailersProvider.
      _ref.read(locationProvider.notifier).state = pos;
    } else {
      state = const LocationState(status: LocationStatus.denied);
    }
  }
}

final locationNotifierProvider =
    StateNotifierProvider<LocationNotifier, LocationState>((ref) {
  return LocationNotifier(ref);
});

/// Simple nullable position — set by [LocationNotifier] after a successful
/// fetch. Watched by [homeRetailersProvider] for distance calculations.
final locationProvider = StateProvider<Position?>((ref) => null);

/// Silently checks whether location permission is already granted and, if so,
/// fetches the device position without prompting the user.
///
/// Watched by [HomeScreen] so distance calculations run on the first home
/// screen load. Uses a plain (non-autoDispose) FutureProvider so the init
/// only fires once per app session.
final locationInitProvider = FutureProvider<void>((ref) {
  return ref.read(locationNotifierProvider.notifier).init();
});
