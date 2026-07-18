import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../widgets/date_filter_dropdown.dart';

class DirectPurchasesScreen extends StatefulWidget {
  const DirectPurchasesScreen({super.key});

  @override
  State<DirectPurchasesScreen> createState() => _DirectPurchasesScreenState();
}

class _DirectPurchasesScreenState extends State<DirectPurchasesScreen> {
  static const _color     = Color(0xFF0F766E);
  static const _colorDark = Color(0xFF0D5F58);

  final List<PurchaseOrder> _orders = [];
  bool _loading = false;
  bool _hasMore = true;
  int _page = 0;
  final _scroll = ScrollController();

  bool _showSearch = false;
  String _search = '';
  final _searchCtrl = TextEditingController();

  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  BizDateFilter _dateFilter = const BizDateFilter();

  static const _statusColors = {
    'DRAFT':      Color(0xFF9E9E9E),
    'PENDING':    Color(0xFFFF9800),
    'APPROVED':   Color(0xFF2196F3),
    'RECEIVED':   Color(0xFF4CAF50),
    'CANCELLED':  Color(0xFFF44336),
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
      final raw = await ApiService().getDirectPurchases(
        page: _page, size: 20,
        from: _dateFilter.from != null ? fmt.format(_dateFilter.from!) : null,
        to:   _dateFilter.to   != null ? fmt.format(_dateFilter.to!)   : null,
      );
      final items = raw.map((e) => PurchaseOrder.fromJson(e as Map<String, dynamic>)).toList();
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
    if (_search.trim().isEmpty) return _orders;
    final q = _search.toLowerCase();
    return _orders.where((po) =>
        po.poNumber.toLowerCase().contains(q) ||
        (po.vendorName ?? '').toLowerCase().contains(q)).toList();
  }

  double get _totalValue => _orders.fold(0.0, (s, po) => s + po.totalAmount);

