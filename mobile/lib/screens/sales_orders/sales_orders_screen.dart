import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';

class SalesOrdersScreen extends StatefulWidget {
  const SalesOrdersScreen({super.key});

  @override
  State<SalesOrdersScreen> createState() => _SalesOrdersScreenState();
}

class _SalesOrdersScreenState extends State<SalesOrdersScreen> {
  static const _color     = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  final List<SalesOrder> _orders = [];
  bool _loading = false;
  bool _hasMore = true;
  int  _page    = 0;
  final _scroll = ScrollController();

  String _activeTab  = 'all';
  bool   _showSearch = false;
  String _search     = '';
  final _searchCtrl  = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 200) {
        if (!_loading && _hasMore) _load();
      }
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    if (reset) {
      _orders.clear();
      _page    = 0;
      _hasMore = true;
    }
    setState(() => _loading = true);
    try {
      final raw   = await ApiService().getSalesOrders(page: _page, size: 20);
      final items = raw.map((e) => SalesOrder.fromJson(e)).toList();
      setState(() {
        _orders.addAll(items);
        _page++;
        _hasMore = items.length == 20;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  List<SalesOrder> get _filtered {
    var list = _orders;
    switch (_activeTab) {
      case 'pending':
        list = list.where((o) => o.status == 'PENDING').toList();
      case 'done':
        list = list.where((o) => o.status == 'DELIVERED' || o.status == 'CANCELLED').toList();
    }
    if (_search.trim().isNotEmpty) {
      final q = _search.toLowerCase();
      list = list.where((o) =>
        o.soNumber.toLowerCase().contains(q) ||
        (o.customerName?.toLowerCase().contains(q) ?? false),
      ).toList();
    }
    return list;
  }

  int get _pendingCount   => _orders.where((o) => o.status == 'PENDING').length;

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final totalAmt = _orders.fold<double>(0, (s, o) => s + o.totalAmount);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: _loading && _orders.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () => _load(reset: true),
              child: CustomScrollView(
                controller: _scroll,
                slivers: [
                  SliverAppBar(
                    pinned: true,
                    expandedHeight: 106,
                    toolbarHeight: 46,
                    backgroundColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    scrolledUnderElevation: 0,
                    leading: context.canPop()
                        ? IconButton(
                            icon: const Icon(Icons.arrow_back),
                            onPressed: () => context.pop(),
                          )
                        : IconButton(
                            icon: const Icon(Icons.menu_outlined),
                            onPressed: openAppDrawer,
                            tooltip: 'Open menu',
                          ),
                    flexibleSpace: FlexibleSpaceBar(
                      collapseMode: CollapseMode.pin,
                      background: Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [_color, _colorDark],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: Stack(children: [
                          Positioned(
                            right: -24, top: -24,
                            child: Container(
                              width: 110, height: 110,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.white.withValues(alpha: 0.06),
                              ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.bottomLeft,
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(6, 0, 6, 10),
                              child: Row(children: [
                                _hStat('${_orders.length}', 'Orders'),
                                _hStat('$_pendingCount',    'Pending'),
                                _hStat(fmt.format(totalAmt), 'Value'),
                              ]),
                            ),
                          ),
                        ]),
                      ),
                    ),
                    title: const Text('Sales Orders',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white)),
                    actions: [
                      GestureDetector(
                        onTap: () => _showCreateDialog(context),
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: const Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.add, size: 14, color: Colors.white),
                            SizedBox(width: 4),
                            Text('New Order',
                                style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                          ]),
                        ),
                      ),
                    ],
                  ),

                  if (filtered.isEmpty && !_loading)
                    SliverFillRemaining(
                      child: Center(
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.shopping_bag_outlined, size: 48, color: Colors.grey.shade300),
                          const SizedBox(height: 12),
                          Text('No sales orders found',
                              style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                        ]),
                      ),
                    )
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (ctx, i) {
                            if (i >= filtered.length) {
                              return const Center(
                                child: Padding(
                                  padding: EdgeInsets.all(16),
                                  child: CircularProgressIndicator(),
                                ),
                              );
                            }
                            return _SalesOrderCard(
                              order: filtered[i],
                              onStatusChanged: () => _load(reset: true),
                            );
                          },
                          childCount: filtered.length + (_loading ? 1 : 0),
                        ),
                      ),
                    ),
                ],
              ),
            ),
      bottomNavigationBar: _buildFloatingNav(),
    );
  }

  void _showCreateDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _CreateSOSheet(onCreated: () => _load(reset: true)),
    );
  }

  // ── Floating nav ──────────────────────────────────────────────────────────

  Widget _buildFloatingNav() {
    return Container(
      color: Colors.transparent,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
          child: Container(
            height: 64,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(32),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.13),
                  blurRadius: 24,
                  spreadRadius: -2,
                  offset: const Offset(0, 6),
                ),
                BoxShadow(
                  color: _color.withValues(alpha: 0.12),
                  blurRadius: 40,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            clipBehavior: Clip.hardEdge,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              transitionBuilder: (child, anim) =>
                  FadeTransition(opacity: anim, child: child),
              child: _showSearch ? _buildSearchExpanded() : _buildNavItems(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchExpanded() {
    return Row(
      key: const ValueKey('sosearch'),
      children: [
        Container(
          margin: const EdgeInsets.all(8),
          width: 48,
          height: 48,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [_color, _colorDark],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.all(Radius.circular(24)),
          ),
          child: const Icon(Icons.search, color: Colors.white, size: 20),
        ),
        Expanded(
          child: TextField(
            controller: _searchCtrl,
            autofocus: true,
            style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
            onChanged: (v) => setState(() => _search = v),
            decoration: InputDecoration(
              hintText: 'Search orders…',
              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
              border: InputBorder.none,
              isDense: true,
            ),
          ),
        ),
        GestureDetector(
          onTap: () => setState(() {
            _showSearch = false;
            _search     = '';
            _searchCtrl.clear();
          }),
          child: Container(
            margin: const EdgeInsets.all(10),
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(Icons.close, size: 18, color: Color(0xFF64748B)),
          ),
        ),
      ],
    );
  }

  Widget _buildNavItems() {
    return Row(
      key: const ValueKey('sonav'),
      children: [
        _navItem(icon: Icons.search,           label: 'Search',  tab: 'search'),
        _navItem(icon: Icons.list_outlined,    label: 'All',     tab: 'all'),
        _navItem(icon: Icons.hourglass_empty,  label: 'Pending', tab: 'pending'),
        _navItem(icon: Icons.done_all_outlined,label: 'Done',    tab: 'done'),
      ],
    );
  }

  Widget _navItem({required IconData icon, required String label, required String tab}) {
    final active = (tab == 'search') ? false : _activeTab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          if (tab == 'search') {
            setState(() => _showSearch = true);
          } else {
            setState(() => _activeTab = tab);
          }
        },
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeInOut,
          margin: const EdgeInsets.all(6),
          decoration: active
              ? const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [_color, _colorDark],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.all(Radius.circular(26)),
                )
              : null,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22,
                  color: active ? Colors.white : const Color(0xFF94A3B8)),
              const SizedBox(height: 3),
              Text(label,
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                    color: active ? Colors.white : const Color(0xFF94A3B8),
                    letterSpacing: 0.2,
                  )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value,
          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label,
          style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2),
          textAlign: TextAlign.center),
    ]),
  );
}

