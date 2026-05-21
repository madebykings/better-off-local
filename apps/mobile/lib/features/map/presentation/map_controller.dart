import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

// ── State ─────────────────────────────────────────────────────────────────────

class MapState extends Equatable {
  const MapState({
    this.selectedRetailerId,
    this.searchQuery = '',
  });

  final String? selectedRetailerId;
  final String searchQuery;

  MapState copyWith({
    String? selectedRetailerId,
    bool clearSelected = false,
    String? searchQuery,
  }) {
    return MapState(
      selectedRetailerId:
          clearSelected ? null : (selectedRetailerId ?? this.selectedRetailerId),
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }

  @override
  List<Object?> get props => [selectedRetailerId, searchQuery];
}

// ── Controller ────────────────────────────────────────────────────────────────

class MapController extends StateNotifier<MapState> {
  MapController() : super(const MapState());

  void selectRetailer(String retailerId) =>
      state = state.copyWith(selectedRetailerId: retailerId);

  void clearSelection() =>
      state = state.copyWith(clearSelected: true);

  void setSearchQuery(String query) =>
      state = state.copyWith(searchQuery: query, clearSelected: true);
}

// ── Provider ──────────────────────────────────────────────────────────────────

final mapControllerProvider =
    StateNotifierProvider<MapController, MapState>((ref) => MapController());