  void _showSheet({PurchaseOrder? editing}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DirectPurchaseSheet(
        color: _color,
        editing: editing,
        onSaved: () => _load(reset: true),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final fmt      = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final filtered = _filtered;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      floatingActionButton: FloatingActionButton(
        backgroundColor: _color,
        onPressed: () => _showSheet(),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: CustomScrollView(
          controller: _scroll,
          slivers: [
            // ── Hero ──
            SliverToBoxAdapter(
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [_colorDark, _color],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        if (!_showSearch) ...[
                          GestureDetector(
                            onTap: () => context.canPop() ? context.pop() : context.go('/purchases'),
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.18),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: const Icon(Icons.arrow_back, color: Colors.white, size: 18),
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('Direct Purchases', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                            Text('Cash & credit purchases', style: TextStyle(color: Colors.white70, fontSize: 12)),
                          ])),
                        ] else
                          Expanded(
                            child: TextField(
                              controller: _searchCtrl,
                              autofocus: true,
                              style: const TextStyle(color: Colors.white, fontSize: 14),
                              decoration: InputDecoration(
                                hintText: 'Search vendor or number…',
                                hintStyle: const TextStyle(color: Colors.white54),
                                prefixIcon: const Icon(Icons.search, color: Colors.white54, size: 18),
                                filled: true,
                                fillColor: Colors.white.withOpacity(0.15),
                                contentPadding: const EdgeInsets.symmetric(vertical: 10),
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide.none),
                              ),
                              onChanged: (v) => setState(() => _search = v),
                            ),
                          ),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () => setState(() {
                            _showSearch = !_showSearch;
                            if (!_showSearch) { _search = ''; _searchCtrl.clear(); }
                          }),
                          child: Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.18),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(_showSearch ? Icons.close : Icons.search, color: Colors.white, size: 18),
                          ),
                        ),
                        const SizedBox(width: 6),
                        CompositedTransformTarget(
                          link: _layerLink,
                          child: GestureDetector(
                            onTap: _toggleDateOverlay,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.18),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Row(mainAxisSize: MainAxisSize.min, children: [
                                const Icon(Icons.calendar_today_outlined, color: Colors.white, size: 13),
                                const SizedBox(width: 5),
                                Text(
                                  _dateFilter.isActive ? _dateFilter.label : 'Date',
                                  style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                                const SizedBox(width: 3),
                                const Icon(Icons.keyboard_arrow_down, color: Colors.white, size: 14),
                              ]),
                            ),
                          ),
                        ),
                      ]),
                      const SizedBox(height: 14),
                      Row(children: [
                        _statChip(Icons.receipt_long_outlined, '${_orders.length}', 'purchases'),
                        const SizedBox(width: 8),
                        _statChip(Icons.currency_rupee_outlined, fmt.format(_totalValue).replaceFirst('₹', ''), 'total value'),
                      ]),
                    ]),
                  ),
                ),
              ),
            ),

            // ── List ──
            if (filtered.isEmpty && !_loading)
              SliverFillRemaining(
                child: Center(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.receipt_long_outlined, size: 48, color: Colors.grey.shade300),
                    const SizedBox(height: 12),
                    Text('No direct purchases found', style: TextStyle(color: Colors.grey.shade400, fontSize: 14)),
                  ]),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 100),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) {
                      if (i == filtered.length) {
                        return _loading
                            ? const Padding(
                                padding: EdgeInsets.all(16),
                                child: Center(child: CircularProgressIndicator()),
                              )
                            : const SizedBox.shrink();
                      }
                      return _buildCard(filtered[i], fmt);
                    },
                    childCount: filtered.length + 1,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _statChip(IconData icon, String value, String label) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(children: [
        Icon(icon, color: Colors.white70, size: 16),
        const SizedBox(width: 6),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 10)),
        ]),
      ]),
    ),
  );

  Widget _buildCard(PurchaseOrder po, NumberFormat fmt) {
    final statusColor = _statusColors[po.status] ?? Colors.grey;
    final date = po.createdAt.isNotEmpty
        ? DateFormat('d MMM yyyy').format(DateTime.tryParse(po.createdAt) ?? DateTime.now())
        : '—';
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _showSheet(editing: po),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text(po.poNumber,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF1F2937))),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(po.status,
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusColor)),
              ),
              const SizedBox(width: 6),
              Icon(Icons.chevron_right, size: 16, color: Colors.grey.shade400),
            ]),
            const SizedBox(height: 6),
            if (po.vendorName != null)
              Row(children: [
                Icon(Icons.business_outlined, size: 13, color: Colors.grey.shade500),
                const SizedBox(width: 4),
                Text(po.vendorName!, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              ]),
            const SizedBox(height: 8),
            Row(children: [
              Icon(Icons.calendar_today_outlined, size: 12, color: Colors.grey.shade400),
              const SizedBox(width: 4),
              Text(date, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
              const Spacer(),
              Text(fmt.format(po.totalAmount),
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F766E))),
            ]),
            if (po.items.isNotEmpty) ...[
              const SizedBox(height: 8),
              const Divider(height: 1),
              const SizedBox(height: 6),
              ...po.items.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 2),
                child: Row(children: [
                  Expanded(child: Text(item.productName,
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade600), overflow: TextOverflow.ellipsis)),
                  Text('${item.quantity % 1 == 0 ? item.quantity.toInt() : item.quantity} × ₹${item.unitPrice.toInt()}',
                      style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                ]),
              )),
            ],
          ]),
        ),
      ),
    );
  }
}

// ── Create Direct Purchase Sheet ────────────────────────────────────────────

class _DirectPurchaseSheet extends StatefulWidget {
  final Color color;
  final PurchaseOrder? editing;
  final VoidCallback onSaved;
  const _DirectPurchaseSheet({required this.color, this.editing, required this.onSaved});

  @override
  State<_DirectPurchaseSheet> createState() => _DirectPurchaseSheetState();
}

class _DirectPurchaseSheetState extends State<_DirectPurchaseSheet> {
  late final TextEditingController _vendorCtrl;
  late final TextEditingController _notesCtrl;
  late final List<_Line> _lines;
  bool _saving = false;

  bool get _isEdit => widget.editing != null;

  @override
  void initState() {
    super.initState();
    final po = widget.editing;
    _vendorCtrl = TextEditingController(text: po?.vendorName ?? '');
    _notesCtrl  = TextEditingController();
    if (po != null && po.items.isNotEmpty) {
      _lines = po.items.map((item) {
        final l = _Line();
        l.nameCtrl.text = item.productName;
        l.qtyCtrl.text  = item.quantity % 1 == 0 ? '${item.quantity.toInt()}' : '${item.quantity}';
        l.rateCtrl.text = item.unitPrice % 1 == 0 ? '${item.unitPrice.toInt()}' : '${item.unitPrice}';
        return l;
      }).toList();
    } else {
      _lines = [_Line()];
    }
  }

