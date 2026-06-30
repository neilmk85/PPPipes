import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';

class ProductionScreen extends StatefulWidget {
  const ProductionScreen({super.key});

  @override
  State<ProductionScreen> createState() => _ProductionScreenState();
}

class _ProductionScreenState extends State<ProductionScreen> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  static const _statusColors = {
    'PENDING': Color(0xFFFF9800),
    'IN_PROGRESS': Color(0xFF2196F3),
    'COMPLETED': Color(0xFF4CAF50),
    'CANCELLED': Color(0xFF9E9E9E),
    'ON_HOLD': Color(0xFFFF9800),
  };

  final List<ProductionOrder> _orders = [];
  bool _loading = false;
  bool _hasMore = true;
  int _page = 0;
  final _scroll = ScrollController();

  String _tab = 'all';
  bool _showSearch = false;
  String _query = '';
  final _searchCtrl = TextEditingController();

  int get _completed =>
      _orders.where((o) => o.status == 'COMPLETED').length;
  int get _inProgress =>
      _orders.where((o) => o.status == 'IN_PROGRESS').length;

  List<ProductionOrder> get _filtered {
    var list = _orders.where((o) {
      if (_tab == 'pending') {
        return o.status == 'PENDING' || o.status == 'ON_HOLD';
      } else if (_tab == 'progress') {
        return o.status == 'IN_PROGRESS';
      } else if (_tab == 'done') {
        return o.status == 'COMPLETED' || o.status == 'CANCELLED';
      }
      return true;
    }).toList();

    if (_query.isNotEmpty) {
      final q = _query.toLowerCase();
      list = list.where((o) {
        return o.poNumber.toLowerCase().contains(q) ||
            (o.pipeConfig != null &&
                o.pipeConfig!.toLowerCase().contains(q));
      }).toList();
    }

    return list;
  }

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
    _scroll.dispose();
    _searchCtrl.dispose();
    super.dispose();
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
      final raw = await ApiService().getProductionOrders(page: _page, size: 20);
      final items = raw.map((e) => ProductionOrder.fromJson(e)).toList();
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

  void _showDetail(BuildContext context, ProductionOrder order) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _ProductionDetailSheet(
          order: order, onAddEntry: () => _showAddEntrySheet(context, order)),
    );
  }

  void _showAddEntrySheet(BuildContext context, ProductionOrder? order) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _AddEntrySheet(
          selectedOrder: order, onAdded: () => _load(reset: true)),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(value,
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Colors.white)),
          Text(label,
              style: const TextStyle(
                  fontSize: 9, color: Colors.white70, letterSpacing: 0.2),
              textAlign: TextAlign.center),
        ]),
      );

  Widget _navItem(
      {required IconData icon,
      required String label,
      required String tab,
      VoidCallback? onTap}) {
    final active = !_showSearch && _tab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: onTap ?? () => setState(() => _tab = tab),
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
                      end: Alignment.bottomRight),
                  borderRadius: BorderRadius.all(Radius.circular(26)))
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon,
                size: 22,
                color: active ? Colors.white : const Color(0xFF94A3B8)),
            const SizedBox(height: 3),
            Text(label,
                style: TextStyle(
                    fontSize: 9.5,
                    fontWeight:
                        active ? FontWeight.w700 : FontWeight.w500,
                    color:
                        active ? Colors.white : const Color(0xFF94A3B8),
                    letterSpacing: 0.2)),
          ]),
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
                    end: Alignment.bottomRight),
                borderRadius: BorderRadius.all(Radius.circular(24))),
            child: const Icon(Icons.search, color: Colors.white, size: 20)),
        Expanded(
            child: TextField(
                controller: _searchCtrl,
                autofocus: true,
                style:
                    const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
                onChanged: (v) => setState(() => _query = v),
                decoration: InputDecoration(
                    hintText: 'Search orders…',
                    hintStyle: TextStyle(
                        color: Colors.grey.shade400, fontSize: 13),
                    border: InputBorder.none,
                    isDense: true))),
        GestureDetector(
            onTap: () => setState(() {
                  _showSearch = false;
                  _query = '';
                  _searchCtrl.clear();
                }),
            child: Container(
                margin: const EdgeInsets.all(10),
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(20)),
                child: const Icon(Icons.close,
                    size: 18, color: Color(0xFF64748B)))),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      bottomNavigationBar: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 16),
        height: 68,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(34),
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.10),
                blurRadius: 20,
                offset: const Offset(0, 4)),
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.05),
                blurRadius: 6,
                offset: const Offset(0, 1)),
          ],
        ),
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: _showSearch
              ? _buildSearchExpanded()
              : Row(
                  key: const ValueKey('pnav'),
                  children: [
                    _navItem(
                        icon: Icons.search,
                        label: 'Search',
                        tab: 'search',
                        onTap: () => setState(() => _showSearch = true)),
                    _navItem(
                        icon: Icons.list_outlined, label: 'All', tab: 'all'),
                    _navItem(
                        icon: Icons.pending_outlined,
                        label: 'Pending',
                        tab: 'pending'),
                    _navItem(
                        icon: Icons.autorenew_outlined,
                        label: 'In Progress',
                        tab: 'progress'),
                    _navItem(
                        icon: Icons.check_circle_outline,
                        label: 'Done',
                        tab: 'done'),
                  ],
                ),
        ),
      ),
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
                      onPressed: () => context.pop())
                  : const IconButton(
                      icon: Icon(Icons.menu_outlined),
                      onPressed: openAppDrawer),
              title: const Text('Production',
                  style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                      color: Colors.white)),
              actions: [
                TextButton(
                  onPressed: () => _showAddEntrySheet(context, null),
                  style: TextButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.15),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 4),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.add, size: 14),
                      SizedBox(width: 4),
                      Text('Record',
                          style: TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
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
                      Positioned(
                        bottom: 10,
                        left: 0,
                        right: 0,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            _hStat('${_orders.length}', 'Orders'),
                            _hStat('$_completed', 'Completed'),
                            _hStat('$_inProgress', 'In Progress'),
                          ],
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
                      Icon(Icons.precision_manufacturing_outlined,
                          size: 48, color: Colors.grey.shade300),
                      const SizedBox(height: 12),
                      Text(
                        _query.isNotEmpty || _tab != 'all'
                            ? 'No orders match your filter'
                            : 'No production orders found',
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
                      final order = filtered[i];
                      final color = _statusColors[order.status] ??
                          const Color(0xFF9E9E9E);
                      return GestureDetector(
                        onTap: () => _showDetail(context, order),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.06),
                                  blurRadius: 10,
                                  offset: const Offset(0, 2)),
                              BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.03),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1)),
                            ],
                          ),
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Container(
                                      width: 40,
                                      height: 40,
                                      decoration: BoxDecoration(
                                        color: color.withValues(alpha: 0.12),
                                        borderRadius:
                                            BorderRadius.circular(10),
                                      ),
                                      child: Icon(
                                          Icons
                                              .precision_manufacturing_outlined,
                                          color: color,
                                          size: 20),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(order.poNumber,
                                              style: const TextStyle(
                                                  fontWeight:
                                                      FontWeight.bold)),
                                          if (order.pipeConfig != null)
                                            Text(order.pipeConfig!,
                                                style: const TextStyle(
                                                    fontSize: 12,
                                                    color: Colors.grey)),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: color.withValues(alpha: 0.12),
                                        borderRadius:
                                            BorderRadius.circular(8),
                                      ),
                                      child: Text(order.status,
                                          style: TextStyle(
                                              fontSize: 10,
                                              color: color,
                                              fontWeight: FontWeight.bold)),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                        '${order.completedQuantity.toStringAsFixed(0)} / ${order.targetQuantity.toStringAsFixed(0)} units',
                                        style: const TextStyle(
                                            fontSize: 12,
                                            color: Colors.grey)),
                                    Text(
                                        '${(order.progressPercent * 100).toStringAsFixed(0)}%',
                                        style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: color)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    value: order.progressPercent,
                                    minHeight: 6,
                                    backgroundColor:
                                        color.withValues(alpha: 0.15),
                                    valueColor:
                                        AlwaysStoppedAnimation(color),
                                  ),
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
    );
  }
}

