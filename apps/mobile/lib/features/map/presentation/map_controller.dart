import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// ── Filter options shown in the map filter bar ────────────────────────────────

enum MapFilter { all, offers, events, featured, following, loyalty }

// ── State ─────────────────────────────────────────────────────────────────────

class MapState extends Equatable {
  const MapState({
    this.selectedRetailerId,
    this.selectedEventId,
    this.searchQuery = '',
    this.activeFilter = MapFilter.all,
  });

  final String? selectedRetailerId;
  final String? selectedEventId;
  final String searchQuery;
  final MapFilter activeFilter;

  MapState copyWith({
    String? selectedRetailerId,
    String? selectedEventId,
    bool clearSelected = false,
    String? searchQuery,
    MapFilter? activeFilter,
  }) {
    return MapState(
      selectedRetailerId:
          clearSelected ? null : (selectedRetailerId ?? this.selectedRetailerId),
      selectedEventId:
          clearSelected ? null : (selectedEventId ?? this.selectedEventId),
      searchQuery: searchQuery ?? this.searchQuery,
      activeFilter: activeFilter ?? this.activeFilter,
    );
  }

  @override
  List<Object?> get props =>
      [selectedRetailerId, selectedEventId, searchQuery, activeFilter];
}

// ── Controller ────────────────────────────────────────────────────────────────

class MapController extends StateNotifier<MapState> {
  MapController() : super(const MapState());

  /// Selects a retailer marker, clearing any selected event.
  void selectRetailer(String retailerId) => state = MapState(
        selectedRetailerId: retailerId,
        selectedEventId: null,
        searchQuery: state.searchQuery,
        activeFilter: state.activeFilter,
      );

  /// Selects an event marker, clearing any selected retailer.
  void selectEvent(String eventId) => state = MapState(
        selectedRetailerId: null,
        selectedEventId: eventId,
        searchQuery: state.searchQuery,
        activeFilter: state.activeFilter,
      );

  void clearSelection() => state = state.copyWith(clearSelected: true);

  void setSearchQuery(String query) =>
      state = state.copyWith(searchQuery: query, clearSelected: true);

  void setFilter(MapFilter filter) =>
      state = state.copyWith(activeFilter: filter, clearSelected: true);
}

// ── Provider ──────────────────────────────────────────────────────────────────

final mapControllerProvider =
    StateNotifierProvider<MapController, MapState>((ref) => MapController());
