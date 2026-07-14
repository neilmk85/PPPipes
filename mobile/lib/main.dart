import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'providers/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/dashboard/dashboard_screen.dart';
import 'screens/pos/pos_screen.dart';
import 'screens/products/products_screen.dart';
import 'screens/inventory/inventory_screen.dart';
import 'screens/customers/customers_screen.dart';
import 'screens/orders/orders_screen.dart';
import 'screens/reports/reports_screen.dart';
import 'screens/settings/settings_screen.dart';
import 'screens/sales_orders/sales_orders_screen.dart';
import 'screens/purchases/purchases_screen.dart';
import 'screens/purchases/direct_purchases_screen.dart';
import 'screens/invoices/invoices_screen.dart';
import 'screens/vendors/vendors_screen.dart';
import 'screens/expenses/expenses_screen.dart';
import 'screens/shifts/shifts_screen.dart';
import 'screens/production/production_screen.dart';
import 'screens/business/business_screen.dart';
import 'screens/business/business_detail_screen.dart';

void main() {
  runApp(const ProviderScope(child: PosApp()));
}

// ── Global drawer key — import this file from any screen to open the drawer ──
final GlobalKey<ScaffoldState> appShellKey = GlobalKey<ScaffoldState>();
void openAppDrawer() => appShellKey.currentState?.openDrawer();

// ── App root ──────────────────────────────────────────────────────────────────

class PosApp extends ConsumerWidget {
  const PosApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    if (auth.isRestoring) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          body: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: const Color(0xFF6C63FF),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(Icons.factory, color: Colors.white, size: 40),
                ),
                const SizedBox(height: 24),
                const CircularProgressIndicator(color: Color(0xFF6C63FF)),
              ],
            ),
          ),
        ),
      );
    }

    final router = GoRouter(
      initialLocation: auth.isAuthenticated ? '/dashboard' : '/login',
      redirect: (ctx, state) {
        final loggedIn = ref.read(authProvider).isAuthenticated;
        final onLogin = state.matchedLocation == '/login';
        if (!loggedIn && !onLogin) return '/login';
        if (loggedIn && onLogin) return '/dashboard';
        return null;
      },
      routes: [
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        ShellRoute(
          builder: (ctx, state, child) => _AppShell(child: child),
          routes: [
            GoRoute(path: '/dashboard',   builder: (_, __) => const DashboardScreen()),
            GoRoute(path: '/pos',         builder: (_, __) => const POSScreen()),
            GoRoute(path: '/sales-orders',builder: (_, __) => const SalesOrdersScreen()),
            GoRoute(path: '/purchases',         builder: (_, __) => const PurchasesScreen()),
            GoRoute(path: '/purchases/direct',  builder: (_, __) => const DirectPurchasesScreen()),
            GoRoute(path: '/invoices',    builder: (_, __) => const InvoicesScreen()),
            GoRoute(path: '/vendors',     builder: (_, __) => const VendorsScreen()),
            GoRoute(path: '/orders',      builder: (_, __) => const OrdersScreen()),
            GoRoute(path: '/customers',   builder: (_, __) => const CustomersScreen()),
            GoRoute(path: '/expenses',    builder: (_, __) => const ExpensesScreen()),
            GoRoute(path: '/shifts',      builder: (_, __) => const ShiftsScreen()),
            GoRoute(path: '/production',  builder: (_, __) => const ProductionScreen()),
            GoRoute(path: '/business',             builder: (_, __) => const BusinessScreen()),
            GoRoute(path: '/business/cement-bags',     builder: (_, __) => const CementBagsScreen()),
            GoRoute(path: '/business/vehicles',        builder: (_, __) => const VehiclesScreen()),
            GoRoute(path: '/business/silo',            builder: (_, __) => const SiloScreen()),
            GoRoute(path: '/business/silo-extraction', builder: (_, __) => const SiloScreen(isExtraction: true)),
            GoRoute(path: '/business/pdi',             builder: (_, __) => const PdiScreen()),
            GoRoute(path: '/business/loading',         builder: (_, __) => const LoadingScreen()),
            GoRoute(path: '/business/extra-vehicles',  builder: (_, __) => const ExtraVehiclesScreen()),
            GoRoute(path: '/business/conversion',      builder: (_, __) => const ConversionScreen()),
            GoRoute(path: '/business/loaded-pipes',    builder: (_, __) => const LoadedPipesScreen()),
            GoRoute(path: '/business/loading-invoice', builder: (_, __) => const LoadingInvoiceScreen()),
            GoRoute(path: '/business/labour',          builder: (_, __) => const LabourScreen()),
            GoRoute(path: '/business/store-material',  builder: (_, __) => const StoreMaterialScreen()),
            GoRoute(path: '/business/maintenance',     builder: (_, __) => const MaintenanceScreen()),
            GoRoute(path: '/business/cutting',            builder: (_, __) => const CuttingScreen()),
            GoRoute(path: '/business/diesel-maintenance', builder: (_, __) => const DieselMaintenanceScreen()),
            GoRoute(path: '/business/transport-report',  builder: (_, __) => const TransportReportScreen()),
            GoRoute(path: '/business/discard',           builder: (_, __) => const DiscardScreen()),
            GoRoute(path: '/business/extra-fab',         builder: (_, __) => const ExtraFabScreen()),
            GoRoute(path: '/business/testing-lab',       builder: (_, __) => const TestingLabScreen()),
            GoRoute(path: '/business/pccp',              builder: (_, __) => const PccpScreen()),
            GoRoute(
              path: '/business/pccp/stage',
              builder: (_, state) {
                final extra = state.extra as Map<String, dynamic>;
                return PccpStageScreen(
                  stageType: extra['stageType'] as String,
                  stageName: extra['name'] as String,
                  color: Color(extra['colorValue'] as int),
                );
              },
            ),
            GoRoute(path: '/products',    builder: (_, __) => const ProductsScreen()),
            GoRoute(path: '/inventory',   builder: (_, __) => const InventoryScreen()),
            GoRoute(path: '/reports',     builder: (_, __) => const ReportsScreen()),
            GoRoute(path: '/settings',    builder: (_, __) => const SettingsScreen()),
          ],
        ),
      ],
    );

    return MaterialApp.router(
      title: 'ERP',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6C63FF),
          brightness: Brightness.light,
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF6C63FF),
          brightness: Brightness.dark,
        ),
      ),
      routerConfig: router,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en')],
    );
  }
}

