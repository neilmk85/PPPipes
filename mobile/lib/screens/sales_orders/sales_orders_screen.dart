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
      case 'confirmed':
        list = list.where((o) => o.status == 'CONFIRMED').toList();
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
  int get _confirmedCount => _orders.where((o) => o.status == 'CONFIRMED').length;

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
                                _hStat('$_confirmedCount',  'Confirmed'),
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
        _navItem(icon: Icons.search,              label: 'Search',    tab: 'search'),
        _navItem(icon: Icons.list_outlined,        label: 'All',       tab: 'all'),
        _navItem(icon: Icons.hourglass_empty,      label: 'Pending',   tab: 'pending'),
        _navItem(icon: Icons.check_circle_outline, label: 'Confirmed', tab: 'confirmed'),
        _navItem(icon: Icons.done_all_outlined,    label: 'Done',      tab: 'done'),
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

  static const _color = Color(0xFF4F46E5);

  static const _statusColors = {
    'PENDING':    Color(0xFFFF9800),
    'CONFIRMED':  Color(0xFF2196F3),
    'DELIVERED':  Color(0xFF4CAF50),
    'CANCELLED':  Color(0xFF9E9E9E),
    'PROCESSING': Color(0xFF9C27B0),
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

    return GestureDetector(
      onTap: () => _showDetail(context),
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2)),
            BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4,  offset: const Offset(0, 1)),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: _color.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.shopping_bag_outlined, color: _color, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(order.soNumber,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                if (order.customerName != null)
                  Text(order.customerName!,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                if (order.createdAt.isNotEmpty)
                  Text(_fmtDate(order.createdAt),
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Text(fmt.format(order.totalAmount),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(order.status,
                    style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.bold)),
              ),
            ]),
          ]),
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

  static const _color = Color(0xFF4F46E5);

  static const _statusColors = {
    'PENDING':   Color(0xFFFF9800),
    'CONFIRMED': Color(0xFF2196F3),
    'DELIVERED': Color(0xFF4CAF50),
    'CANCELLED': Color(0xFF9E9E9E),
  };

  @override
  Widget build(BuildContext context) {
    final fmt   = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    final color = _statusColors[order.status] ?? const Color(0xFF9E9E9E);

    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      maxChildSize:     0.95,
      minChildSize:     0.4,
      expand: false,
      builder: (_, ctrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Expanded(
                  child: Text(order.soNumber,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(order.status,
                      style: TextStyle(color: color, fontWeight: FontWeight.bold)),
                ),
              ]),
              if (order.customerName != null) ...[
                const SizedBox(height: 4),
                Text('Customer: ${order.customerName}',
                    style: const TextStyle(color: Colors.grey)),
              ],
              const Divider(height: 24),
              if (order.items.isNotEmpty) ...[
                const Text('Items', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Expanded(
                  child: ListView.builder(
                    controller: ctrl,
                    itemCount: order.items.length,
                    itemBuilder: (_, i) {
                      final item = order.items[i];
                      return ListTile(
                        dense: true,
                        title: Text(item.productName),
                        subtitle: Text('${item.quantity} × ${fmt.format(item.unitPrice)}'),
                        trailing: Text(fmt.format(item.total),
                            style: const TextStyle(fontWeight: FontWeight.bold)),
                      );
                    },
                  ),
                ),
              ] else
                const Expanded(child: Center(child: Text('No items loaded'))),
              const Divider(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  Text(fmt.format(order.totalAmount),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                ],
              ),
              const SizedBox(height: 16),
              if (order.status == 'PENDING')
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _doAction(context, 'cancel'),
                      icon: const Icon(Icons.cancel_outlined),
                      label: const Text('Cancel'),
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => _doAction(context, 'confirm'),
                      icon: const Icon(Icons.check_circle_outline),
                      label: const Text('Confirm'),
                      style: FilledButton.styleFrom(backgroundColor: _color),
                    ),
                  ),
                ]),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _doAction(BuildContext context, String action) async {
    Navigator.pop(context);
    try {
      if (action == 'confirm') {
        await ApiService().confirmSalesOrder(order.id);
      } else {
        await ApiService().cancelSalesOrder(order.id);
      }
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