  @override
  void dispose() {
    _vendorCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  double get _grandTotal => _lines.fold(0, (s, l) {
    final qty  = double.tryParse(l.qtyCtrl.text)  ?? 0;
    final rate = double.tryParse(l.rateCtrl.text) ?? 0;
    return s + qty * rate;
  });

  Future<void> _submit() async {
    if (_vendorCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please enter vendor name')));
      return;
    }
    setState(() => _saving = true);
    try {
      final items = _lines
          .where((l) => l.nameCtrl.text.trim().isNotEmpty)
          .map((l) => {
                'productName': l.nameCtrl.text.trim(),
                'quantity':    double.tryParse(l.qtyCtrl.text)  ?? 0,
                'unitCost':    double.tryParse(l.rateCtrl.text) ?? 0,
                'uom':         l.uom,
              })
          .toList();
      final payload = {
        'vendorName': _vendorCtrl.text.trim(),
        'notes':      _notesCtrl.text.trim(),
        'items':      items,
      };
      if (_isEdit) {
        await ApiService().updateDirectPurchase(widget.editing!.id, payload);
      } else {
        await ApiService().createDirectPurchase(payload);
      }
      if (mounted) Navigator.pop(context);
      widget.onSaved();
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.color;
    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      expand: false,
      builder: (_, ctrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(children: [
          // Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 4),
              width: 36, height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 6, 20, 12),
            child: Row(children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: color.withOpacity(0.12), borderRadius: BorderRadius.circular(10)),
                child: Icon(Icons.receipt_long_outlined, color: color, size: 20),
              ),
              const SizedBox(width: 10),
              Text(_isEdit ? 'Edit Direct Purchase' : 'New Direct Purchase',
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
            ]),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              controller: ctrl,
              padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).viewInsets.bottom + 100),
              children: [
                _field('Vendor / Supplier', _vendorCtrl, color, hint: 'Enter vendor name'),
                const SizedBox(height: 12),
                _field('Notes (optional)', _notesCtrl, color, hint: 'e.g. Invoice #, remarks', maxLines: 2),
                const SizedBox(height: 16),
                Row(children: [
                  const Text('Items', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: () => setState(() => _lines.add(_Line())),
                    icon: Icon(Icons.add, size: 16, color: color),
                    label: Text('Add item', style: TextStyle(color: color, fontSize: 12)),
                  ),
                ]),
                const SizedBox(height: 6),
                ..._lines.asMap().entries.map((e) => _lineRow(e.key, e.value, color)),
                const SizedBox(height: 12),
                if (_grandTotal > 0)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.06),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(children: [
                      const Text('Grand Total', style: TextStyle(fontWeight: FontWeight.w600)),
                      const Spacer(),
                      Text(
                        '₹${NumberFormat('#,##,###', 'en_IN').format(_grandTotal)}',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: color),
                      ),
                    ]),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(
                  backgroundColor: color,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: _saving
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(_isEdit ? 'Update Direct Purchase' : 'Save Direct Purchase',
                        style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _lineRow(int i, _Line line, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(children: [
        Row(children: [
          Expanded(
            child: TextField(
              controller: line.nameCtrl,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Product / item name',
                hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
                isDense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: color)),
              ),
            ),
          ),
          if (_lines.length > 1) ...[
            const SizedBox(width: 6),
            GestureDetector(
              onTap: () => setState(() => _lines.removeAt(i)),
              child: Icon(Icons.remove_circle_outline, color: Colors.red.shade300, size: 20),
            ),
          ],
        ]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(
            child: TextField(
              controller: line.qtyCtrl,
              keyboardType: TextInputType.number,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Qty',
                hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                isDense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: color)),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: line.rateCtrl,
              keyboardType: TextInputType.number,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                hintText: 'Rate (₹)',
                hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 12),
                isDense: true, contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: Colors.grey.shade300)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: color)),
              ),
            ),
          ),
        ]),
        if ((double.tryParse(line.qtyCtrl.text) ?? 0) > 0 &&
            (double.tryParse(line.rateCtrl.text) ?? 0) > 0) ...[
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerRight,
            child: Text(
              '= ₹${NumberFormat('#,##,###', 'en_IN').format((double.tryParse(line.qtyCtrl.text) ?? 0) * (double.tryParse(line.rateCtrl.text) ?? 0))}',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: color),
            ),
          ),
        ],
      ]),
    );
  }

  Widget _field(String label, TextEditingController ctrl, Color color, {String? hint, int maxLines = 1}) {
    return TextField(
      controller: ctrl,
      maxLines: maxLines,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: color, width: 2)),
        labelStyle: TextStyle(color: Colors.grey.shade600),
        floatingLabelStyle: TextStyle(color: color),
      ),
    );
  }
}

class _Line {
  final nameCtrl = TextEditingController();
  final qtyCtrl  = TextEditingController();
  final rateCtrl = TextEditingController();
  String uom     = 'pcs';
}