// ── Section detection ─────────────────────────────────────────────────────────

enum _Section { dashboard, commerce, operations, reports, settings }

_Section _sectionOf(String path) {
  if (path.startsWith('/sales-orders') ||
      path.startsWith('/purchases')    ||
      path.startsWith('/invoices')     ||
      path.startsWith('/vendors')      ||
      path.startsWith('/orders')       ||
      path.startsWith('/customers'))   return _Section.commerce;
  if (path.startsWith('/expenses')     ||
      path.startsWith('/shifts')       ||
      path.startsWith('/production')   ||
      path.startsWith('/business')     ||
      path.startsWith('/products')     ||
      path.startsWith('/inventory'))   return _Section.operations;
  if (path.startsWith('/reports'))     return _Section.reports;
  if (path.startsWith('/settings'))    return _Section.settings;
  return _Section.dashboard;
}

// ── Bottom-nav item model ─────────────────────────────────────────────────────

class _BotItem {
  final String path;
  final IconData icon;
  final IconData activeIcon;
  final String label;
  const _BotItem({
    required this.path,
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
}

List<_BotItem> _itemsFor(_Section section) {
  switch (section) {
    case _Section.dashboard:
      return const [
        _BotItem(path: '/dashboard',    icon: Icons.dashboard_outlined,    activeIcon: Icons.dashboard,    label: 'Dashboard'),
        _BotItem(path: '/sales-orders', icon: Icons.shopping_bag_outlined, activeIcon: Icons.shopping_bag, label: 'Commerce'),
        _BotItem(path: '/production',   icon: Icons.factory_outlined,      activeIcon: Icons.factory,      label: 'Operations'),
      ];
    case _Section.commerce:
      return const [
        _BotItem(path: '/sales-orders', icon: Icons.shopping_cart_outlined,  activeIcon: Icons.shopping_cart,  label: 'Sales'),
        _BotItem(path: '/purchases',    icon: Icons.local_shipping_outlined, activeIcon: Icons.local_shipping, label: 'Purchases'),
        _BotItem(path: '/invoices',     icon: Icons.description_outlined,    activeIcon: Icons.description,    label: 'Invoices'),
        _BotItem(path: '/customers',    icon: Icons.people_outline,           activeIcon: Icons.people,          label: 'Customers'),
      ];
    case _Section.operations:
      return const [
        _BotItem(path: '/production', icon: Icons.precision_manufacturing_outlined,  activeIcon: Icons.precision_manufacturing, label: 'Production'),
        _BotItem(path: '/expenses',   icon: Icons.payments_outlined,                 activeIcon: Icons.payments,                label: 'Expenses'),
        _BotItem(path: '/shifts',     icon: Icons.access_time_outlined,              activeIcon: Icons.access_time_filled,      label: 'Shifts'),
        _BotItem(path: '/business',   icon: Icons.factory_outlined,                  activeIcon: Icons.factory,                 label: 'Business'),
      ];
    case _Section.reports:
      return const [
        _BotItem(path: '/dashboard', icon: Icons.dashboard_outlined,    activeIcon: Icons.dashboard,    label: 'Dashboard'),
        _BotItem(path: '/reports',   icon: Icons.bar_chart_outlined,    activeIcon: Icons.bar_chart,    label: 'Reports'),
        _BotItem(path: '/settings',  icon: Icons.settings_outlined,     activeIcon: Icons.settings,     label: 'Settings'),
      ];
    case _Section.settings:
      return const [
        _BotItem(path: '/dashboard', icon: Icons.dashboard_outlined,    activeIcon: Icons.dashboard,    label: 'Dashboard'),
        _BotItem(path: '/reports',   icon: Icons.bar_chart_outlined,    activeIcon: Icons.bar_chart,    label: 'Reports'),
        _BotItem(path: '/settings',  icon: Icons.settings_outlined,     activeIcon: Icons.settings,     label: 'Settings'),
      ];
  }
}

// ── App Shell ─────────────────────────────────────────────────────────────────

class _AppShell extends ConsumerStatefulWidget {
  final Widget child;
  const _AppShell({required this.child});

  @override
  ConsumerState<_AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<_AppShell> {
  @override
  Widget build(BuildContext context) {
    // Use the full URI path so sub-routes inside ShellRoute are detected correctly
    final location = GoRouter.of(context).routerDelegate.currentConfiguration.uri.path;
    final section  = _sectionOf(location);
    final items    = _itemsFor(section);
    final activeIdx = items.indexWhere((it) => location.startsWith(it.path));
    final auth     = ref.watch(authProvider);

    // Business hub, Operations screens, and Reports use their own floating nav
    final showBottomNav = !location.startsWith('/business') && section != _Section.operations && !location.startsWith('/reports');

    return Scaffold(
      key: appShellKey,
      drawer: _AppDrawer(currentPath: location, auth: auth, ref: ref),
      body: widget.child,
      bottomNavigationBar: showBottomNav ? NavigationBar(
        selectedIndex: activeIdx < 0 ? 0 : activeIdx,
        onDestinationSelected: (i) => context.go(items[i].path),
        labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected,
        destinations: items.map((item) => NavigationDestination(
          icon: Icon(item.icon),
          selectedIcon: Icon(item.activeIcon),
          label: item.label,
        )).toList(),
      ) : null,
    );
  }
}

// ── Left Navigation Drawer ────────────────────────────────────────────────────

class _AppDrawer extends StatefulWidget {
  final String currentPath;
  final dynamic auth;
  final WidgetRef ref;

  const _AppDrawer({
    required this.currentPath,
    required this.auth,
    required this.ref,
  });

  @override
  State<_AppDrawer> createState() => _AppDrawerState();
}

class _AppDrawerState extends State<_AppDrawer> {
  bool _purchasesExpanded = false;

  @override
  void initState() {
    super.initState();
    // Auto-expand if on a purchases route
    _purchasesExpanded = widget.currentPath.startsWith('/purchases');
  }

  @override
  Widget build(BuildContext context) {
    final currentPath = widget.currentPath;
    final auth        = widget.auth;
    final roles = auth?.user?.roles as List<String>? ?? [];
    final isAdmin = roles.contains('SUPER_ADMIN') || roles.contains('ADMIN');

    return Drawer(
      width: 285,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.horizontal(right: Radius.circular(24)),
      ),
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0F172A),
          borderRadius: BorderRadius.horizontal(right: Radius.circular(24)),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _buildHeader(),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                  children: [
                    // ── HOME ─────────────────────────────────────────
                    _sectionLabel('HOME'),
                    _navItem(context, '/dashboard', Icons.dashboard_outlined, Icons.dashboard, 'Dashboard'),
                    _navItem(context, '/business',  Icons.business_center_outlined, Icons.business_center, 'Business'),

                    if (isAdmin) ...[
                      // ── COMMERCE ───────────────────────────────────
                      const SizedBox(height: 6),
                      _sectionLabel('COMMERCE'),
                      _navItem(context, '/sales-orders', Icons.shopping_cart_outlined,     Icons.shopping_cart,     'Sales Orders'),
                      // ── Purchases expandable ───────────────────────────
                      _purchasesExpander(context, currentPath),
                      if (_purchasesExpanded) ...[
                        _subNavItem(context, '/purchases',         Icons.assignment_outlined,      'PO',                currentPath),
                        _subNavItem(context, '/purchases/direct',  Icons.receipt_long_outlined,    'Direct Purchases',  currentPath),
                      ],
                      _navItem(context, '/invoices',     Icons.description_outlined,       Icons.description,       'Invoices'),
                      _navItem(context, '/vendors',      Icons.business_outlined,          Icons.business,          'Vendors'),
                      _navItem(context, '/customers',    Icons.people_outline,             Icons.people,            'Customers'),
                      _navItem(context, '/orders',       Icons.receipt_long_outlined,      Icons.receipt_long,      'Orders'),

                      // ── OPERATIONS ─────────────────────────────────
                      const SizedBox(height: 6),
                      _sectionLabel('OPERATIONS'),
                      _navItem(context, '/production', Icons.precision_manufacturing_outlined, Icons.precision_manufacturing, 'Production'),
                      _navItem(context, '/expenses',   Icons.payments_outlined,                Icons.payments,                'Expenses'),
                      _navItem(context, '/shifts',     Icons.access_time_outlined,             Icons.access_time_filled,      'Shifts'),
                      _navItem(context, '/products',   Icons.inventory_2_outlined,             Icons.inventory_2,             'Products'),
                      _navItem(context, '/inventory',  Icons.warehouse_outlined,               Icons.warehouse,               'Inventory'),

                      // ── ANALYTICS ──────────────────────────────────
                      const SizedBox(height: 6),
                      _sectionLabel('ANALYTICS'),
                      _navItem(context, '/reports', Icons.bar_chart_outlined, Icons.bar_chart, 'Reports'),

                      // ── ACCOUNT ────────────────────────────────────
                      const SizedBox(height: 6),
                      _sectionLabel('ACCOUNT'),
                      _navItem(context, '/settings', Icons.settings_outlined, Icons.settings, 'Settings'),
                    ],
                  ],
                ),
              ),
              _buildLogout(context),
            ],
          ),
        ),
      ),
    );
  }

  // ── Header with app logo + user info ────────────────────────────────────────
  Widget _buildHeader() {
    final name  = widget.auth?.user?.name  ?? 'User';
    final email = widget.auth?.user?.email ?? '';
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'A';

    return Container(
      padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF4C1D95), Color(0xFF1E40AF)],
        ),
        borderRadius: BorderRadius.only(topRight: Radius.circular(24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // App branding
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withOpacity(0.25)),
                ),
                child: const Icon(Icons.factory, color: Colors.white, size: 22),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'P&P Pipe Products',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 13.5,
                        letterSpacing: -0.3,
                      ),
                    ),
                    Text(
                      'ERP Management System',
                      style: TextStyle(color: Color(0xFFBAE6FD), fontSize: 10.5),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // User info
          Row(
            children: [
              CircleAvatar(
                radius: 17,
                backgroundColor: Colors.white.withOpacity(0.2),
                child: Text(
                  initial,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      name,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      email,
                      style: const TextStyle(
                        color: Color(0xFFBAE6FD),
                        fontSize: 11,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Section label ─────────────────────────────────────────────────────────
  Widget _sectionLabel(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 10, 10, 3),
      child: Text(
        title,
        style: const TextStyle(
          color: Color(0xFF475569),
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.3,
        ),
      ),
    );
  }

  // ── Navigation item ───────────────────────────────────────────────────────
  Widget _navItem(
    BuildContext context,
    String path,
    IconData icon,
    IconData activeIcon,
    String label,
  ) {
    final isActive = widget.currentPath.startsWith(path);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 1),
      decoration: isActive
          ? BoxDecoration(
              color: const Color(0xFF6C63FF).withOpacity(0.14),
              borderRadius: BorderRadius.circular(10),
              border: const Border(
                left: BorderSide(color: Color(0xFF818CF8), width: 3),
              ),
            )
          : null,
      child: ListTile(
        dense: true,
        visualDensity: const VisualDensity(horizontal: 0, vertical: -1),
        contentPadding: EdgeInsets.fromLTRB(isActive ? 9 : 12, 0, 12, 0),
        leading: Icon(
          isActive ? activeIcon : icon,
          size: 18,
          color: isActive ? const Color(0xFF818CF8) : const Color(0xFF64748B),
        ),
        title: Text(
          label,
          style: TextStyle(
            color: isActive ? const Color(0xFFE2E8F0) : const Color(0xFF94A3B8),
            fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
            fontSize: 13.5,
          ),
        ),
        onTap: () {
          Navigator.pop(context);
          context.go(path);
        },
      ),
    );
  }

  // ── Purchases expandable header ───────────────────────────────────────────
  Widget _purchasesExpander(BuildContext context, String currentPath) {
    final anyActive = currentPath.startsWith('/purchases');
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 1),
      decoration: anyActive
          ? BoxDecoration(
              color: const Color(0xFF6C63FF).withOpacity(0.10),
              borderRadius: BorderRadius.circular(10),
            )
          : null,
      child: ListTile(
        dense: true,
        visualDensity: const VisualDensity(horizontal: 0, vertical: -1),
        contentPadding: const EdgeInsets.fromLTRB(12, 0, 8, 0),
        leading: Icon(
          Icons.local_shipping_outlined,
          size: 18,
          color: anyActive ? const Color(0xFF818CF8) : const Color(0xFF64748B),
        ),
        title: Text(
          'Purchases',
          style: TextStyle(
            color: anyActive ? const Color(0xFFE2E8F0) : const Color(0xFF94A3B8),
            fontWeight: anyActive ? FontWeight.w600 : FontWeight.w400,
            fontSize: 13.5,
          ),
        ),
        trailing: Icon(
          _purchasesExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
          size: 18,
          color: const Color(0xFF64748B),
        ),
        onTap: () => setState(() => _purchasesExpanded = !_purchasesExpanded),
      ),
    );
  }

  // ── Sub-navigation item (indented) ────────────────────────────────────────
  Widget _subNavItem(BuildContext context, String path, IconData icon, String label, String currentPath) {
    final isActive = currentPath == path;
    return Container(
      margin: const EdgeInsets.only(left: 20, top: 1, bottom: 1),
      decoration: isActive
          ? BoxDecoration(
              color: const Color(0xFF6C63FF).withOpacity(0.14),
              borderRadius: BorderRadius.circular(10),
              border: const Border(left: BorderSide(color: Color(0xFF818CF8), width: 3)),
            )
          : null,
      child: ListTile(
        dense: true,
        visualDensity: const VisualDensity(horizontal: 0, vertical: -2),
        contentPadding: EdgeInsets.fromLTRB(isActive ? 9 : 12, 0, 12, 0),
        leading: Icon(icon, size: 16,
            color: isActive ? const Color(0xFF818CF8) : const Color(0xFF64748B)),
        title: Text(label,
            style: TextStyle(
              color: isActive ? const Color(0xFFE2E8F0) : const Color(0xFF94A3B8),
              fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
              fontSize: 13,
            )),
        onTap: () {
          Navigator.pop(context);
          context.go(path);
        },
      ),
    );
  }

  // ── Out-of-Office toggle ──────────────────────────────────────────────────
  Widget _buildOutOfOfficeToggle(BuildContext context) {
    final isOutOfOffice = widget.auth?.user?.outOfOffice as bool? ?? false;
    return Container(
      margin: const EdgeInsets.fromLTRB(10, 0, 10, 6),
      decoration: BoxDecoration(
        color: isOutOfOffice
            ? const Color(0xFFF97316).withOpacity(0.12)
            : Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isOutOfOffice
              ? const Color(0xFFF97316).withOpacity(0.4)
              : Colors.transparent,
          width: 1,
        ),
      ),
      child: ListTile(
        dense: true,
        visualDensity: const VisualDensity(horizontal: 0, vertical: -1),
        leading: Icon(
          isOutOfOffice ? Icons.location_off_outlined : Icons.location_on_outlined,
          color: isOutOfOffice ? const Color(0xFFF97316) : const Color(0xFF94A3B8),
          size: 18,
        ),
        title: Text(
          isOutOfOffice ? 'Out of Office' : 'In Office',
          style: TextStyle(
            color: isOutOfOffice ? const Color(0xFFF97316) : const Color(0xFF94A3B8),
            fontWeight: FontWeight.w600,
            fontSize: 13.5,
          ),
        ),
        subtitle: Text(
          isOutOfOffice ? 'Invoices will be queued for printing' : 'Tap to mark as out of office',
          style: TextStyle(
            color: isOutOfOffice
                ? const Color(0xFFF97316).withOpacity(0.7)
                : const Color(0xFF64748B),
            fontSize: 11,
          ),
        ),
        trailing: Switch(
          value: isOutOfOffice,
          onChanged: (val) {
            widget.ref.read(authProvider.notifier).toggleOutOfOffice(val);
          },
          activeColor: const Color(0xFFF97316),
          inactiveThumbColor: const Color(0xFF64748B),
          inactiveTrackColor: const Color(0xFF334155),
        ),
      ),
    );
  }

  // ── Logout button ─────────────────────────────────────────────────────────
  Widget _buildLogout(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(10, 0, 10, 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF87171).withOpacity(0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: ListTile(
        dense: true,
        visualDensity: const VisualDensity(horizontal: 0, vertical: -1),
        leading: const Icon(Icons.logout_outlined, color: Color(0xFFF87171), size: 18),
        title: const Text(
          'Sign Out',
          style: TextStyle(
            color: Color(0xFFF87171),
            fontWeight: FontWeight.w600,
            fontSize: 13.5,
          ),
        ),
        onTap: () {
          Navigator.pop(context);
          widget.ref.read(authProvider.notifier).logout();
        },
      ),
    );
  }
}