// ── Sales Order Card ──────────────────────────────────────────────────────────

class _SalesOrderCard extends StatelessWidget {
  final SalesOrder order;
  final VoidCallback onStatusChanged;

  const _SalesOrderCard({required this.order, required this.onStatusChanged});

  static const _statusColors = {
    'DRAFT':         Color(0xFF3B82F6),
    'PENDING':       Color(0xFFF59E0B),
    'IN_PRODUCTION': Color(0xFF8B5CF6),
    'DELIVERED':     Color(0xFF10B981),
    'CANCELLED':     Color(0xFF6B7280),
    'PROCESSING':    Color(0xFF8B5CF6),
  };

  static const _statusLabels = {
    'DRAFT':         'Draft',
    'PENDING':       'Pending',
    'IN_PRODUCTION': 'In Production',
    'DELIVERED':     'Delivered',
    'CANCELLED':     'Cancelled',
  };

  static String _fmtDate(String s) {
    try {
      return DateFormat('dd MMM yyyy').format(DateTime.parse(s));
    } catch (_) {
      return s;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = _statusColors[order.status] ?? const Color(0xFF9E9E9E);
    final fmt   = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    final label = _statusLabels[order.status] ?? order.status;

    return GestureDetector(
      onTap: () => _showDetail(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(color: color.withValues(alpha: 0.10), blurRadius: 12, offset: const Offset(0, 4)),
            BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 4, offset: const Offset(0, 1)),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: IntrinsicHeight(
            child: Row(children: [
              Container(width: 4, color: color),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  child: Row(children: [
                    Container(
                      width: 42, height: 42,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Icon(Icons.receipt_long_outlined, color: color, size: 20),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(order.soNumber,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.3,
                              color: Color(0xFF374151),
                              fontFamily: 'monospace',
                            )),
                        if (order.customerName != null)
                          Text(order.customerName!,
                              style: const TextStyle(fontSize: 13, color: Color(0xFF111827), fontWeight: FontWeight.w600)),
                        if (order.createdAt.isNotEmpty)
                          Text(_fmtDate(order.createdAt),
                              style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF))),
                      ]),
                    ),
                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                      Text(fmt.format(order.totalAmount),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF111827))),
                      const SizedBox(height: 5),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: color,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(label,
                            style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.w700)),
                      ),
                    ]),
                  ]),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _SODetailSheet(order: order, onStatusChanged: onStatusChanged),
    );
  }
}

// ── Detail Sheet ──────────────────────────────────────────────────────────────

class _SODetailSheet extends StatelessWidget {
  final SalesOrder order;
  final VoidCallback onStatusChanged;