class _ProductionDetailSheet extends StatefulWidget {
  final ProductionOrder order;
  final VoidCallback onAddEntry;
  const _ProductionDetailSheet(
      {required this.order, required this.onAddEntry});

  @override
  State<_ProductionDetailSheet> createState() =>
      _ProductionDetailSheetState();
}

class _ProductionDetailSheetState extends State<_ProductionDetailSheet> {
  List<ProductionEntry> _entries = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadEntries();
  }

  Future<void> _loadEntries() async {
    try {
      final raw = await ApiService().getEntriesByOrder(widget.order.id);
      setState(() {
        _entries = raw.map((e) => ProductionEntry.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        expand: false,
        builder: (_, ctrl) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(widget.order.poNumber,
                            style: const TextStyle(
                                fontSize: 18, fontWeight: FontWeight.bold)),
                        if (widget.order.pipeConfig != null)
                          Text(widget.order.pipeConfig!,
                              style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                  ),
                  FilledButton.icon(
                    onPressed: () {
                      Navigator.pop(context);
                      widget.onAddEntry();
                    },
                    icon: const Icon(Icons.add, size: 16),
                    label: const Text('Add Entry'),
                    style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF4F46E5),
                        visualDensity: VisualDensity.compact),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: widget.order.progressPercent,
                  minHeight: 8,
                ),
              ),
              Text(
                  '${widget.order.completedQuantity.toStringAsFixed(0)} / ${widget.order.targetQuantity.toStringAsFixed(0)} units',
                  style: const TextStyle(fontSize: 12, color: Colors.grey)),
              const Divider(height: 20),
              const Text('Production Entries',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              if (_loading)
                const Center(child: CircularProgressIndicator())
              else if (_entries.isEmpty)
                const Center(child: Text('No entries yet'))
              else
                Expanded(
                  child: ListView.builder(
                    controller: ctrl,
                    itemCount: _entries.length,
                    itemBuilder: (_, i) {
                      final e = _entries[i];
                      return ListTile(
                        dense: true,
                        leading: const Icon(Icons.check_circle_outline,
                            color: Color(0xFF4F46E5)),
                        title: Text(
                            '${e.quantityProduced.toStringAsFixed(0)} units'
                            '${e.stage != null ? ' — ${e.stage}' : ''}'),
                        subtitle: Text(e.machine ?? '',
                            style: const TextStyle(fontSize: 11)),
                        trailing: e.createdAt != null
                            ? Text(
                                DateFormat('dd MMM').format(
                                    DateTime.parse(e.createdAt!)),
                                style: const TextStyle(
                                    fontSize: 11, color: Colors.grey))
                            : null,
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AddEntrySheet extends StatefulWidget {
  final ProductionOrder? selectedOrder;
  final VoidCallback onAdded;
  const _AddEntrySheet({this.selectedOrder, required this.onAdded});

  @override
  State<_AddEntrySheet> createState() => _AddEntrySheetState();
}

class _AddEntrySheetState extends State<_AddEntrySheet> {
  List<ProductionOrder> _orders = [];
  ProductionOrder? _pickedOrder;
  final _qtyCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String? _stage;
  bool _loading = true;
  bool _saving = false;

  final _stages = ['MIXING', 'CASTING', 'CURING', 'TESTING', 'FINISHING'];

  @override
  void initState() {
    super.initState();
    _pickedOrder = widget.selectedOrder;
    _loadOrders();
  }

  Future<void> _loadOrders() async {
    try {
      final raw = await ApiService().getProductionOrders(size: 50);
      setState(() {
        _orders = raw.map((e) => ProductionOrder.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Padding(
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
            const Text('Record Production Entry',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            if (_loading)
              const Center(child: CircularProgressIndicator())
            else
              DropdownButtonFormField<ProductionOrder>(
                value: _pickedOrder,
                decoration: const InputDecoration(
                  labelText: 'Production Order',
                  border: OutlineInputBorder(),
                ),
                items: _orders
                    .map((o) =>
                        DropdownMenuItem(value: o, child: Text(o.poNumber)))
                    .toList(),
                onChanged: (v) => setState(() => _pickedOrder = v),
              ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              value: _stage,
              decoration: const InputDecoration(
                labelText: 'Stage',
                border: OutlineInputBorder(),
              ),
              items: _stages
                  .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                  .toList(),
              onChanged: (v) => setState(() => _stage = v),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _qtyCtrl,
              decoration: const InputDecoration(
                labelText: 'Quantity Produced',
                border: OutlineInputBorder(),
              ),
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesCtrl,
              decoration: const InputDecoration(
                labelText: 'Notes (optional)',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF4F46E5)),
                child: _saving
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Save Entry'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_pickedOrder == null) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Select a production order')));
      return;
    }
    final qty = double.tryParse(_qtyCtrl.text.trim());
    if (qty == null || qty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid quantity')));
      return;
    }
    setState(() => _saving = true);
    try {
      await ApiService().createProductionEntry({
        'productionOrderId': _pickedOrder!.id,
        'stage': _stage,
        'quantityProduced': qty,
        'notes': _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
      widget.onAdded();
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}
