import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  final List<Order> _orders = [];
  int _page = 0;
  bool _loading = false;
  bool _hasMore = true;
  final ScrollController _scrollCtrl = ScrollController();

  String _activeTab = 'all';
  bool _showSearch = false;
  String _search = '';
  final _searchCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _scrollCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
            _scrollCtrl.position.maxScrollExtent - 150 &&
        !_loading &&
        _hasMore) {
      _load();
    }
  }

  Future<void> _load({bool reset = false}) async {
    final outletId = ref.read(authProvider).user?.outletId;
    if (outletId == null) return;
    if (_loading) return;
    if (reset) {
      _orders.clear();
      _page = 0;
      _hasMore = true;
    }
    setState(() => _loading = true);
    try {
      final batch = await ApiService()
          .getOrdersByOutletPaged(outletId, page: _page, size: 20);
      setState(() {
        _orders.addAll(batch);
        _page++;
        if (batch.length < 20) _hasMore = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  List<Order> get _filtered {
    var list = _orders.where((o) {
      if (_activeTab == 'active') {
        return o.status != 'COMPLETED' &&
            o.status != 'CANCELLED' &&
            o.status != 'REFUNDED';
      }
      if (_activeTab == 'completed') return o.status == 'COMPLETED';
      if (_activeTab == 'cancelled') return o.status == 'CANCELLED';
      return true;
    }).toList();

    if (_search.trim().isNotEmpty) {
      final q = _search.toLowerCase();
      list = list
          .where((o) =>
              o.orderNumber.toLowerCase().contains(q) ||
              (o.customer?.name.toLowerCase().contains(q) ?? false))
          .toList();
    }
    return list;
  }

  int get _completedCount =>
      _orders.where((o) => o.status == 'COMPLETED').length;
  int get _activeCount => _orders
      .where((o) =>
          o.status != 'COMPLETED' &&
          o.status != 'CANCELLED' &&
          o.status != 'REFUNDED')
      .length;

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: CustomScrollView(
          controller: _scrollCtrl,
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
                  : const IconButton(
                      icon: Icon(Icons.menu_outlined),
                      onPressed: openAppDrawer,
                      tooltip: 'Open menu',
                    ),
              title: const Text(
                'Orders',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  color: Colors.white,
                ),
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
                  child: Stack(
                    children: [
                      Positioned(
                        right: -24,
                        top: -24,
                        child: Container(
                          width: 110,
                          height: 110,
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
                          child: Row(
                            children: [
                              _hStat('${_orders.length}', 'Orders'),
                              _hStat('$_completedCount', 'Completed'),
                              _hStat('$_activeCount', 'Active'),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            if (filtered.isEmpty && !_loading)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.receipt_long_outlined,
                          size: 48, color: Colors.grey.shade300),
                      const SizedBox(height: 12),
                      Text(
                        'No orders found',
                        style: TextStyle(
                            color: Colors.grey.shade500,
                            fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              )
            else if (_loading && _orders.isEmpty)
              const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()),
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
                      final o = filtered[i];
                      return GestureDetector(
                        onTap: () => showDialog(
                          context: context,
                          builder: (_) => _OrderDetailDialog(
                            order: o,
                            onCancelled: () => _load(reset: true),
                          ),
                        ),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.06),
                                blurRadius: 10,
                                offset: const Offset(0, 2),
                              ),
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.03),
                                blurRadius: 4,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Row(
                              children: [
                                Container(
                                  width: 40,
                                  height: 40,
                                  decoration: BoxDecoration(
                                    color: _color.withValues(alpha: 0.10),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(
                                      Icons.receipt_long_outlined,
                                      color: _color,
                                      size: 20),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        o.orderNumber,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                        ),
                                      ),
                                      Text(
                                        '${o.customer?.name ?? 'Walk-in'}  •  ${o.items.length} items  •  ${_fmtDate(o.createdAt)}',
                                        style: TextStyle(
                                          color: Colors.grey.shade600,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      '₹${o.totalAmount.toStringAsFixed(0)}',
                                      style: const TextStyle(
                                        color: _color,
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    _StatusBadge(status: o.status),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                    childCount: filtered.length + (_hasMore ? 1 : 0),
                  ),
                ),
              ),
          ],
        ),
      ),
      bottomNavigationBar: _buildFloatingNav(),
    );
  }

  Widget _buildFloatingNav() {
    return Container(
      color: Colors.transparent,
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
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
                  child:
                      _showSearch ? _buildSearchExpanded() : _buildNavItems(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchExpanded() {
    return Row(
      key: const ValueKey('osearch'),
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
              hintStyle:
                  TextStyle(color: Colors.grey.shade400, fontSize: 13),
              border: InputBorder.none,
              isDense: true,
            ),
          ),
        ),
        GestureDetector(
          onTap: () => setState(() {
            _showSearch = false;
            _search = '';
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
            child: const Icon(Icons.close,
                size: 18, color: Color(0xFF64748B)),
          ),
        ),
      ],
    );
  }

  Widget _buildNavItems() {
    return Row(
      key: const ValueKey('onav'),
      children: [
        _navItem(
          icon: Icons.search,
          label: 'Search',
          active: false,
          onTap: () => setState(() => _showSearch = true),
        ),
        _navItem(
          icon: Icons.all_inbox_outlined,
          label: 'All',
          active: _activeTab == 'all',
          onTap: () => setState(() => _activeTab = 'all'),
        ),
        _navItem(
          icon: Icons.bolt_outlined,
          label: 'Active',
          active: _activeTab == 'active',
          onTap: () => setState(() => _activeTab = 'active'),
        ),
        _navItem(
          icon: Icons.check_circle_outline,
          label: 'Completed',
          active: _activeTab == 'completed',
          onTap: () => setState(() => _activeTab = 'completed'),
        ),
        _navItem(
          icon: Icons.cancel_outlined,
          label: 'Cancelled',
          active: _activeTab == 'cancelled',
          onTap: () => setState(() => _activeTab = 'cancelled'),
        ),
      ],
    );
  }

  Widget _navItem({
    required IconData icon,
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
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
              Icon(icon,
                  size: 22,
                  color: active ? Colors.white : const Color(0xFF94A3B8)),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight:
                      active ? FontWeight.w700 : FontWeight.w500,
                  color: active ? Colors.white : const Color(0xFF94A3B8),
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              value,
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Colors.white),
            ),
            Text(
              label,
              style: const TextStyle(
                  fontSize: 9, color: Colors.white70, letterSpacing: 0.2),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );

  String _fmtDate(String iso) {
    if (iso.isEmpty) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return '';
    }
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'COMPLETED' => Colors.green,
      'CANCELLED' => Colors.red,
      'REFUNDED' => Colors.orange,
      'HELD' => Colors.blue,
      _ => Colors.grey,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(status, style: TextStyle(color: color, fontSize: 10)),
    );
  }
}

class _OrderDetailDialog extends StatefulWidget {
  final Order order;
  final VoidCallback onCancelled;
  const _OrderDetailDialog(
      {required this.order, required this.onCancelled});

  @override
  State<_OrderDetailDialog> createState() => _OrderDetailDialogState();
}

class _OrderDetailDialogState extends State<_OrderDetailDialog> {
  late Order _order;
  bool _cancelling = false;

  @override
  void initState() {
    super.initState();
    _order = widget.order;
  }

  bool get _canCancel =>
      _order.status != 'COMPLETED' &&
      _order.status != 'CANCELLED' &&
      _order.status != 'REFUNDED';

  Future<void> _cancelOrder() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel Order'),
        content: Text(
            'Are you sure you want to cancel order ${_order.orderNumber}?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('No')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Yes, Cancel',
                style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _cancelling = true);
    try {
      final updated = await ApiService().cancelOrder(_order.id);
      setState(() => _order = updated);
      widget.onCancelled();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Order cancelled'),
              backgroundColor: Colors.orange),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(
        children: [
          Expanded(child: Text(_order.orderNumber)),
          _StatusBadge(status: _order.status),
        ],
      ),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_order.customer != null) ...[
              Text('Customer: ${_order.customer!.name}',
                  style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
            ],
            const Text('Items:',
                style: TextStyle(fontWeight: FontWeight.w600)),
            ..._order.items.map((item) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Expanded(child: Text(item.productName)),
                      Text(
                          '${item.quantity.toStringAsFixed(0)} × ₹${item.unitPrice.toStringAsFixed(2)}'),
                    ],
                  ),
                )),
            const Divider(),
            _Row('Subtotal', _order.subtotal),
            if (_order.discountAmount > 0)
              _Row('Discount', -_order.discountAmount, color: Colors.green),
            _Row('Tax', _order.taxAmount),
            const Divider(),
            _Row('Total', _order.totalAmount, bold: true),
            const SizedBox(height: 8),
            const Text('Payments:',
                style: TextStyle(fontWeight: FontWeight.w600)),
            ..._order.payments.map((p) => _Row(p.paymentMethod, p.amount)),
          ],
        ),
      ),
      actions: [
        if (_canCancel)
          TextButton.icon(
            icon: _cancelling
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.cancel_outlined, color: Colors.red),
            label: const Text('Cancel Order',
                style: TextStyle(color: Colors.red)),
            onPressed: _cancelling ? null : _cancelOrder,
          ),
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close')),
      ],
    );
  }

  // ignore: non_constant_identifier_names
  Widget _Row(String label, double amount,
      {Color? color, bool bold = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: TextStyle(
                    color: color,
                    fontWeight:
                        bold ? FontWeight.bold : FontWeight.normal)),
            Text('₹${amount.abs().toStringAsFixed(2)}',
                style: TextStyle(
                    color: color,
                    fontWeight:
                        bold ? FontWeight.bold : FontWeight.normal)),
          ],
        ),
      );
}