  const _SODetailSheet({required this.order, required this.onStatusChanged});

  static const _statusColors = {
    'DRAFT':         Color(0xFF3B82F6),
    'PENDING':       Color(0xFFF59E0B),
    'IN_PRODUCTION': Color(0xFF8B5CF6),
    'DELIVERED':     Color(0xFF10B981),
    'CANCELLED':     Color(0xFF6B7280),
  };

  static const _statusLabels = {
    'DRAFT':         'Draft',
    'PENDING':       'Pending',
    'IN_PRODUCTION': 'In Production',
    'DELIVERED':     'Delivered',
    'CANCELLED':     'Cancelled',
  };

  @override
  Widget build(BuildContext context) {
    final fmt   = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    final color = _statusColors[order.status] ?? const Color(0xFF6B7280);
    final label = _statusLabels[order.status] ?? order.status;
    final canConvert = order.status == 'DRAFT';
    final canCancel  = order.status == 'DRAFT' || order.status == 'PENDING';

    return DraggableScrollableSheet(
      initialChildSize: 0.70,
      maxChildSize:     0.95,
      minChildSize:     0.4,
      expand: false,
      builder: (_, ctrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Header
            Container(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.06),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Center(
                  child: Container(
                    width: 36, height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.shade300,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(children: [
                  Container(
                    width: 44, height: 44,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(Icons.receipt_long_outlined, color: color, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(order.soNumber,
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: -0.3)),
                      if (order.customerName != null)
                        Text(order.customerName!,
                            style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
                    ]),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(label,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 11)),
                  ),
                ]),
              ]),
            ),
            // Items list
            Expanded(
              child: order.items.isNotEmpty
                  ? ListView.builder(
                      controller: ctrl,
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                      itemCount: order.items.length,
                      itemBuilder: (_, i) {
                        final item = order.items[i];
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: Row(children: [
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text(item.productName,
                                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF111827))),
                                Text('${item.quantity} × ${fmt.format(item.unitPrice)}',
                                    style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
                              ]),
                            ),
                            Text(fmt.format(item.total),
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF111827))),
                          ]),
                        );
                      },
                    )
                  : const Center(child: Text('No items loaded', style: TextStyle(color: Colors.grey))),
            ),
            // Footer
            Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, -4))],
              ),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: Color(0xFF111827))),
                    Text(fmt.format(order.totalAmount),
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: Color(0xFF111827))),
                  ],
                ),
                const SizedBox(height: 12),
                if (canConvert)
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: () => _doConvert(context),
                      icon: const Icon(Icons.precision_manufacturing_outlined, size: 18),
                      label: const Text('Convert All to Production Order',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF8B5CF6),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                if (canCancel) ...[
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: () => _doAction(context, 'cancel'),
                      icon: const Icon(Icons.cancel_outlined, size: 18),
                      label: const Text('Cancel Order', style: TextStyle(fontWeight: FontWeight.w600)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                        side: const BorderSide(color: Colors.red),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                ],
              ]),
            ),
            SizedBox(height: MediaQuery.of(context).padding.bottom),
          ],
        ),
      ),
    );
  }

  Future<void> _doConvert(BuildContext context) async {
    Navigator.pop(context);
    try {
      await ApiService().convertSalesOrderAllToPO(order.id);
      onStatusChanged();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Converted to Production Order successfully'),
            backgroundColor: Color(0xFF8B5CF6),
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Future<void> _doAction(BuildContext context, String action) async {
    Navigator.pop(context);
    try {
      await ApiService().cancelSalesOrder(order.id);
      onStatusChanged();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Order ${action}ed successfully')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}

// ── Create Sheet ──────────────────────────────────────────────────────────────

class _CreateSOSheet extends StatefulWidget {
  final VoidCallback onCreated;
  const _CreateSOSheet({required this.onCreated});

  @override
  State<_CreateSOSheet> createState() => _CreateSOSheetState();
}

class _CreateSOSheetState extends State<_CreateSOSheet> {
  static const _color = Color(0xFF4F46E5);

  final _customerCtrl = TextEditingController();
  final _notesCtrl    = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _customerCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 20, right: 20, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(
                color: _color.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.shopping_bag_outlined, color: _color, size: 18),
            ),
            const SizedBox(width: 10),
            const Text('New Sales Order',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          ]),
          const SizedBox(height: 16),
          TextField(
            controller: _customerCtrl,
            decoration: InputDecoration(
              labelText: 'Customer Name',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: _color),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notesCtrl,
            decoration: InputDecoration(
              labelText: 'Notes (optional)',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: const BorderSide(color: _color),
              ),
            ),
            maxLines: 2,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: _color,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _saving
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Create Sales Order',
                      style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await ApiService().createSalesOrder({
        'customerName': _customerCtrl.text.trim(),
        'notes':        _notesCtrl.text.trim(),
        'items':        [],
      });
      if (mounted) Navigator.pop(context);
      widget.onCreated();
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}
