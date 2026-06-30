import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../widgets/date_filter_dropdown.dart';

class PurchasesScreen extends StatefulWidget {
  const PurchasesScreen({super.key});

  @override
  State<PurchasesScreen> createState() => _PurchasesScreenState();
}

class _PurchasesScreenState extends State<PurchasesScreen> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  final List<PurchaseOrder> _orders = [];
  bool _loading = false;
  bool _hasMore = true;
  int _page = 0;
  final _scroll = ScrollController();

  bool _showSearch = false;
  String _search = '';
  final _searchCtrl = TextEditingController();
  String _tab = 'all';

  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  BizDateFilter _dateFilter = const BizDateFilter();

  static const _statusColors = {
    'DRAFT': Color(0xFF9E9E9E),
    'PENDING': Color(0xFFFF9800),
    'APPROVED': Color(0xFF2196F3),
    'RECEIVED': Color(0xFF4CAF50),
    'CANCELLED': Color(0xFFF44336),
  };

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
    _closeDateOverlay();
    _scroll.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  void _closeDateOverlay() {
    _dateOverlay?.remove();
    _dateOverlay = null;
  }

  void _toggleDateOverlay() {
    if (_dateOverlay != null) { _closeDateOverlay(); return; }
    final entry = OverlayEntry(
      builder: (_) => BizDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() => _dateFilter = f);
          _load(reset: true);
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    if (reset) {
      _orders.clear();
      _page = 0;
      _hasMore = true;
    }
    setState(() => _loading = true);
    try {
      final fmt = DateFormat('yyyy-MM-dd');
      final raw = await ApiService().getPurchaseOrders(
        page: _page, size: 20,
        from: _dateFilter.from != null ? fmt.format(_dateFilter.from!) : null,
        to:   _dateFilter.to   != null ? fmt.format(_dateFilter.to!)   : null,
      );
      final items = raw.map((e) => PurchaseOrder.fromJson(e)).toList();
      setState(() {
        _orders.addAll(items);
        _page++;
        _hasMore = items.length == 20;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  List<PurchaseOrder> get _filtered {
    var list = _orders.where((po) {
      if (_tab == 'pending') return po.status == 'PENDING';
      if (_tab == 'approved') return po.status == 'APPROVED';
      if (_tab == 'received') return po.status == 'RECEIVED';
      return true;
    }).toList();

    if (_search.trim().isNotEmpty) {
      final q = _search.toLowerCase();
      list = list
          .where((po) =>
              po.poNumber.toLowerCase().contains(q) ||
              (po.vendorName ?? '').toLowerCase().contains(q))
          .toList();
    }
    return list;
  }

  int get _pendingCount =>
      _orders.where((po) => po.status == 'PENDING').length;
  int get _approvedCount =>
      _orders.where((po) => po.status == 'APPROVED').length;
  double get _totalValue =>
      _orders.fold(0.0, (s, po) => s + po.totalAmount);

  void _showCreateSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CreatePOSheet(onCreated: () => _load(reset: true)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final filtered = _filtered;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: RefreshIndicator(
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
                  : const IconButton(
                      icon: Icon(Icons.menu_outlined),
                      onPressed: openAppDrawer,
                      tooltip: 'Open menu',
                    ),
              title: const Text(
                'Purchase Orders',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  color: Colors.white,
                ),
              ),
              actions: [
                CompositedTransformTarget(
                  link: _layerLink,
                  child: GestureDetector(
                    onTap: _toggleDateOverlay,
                    child: Container(
                      margin: const EdgeInsets.only(left: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                        const SizedBox(width: 5),
                        Text(
                          _dateFilter.isActive ? _dateFilter.label : 'Date',
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(width: 3),
                        const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                      ]),
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                GestureDetector(
                  onTap: () => _showCreateSheet(context),
                  child: Container(
                    margin: const EdgeInsets.only(right: 12),
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                          color: Colors.white.withValues(alpha: 0.25)),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.add, size: 14, color: Colors.white),
                        SizedBox(width: 4),
                        Text(
                          'New PO',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
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
                              _hStat('$_pendingCount', 'Pending'),
                              _hStat('$_approvedCount', 'Approved'),
                              _hStat(fmt.format(_totalValue), 'Value'),
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
                      Icon(Icons.local_shipping_outlined,
                          size: 48, color: Colors.grey.shade300),
                      const SizedBox(height: 12),
                      Text(
                        'No purchase orders found',
                        style: TextStyle(
                            color: Colors.grey.shade500,
                            fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
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
                      final po = filtered[i];
                      final color =
                          _statusColors[po.status] ?? const Color(0xFF9E9E9E);
                      final fmt2 = NumberFormat.currency(
                          locale: 'en_IN', symbol: '₹', decimalDigits: 0);
                      final dateStr = po.createdAt.isNotEmpty
                          ? DateFormat('dd MMM yyyy').format(
                              DateTime.tryParse(po.createdAt) ??
                                  DateTime.now())
                          : '';
                      return GestureDetector(
                        onTap: () {},
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
                                      Icons.local_shipping_outlined,
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
                                        po.poNumber,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                        ),
                                      ),
                                      Text(
                                        po.vendorName ?? 'Unknown Vendor',
                                        style: TextStyle(
                                          color: Colors.grey.shade600,
                                          fontSize: 12,
                                        ),
                                      ),
                                      if (dateStr.isNotEmpty)
                                        Text(
                                          dateStr,
                                          style: TextStyle(
                                            color: Colors.grey.shade400,
                                            fontSize: 11,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      fmt2.format(po.totalAmount),
                                      style: const TextStyle(
                                        fontWeight: FontWeight.bold,
                                        fontSize: 14,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: color.withValues(alpha: 0.12),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        po.status,
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: color,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
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
      key: const ValueKey('psearch'),
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
      key: const ValueKey('pnav'),
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
          active: _tab == 'all',
          onTap: () => setState(() => _tab = 'all'),
        ),
        _navItem(
          icon: Icons.hourglass_empty_outlined,
          label: 'Pending',
          active: _tab == 'pending',
          onTap: () => setState(() => _tab = 'pending'),
        ),
        _navItem(
          icon: Icons.check_circle_outline,
          label: 'Approved',
          active: _tab == 'approved',
          onTap: () => setState(() => _tab = 'approved'),
        ),
        _navItem(
          icon: Icons.inventory_2_outlined,
          label: 'Received',
          active: _tab == 'received',
          onTap: () => setState(() => _tab = 'received'),
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
                  color: active
                      ? Colors.white
                      : const Color(0xFF94A3B8)),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight:
                      active ? FontWeight.w700 : FontWeight.w500,
                  color: active
                      ? Colors.white
                      : const Color(0xFF94A3B8),
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
}

class _CreatePOSheet extends StatefulWidget {
  final VoidCallback onCreated;
  const _CreatePOSheet({required this.onCreated});

  @override
  State<_CreatePOSheet> createState() => _CreatePOSheetState();
}

class _CreatePOSheetState extends State<_CreatePOSheet> {
  static const _color = Color(0xFF4F46E5);

  final _vendorCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'New Purchase Order',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _vendorCtrl,
            decoration: InputDecoration(
              labelText: 'Vendor Name',
              border: const OutlineInputBorder(
                borderRadius: BorderRadius.all(Radius.circular(10)),
              ),
              focusedBorder: const OutlineInputBorder(
                borderRadius: BorderRadius.all(Radius.circular(10)),
                borderSide: BorderSide(color: _color, width: 2),
              ),
              labelStyle:
                  TextStyle(color: Colors.grey.shade600),
              floatingLabelStyle: const TextStyle(color: _color),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notesCtrl,
            decoration: InputDecoration(
              labelText: 'Notes (optional)',
              border: const OutlineInputBorder(
                borderRadius: BorderRadius.all(Radius.circular(10)),
              ),
              focusedBorder: const OutlineInputBorder(
                borderRadius: BorderRadius.all(Radius.circular(10)),
                borderSide: BorderSide(color: _color, width: 2),
              ),
              labelStyle:
                  TextStyle(color: Colors.grey.shade600),
              floatingLabelStyle: const TextStyle(color: _color),
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
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: _saving
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('Create Purchase Order'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await ApiService().createDirectPurchase({
        'vendorName': _vendorCtrl.text.trim(),
        'notes': _notesCtrl.text.trim(),
        'items': [],
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
