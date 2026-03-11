import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/router/route_names.dart';

/// Root shell widget wrapping the bottom navigation tabs.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.child});

  final Widget child;

  static const _tabs = [
    _Tab(icon: Icons.home_outlined, activeIcon: Icons.home, label: 'Home', route: RouteNames.home),
    _Tab(icon: Icons.search_outlined, activeIcon: Icons.search, label: 'Explore', route: RouteNames.explore),
    _Tab(icon: Icons.map_outlined, activeIcon: Icons.map, label: 'Map', route: RouteNames.map),
    _Tab(icon: Icons.card_membership_outlined, activeIcon: Icons.card_membership, label: 'Card', route: RouteNames.card),
    _Tab(icon: Icons.person_outline, activeIcon: Icons.person, label: 'Account', route: RouteNames.account),
  ];

  int _selectedIndex(String location) {
    if (location.startsWith(RouteNames.explore)) return 1;
    if (location.startsWith(RouteNames.map)) return 2;
    if (location.startsWith(RouteNames.card)) return 3;
    if (location.startsWith(RouteNames.account)) return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final selectedIndex = _selectedIndex(location);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (index) =>
            context.go(_tabs[index].route),
        destinations: _tabs
            .map(
              (tab) => NavigationDestination(
                icon: Icon(tab.icon),
                selectedIcon: Icon(tab.activeIcon),
                label: tab.label,
              ),
            )
            .toList(),
      ),
    );
  }
}

class _Tab {
  const _Tab({
    required this.icon,
    required this.activeIcon,
    required this.label,
    required this.route,
  });
  final IconData icon;
  final IconData activeIcon;
  final String label;
  final String route;
}
