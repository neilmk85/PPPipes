import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../widgets/date_filter_dropdown.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';

// ── Cement Bags ───────────────────────────────────────────────────────────────

class CementBagsScreen extends StatefulWidget {
  const CementBagsScreen({super.key});

  @override
  State<CementBagsScreen> createState() => _CementBagsScreenState();
}

class _CementBagsScreenState extends State<CementBagsScreen> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  bool _loadingData = true;
  List<Map<String, dynamic>> _items = [];
  bool _showSearch = false;
  String _search = '';
  final _searchCtrl = TextEditingController();

  // date filter
  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  @override
  void initState() {
    super.initState();
    _to = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _load();
  }

  @override
  void dispose() {
    _closeDateOverlay();
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
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmtIso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loadingData = true);
    try {
      final data = await ApiService().getCementBags(
          fromDate: _fmtIso(_from), toDate: _fmtIso(_to));
      if (mounted) setState(() => _items = data.cast<Map<String, dynamic>>());
    } catch (_) {}
    if (mounted) setState(() => _loadingData = false);
  }

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  static int _toI(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  List<Map<String, dynamic>> get _filtered {
    if (_search.trim().isEmpty) return _items;
    final q = _search.toLowerCase();
    return _items.where((e) =>
      (e['notes'] ?? '').toString().toLowerCase().contains(q) ||
      _toD(e['quantity']).toStringAsFixed(0).contains(q)
    ).toList();
  }

  double get _totalBags => _items.fold(0.0, (s, e) => s + _toD(e['quantity']));

  void _showAddEdit([Map<String, dynamic>? editing]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CementBagSheet(
        initial: editing,
        onSubmit: (data) async {
          if (editing != null) {
            await ApiService().updateCementBag(_toI(editing['id']), data);
          } else {
            await ApiService().createCementBag(data);
          }
          _load();
        },
      ),
    );
  }

  Future<void> _delete(int id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Entry'),
        content: const Text('This will permanently delete this usage record.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (ok == true) {
      await ApiService().deleteCementBag(id);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final totalBags = _totalBags;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: _loadingData
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 106,
                  toolbarHeight: 46,
                  backgroundColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  scrolledUnderElevation: 0,
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
                              _hStat('${_items.length}', 'Entries'),
                              _hStat(totalBags.toStringAsFixed(0), 'Total Used'),
                            ]),
                          ),
                        ),
                      ]),
                    ),
                  ),
                  title: const Text('Used Cement Bags',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white)),
                  actions: [
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                            const SizedBox(width: 5),
                            Text(_dateFilter.isActive ? _dateFilter.label : 'Filter by Date',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                            const SizedBox(width: 3),
                            const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                          ]),
                        ),
                      ),
                    ),
                  ],
                ),

                if (filtered.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.all_inbox_outlined, size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No usage entries found',
                            style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _CementBagCard(
                          entry: filtered[i],
                          onEdit: () => _showAddEdit(filtered[i]),
                          onDelete: () => _delete(_toI(filtered[i]['id'])),
                        ),
                        childCount: filtered.length,
                      ),
                    ),
                  ),
              ]),
            ),
      bottomNavigationBar: _buildFloatingNav(),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddEdit(),
        backgroundColor: _color,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
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
                  transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
                  child: _showSearch ? _buildCementSearchExpanded() : _buildCementNavItems(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCementSearchExpanded() {
    return Row(
      key: const ValueKey('csearch'),
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
              hintText: 'Search notes…',
              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
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
            child: const Icon(Icons.close, size: 18, color: Color(0xFF64748B)),
          ),
        ),
      ],
    );
  }

  Widget _buildCementNavItems() {
    return Row(
      key: const ValueKey('cnav'),
      children: [
        _cFloatItem(
          icon: Icons.search,
          label: 'Search',
          active: false,
          onTap: () => setState(() => _showSearch = true),
        ),
        _cFloatItem(
          icon: Icons.all_inbox_outlined,
          label: 'Usage Log',
          active: true,
          onTap: () {},
        ),
      ],
    );
  }

  Widget _cFloatItem({
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
              Icon(icon, size: 22, color: active ? Colors.white : const Color(0xFF94A3B8)),
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

// ── Cement Bag Card ──────────────────────────────────────────────────────────

class _CementBagCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _CementBagCard({required this.entry, required this.onEdit, required this.onDelete});

  static const _color = Color(0xFF4F46E5);

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    final p = s.split('-');
    return p.length == 3 ? '${p[2]}/${p[1]}/${p[0]}' : s;
  }

  @override
  Widget build(BuildContext context) {
    final date = entry['date']?.toString() ?? '';
    final qty = _toD(entry['quantity']);
    final notes = entry['notes']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2)),
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 1)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.all_inbox_outlined, color: _color, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${qty.toStringAsFixed(0)} bags used',
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                Text(_fmtDate(date),
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              ]),
            ),
            Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(
                onPressed: onEdit,
                icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF94A3B8)),
                padding: const EdgeInsets.all(6),
                constraints: const BoxConstraints(),
              ),
              IconButton(
                onPressed: onDelete,
                icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFFEF4444)),
                padding: const EdgeInsets.all(6),
                constraints: const BoxConstraints(),
              ),
            ]),
          ]),
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(notes,
                style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                maxLines: 2,
                overflow: TextOverflow.ellipsis),
          ],
        ]),
      ),
    );
  }
}

// ── Cement Bag Sheet ─────────────────────────────────────────────────────────

class _CementBagSheet extends StatefulWidget {
  final Map<String, dynamic>? initial;
  final Future<void> Function(Map<String, dynamic>) onSubmit;

  const _CementBagSheet({this.initial, required this.onSubmit});

  @override
  State<_CementBagSheet> createState() => _CementBagSheetState();
}

class _CementBagSheetState extends State<_CementBagSheet> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  late DateTime _date;
  final _qtyCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _submitting = false;
  String? _errQty;

  bool get _isEdit => widget.initial != null;

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  @override
  void initState() {
    super.initState();
    final e = widget.initial;
    _date = e != null && (e['date']?.toString().length ?? 0) >= 10
        ? DateTime.tryParse(e['date'].toString().substring(0, 10)) ?? DateTime.now()
        : DateTime.now();
    _qtyCtrl.text = e != null ? _toD(e['quantity']).toStringAsFixed(0) : '';
    _notesCtrl.text = e?['notes']?.toString() ?? '';
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final qty = double.tryParse(_qtyCtrl.text.trim());
    setState(() { _errQty = qty == null || qty <= 0 ? 'Enter a valid quantity' : null; });
    if (_errQty != null) return;

    setState(() => _submitting = true);
    try {
      await widget.onSubmit({
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'quantity': qty,
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (_) {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [_color, _colorDark],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
            child: Row(children: [
              const Icon(Icons.all_inbox_outlined, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Text(_isEdit ? 'Edit Usage Entry' : 'Log Bag Usage',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 30, height: 30,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(15),
                  ),
                  child: const Icon(Icons.close, color: Colors.white, size: 16),
                ),
              ),
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Date', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(
                      context: context,
                      initialDate: _date,
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now(),
                    );
                    if (d != null) setState(() => _date = d);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade300),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(children: [
                      const Icon(Icons.calendar_today_outlined, size: 16, color: Color(0xFF64748B)),
                      const SizedBox(width: 8),
                      Text(DateFormat('dd MMM yyyy').format(_date),
                          style: const TextStyle(fontSize: 14)),
                    ]),
                  ),
                ),
                const SizedBox(height: 14),

                const Text('Bags Used*', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                TextField(
                  controller: _qtyCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(fontSize: 14),
                  onChanged: (_) => setState(() => _errQty = null),
                  decoration: InputDecoration(
                    hintText: 'No. of bags used',
                    errorText: _errQty,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 14),

                const Text('Notes (optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                TextField(
                  controller: _notesCtrl,
                  maxLines: 2,
                  style: const TextStyle(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Supplier name, delivery info…',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: _color,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: _submitting
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.check_circle_outline),
                    label: Text(_submitting ? 'Saving…' : _isEdit ? 'Save Changes' : 'Log Usage'),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

class VehiclesScreen extends StatefulWidget {
  const VehiclesScreen({super.key});

  @override
  State<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends State<VehiclesScreen> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF4C1D95);

  List<VehicleEntry> _allItems = [];
  bool _loading = true;

  // date filter
  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  // bottom nav
  String _activeTab      = 'all'; // 'all' | 'crane' | 'jcb'
  bool   _searchExpanded = false;
  String _search         = '';
  final  _searchCtrl     = TextEditingController();

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _load();
  }

  @override
  void dispose() {
    _closeDateOverlay();
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
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getVehicleEntries(size: 500);
      setState(() {
        _allItems = raw.map((e) => VehicleEntry.fromJson(e)).toList();
        _loading  = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<VehicleEntry> get _filtered {
    return _allItems.where((item) {
      // date range
      if (item.date.isNotEmpty) {
        try {
          final d    = DateTime.parse(item.date.split('T').first);
          final from = DateTime(_from.year, _from.month, _from.day);
          final to   = DateTime(_to.year, _to.month, _to.day, 23, 59, 59);
          if (d.isBefore(from) || d.isAfter(to)) return false;
        } catch (_) {}
      }
      // tab
      if (_activeTab == 'crane' && !item.craneEnabled) return false;
      if (_activeTab == 'jcb'   && !item.jcbEnabled)   return false;
      // search
      if (_search.trim().isNotEmpty) {
        final q = _search.toLowerCase();
        return _fmtDate(item.date).toLowerCase().contains(q) ||
               (item.notes ?? '').toLowerCase().contains(q);
      }
      return true;
    }).toList();
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );

  // ── bottom nav ──────────────────────────────────────────────────────────────

  Widget _buildFloatingNav() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [
              BoxShadow(color: Colors.black.withOpacity(0.10), blurRadius: 20, offset: const Offset(0, 4)),
            ],
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 260),
            child: _searchExpanded ? _buildSearchExpanded() : _buildNavItems(),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchExpanded() => Row(
    key: const ValueKey('search'),
    children: [
      // search icon circle
      Container(
        margin: const EdgeInsets.all(8),
        width: 46, height: 46,
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [_color, _colorDark]),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.search, color: Colors.white, size: 20),
      ),
      Expanded(
        child: TextField(
          controller: _searchCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Search by date or notes…',
            hintStyle: TextStyle(fontSize: 13, color: Colors.grey),
            border: InputBorder.none,
          ),
          style: const TextStyle(fontSize: 14),
          onChanged: (v) => setState(() => _search = v),
        ),
      ),
      GestureDetector(
        onTap: () {
          _searchCtrl.clear();
          setState(() { _search = ''; _searchExpanded = false; });
        },
        child: Container(
          margin: const EdgeInsets.all(8),
          width: 46, height: 46,
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            shape: BoxShape.circle,
          ),
          child: const Icon(Icons.close, size: 20, color: Colors.grey),
        ),
      ),
    ],
  );

  Widget _buildNavItems() => Row(
    key: const ValueKey('nav'),
    children: [
      _navItem(Icons.search, 'Search', '', onTap: () => setState(() => _searchExpanded = true)),
      _navItem(Icons.list_outlined,                   'All',   'all'),
      _navItem(Icons.precision_manufacturing_outlined, 'Crane', 'crane'),
      _navItem(Icons.construction_outlined,            'JCB',   'jcb'),
    ],
  );

  Widget _navItem(IconData icon, String label, String tab, {VoidCallback? onTap}) {
    final active = tab.isNotEmpty && _activeTab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: onTap ?? () => setState(() => _activeTab = tab),
        child: Container(
          margin: const EdgeInsets.all(6),
          decoration: active
              ? BoxDecoration(
                  gradient: const LinearGradient(colors: [_color, _colorDark]),
                  borderRadius: BorderRadius.circular(26),
                )
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 20, color: active ? Colors.white : Colors.grey.shade500),
            const SizedBox(height: 2),
            Text(label,
                style: TextStyle(
                  fontSize: 10, fontWeight: FontWeight.w600,
                  color: active ? Colors.white : Colors.grey.shade500,
                )),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered    = _filtered;
    final craneLitres = filtered.fold<double>(0, (s, e) => s + (e.craneDiesel ?? 0));
    final jcbLitres   = filtered.fold<double>(0, (s, e) => s + (e.jcbDiesel   ?? 0));

    return Scaffold(
      bottomNavigationBar: _buildFloatingNav(),
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 120,
            backgroundColor: _color,
            foregroundColor: Colors.white,
            leading: context.canPop()
                ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())
                : IconButton(icon: const Icon(Icons.menu_outlined), onPressed: openAppDrawer, tooltip: 'Open menu'),
            title: const Text('Vehicles'),
            actions: [
              CompositedTransformTarget(
                link: _layerLink,
                child: GestureDetector(
                  onTap: _toggleDateOverlay,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withOpacity(0.25)),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                      const SizedBox(width: 5),
                      Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                      const SizedBox(width: 3),
                      const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                    ]),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.add, color: Colors.white),
                onPressed: () => _showAdd(context),
              ),
              const SizedBox(width: 4),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [_color, _colorDark],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(6, 64, 6, 4),
                    child: Row(children: [
                      _hStat('${filtered.length}', 'Entries'),
                      _hStat(craneLitres > 0 ? craneLitres.toStringAsFixed(1) : '—', 'Crane L'),
                      _hStat(jcbLitres   > 0 ? jcbLitres.toStringAsFixed(1)   : '—', 'JCB L'),
                    ]),
                  ),
                ),
              ),
            ),
          ),
          SliverFillRemaining(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: filtered.isEmpty
                        ? Center(child: Text(
                            _activeTab == 'crane' ? 'No crane entries' :
                            _activeTab == 'jcb'   ? 'No JCB entries'  : 'No vehicle entries'))
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                            itemCount: filtered.length,
                            itemBuilder: (_, i) {
                              final item  = filtered[i];
                              final parts = <String>[];
                              if (item.craneEnabled) {
                                parts.add('Crane: ${item.craneDiesel?.toStringAsFixed(1) ?? '-'} L'
                                    ' · ${item.craneHours?.toStringAsFixed(1) ?? '-'} h');
                              }
                              if (item.jcbEnabled) {
                                parts.add('JCB: ${item.jcbDiesel?.toStringAsFixed(1) ?? '-'} L'
                                    ' · ${item.jcbHours?.toStringAsFixed(1) ?? '-'} h');
                              }
                              return _BizCard(
                                icon: Icons.local_shipping_outlined,
                                color: _color,
                                title: _fmtDate(item.date),
                                subtitle: parts.isEmpty ? 'No equipment recorded' : parts.join('  '),
                                notes: item.notes,
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  void _showAdd(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _VehicleAddSheet(
        onSubmit: (data) async {
          await ApiService().createVehicleEntry(data);
          _load();
        },
      ),
    );
  }
}

// ── Vehicle Add Sheet ─────────────────────────────────────────────────────────

class _VehicleAddSheet extends StatefulWidget {
  final Future<void> Function(Map<String, dynamic>) onSubmit;

  const _VehicleAddSheet({required this.onSubmit});

  @override
  State<_VehicleAddSheet> createState() => _VehicleAddSheetState();
}

class _VehicleAddSheetState extends State<_VehicleAddSheet>
    with TickerProviderStateMixin {
  bool _craneEnabled = false;
  bool _jcbEnabled = false;
  bool _saving = false;
  DateTime _date = DateTime.now();

  final _craneDieselCtrl = TextEditingController();
  final _craneHoursCtrl = TextEditingController();
  final _jcbDieselCtrl = TextEditingController();
  final _jcbHoursCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  static const _orange     = Color(0xFF7C3AED);
  static const _deepOrange = Color(0xFF4C1D95);

  @override
  void dispose() {
    _craneDieselCtrl.dispose();
    _craneHoursCtrl.dispose();
    _jcbDieselCtrl.dispose();
    _jcbHoursCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(
            primary: _orange, onPrimary: Colors.white, surface: Colors.white,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await widget.onSubmit({
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'craneEnabled': _craneEnabled,
        'craneDiesel': _craneEnabled ? _craneDieselCtrl.text.trim() : '',
        'craneHours':  _craneEnabled ? _craneHoursCtrl.text.trim()  : '',
        'jcbEnabled': _jcbEnabled,
        'jcbDiesel': _jcbEnabled ? _jcbDieselCtrl.text.trim() : '',
        'jcbHours':  _jcbEnabled ? _jcbHoursCtrl.text.trim()  : '',
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  Widget _equipCard({
    required String label,
    required String subtitle,
    required IconData icon,
    required bool enabled,
    required VoidCallback onToggle,
    required List<Widget> fields,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeInOut,
      decoration: BoxDecoration(
        color: enabled ? _orange.withOpacity(0.05) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: enabled ? _orange : Colors.grey.shade200,
          width: enabled ? 1.5 : 1,
        ),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: onToggle,
            borderRadius: BorderRadius.circular(16),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 250),
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: enabled ? _orange : Colors.grey.shade200,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(icon,
                        color: enabled ? Colors.white : Colors.grey.shade500,
                        size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(label,
                            style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: enabled
                                    ? const Color(0xFF1A1A1A)
                                    : Colors.grey.shade600)),
                        Text(subtitle,
                            style: TextStyle(
                                fontSize: 12,
                                color: Colors.grey.shade500)),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: onToggle,
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      width: 52,
                      height: 28,
                      decoration: BoxDecoration(
                        color: enabled ? _orange : Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: AnimatedAlign(
                        duration: const Duration(milliseconds: 250),
                        curve: Curves.easeInOut,
                        alignment: enabled
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.all(3),
                          width: 22,
                          height: 22,
                          decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle),
                          child: enabled
                              ? const Icon(Icons.check,
                                  size: 12, color: _orange)
                              : null,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          AnimatedSize(
            duration: const Duration(milliseconds: 280),
            curve: Curves.easeInOut,
            child: enabled
                ? Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                    child: Column(children: fields),
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _iconField({
    required TextEditingController ctrl,
    required String label,
    required String hint,
    required IconData icon,
    required Color iconColor,
  }) =>
      Padding(
        padding: const EdgeInsets.only(top: 10),
        child: TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            prefixIcon: Container(
              margin: const EdgeInsets.all(8),
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 16, color: iconColor),
            ),
            filled: true,
            fillColor: Colors.white,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey.shade200),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: _orange, width: 1.5),
            ),
          ),
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Gradient header
          Container(
            margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [_orange, _deepOrange],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.local_shipping_rounded,
                      color: Colors.white, size: 28),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Vehicle Entry',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.3)),
                      SizedBox(height: 2),
                      Text('Record daily equipment usage',
                          style: TextStyle(
                              color: Colors.white70, fontSize: 13)),
                    ],
                  ),
                ),
                // Date pill
                GestureDetector(
                  onTap: _pickDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                          color: Colors.white.withOpacity(0.4)),
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.calendar_today_rounded,
                            color: Colors.white, size: 14),
                        const SizedBox(height: 3),
                        Text(
                          DateFormat('dd MMM').format(_date),
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w700),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Scrollable body
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                  16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text('Equipment',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey.shade500,
                            letterSpacing: 0.8)),
                  ),

                  // Crane card
                  _equipCard(
                    label: 'Crane',
                    subtitle: 'Diesel consumption & hours',
                    icon: Icons.precision_manufacturing_outlined,
                    enabled: _craneEnabled,
                    onToggle: () =>
                        setState(() => _craneEnabled = !_craneEnabled),
                    fields: [
                      _iconField(
                        ctrl: _craneDieselCtrl,
                        label: 'Diesel (Litres)',
                        hint: '0.0',
                        icon: Icons.local_gas_station_outlined,
                        iconColor: const Color(0xFFEF4444),
                      ),
                      _iconField(
                        ctrl: _craneHoursCtrl,
                        label: 'Hours',
                        hint: '0.0',
                        icon: Icons.schedule_outlined,
                        iconColor: const Color(0xFF3B82F6),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),

                  // JCB card
                  _equipCard(
                    label: 'JCB',
                    subtitle: 'Diesel consumption & hours',
                    icon: Icons.construction_outlined,
                    enabled: _jcbEnabled,
                    onToggle: () =>
                        setState(() => _jcbEnabled = !_jcbEnabled),
                    fields: [
                      _iconField(
                        ctrl: _jcbDieselCtrl,
                        label: 'Diesel (Litres)',
                        hint: '0.0',
                        icon: Icons.local_gas_station_outlined,
                        iconColor: const Color(0xFFEF4444),
                      ),
                      _iconField(
                        ctrl: _jcbHoursCtrl,
                        label: 'Hours',
                        hint: '0.0',
                        icon: Icons.schedule_outlined,
                        iconColor: const Color(0xFF3B82F6),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),

                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text('Notes',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: Colors.grey.shade500,
                            letterSpacing: 0.8)),
                  ),
                  TextField(
                    controller: _notesCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'Any additional notes...',
                      hintStyle: TextStyle(color: Colors.grey.shade400),
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      contentPadding: const EdgeInsets.all(14),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade200),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: Colors.grey.shade200),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide:
                            const BorderSide(color: _orange, width: 1.5),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Save button
                  SizedBox(
                    width: double.infinity,
                    height: 54,
                    child: _saving
                        ? Container(
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                  colors: [_orange, _deepOrange]),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Center(
                              child: SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                    valueColor: AlwaysStoppedAnimation(
                                        Colors.white)),
                              ),
                            ),
                          )
                        : GestureDetector(
                            onTap: _submit,
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                    colors: [_orange, _deepOrange]),
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: _orange.withOpacity(0.4),
                                    blurRadius: 12,
                                    offset: const Offset(0, 6),
                                  ),
                                ],
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.check_circle_outline_rounded,
                                      color: Colors.white, size: 20),
                                  SizedBox(width: 8),
                                  Text('Save Entry',
                                      style: TextStyle(
                                          color: Colors.white,
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 0.3)),
                                ],
                              ),
                            ),
                          ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Silo ──────────────────────────────────────────────────────────────────────

class SiloScreen extends StatefulWidget {
  final bool isExtraction;
  const SiloScreen({super.key, this.isExtraction = false});

  @override
  State<SiloScreen> createState() => _SiloScreenState();
}

class _SiloScreenState extends State<SiloScreen> {
  static const _color = Color(0xFF7C3AED);

  List<SiloEntry> _allItems = [];
  bool _loading = true;

  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  @override
  void initState() {
    super.initState();
    _to = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _load();
  }

  @override
  void dispose() {
    _closeDateOverlay();
    super.dispose();
  }

  void _closeDateOverlay() {
    _dateOverlay?.remove();
    _dateOverlay = null;
  }

  void _toggleDateOverlay() {
    if (_dateOverlay != null) { _closeDateOverlay(); return; }
    final entry = OverlayEntry(
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getSiloEntries(size: 500);
      setState(() {
        _allItems = raw.map((e) => SiloEntry.fromJson(e)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<SiloEntry> get _filtered {
    return _allItems.where((item) {
      if (item.date.isEmpty) return true;
      try {
        final d = DateTime.parse(item.date.split('T').first);
        final from = DateTime(_from.year, _from.month, _from.day);
        final to = DateTime(_to.year, _to.month, _to.day, 23, 59, 59);
        return !d.isBefore(from) && !d.isAfter(to);
      } catch (_) { return true; }
    }).toList();
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final totalExtracted = filtered.fold<double>(0, (s, e) => s + (e.extracted ?? 0));

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 120,
            backgroundColor: _color,
            foregroundColor: Colors.white,
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
            title: Text(widget.isExtraction ? 'Silo Extraction' : 'Silo'),
            actions: [
              CompositedTransformTarget(
                link: _layerLink,
                child: GestureDetector(
                  onTap: _toggleDateOverlay,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white.withOpacity(0.25)),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                      const SizedBox(width: 5),
                      Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                          style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                      const SizedBox(width: 3),
                      const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                    ]),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                icon: const Icon(Icons.add, color: Colors.white),
                onPressed: () => _showAdd(context),
              ),
              const SizedBox(width: 4),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF7C3AED), Color(0xFF4C1D95)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(6, 64, 6, 4),
                    child: Row(children: [
                      _hStat('${filtered.length}', 'Entries'),
                      _hStat(totalExtracted > 0 ? totalExtracted.toStringAsFixed(0) : '—', 'Total MT'),
                    ]),
                  ),
                ),
              ),
            ),
          ),
          SliverFillRemaining(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: _load,
                    child: filtered.isEmpty
                        ? const Center(child: Text('No silo entries'))
                        : ListView.builder(
                            padding: const EdgeInsets.all(12),
                            itemCount: filtered.length,
                            itemBuilder: (_, i) {
                              final item = filtered[i];
                              return _BizCard(
                                icon: Icons.storage_outlined,
                                color: _color,
                                title: item.siloName ?? 'Silo Entry',
                                subtitle: item.extracted != null
                                    ? '${item.extracted!.toStringAsFixed(1)} MT'
                                    : _fmtDate(item.date),
                                notes: item.notes,
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }

  void _showAdd(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _SiloEntrySheet(
        isExtraction: widget.isExtraction,
        onSaved: _load,
      ),
    );
  }
}

// ── Silo Entry Sheet ──────────────────────────────────────────────────────────

class _SiloEntrySheet extends StatefulWidget {
  final bool isExtraction;
  final VoidCallback onSaved;
  const _SiloEntrySheet({required this.onSaved, this.isExtraction = false});
  @override
  State<_SiloEntrySheet> createState() => _SiloEntrySheetState();
}

class _SiloEntrySheetState extends State<_SiloEntrySheet> {
  static const _violet     = Color(0xFF7C3AED);
  static const _violetDark = Color(0xFF4C1D95);

  DateTime _date = DateTime.now();
  final _checked     = [false, false, false];
  final _amountCtrls = List.generate(3, (_) => TextEditingController());
  final _uoms        = ['MT', 'MT', 'MT'];
  final _notesCtrl   = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    for (final c in _amountCtrls) c.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(
          colorScheme: const ColorScheme.light(
            primary: _violet, onPrimary: Colors.white, surface: Colors.white,
          ),
        ),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _save() async {
    const names = ['Silo 1', 'Silo 2', 'Silo 3'];
    final entries = <Map<String, dynamic>>[];
    for (var i = 0; i < 3; i++) {
      if (!_checked[i]) continue;
      final amt = double.tryParse(_amountCtrls[i].text.trim()) ?? 0;
      if (amt <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Enter a valid amount for ${names[i]}')),
        );
        return;
      }
      entries.add({
        'siloName': names[i],
        'extractedAmount': amt,
        'unit': widget.isExtraction ? _uoms[i] : 'MT',
        'notes': _notesCtrl.text.trim(),
        'date': DateFormat('yyyy-MM-dd').format(_date),
      });
    }
    if (entries.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select at least one silo')),
      );
      return;
    }
    setState(() => _saving = true);
    try {
      for (final e in entries) await ApiService().createSiloEntry(e);
      if (mounted) { Navigator.pop(context); widget.onSaved(); }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── gradient header ──
            Container(
              padding: const EdgeInsets.fromLTRB(20, 16, 12, 16),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft, end: Alignment.bottomRight,
                  colors: [_violet, _violetDark],
                ),
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(widget.isExtraction ? 'New Silo Extraction' : 'New Silo Entry',
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                    const SizedBox(height: 4),
                    GestureDetector(
                      onTap: _pickDate,
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        const Icon(Icons.calendar_today_outlined, size: 12, color: Colors.white70),
                        const SizedBox(width: 5),
                        Text(DateFormat('dd MMM yyyy').format(_date),
                            style: const TextStyle(color: Colors.white70, fontSize: 12)),
                        const SizedBox(width: 5),
                        const Icon(Icons.edit_outlined, size: 11, color: Colors.white54),
                      ]),
                    ),
                  ]),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
              ]),
            ),
            // ── body ──
            SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(widget.isExtraction ? 'Silo Extractions' : 'Silo Entries',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.black54, letterSpacing: 0.5)),
                const SizedBox(height: 12),
                ...List.generate(3, (i) {
                  final enabled = _checked[i];
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        // checkbox + label
                        GestureDetector(
                          onTap: () => setState(() => _checked[i] = !_checked[i]),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            Container(
                              width: 22, height: 22,
                              decoration: BoxDecoration(
                                color: enabled ? _violet : Colors.transparent,
                                border: Border.all(
                                  color: enabled ? _violet : Colors.grey.shade400,
                                  width: 1.5,
                                ),
                                borderRadius: BorderRadius.circular(5),
                              ),
                              child: enabled
                                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                                  : null,
                            ),
                            const SizedBox(width: 8),
                            Text('Silo ${i + 1}',
                                style: TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w600,
                                  color: enabled ? Colors.black87 : Colors.grey.shade500,
                                )),
                          ]),
                        ),
                        const SizedBox(width: 12),
                        // amount field
                        Expanded(
                          child: TextField(
                            controller: _amountCtrls[i],
                            enabled: enabled,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: InputDecoration(
                              hintText: enabled ? '0.00' : '—',
                              suffixText: widget.isExtraction ? null : 'MT',
                              suffixStyle: TextStyle(
                                color: enabled ? _violet : Colors.grey.shade400,
                                fontWeight: FontWeight.w600, fontSize: 13,
                              ),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: const BorderSide(color: _violet, width: 1.2),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: const BorderSide(color: _violet, width: 1.8),
                              ),
                              disabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: BorderSide(color: Colors.grey.shade200),
                              ),
                              filled: true,
                              fillColor: enabled ? Colors.white : Colors.grey.shade50,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            ),
                          ),
                        ),
                        // UOM toggle — only for Silo Extraction
                        if (widget.isExtraction) ...[
                          const SizedBox(width: 8),
                          _UomToggle(
                            selected: _uoms[i],
                            enabled: enabled,
                            onChanged: (v) => setState(() => _uoms[i] = v),
                          ),
                        ],
                      ]),
                    ]),
                  );
                }),
                const Divider(height: 24),
                // notes
                TextField(
                  controller: _notesCtrl,
                  maxLines: 2,
                  decoration: InputDecoration(
                    hintText: 'Notes (optional)',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: _violet, width: 1.5),
                    ),
                    filled: true,
                    fillColor: Colors.white,
                    contentPadding: const EdgeInsets.all(12),
                  ),
                ),
                const SizedBox(height: 20),
                // save button
                SizedBox(
                  width: double.infinity,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [_violet, _violetDark]),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: ElevatedButton(
                      onPressed: _saving ? null : _save,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.transparent,
                        shadowColor: Colors.transparent,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _saving
                          ? const SizedBox(
                              width: 20, height: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Text('Save Entry',
                              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

// ── UOM Toggle ───────────────────────────────────────────────────────────────

class _UomToggle extends StatelessWidget {
  final String selected;
  final bool enabled;
  final void Function(String) onChanged;
  const _UomToggle({required this.selected, required this.enabled, required this.onChanged});

  static const _violet = Color(0xFF7C3AED);

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      _btn('MT'),
      const SizedBox(width: 4),
      _btn('KG'),
    ]);
  }

  Widget _btn(String label) {
    final active = selected == label && enabled;
    final inactive = !enabled;
    return GestureDetector(
      onTap: enabled ? () => onChanged(label) : null,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: active ? _violet : (inactive ? Colors.grey.shade100 : Colors.white),
          border: Border.all(
            color: active ? _violet : (inactive ? Colors.grey.shade200 : Colors.grey.shade400),
            width: 1.2,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: active ? Colors.white : (inactive ? Colors.grey.shade400 : Colors.grey.shade700),
          ),
        ),
      ),
    );
  }
}

// ── Loading ───────────────────────────────────────────────────────────────────

class _ReadinessRow {
  final String pipeName;
  final int day5;
  final int day6;
  final int day7plus;
  final int finalTesting;
  const _ReadinessRow({required this.pipeName, required this.day5, required this.day6, required this.day7plus, required this.finalTesting});
}

class LoadingScreen extends StatefulWidget {
  const LoadingScreen({super.key});
  @override
  State<LoadingScreen> createState() => _LoadingScreenState();
}

class _LoadingScreenState extends State<LoadingScreen> {
  static const _color  = Color(0xFF0D9488);
  static const _violet = Color(0xFF7C3AED);

  bool _loadingData = true;
  List<_ReadinessRow> _rows = [];
  List<Map<String, dynamic>> _records = [];
  List<String> _vendorNames    = [];
  List<String> _customerNames  = [];
  List<String> _allAddresses   = [];
  Map<String, List<String>> _customerAddressMap = {};
  bool _showHistory = true;
  bool _showSearch  = false;
  String _recSearch = '';
  final _searchCtrl = TextEditingController();

  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from;
  late DateTime _to;

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _loadAll();
  }

  @override
  void dispose() {
    _closeDateOverlay();
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
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _loadAll();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmt(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _loadAll() async {
    setState(() => _loadingData = true);

    List c2Entries = [], ftEntries = [], records = [];
    try {
      final r = await Future.wait([
        ApiService().getProductionEntries(stageType: 'CURING_2',      from: _fmt(_from), to: _fmt(_to)),
        ApiService().getProductionEntries(stageType: 'FINAL_TESTING',  from: _fmt(_from), to: _fmt(_to)),
        ApiService().getLoadingRecords(from: _fmt(_from), to: _fmt(_to)),
      ]);
      c2Entries = r[0]; ftEntries = r[1]; records = r[2];
    } catch (_) {}

    List vendors = [], salesOrders = [], customers = [];
    try { vendors     = await ApiService().getVendors(size: 500); }     catch (_) {}
    try { salesOrders = await ApiService().getSalesOrders(size: 500); } catch (_) {}
    try { customers   = await ApiService().getAllCustomers(size: 500); } catch (_) {}

    final today   = DateTime.now();
    final day5Str = _fmt(today.subtract(const Duration(days: 5)));
    final day6Str = _fmt(today.subtract(const Duration(days: 6)));
    final day7Str = _fmt(today.subtract(const Duration(days: 7)));

    // Build readiness rows
    final pipeNames = <String>{};
    for (final e in [...c2Entries, ...ftEntries]) {
      final m = e as Map<String, dynamic>;
      pipeNames.add(m['pipeConfig']?['name'] ?? 'Config #${m['pipeConfigId']}');
    }
    String entryDate(Map<String, dynamic> e) => (e['entryDate'] as String? ?? '').split('T').first;
    final readiness = (pipeNames.toList()..sort()).map((name) {
      bool byName(Map<String, dynamic> e) =>
          (e['pipeConfig']?['name'] ?? 'Config #${e['pipeConfigId']}') == name;
      int sumExact(List src, String d) => src.cast<Map<String, dynamic>>()
          .where((e) => byName(e) && entryDate(e) == d)
          .fold(0, (s, e) => s + ((e['pipesCompleted'] as num?)?.toInt() ?? 0));
      int sumDay7plus(List src) => src.cast<Map<String, dynamic>>()
          .where((e) => byName(e) && entryDate(e).compareTo(day7Str) <= 0)
          .fold(0, (s, e) => s + ((e['pipesCompleted'] as num?)?.toInt() ?? 0));
      int sumAll(List src) => src.cast<Map<String, dynamic>>()
          .where(byName).fold(0, (s, e) => s + ((e['pipesCompleted'] as num?)?.toInt() ?? 0));
      return _ReadinessRow(
        pipeName: name,
        day5: sumExact(c2Entries, day5Str),
        day6: sumExact(c2Entries, day6Str),
        day7plus: sumDay7plus(c2Entries),
        finalTesting: sumAll(ftEntries),
      );
    }).toList();

    // Build customer→address map from sales orders
    final custAddrMap = <String, List<String>>{};
    final seenAddrs   = <String>{};
    final allAddrs    = <String>[];
    for (final so in salesOrders.cast<Map<String, dynamic>>()) {
      final parts = [so['shippingAddress'], so['shippingCity'], so['shippingState']]
          .whereType<String>().where((s) => s.isNotEmpty).toList();
      if (parts.isEmpty) continue;
      final full = parts.join(', ');
      if (seenAddrs.add(full)) allAddrs.add(full);
      final custName = ((so['customer']?['name'] ?? so['customerName'] ?? '') as String).trim().toLowerCase();
      if (custName.isNotEmpty) {
        custAddrMap.putIfAbsent(custName, () => []);
        if (!custAddrMap[custName]!.contains(full)) custAddrMap[custName]!.add(full);
      }
    }
    // Also collect addresses from past loading records
    for (final rec in records.cast<Map<String, dynamic>>()) {
      final a = (rec['siteAddress'] as String? ?? '').trim();
      if (a.isNotEmpty && seenAddrs.add(a)) allAddrs.add(a);
    }
    allAddrs.sort();

    setState(() {
      _rows    = readiness;
      _records = records.cast<Map<String, dynamic>>();
      _vendorNames = vendors.cast<Map<String, dynamic>>()
          .map((v) => (v['name'] ?? v['companyName'] ?? '') as String)
          .where((s) => s.isNotEmpty).toList()..sort();
      _customerNames = customers.cast<Map<String, dynamic>>()
          .map((c) => (c['name'] ?? c['companyName'] ?? '') as String)
          .where((s) => s.isNotEmpty).toList()..sort();
      _allAddresses      = allAddrs;
      _customerAddressMap = custAddrMap;
      _loadingData       = false;
    });
  }

  void _openLoadSheet() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LoadPipesSheet(
        accentColor: _color,
        rows: _rows,
        vendorNames: _vendorNames,
        customerNames: _customerNames,
        allAddresses: _allAddresses,
        customerAddressMap: _customerAddressMap,
        onSubmit: (data) async {
          await ApiService().createLoadingRecord(data);
          await _loadAll();
        },
      ),
    );
  }

  void _openChallanSheet(Map<String, dynamic> rec) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ChallanSheet(record: rec, onSaved: (updated) {
        setState(() {
          final idx = _records.indexWhere((r) => r['id'] == updated['id']);
          if (idx >= 0) _records[idx] = {..._records[idx], ...updated};
        });
      }),
    );
  }

  Widget _badge(int n, Color bg, Color fg) {
    if (n == 0) return const Text('—', style: TextStyle(color: Colors.grey, fontSize: 13));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(12)),
      child: Text('$n', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: fg)),
    );
  }

  List<Map<String, dynamic>> get _filteredRecords {
    if (_recSearch.trim().isEmpty) return _records;
    final q = _recSearch.toLowerCase();
    return _records.where((r) =>
      (r['pipeName']     ?? '').toString().toLowerCase().contains(q) ||
      (r['vehicleNo']    ?? '').toString().toLowerCase().contains(q) ||
      (r['driverName']   ?? '').toString().toLowerCase().contains(q) ||
      (r['vendor']       ?? '').toString().toLowerCase().contains(q) ||
      (r['customerName'] ?? '').toString().toLowerCase().contains(q) ||
      (r['customerPoNo'] ?? '').toString().toLowerCase().contains(q)
    ).toList();
  }

  List<({String value, String category})> get _suggestions {
    final q = _recSearch.trim().toLowerCase();
    if (q.isEmpty) return [];
    final seen = <String>{};
    final result = <({String value, String category})>[];
    void add(String? val, String cat) {
      if (val == null || val.trim().isEmpty) return;
      final v = val.trim();
      if (v.toLowerCase().contains(q) && seen.add(v.toLowerCase())) {
        result.add((value: v, category: cat));
      }
    }
    for (final r in _records) {
      add(r['pipeName']     as String?, 'Pipe');
      add(r['customerName'] as String?, 'Customer');
      add(r['vehicleNo']    as String?, 'Vehicle');
      add(r['driverName']   as String?, 'Driver');
      add(r['vendor']       as String?, 'Vendor');
      add(r['customerPoNo'] as String?, 'PO No.');
    }
    return result.take(6).toList();
  }

  IconData _suggIcon(String cat) {
    switch (cat) {
      case 'Pipe':     return Icons.water_damage_outlined;
      case 'Customer': return Icons.person_outline;
      case 'Vehicle':  return Icons.local_shipping_outlined;
      case 'Driver':   return Icons.drive_eta_outlined;
      case 'Vendor':   return Icons.store_outlined;
      case 'PO No.':   return Icons.receipt_outlined;
      default:         return Icons.search;
    }
  }

  @override
  Widget build(BuildContext context) {
    final today     = DateTime.now();
    final day5Label = DateFormat('dd/MM').format(today.subtract(const Duration(days: 5)));
    final day6Label = DateFormat('dd/MM').format(today.subtract(const Duration(days: 6)));
    final day7Label = DateFormat('dd/MM').format(today.subtract(const Duration(days: 7)));

    final totalDay5  = _rows.fold(0, (s, r) => s + r.day5);
    final totalDay6  = _rows.fold(0, (s, r) => s + r.day6);
    final totalDay7  = _rows.fold(0, (s, r) => s + r.day7plus);
    final totalFinal = _rows.fold(0, (s, r) => s + r.finalTesting);

    final filtered     = _filteredRecords;
    final totalLoaded  = filtered.fold(0, (s, r) => s + ((r['quantity'] as num?)?.toInt() ?? 0));
    final uniquePipes   = filtered.map((r) => r['pipeName']).whereType<String>().toSet().length;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      bottomNavigationBar: _buildFloatingNav(),
      body: _loadingData
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAll,
              child: CustomScrollView(slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 106,
                  toolbarHeight: 46,
                  backgroundColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  scrolledUnderElevation: 0,
                  flexibleSpace: FlexibleSpaceBar(
                    collapseMode: CollapseMode.pin,
                    background: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF7C3AED), Color(0xFF4C1D95)],
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
                            child: Row(children: _showHistory ? [
                              _hStat('${filtered.length}', 'Dispatches'),
                              _hStat('$totalLoaded', 'Loaded'),
                              _hStat('$uniquePipes', 'Pipe Types'),
                            ] : [
                              _hStat('$totalDay5', 'Day 5\n$day5Label'),
                              _hStat('$totalDay6', 'Day 6\n$day6Label'),
                              _hStat('$totalDay7', 'Day 7+\n≤$day7Label'),
                              _hStat('$totalFinal', 'Final\nTest'),
                            ]),
                          ),
                        ),
                      ]),
                    ),
                  ),
                  title: const Text('Loading',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white)),
                  actions: [
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                            const SizedBox(width: 5),
                            Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                            const SizedBox(width: 3),
                            const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                          ]),
                        ),
                      ),
                    ),
                  ],
                ),

                if (!_showHistory) ...[
                  // Readiness table header
                  SliverToBoxAdapter(child: Container(
                    color: Colors.grey.shade100,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Row(children: [
                      const Expanded(flex: 3, child: Text('Pipe', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.grey))),
                      _thCell('Day 5', day5Label),
                      _thCell('Day 6', day6Label),
                      _thCell('Day 7+', '≤$day7Label'),
                      _thCell('Final', 'Testing'),
                    ]),
                  )),
                  if (_rows.isEmpty)
                    const SliverFillRemaining(child: Center(child: Text('No production data for range')))
                  else
                    SliverList(delegate: SliverChildBuilderDelegate((_, i) {
                      final r = _rows[i];
                      return Container(
                        decoration: BoxDecoration(
                          color: i.isOdd ? Colors.grey.shade50 : Colors.white,
                          border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        child: Row(children: [
                          Expanded(flex: 3, child: Text(r.pipeName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                          Expanded(child: Center(child: _badge(r.day5,         const Color(0xFFECFEFF), const Color(0xFF0E7490)))),
                          Expanded(child: Center(child: _badge(r.day6,         const Color(0xFFEFF6FF), const Color(0xFF1D4ED8)))),
                          Expanded(child: Center(child: _badge(r.day7plus,     const Color(0xFFEEF2FF), const Color(0xFF4338CA)))),
                          Expanded(child: Center(child: _badge(r.finalTesting, const Color(0xFFF0FDF4), const Color(0xFF15803D)))),
                        ]),
                      );
                    }, childCount: _rows.length)),
                  SliverToBoxAdapter(child: Container(
                    color: const Color(0xFFEDE9FE),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    child: Row(children: [
                      const Expanded(flex: 3, child: Text('Total', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF5B21B6)))),
                      Expanded(child: Center(child: Text('$totalDay5',  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF5B21B6))))),
                      Expanded(child: Center(child: Text('$totalDay6',  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF5B21B6))))),
                      Expanded(child: Center(child: Text('$totalDay7',  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF5B21B6))))),
                      Expanded(child: Center(child: Text('$totalFinal', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF5B21B6))))),
                    ]),
                  )),
                ] else ...[
                  // Loaded pipes list
                  if (filtered.isEmpty)
                    const SliverFillRemaining(child: Center(child: Text('No loading records found')))
                  else
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
                      sliver: SliverList(delegate: SliverChildBuilderDelegate((_, i) {
                        final rec = filtered[i];
                        final date    = rec['date'] != null ? _fmtDate(rec['date'] as String) : '—';
                        final qty     = (rec['quantity'] as num?)?.toInt() ?? 0;
                        final rate    = rec['transportRate'];
                        final rateType = rec['rateType'] ?? 'per_pipe';
                        final chNo    = (rec['customerPoNo'] ?? '').toString();
                        final custName = (rec['customerName'] ?? '').toString();
                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(12),
                            boxShadow: [
                              BoxShadow(color: Colors.black.withValues(alpha: 0.07), blurRadius: 12, offset: const Offset(0, 3)),
                              BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4,  offset: const Offset(0, 1)),
                            ],
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(12),
                            onTap: () => _openChallanSheet(rec),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  Expanded(child: Text(rec['pipeName'] ?? '—', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(color: const Color(0xFFF0FDF4), borderRadius: BorderRadius.circular(12)),
                                    child: Text('$qty pipes', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF15803D))),
                                  ),
                                ]),
                                if (chNo.isNotEmpty || custName.isNotEmpty) Padding(
                                  padding: const EdgeInsets.only(top: 4, bottom: 2),
                                  child: Row(children: [
                                    if (chNo.isNotEmpty) ...[
                                      const Icon(Icons.receipt_outlined, size: 11, color: Color(0xFF7C3AED)),
                                      const SizedBox(width: 3),
                                      Text('CH: $chNo', style: const TextStyle(fontSize: 11, color: Color(0xFF7C3AED), fontWeight: FontWeight.w600)),
                                      const SizedBox(width: 12),
                                    ],
                                    if (custName.isNotEmpty) ...[
                                      const Icon(Icons.person_outline, size: 11, color: Colors.blueGrey),
                                      const SizedBox(width: 3),
                                      Expanded(child: Text(custName, style: const TextStyle(fontSize: 11, color: Colors.blueGrey), overflow: TextOverflow.ellipsis)),
                                    ],
                                  ]),
                                ),
                                const SizedBox(height: 4),
                                Wrap(spacing: 12, runSpacing: 2, children: [
                                  _infoChip(Icons.calendar_today_outlined, date),
                                  if ((rec['vehicleNo'] ?? '').toString().isNotEmpty)  _infoChip(Icons.local_shipping_outlined, rec['vehicleNo'] as String),
                                  if ((rec['driverName'] ?? '').toString().isNotEmpty) _infoChip(Icons.person_outline, rec['driverName'] as String),
                                  if ((rec['vendor'] ?? '').toString().isNotEmpty)     _infoChip(Icons.business_outlined, rec['vendor'] as String),
                                  if ((rec['siteAddress'] ?? '').toString().isNotEmpty) _infoChip(Icons.location_on_outlined, rec['siteAddress'] as String),
                                  if (rate != null && rate.toString().isNotEmpty && rate != '0')
                                    _infoChip(Icons.currency_rupee, '$rate${rateType == "per_trip" ? "/trip" : "/pipe"}'),
                                ]),
                                if ((rec['notes'] ?? '').toString().isNotEmpty) Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(rec['notes'] as String, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                                ),
                                Align(
                                  alignment: Alignment.bottomRight,
                                  child: Text('Tap to view challan', style: TextStyle(fontSize: 9, color: Colors.grey.shade400)),
                                ),
                              ]),
                            ),
                          ),
                        );
                      }, childCount: filtered.length)),
                    ),
                ],
              ]),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: _openLoadSheet,
        backgroundColor: _violet,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildSuggestions() {
    final suggs = _suggestions;
    if (!_showSearch || suggs.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.10), blurRadius: 16, offset: const Offset(0, -4)),
          BoxShadow(color: _violet.withValues(alpha: 0.07), blurRadius: 24, offset: const Offset(0, -8)),
        ],
      ),
      constraints: const BoxConstraints(maxHeight: 210),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: ListView.separated(
          padding: const EdgeInsets.symmetric(vertical: 4),
          shrinkWrap: true,
          itemCount: suggs.length,
          separatorBuilder: (_, __) => Divider(height: 1, indent: 16, endIndent: 16, color: Colors.grey.shade100),
          itemBuilder: (_, i) {
            final s = suggs[i];
            final q = _recSearch.trim().toLowerCase();
            final idx = s.value.toLowerCase().indexOf(q);
            return InkWell(
              onTap: () => setState(() {
                _searchCtrl.text = s.value;
                _recSearch = s.value;
              }),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(children: [
                  Icon(_suggIcon(s.category), size: 15, color: const Color(0xFF94A3B8)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: idx >= 0
                        ? RichText(text: TextSpan(
                            style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B), fontWeight: FontWeight.w500),
                            children: [
                              if (idx > 0) TextSpan(text: s.value.substring(0, idx)),
                              TextSpan(text: s.value.substring(idx, idx + q.length),
                                style: const TextStyle(color: _violet, fontWeight: FontWeight.w700)),
                              TextSpan(text: s.value.substring(idx + q.length)),
                            ],
                          ))
                        : Text(s.value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(s.category, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                  ),
                ]),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildFloatingNav() {
    return Container(
      color: Colors.transparent,
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildSuggestions(),
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
                  color: _violet.withValues(alpha: 0.12),
                  blurRadius: 40,
                  spreadRadius: 0,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            clipBehavior: Clip.hardEdge,
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 260),
              transitionBuilder: (child, anim) =>
                  FadeTransition(opacity: anim, child: child),
              child: (_showSearch && _showHistory)
                  ? _buildSearchExpanded()
                  : _buildNavItems(),
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
      key: const ValueKey('search'),
      children: [
        // Active search pill
        Container(
          margin: const EdgeInsets.all(8),
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [_violet, Color(0xFF2563EB)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
          ),
          child: const Icon(Icons.search, color: Colors.white, size: 20),
        ),
        // Expanding text field
        Expanded(
          child: TextField(
            controller: _searchCtrl,
            autofocus: true,
            style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
            onChanged: (v) => setState(() => _recSearch = v),
            decoration: InputDecoration(
              hintText: 'Search pipe, vehicle, driver…',
              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
              border: InputBorder.none,
              isDense: true,
            ),
          ),
        ),
        // Close button
        GestureDetector(
          onTap: () => setState(() {
            _showSearch = false;
            _recSearch = '';
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
      key: const ValueKey('nav'),
      children: [
        _floatItem(
          icon: Icons.search,
          label: 'Search',
          active: false,
          onTap: () => setState(() {
            _showHistory = true;
            _showSearch = true;
          }),
        ),
        _floatItem(
          icon: Icons.local_shipping_outlined,
          label: 'Loaded Pipes',
          active: _showHistory,
          onTap: () => setState(() {
            _showHistory = true;
            _showSearch = false;
          }),
        ),
        _floatItem(
          iconBuilder: (c) => CustomPaint(size: const Size(22, 22), painter: _PipeIconPainter(c)),
          label: 'Curing Days',
          active: !_showHistory,
          onTap: () => setState(() {
            _showHistory = false;
            _showSearch = false;
            _recSearch = '';
            _searchCtrl.clear();
          }),
        ),
      ],
    );
  }

  Widget _floatItem({
    IconData? icon,
    Widget Function(Color color)? iconBuilder,
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    final iconColor = active ? Colors.white : const Color(0xFF94A3B8);
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: Curves.easeInOut,
          margin: const EdgeInsets.all(6),
          decoration: active
              ? BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [_violet, Color(0xFF2563EB)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(26),
                )
              : null,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              iconBuilder != null
                  ? iconBuilder(iconColor)
                  : Icon(icon!, size: 22, color: iconColor),
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
      Text(value, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2, height: 1.3), textAlign: TextAlign.center),
    ]),
  );

  Widget _thCell(String line1, String line2) => Expanded(child: Column(children: [
    Text(line1, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: Colors.grey)),
    Text(line2, style: const TextStyle(fontSize: 8, color: Colors.grey)),
  ]));

  Widget _infoChip(IconData icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
    Icon(icon, size: 11, color: Colors.grey),
    const SizedBox(width: 3),
    Text(text, style: const TextStyle(fontSize: 11, color: Colors.grey)),
  ]);
}

// ── Pipe icon painter (used in Loading floating nav) ──────────────────────────

class _PipeIconPainter extends CustomPainter {
  final Color color;
  _PipeIconPainter(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.35
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    const r = Radius.circular(2.5);

    // Proportions derived from the reference image
    final fl = w * 0.21;   // flange width
    final ft = h * 0.10;   // flange top
    final fb = h * 0.90;   // flange bottom
    final pt = h * 0.32;   // pipe body top
    final pb = h * 0.68;   // pipe body bottom

    // Left flange outer shape
    canvas.drawRRect(RRect.fromLTRBR(0, ft, fl, fb, r), paint);
    // Left flange inner step line (shows socket depth)
    canvas.drawLine(Offset(fl * 0.55, pt), Offset(fl * 0.55, pb), paint);

    // Pipe body — top and bottom edges
    canvas.drawLine(Offset(fl, pt), Offset(w - fl, pt), paint);
    canvas.drawLine(Offset(fl, pb), Offset(w - fl, pb), paint);

    // Right flange outer shape
    canvas.drawRRect(RRect.fromLTRBR(w - fl, ft, w, fb, r), paint);
    // Right flange inner step line
    canvas.drawLine(Offset(w - fl * 0.55, pt), Offset(w - fl * 0.55, pb), paint);
  }

  @override
  bool shouldRepaint(covariant _PipeIconPainter old) => old.color != color;
}

class _BizDateSheet extends StatefulWidget {
  final String preset;
  final DateTime from, to;
  final void Function(String preset, DateTime from, DateTime to) onApply;
  final VoidCallback onClear;

  const _BizDateSheet({
    required this.preset, required this.from, required this.to,
    required this.onApply, required this.onClear,
  });

  @override
  State<_BizDateSheet> createState() => _BizDateSheetState();
}

class _BizDateSheetState extends State<_BizDateSheet> {
  static const _violet = Color(0xFF7C3AED);
  static const _blue   = Color(0xFF2563EB);

  static const _presets = [
    ('today',        'Today'),
    ('yesterday',    'Yesterday'),
    ('this_week',    'This Week'),
    ('last_week',    'Last Week'),
    ('this_month',   'This Month'),
    ('last_month',   'Last Month'),
    ('this_quarter', 'This Quarter'),
    ('this_year',    'This Year'),
  ];

  late String   _preset;
  late DateTime _from, _to;

  @override
  void initState() {
    super.initState();
    _preset = widget.preset;
    _from   = widget.from;
    _to     = widget.to;
  }

  DateTime _resolveFrom(String key) {
    final n = DateTime.now();
    switch (key) {
      case 'today':        return DateTime(n.year, n.month, n.day);
      case 'yesterday':    return DateTime(n.year, n.month, n.day - 1);
      case 'this_week':    return n.subtract(Duration(days: n.weekday - 1));
      case 'last_week':    return n.subtract(Duration(days: n.weekday - 1 + 7));
      case 'this_month':   return DateTime(n.year, n.month, 1);
      case 'last_month':   return DateTime(n.year, n.month - 1, 1);
      case 'this_quarter': final q = ((n.month - 1) ~/ 3); return DateTime(n.year, q * 3 + 1, 1);
      case 'this_year':    return DateTime(n.year, 1, 1);
      default:             return n.subtract(const Duration(days: 29));
    }
  }

  DateTime _resolveTo(String key) {
    final n = DateTime.now();
    switch (key) {
      case 'yesterday':  return DateTime(n.year, n.month, n.day - 1);
      case 'last_week':  return n.subtract(Duration(days: n.weekday));
      case 'last_month': return DateTime(n.year, n.month, 0);
      default:           return n;
    }
  }

  void _pickPreset(String key) {
    final from = _resolveFrom(key);
    final to   = _resolveTo(key);
    setState(() { _preset = key; _from = from; _to = to; });
    widget.onApply(key, from, to);
    Navigator.pop(context);
  }

  Future<void> _pickFrom() async {
    final p = await showDatePicker(
      context: context,
      initialDate: _from,
      firstDate: DateTime(2020), lastDate: DateTime(2030),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(colorScheme: const ColorScheme.light(primary: _violet)),
        child: child!,
      ),
    );
    if (p != null) setState(() { _from = p; _preset = 'custom'; if (_to.isBefore(p)) _to = p; });
  }

  Future<void> _pickTo() async {
    final p = await showDatePicker(
      context: context,
      initialDate: _to.isBefore(_from) ? _from : _to,
      firstDate: _from, lastDate: DateTime(2030),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(colorScheme: const ColorScheme.light(primary: _violet)),
        child: child!,
      ),
    );
    if (p != null) setState(() { _to = p; _preset = 'custom'; });
  }

  @override
  Widget build(BuildContext context) {
    final dfmt = DateFormat('dd MMM yyyy');
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        // Drag handle
        Center(child: Container(
          margin: const EdgeInsets.only(top: 12, bottom: 14),
          width: 36, height: 4,
          decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
        )),
        // Title + Clear
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: [
            const Expanded(child: Text('Filter by Date', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold))),
            TextButton(
              onPressed: () { Navigator.pop(context); widget.onClear(); },
              child: const Text('Clear', style: TextStyle(color: Color(0xFF7C3AED))),
            ),
          ]),
        ),
        const SizedBox(height: 8),
        // Preset chips
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Wrap(spacing: 8, runSpacing: 8,
            children: _presets.map((pr) {
              final active = _preset == pr.$1;
              return GestureDetector(
                onTap: () => _pickPreset(pr.$1),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 7),
                  decoration: BoxDecoration(
                    color: active ? _violet.withValues(alpha: 0.1) : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(20),
                    border: active ? Border.all(color: _violet.withValues(alpha: 0.4)) : null,
                  ),
                  child: Text(pr.$2, style: TextStyle(
                    fontSize: 12,
                    fontWeight: active ? FontWeight.w600 : FontWeight.normal,
                    color: active ? _violet : Colors.grey.shade700,
                  )),
                ),
              );
            }).toList(),
          ),
        ),
        const SizedBox(height: 12),
        const Divider(indent: 16, endIndent: 16),
        // Custom range
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('CUSTOM RANGE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey, letterSpacing: 0.8)),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: _BizDtField(label: 'From', value: dfmt.format(_from), onTap: _pickFrom)),
              const SizedBox(width: 10),
              Expanded(child: _BizDtField(label: 'To',   value: dfmt.format(_to),   onTap: _pickTo)),
            ]),
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [_violet, _blue]),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent, shadowColor: Colors.transparent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  onPressed: () {
                    widget.onApply(_preset, _from, _to);
                    Navigator.pop(context);
                  },
                  child: const Text('Apply Range', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ),
          ]),
        ),
      ]),
    );
  }
}

class _BizDtField extends StatelessWidget {
  final String label, value;
  final VoidCallback onTap;
  const _BizDtField({required this.label, required this.value, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey.shade300),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(fontSize: 10, color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
          const SizedBox(height: 2),
          Row(children: [
            Icon(Icons.calendar_today_outlined, size: 12, color: Colors.grey.shade500),
            const SizedBox(width: 4),
            Expanded(child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
          ]),
        ]),
      ),
    );
  }
}

// ── Loading Date Filter dropdown overlay ──────────────────────────────────────




// ── Delivery Challan bottom sheet ─────────────────────────────────────────────

class _ChallanSheet extends StatefulWidget {
  final Map<String, dynamic> record;
  final void Function(Map<String, dynamic>) onSaved;
  const _ChallanSheet({required this.record, required this.onSaved});
  @override
  State<_ChallanSheet> createState() => _ChallanSheetState();
}

class _ChallanSheetState extends State<_ChallanSheet> {
  late TextEditingController _chNoCtrl;
  late TextEditingController _pipeNoCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _chNoCtrl   = TextEditingController(text: widget.record['customerPoNo'] ?? '');
    _pipeNoCtrl = TextEditingController(text: widget.record['pipeNo']       ?? '');
  }

  @override
  void dispose() { _chNoCtrl.dispose(); _pipeNoCtrl.dispose(); super.dispose(); }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final updated = await ApiService().updateLoadingRecord(
        widget.record['id'] as int,
        {...widget.record, 'customerPoNo': _chNoCtrl.text.trim(), 'pipeNo': _pipeNoCtrl.text.trim()},
      );
      widget.onSaved(updated);
      if (mounted) { Navigator.pop(context); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Challan saved'))); }
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final rec      = widget.record;
    final qty      = (rec['quantity'] as num?)?.toInt() ?? 0;
    final date     = rec['date'] != null ? _fmtDate(rec['date'] as String) : '—';
    final bottom   = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      padding: EdgeInsets.only(left: 20, right: 20, top: 16, bottom: bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          const Icon(Icons.receipt_long_outlined, color: Color(0xFF7C3AED), size: 20),
          const SizedBox(width: 8),
          Expanded(child: Text('Delivery Challan', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold))),
          IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
        ]),
        // Record summary
        Container(
          margin: const EdgeInsets.symmetric(vertical: 10),
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(color: const Color(0xFFF9FAFB), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.grey.shade200)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(rec['pipeName'] ?? '—', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            const SizedBox(height: 4),
            Wrap(spacing: 16, children: [
              _summaryItem(Icons.layers_outlined, '$qty pipes'),
              _summaryItem(Icons.calendar_today_outlined, date),
              if ((rec['vehicleNo'] ?? '').toString().isNotEmpty) _summaryItem(Icons.local_shipping_outlined, rec['vehicleNo'] as String),
              if ((rec['customerName'] ?? '').toString().isNotEmpty) _summaryItem(Icons.person_outline, rec['customerName'] as String),
              if ((rec['siteAddress'] ?? '').toString().isNotEmpty) _summaryItem(Icons.location_on_outlined, rec['siteAddress'] as String),
            ]),
          ]),
        ),
        // Editable fields
        TextField(
          controller: _chNoCtrl,
          decoration: const InputDecoration(
            labelText: 'CH.NO (Customer PO No.)',
            hintText: 'e.g. DC-2024-001',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.tag_outlined),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _pipeNoCtrl,
          decoration: const InputDecoration(
            labelText: 'Pipe Number',
            hintText: 'e.g. P-101, P-102',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.numbers_outlined),
          ),
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFF7C3AED), padding: const EdgeInsets.symmetric(vertical: 14)),
            icon: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.save_outlined),
            label: Text(_saving ? 'Saving…' : 'Save Challan'),
          ),
        ),
      ]),
    );
  }

  Widget _summaryItem(IconData icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
    Icon(icon, size: 12, color: Colors.grey),
    const SizedBox(width: 4),
    Text(text, style: const TextStyle(fontSize: 12, color: Colors.grey)),
  ]);
}

class _StatStrip extends StatelessWidget {
  final List<(String, int, Color)> stats;
  final Color color;
  const _StatStrip({required this.stats, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color,
      child: Row(children: stats.map((s) => Expanded(child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        child: Column(children: [
          Text('${s.$2}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
          Text(s.$1, style: const TextStyle(fontSize: 9, color: Colors.white70), textAlign: TextAlign.center),
        ]),
      ))).toList()),
    );
  }
}

class _LoadPipesSheet extends StatefulWidget {
  final Color accentColor;
  final List<_ReadinessRow> rows;
  final List<String> vendorNames;
  final List<String> customerNames;
  final List<String> allAddresses;
  final Map<String, List<String>> customerAddressMap;
  final Future<void> Function(Map<String, dynamic>) onSubmit;
  const _LoadPipesSheet({
    required this.accentColor,
    required this.rows,
    required this.vendorNames,
    required this.customerNames,
    required this.allAddresses,
    required this.customerAddressMap,
    required this.onSubmit,
  });

  @override
  State<_LoadPipesSheet> createState() => _LoadPipesSheetState();
}

class _LoadPipesSheetState extends State<_LoadPipesSheet> {
  String _pipeName     = '';
  int    _qty          = 0;
  DateTime _date       = DateTime.now();
  String _vendor       = '';
  String _customerName = '';
  String _siteAddress  = '';
  String _transportRate = '';
  String _rateType     = 'per_pipe';
  final _pipeNoCtrl    = TextEditingController();
  final _vehicleCtrl   = TextEditingController();
  final _driverCtrl    = TextEditingController();
  final _contactCtrl   = TextEditingController();
  final _notesCtrl     = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _pipeNoCtrl.dispose(); _vehicleCtrl.dispose(); _driverCtrl.dispose();
    _contactCtrl.dispose(); _notesCtrl.dispose();
    super.dispose();
  }

  List<_ReadinessRow> get _availableRows => widget.rows.where((r) => r.finalTesting > 0).toList();
  int get _maxQty => _availableRows
      .firstWhere((r) => r.pipeName == _pipeName,
          orElse: () => const _ReadinessRow(pipeName: '', day5: 0, day6: 0, day7plus: 0, finalTesting: 0))
      .finalTesting;

  List<String> get _filteredAddresses {
    final sel = _customerName.trim().toLowerCase();
    if (sel.isEmpty) return widget.allAddresses;
    final exact = widget.customerAddressMap[sel];
    if (exact != null && exact.isNotEmpty) return exact;
    final partialKey = widget.customerAddressMap.keys
        .firstWhere((k) => k.contains(sel) || sel.contains(k), orElse: () => '');
    return partialKey.isNotEmpty ? (widget.customerAddressMap[partialKey] ?? widget.allAddresses) : widget.allAddresses;
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: now,
      lastDate: DateTime(now.year + 2),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (_pipeName.isEmpty) { _snack('Please select a pipe type'); return; }
    if (_qty <= 0) { _snack('Please enter a quantity'); return; }
    if (_maxQty > 0 && _qty > _maxQty) { _snack('Exceeds available qty ($_maxQty)'); return; }
    setState(() => _saving = true);
    try {
      await widget.onSubmit({
        'pipeName':      _pipeName,
        'quantity':      _qty,
        'pipeNo':        _pipeNoCtrl.text.trim().isEmpty  ? null : _pipeNoCtrl.text.trim(),
        'date':          DateFormat('yyyy-MM-dd').format(_date),
        'vehicleNo':     _vehicleCtrl.text.trim().isEmpty ? null : _vehicleCtrl.text.trim(),
        'driverName':    _driverCtrl.text.trim().isEmpty  ? null : _driverCtrl.text.trim(),
        'driverContact': _contactCtrl.text.trim().isEmpty ? null : _contactCtrl.text.trim(),
        'vendor':        _vendor.isEmpty       ? null : _vendor,
        'customerName':  _customerName.isEmpty ? null : _customerName,
        'siteAddress':   _siteAddress.isEmpty  ? null : _siteAddress,
        'transportRate': _transportRate.isEmpty ? null : _transportRate,
        'rateType':      _rateType,
        'notes':         _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) _snack('Error: $e');
    }
  }

  void _snack(String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  Widget _sectionLabel(String label) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Row(children: [
      Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: widget.accentColor, letterSpacing: 1)),
      const SizedBox(width: 8),
      Expanded(child: Container(height: 1, color: Colors.grey.shade200)),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final over   = _maxQty > 0 && _qty > _maxQty;
    final rate   = double.tryParse(_transportRate) ?? 0;
    final total  = _rateType == 'per_pipe' ? (_qty * rate) : rate;

    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 16, bottom: bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Row(children: [
            Expanded(child: Text('Load Pipes', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
            // Date in header
            GestureDetector(
              onTap: _pickDate,
              child: Row(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF7C3AED)),
                const SizedBox(width: 4),
                Text(DateFormat('dd MMM yy').format(_date),
                    style: const TextStyle(fontSize: 13, color: Color(0xFF7C3AED), fontWeight: FontWeight.w600)),
                const Icon(Icons.arrow_drop_down, size: 16, color: Color(0xFF7C3AED)),
              ]),
            ),
            const SizedBox(width: 8),
            IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
          ]),
          Flexible(child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 8),

            // ── Pipe Details ──
            _sectionLabel('PIPE DETAILS'),

            const Text('Pipe Name *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 6),
            Container(
              decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
              child: DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: _pipeName.isEmpty ? null : _pipeName,
                  hint: const Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('Select pipe type…', style: TextStyle(color: Colors.grey))),
                  isExpanded: true,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  borderRadius: BorderRadius.circular(10),
                  items: _availableRows.map((r) => DropdownMenuItem(
                    value: r.pipeName,
                    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      Text(r.pipeName, style: const TextStyle(fontSize: 14)),
                      Text('${r.finalTesting} avail.', style: const TextStyle(fontSize: 12, color: Colors.green, fontWeight: FontWeight.w600)),
                    ]),
                  )).toList(),
                  onChanged: (v) => setState(() { _pipeName = v ?? ''; _qty = 0; }),
                ),
              ),
            ),
            const SizedBox(height: 12),

            // Qty stepper + Pipe No in one row
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Qty
              SizedBox(width: 130, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Quantity *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: over ? Colors.red : Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(children: [
                    IconButton(constraints: const BoxConstraints(minWidth: 32, minHeight: 36), padding: EdgeInsets.zero,
                        icon: const Icon(Icons.remove, size: 16), onPressed: _qty > 0 ? () => setState(() => _qty--) : null),
                    Expanded(child: Text('$_qty', textAlign: TextAlign.center, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700))),
                    IconButton(constraints: const BoxConstraints(minWidth: 32, minHeight: 36), padding: EdgeInsets.zero,
                        icon: const Icon(Icons.add, size: 16), onPressed: () => setState(() => _qty++)),
                  ]),
                ),
                if (over) const Text('Exceeds available', style: TextStyle(fontSize: 10, color: Colors.red))
                else if (_maxQty > 0 && _pipeName.isNotEmpty) Text('Max $_maxQty', style: const TextStyle(fontSize: 10, color: Colors.grey)),
              ])),
              const SizedBox(width: 12),
              // Pipe No
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Pipe Number', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
                const SizedBox(height: 6),
                TextField(
                  controller: _pipeNoCtrl,
                  decoration: InputDecoration(
                    hintText: 'e.g. P-101',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  ),
                ),
              ])),
            ]),
            const SizedBox(height: 16),

            // ── Transport ──
            _sectionLabel('TRANSPORT'),
            const Text('Vendor / Transporter', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 6),
            _AutocompleteField(value: _vendor, onChanged: (v) => setState(() => _vendor = v), suggestions: widget.vendorNames, placeholder: 'Search vendor…'),
            const SizedBox(height: 12),

            Row(children: [
              const Expanded(child: Text('Transport Rate', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey))),
              _RateTypeToggle(value: _rateType, onChanged: (v) => setState(() => _rateType = v)),
            ]),
            const SizedBox(height: 6),
            TextField(
              decoration: const InputDecoration(prefixText: '₹ ', labelText: 'Rate', border: OutlineInputBorder()),
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              onChanged: (v) => setState(() => _transportRate = v),
            ),
            if (rate > 0 && _qty > 0) Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                _rateType == 'per_pipe'
                    ? '$_qty pipes × ₹$rate = ₹${NumberFormat('#,##0.00', 'en_IN').format(total)}'
                    : 'Trip total = ₹${NumberFormat('#,##0.00', 'en_IN').format(total)}',
                style: const TextStyle(fontSize: 11, color: Colors.grey),
              ),
            ),
            const SizedBox(height: 16),

            // ── Vehicle & Driver ──
            _sectionLabel('VEHICLE & DRIVER'),
            TextField(controller: _vehicleCtrl, decoration: const InputDecoration(labelText: 'Vehicle Number', border: OutlineInputBorder(), hintText: 'MH 12 AB 1234')),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextField(controller: _driverCtrl, decoration: const InputDecoration(labelText: 'Driver Name', border: OutlineInputBorder()))),
              const SizedBox(width: 12),
              Expanded(child: TextField(controller: _contactCtrl, decoration: const InputDecoration(labelText: 'Driver Contact', border: OutlineInputBorder()), keyboardType: TextInputType.phone)),
            ]),
            const SizedBox(height: 16),

            // ── Delivery ──
            _sectionLabel('DELIVERY'),
            const Text('Customer Name', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 6),
            _AutocompleteField(
              value: _customerName,
              onChanged: (v) => setState(() { _customerName = v; _siteAddress = ''; }),
              suggestions: widget.customerNames,
              placeholder: 'Search customer…',
            ),
            const SizedBox(height: 12),
            const Text('Site / Shipping Address', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 6),
            _AutocompleteField(
              value: _siteAddress,
              onChanged: (v) => setState(() => _siteAddress = v),
              suggestions: _filteredAddresses,
              placeholder: 'Search or type address…',
            ),
            const SizedBox(height: 12),
            TextField(controller: _notesCtrl, decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder()), maxLines: 2),
            const SizedBox(height: 20),

            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(backgroundColor: widget.accentColor, padding: const EdgeInsets.symmetric(vertical: 14)),
                icon: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.check_circle_outline),
                label: Text(_saving ? 'Saving…' : 'Confirm Load'),
              ),
            ),
          ]))),
        ]),
      ),
    );
  }
}

class _AutocompleteField extends StatefulWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final List<String> suggestions;
  final String placeholder;
  const _AutocompleteField({required this.value, required this.onChanged, required this.suggestions, required this.placeholder});

  @override
  State<_AutocompleteField> createState() => _AutocompleteFieldState();
}

class _AutocompleteFieldState extends State<_AutocompleteField> {
  late TextEditingController _ctrl;
  bool _showList = false;

  @override
  void initState() { super.initState(); _ctrl = TextEditingController(text: widget.value); }
  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  List<String> get _filtered {
    final q = _ctrl.text.trim().toLowerCase();
    return q.isEmpty ? widget.suggestions : widget.suggestions.where((s) => s.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      TextField(
        controller: _ctrl,
        decoration: InputDecoration(labelText: widget.placeholder, border: const OutlineInputBorder()),
        onChanged: (v) { setState(() => _showList = true); widget.onChanged(v); },
        onTap: () => setState(() => _showList = true),
      ),
      if (_showList && _filtered.isNotEmpty)
        Container(
          margin: const EdgeInsets.only(top: 2),
          constraints: const BoxConstraints(maxHeight: 140),
          decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(8), color: Colors.white,
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.07), blurRadius: 8)]),
          child: ListView(shrinkWrap: true, children: _filtered.map((s) => ListTile(
            dense: true,
            title: Text(s, style: const TextStyle(fontSize: 13)),
            onTap: () { _ctrl.text = s; widget.onChanged(s); setState(() => _showList = false); },
          )).toList()),
        ),
    ]);
  }
}

class _RateTypeToggle extends StatelessWidget {
  final String value;
  final ValueChanged<String> onChanged;
  const _RateTypeToggle({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(8)),
      child: Row(mainAxisSize: MainAxisSize.min, children: ['per_pipe', 'per_trip'].map((t) {
        final sel = t == value;
        return GestureDetector(
          onTap: () => onChanged(t),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: sel ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(6),
                boxShadow: sel ? [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 4)] : null),
            child: Text(t == 'per_pipe' ? '₹/Pipe' : '₹/Trip',
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: sel ? const Color(0xFF7C3AED) : Colors.grey)),
          ),
        );
      }).toList()),
    );
  }
}

// ── Extra Vehicles ────────────────────────────────────────────────────────────

const _vehicleKeys = ['crane', 'jcb', 'tractor', 'excavator', 'tipper', 'selfLoader', 'generator', 'transitMixer'];
const _vehicleLabels = {
  'crane': 'Crane', 'jcb': 'JCB', 'tractor': 'Tractor', 'excavator': 'Excavator',
  'tipper': 'Tipper', 'selfLoader': 'Self Loader', 'generator': 'Generator', 'transitMixer': 'Transit Mixer',
};

class _VehicleItem {
  bool enabled;
  String rateType; // 'per_day' | 'per_hour'
  double quantity;
  double rate;
  _VehicleItem({this.enabled = false, this.rateType = 'per_day', this.quantity = 0, this.rate = 0});

  factory _VehicleItem.fromJson(Map<String, dynamic> j) => _VehicleItem(
        enabled: j['enabled'] == true,
        rateType: j['rateType'] ?? 'per_day',
        quantity: (j['quantity'] as num?)?.toDouble() ?? 0,
        rate: (j['rate'] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toJson() => {'enabled': enabled, 'rateType': rateType, 'quantity': quantity, 'rate': rate};
  double get amount => enabled ? quantity * rate : 0;
}

class _ExtraVehicleEntry {
  final int id;
  final String date;
  final String vendor;
  final Map<String, _VehicleItem> vehicles;
  final String? notes;
  _ExtraVehicleEntry({required this.id, required this.date, required this.vendor, required this.vehicles, this.notes});

  factory _ExtraVehicleEntry.fromJson(Map<String, dynamic> j) {
    final rawVehicles = j['vehicles'];
    final vehicleMap = rawVehicles is String ? jsonDecode(rawVehicles) as Map<String, dynamic> : (rawVehicles as Map<String, dynamic>? ?? {});
    return _ExtraVehicleEntry(
      id: j['id'] as int,
      date: j['date'] ?? '',
      vendor: j['vendor'] ?? '',
      vehicles: {for (final k in _vehicleKeys) k: _VehicleItem.fromJson((vehicleMap[k] as Map<String, dynamic>?) ?? {})},
      notes: j['notes'],
    );
  }

  double get totalAmount => _vehicleKeys.fold(0, (s, k) => s + (vehicles[k]?.amount ?? 0));
  List<String> get activeKeys => _vehicleKeys.where((k) => vehicles[k]?.enabled == true).toList();
}

Map<String, _VehicleItem> _emptyVehicleMap() => {for (final k in _vehicleKeys) k: _VehicleItem()};

class ExtraVehiclesScreen extends StatefulWidget {
  const ExtraVehiclesScreen({super.key});
  @override
  State<ExtraVehiclesScreen> createState() => _ExtraVehiclesScreenState();
}

class _ExtraVehiclesScreenState extends State<ExtraVehiclesScreen> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF4C1D95);

  List<_ExtraVehicleEntry> _allItems = [];
  bool _loading = true;

  // date filter
  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  // bottom nav
  String _activeTab      = 'all';
  bool   _searchExpanded = false;
  String _search         = '';
  final  _searchCtrl     = TextEditingController();

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _load();
  }

  @override
  void dispose() {
    _closeDateOverlay();
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
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmt(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getExtraVehicles(
        size: 500,
        fromDate: _fmt(_from),
        toDate: _fmt(_to),
      );
      setState(() {
        _allItems = raw.map((e) => _ExtraVehicleEntry.fromJson(e as Map<String, dynamic>)).toList();
        _loading  = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  List<_ExtraVehicleEntry> get _filtered {
    return _allItems.where((e) {
      if (_activeTab == 'crane' && e.vehicles['crane']?.enabled != true) return false;
      if (_activeTab == 'jcb'   && e.vehicles['jcb']?.enabled   != true) return false;
      if (_activeTab == 'other') {
        final otherKeys = _vehicleKeys.where((k) => k != 'crane' && k != 'jcb');
        if (!otherKeys.any((k) => e.vehicles[k]?.enabled == true)) return false;
      }
      if (_search.trim().isNotEmpty) {
        final q = _search.toLowerCase();
        return e.vendor.toLowerCase().contains(q) ||
               (e.notes ?? '').toLowerCase().contains(q) ||
               e.activeKeys.any((k) => (_vehicleLabels[k] ?? k).toLowerCase().contains(q));
      }
      return true;
    }).toList();
  }

  List<String> get _vendorSuggestions {
    final seen = <String>{};
    return _allItems.map((e) => e.vendor).where((v) => v.isNotEmpty && seen.add(v)).toList()..sort();
  }

  Future<void> _showAddEdit(BuildContext context, {_ExtraVehicleEntry? editing}) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ExtraVehicleSheet(
        accentColor: _color,
        initial: editing,
        vendorSuggestions: _vendorSuggestions,
        onSubmit: (data) async {
          if (editing != null) {
            await ApiService().updateExtraVehicle(editing.id, data);
          } else {
            await ApiService().createExtraVehicle(data);
          }
          await _load();
        },
      ),
    );
  }

  Future<void> _delete(_ExtraVehicleEntry entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Entry'),
        content: Text('Delete entry for ${_fmtDate(entry.date)} — ${entry.vendor}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ApiService().deleteExtraVehicle(entry.id);
      _load();
    }
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );

  Widget _buildFloatingNav() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.10), blurRadius: 20, offset: const Offset(0, 4))],
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 260),
            child: _searchExpanded ? _buildSearchExpanded() : _buildNavItems(),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchExpanded() => Row(
    key: const ValueKey('search'),
    children: [
      Container(
        margin: const EdgeInsets.all(8),
        width: 46, height: 46,
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [_color, _colorDark]),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.search, color: Colors.white, size: 20),
      ),
      Expanded(
        child: TextField(
          controller: _searchCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Search vendor or vehicle…',
            hintStyle: TextStyle(fontSize: 13, color: Colors.grey),
            border: InputBorder.none,
          ),
          style: const TextStyle(fontSize: 14),
          onChanged: (v) => setState(() => _search = v),
        ),
      ),
      GestureDetector(
        onTap: () {
          _searchCtrl.clear();
          setState(() { _search = ''; _searchExpanded = false; });
        },
        child: Container(
          margin: const EdgeInsets.all(8),
          width: 46, height: 46,
          decoration: BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
          child: const Icon(Icons.close, size: 20, color: Colors.grey),
        ),
      ),
    ],
  );

  Widget _buildNavItems() => Row(
    key: const ValueKey('nav'),
    children: [
      _navItem(Icons.search,                            'Search', '',      onTap: () => setState(() => _searchExpanded = true)),
      _navItem(Icons.list_outlined,                    'All',    'all'),
      _navItem(Icons.precision_manufacturing_outlined,  'Crane',  'crane'),
      _navItem(Icons.construction_outlined,             'JCB',    'jcb'),
      _navItem(Icons.directions_car_outlined,           'Other',  'other'),
    ],
  );

  Widget _navItem(IconData icon, String label, String tab, {VoidCallback? onTap}) {
    final active = tab.isNotEmpty && _activeTab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: onTap ?? () => setState(() => _activeTab = tab),
        child: Container(
          margin: const EdgeInsets.all(6),
          decoration: active
              ? BoxDecoration(
                  gradient: const LinearGradient(colors: [_color, _colorDark]),
                  borderRadius: BorderRadius.circular(26),
                )
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 20, color: active ? Colors.white : Colors.grey.shade500),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
                color: active ? Colors.white : Colors.grey.shade500)),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final items = _filtered;
    final totalAmount = items.fold(0.0, (s, e) => s + e.totalAmount);
    final fmt = NumberFormat('#,##0', 'en_IN');

    return Scaffold(
      bottomNavigationBar: _buildFloatingNav(),
      body: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 120,
          backgroundColor: _color,
          foregroundColor: Colors.white,
          leading: context.canPop()
              ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())
              : IconButton(icon: const Icon(Icons.menu_outlined), onPressed: openAppDrawer, tooltip: 'Open menu'),
          title: const Text('Extra Vehicles'),
          actions: [
            CompositedTransformTarget(
              link: _layerLink,
              child: GestureDetector(
                onTap: _toggleDateOverlay,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withOpacity(0.25)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                    const SizedBox(width: 5),
                    Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                    const SizedBox(width: 3),
                    const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                  ]),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: const Icon(Icons.add, color: Colors.white),
              onPressed: () => _showAddEdit(context),
            ),
            const SizedBox(width: 4),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [_color, _colorDark],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(6, 64, 6, 4),
                  child: Row(children: [
                    _hStat('${items.length}', 'Entries'),
                    _hStat(totalAmount > 0 ? '₹${fmt.format(totalAmount)}' : '—', 'Total ₹'),
                  ]),
                ),
              ),
            ),
          ),
        ),
        SliverFillRemaining(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: items.isEmpty
                      ? Center(
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.directions_car_outlined, size: 48, color: Colors.grey.shade300),
                            const SizedBox(height: 12),
                            Text('No extra vehicle entries',
                                style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                          ]),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                          itemCount: items.length,
                          itemBuilder: (_, i) => _ExtraVehicleCard(
                            entry: items[i],
                            color: _color,
                            onEdit: () => _showAddEdit(context, editing: items[i]),
                            onDelete: () => _delete(items[i]),
                          ),
                        ),
                ),
        ),
      ]),
    );
  }
}

class _ExtraVehicleCard extends StatelessWidget {
  final _ExtraVehicleEntry entry;
  final Color color;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _ExtraVehicleCard({required this.entry, required this.color, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final active = entry.activeKeys;
    final fmt = NumberFormat('#,##0.00', 'en_IN');
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.withOpacity(0.15)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                width: 36, height: 36,
                decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                child: Icon(Icons.directions_car_outlined, color: color, size: 18),
              ),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(entry.vendor, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                Text(_fmtDate(entry.date), style: const TextStyle(fontSize: 12, color: Colors.grey)),
              ])),
              Text('₹${fmt.format(entry.totalAmount)}',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: color)),
              const SizedBox(width: 4),
              IconButton(icon: const Icon(Icons.edit_outlined, size: 18), color: Colors.grey, onPressed: onEdit, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
              const SizedBox(width: 4),
              IconButton(icon: const Icon(Icons.delete_outline, size: 18), color: Colors.red[300], onPressed: onDelete, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
            ]),
            if (active.isNotEmpty) ...[
              const SizedBox(height: 8),
              const Divider(height: 1),
              const SizedBox(height: 8),
              ...active.map((k) {
                final v = entry.vehicles[k]!;
                final rateLabel = v.rateType == 'per_day' ? 'day' : 'hr';
                return Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: color.withOpacity(0.08), borderRadius: BorderRadius.circular(20)),
                      child: Text(_vehicleLabels[k] ?? k, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: color)),
                    ),
                    const SizedBox(width: 8),
                    Text('${v.quantity % 1 == 0 ? v.quantity.toInt() : v.quantity} / $rateLabel',
                        style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    const Spacer(),
                    Text('₹${fmt.format(v.amount)}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                  ]),
                );
              }),
            ],
            if (entry.notes != null && entry.notes!.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(entry.notes!, style: const TextStyle(fontSize: 11, color: Colors.grey)),
            ],
          ],
        ),
      ),
    );
  }
}

class _ExtraVehicleSheet extends StatefulWidget {
  final Color accentColor;
  final _ExtraVehicleEntry? initial;
  final List<String> vendorSuggestions;
  final Future<void> Function(Map<String, dynamic>) onSubmit;
  const _ExtraVehicleSheet({required this.accentColor, this.initial, required this.vendorSuggestions, required this.onSubmit});

  @override
  State<_ExtraVehicleSheet> createState() => _ExtraVehicleSheetState();
}

class _ExtraVehicleSheetState extends State<_ExtraVehicleSheet> {
  late DateTime _date;
  late TextEditingController _vendorCtrl;
  late TextEditingController _notesCtrl;
  late Map<String, _VehicleItem> _vehicles;
  bool _saving = false;
  bool _showSuggestions = false;

  final Map<String, TextEditingController> _qtyCtrl = {};
  final Map<String, TextEditingController> _rateCtrl = {};

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    _date = init != null ? DateTime.tryParse(init.date) ?? DateTime.now() : DateTime.now();
    _vendorCtrl = TextEditingController(text: init?.vendor ?? '');
    _notesCtrl = TextEditingController(text: init?.notes ?? '');
    _vehicles = init != null
        ? {for (final k in _vehicleKeys) k: _VehicleItem(enabled: init.vehicles[k]?.enabled ?? false, rateType: init.vehicles[k]?.rateType ?? 'per_day', quantity: init.vehicles[k]?.quantity ?? 0, rate: init.vehicles[k]?.rate ?? 0)}
        : _emptyVehicleMap();
    for (final k in _vehicleKeys) {
      final v = _vehicles[k]!;
      _qtyCtrl[k] = TextEditingController(text: v.quantity > 0 ? (v.quantity % 1 == 0 ? v.quantity.toInt().toString() : v.quantity.toString()) : '');
      _rateCtrl[k] = TextEditingController(text: v.rate > 0 ? v.rate.toStringAsFixed(2) : '');
    }
  }

  @override
  void dispose() {
    _vendorCtrl.dispose(); _notesCtrl.dispose();
    for (final c in _qtyCtrl.values) c.dispose();
    for (final c in _rateCtrl.values) c.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime(2030));
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (_vendorCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a vendor name')));
      return;
    }
    final anyEnabled = _vehicleKeys.any((k) => _vehicles[k]!.enabled);
    if (!anyEnabled) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enable at least one vehicle')));
      return;
    }
    // sync text controllers to model
    for (final k in _vehicleKeys) {
      _vehicles[k]!.quantity = double.tryParse(_qtyCtrl[k]!.text.trim()) ?? 0;
      _vehicles[k]!.rate = double.tryParse(_rateCtrl[k]!.text.trim()) ?? 0;
    }
    setState(() => _saving = true);
    try {
      final vehicleJson = {for (final k in _vehicleKeys) k: _vehicles[k]!.toJson()};
      await widget.onSubmit({
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'vendor': _vendorCtrl.text.trim(),
        'vehicles': jsonEncode(vehicleJson),
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  List<String> get _filteredSuggestions {
    final q = _vendorCtrl.text.trim().toLowerCase();
    final all = widget.vendorSuggestions;
    return q.isEmpty ? all : all.where((s) => s.toLowerCase().contains(q)).toList();
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(child: Text(widget.initial != null ? 'Edit Entry' : 'Add Extra Vehicles',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
              IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
            ]),
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 12),
                    // Date
                    GestureDetector(
                      onTap: _pickDate,
                      child: InputDecorator(
                        decoration: const InputDecoration(labelText: 'Date *', border: OutlineInputBorder(), suffixIcon: Icon(Icons.calendar_today_outlined)),
                        child: Text(DateFormat('dd MMM yyyy').format(_date)),
                      ),
                    ),
                    const SizedBox(height: 12),
                    // Vendor with autocomplete
                    Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      TextField(
                        controller: _vendorCtrl,
                        decoration: const InputDecoration(labelText: 'Vendor *', border: OutlineInputBorder()),
                        onChanged: (_) => setState(() => _showSuggestions = true),
                        onTap: () => setState(() => _showSuggestions = true),
                      ),
                      if (_showSuggestions && _filteredSuggestions.isNotEmpty)
                        Container(
                          margin: const EdgeInsets.only(top: 2),
                          decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade200), borderRadius: BorderRadius.circular(8), color: Colors.white,
                              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 8)]),
                          constraints: const BoxConstraints(maxHeight: 150),
                          child: ListView(shrinkWrap: true, children: _filteredSuggestions.map((s) => ListTile(
                            dense: true, title: Text(s, style: const TextStyle(fontSize: 13)),
                            onTap: () { _vendorCtrl.text = s; setState(() => _showSuggestions = false); },
                          )).toList()),
                        ),
                    ]),
                    const SizedBox(height: 16),
                    const Text('Vehicles', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey)),
                    const SizedBox(height: 8),
                    // Vehicle rows
                    ..._vehicleKeys.map((k) {
                      final v = _vehicles[k]!;
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: v.enabled ? widget.accentColor.withOpacity(0.04) : Colors.grey.shade50,
                          border: Border.all(color: v.enabled ? widget.accentColor.withOpacity(0.3) : Colors.grey.shade200),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Column(children: [
                          // Toggle row
                          InkWell(
                            borderRadius: BorderRadius.circular(10),
                            onTap: () => setState(() => v.enabled = !v.enabled),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              child: Row(children: [
                                Switch(value: v.enabled, onChanged: (val) => setState(() => v.enabled = val), activeColor: widget.accentColor, materialTapTargetSize: MaterialTapTargetSize.shrinkWrap),
                                const SizedBox(width: 8),
                                Text(_vehicleLabels[k] ?? k, style: TextStyle(fontWeight: FontWeight.w600, color: v.enabled ? Colors.black87 : Colors.grey)),
                                const Spacer(),
                                if (v.enabled)
                                  Builder(builder: (_) {
                                    final qty = double.tryParse(_qtyCtrl[k]!.text) ?? 0;
                                    final rate = double.tryParse(_rateCtrl[k]!.text) ?? 0;
                                    final amt = qty * rate;
                                    return amt > 0
                                        ? Text('₹${NumberFormat('#,##0.00', 'en_IN').format(amt)}',
                                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: widget.accentColor))
                                        : const SizedBox();
                                  }),
                              ]),
                            ),
                          ),
                          // Fields (when enabled)
                          if (v.enabled) Padding(
                            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                            child: Row(children: [
                              // Rate type
                              Expanded(flex: 2, child: DropdownButtonFormField<String>(
                                value: v.rateType,
                                decoration: const InputDecoration(labelText: 'Rate Type', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10)),
                                items: const [
                                  DropdownMenuItem(value: 'per_day', child: Text('Per Day', style: TextStyle(fontSize: 13))),
                                  DropdownMenuItem(value: 'per_hour', child: Text('Per Hour', style: TextStyle(fontSize: 13))),
                                ],
                                onChanged: (val) => setState(() => v.rateType = val ?? 'per_day'),
                              )),
                              const SizedBox(width: 8),
                              // Quantity
                              Expanded(child: TextField(
                                controller: _qtyCtrl[k],
                                decoration: const InputDecoration(labelText: 'Qty', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10)),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                onChanged: (_) => setState(() {}),
                              )),
                              const SizedBox(width: 8),
                              // Rate
                              Expanded(child: TextField(
                                controller: _rateCtrl[k],
                                decoration: const InputDecoration(labelText: 'Rate ₹', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10)),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                onChanged: (_) => setState(() {}),
                              )),
                            ]),
                          ),
                        ]),
                      );
                    }),
                    const SizedBox(height: 4),
                    // Notes
                    TextField(
                      controller: _notesCtrl,
                      decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder()),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _saving ? null : _submit,
                        style: FilledButton.styleFrom(backgroundColor: widget.accentColor),
                        child: _saving
                            ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : Text(widget.initial != null ? 'Save Changes' : 'Add Entry'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Conversion ────────────────────────────────────────────────────────────────

class _ConversionEntry {
  final int id;
  final String date;
  final String fromPipe;
  final String toPipe;
  final String quantity;
  final String? notes;
  _ConversionEntry({required this.id, required this.date, required this.fromPipe, required this.toPipe, required this.quantity, this.notes});

  factory _ConversionEntry.fromJson(Map<String, dynamic> j) => _ConversionEntry(
        id: j['id'] as int, date: j['date'] ?? '', fromPipe: j['fromPipe'] ?? '',
        toPipe: j['toPipe'] ?? '', quantity: j['quantity']?.toString() ?? '0', notes: j['notes'],
      );

  static RegExp _pipeRe = RegExp(r'(\d+)mm\s+([\d.]+)kg', caseSensitive: false);

  Map<String, String>? get fromParsed { final m = _pipeRe.firstMatch(fromPipe); return m != null ? {'d': m[1]!, 'kg': m[2]!} : null; }
  Map<String, String>? get toParsed   { final m = _pipeRe.firstMatch(toPipe);   return m != null ? {'d': m[1]!, 'kg': m[2]!} : null; }
}

class ConversionScreen extends StatefulWidget {
  const ConversionScreen({super.key});
  @override
  State<ConversionScreen> createState() => _ConversionScreenState();
}

class _ConversionScreenState extends State<ConversionScreen> {
  static const _color     = Color(0xFF9333EA);
  static const _colorDark = Color(0xFF6B21A8);

  List<_ConversionEntry> _items = [];
  bool _loading = true;
  Map<String, List<String>> _pipesByDiameter = {};
  List<String> _diameters = [];
  bool _loadingPipes = true;

  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _loadAll();
  }

  @override
  void dispose() {
    _closeDateOverlay();
    super.dispose();
  }

  void _closeDateOverlay() {
    _dateOverlay?.remove();
    _dateOverlay = null;
  }

  void _toggleDateOverlay() {
    if (_dateOverlay != null) { _closeDateOverlay(); return; }
    final entry = OverlayEntry(
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmtDate2(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _loadAll() async {
    await Future.wait([_load(), _loadPipes()]);
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getConversions(fromDate: _fmtDate2(_from), toDate: _fmtDate2(_to));
      setState(() {
        _items = raw.map((e) => _ConversionEntry.fromJson(e as Map<String, dynamic>)).toList();
        _loading = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  Future<void> _loadPipes() async {
    setState(() => _loadingPipes = true);
    try {
      final raw = await ApiService().getPipeConfigs();
      final re = RegExp(r'(\d+)mm\s+([\d.]+)kg', caseSensitive: false);
      final map = <String, List<String>>{};
      for (final p in raw) {
        final name = (p as Map<String, dynamic>)['name']?.toString() ?? '';
        final m = re.firstMatch(name);
        if (m == null) continue;
        final d = m[1]!, kg = m[2]!;
        map.putIfAbsent(d, () => []);
        if (!map[d]!.contains(kg)) map[d]!.add(kg);
      }
      for (final list in map.values) list.sort((a, b) => double.parse(a).compareTo(double.parse(b)));
      final diams = map.keys.toList()..sort((a, b) => int.parse(a).compareTo(int.parse(b)));
      setState(() { _pipesByDiameter = map; _diameters = diams; _loadingPipes = false; });
    } catch (_) { setState(() => _loadingPipes = false); }
  }

  Future<void> _showAddEdit({_ConversionEntry? editing}) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ConversionSheet(
        accentColor: _color,
        initial: editing,
        pipesByDiameter: _pipesByDiameter,
        diameters: _diameters,
        loadingPipes: _loadingPipes,
        onSubmit: (data) async {
          if (editing != null) {
            await ApiService().updateConversion(editing.id, data);
          } else {
            await ApiService().createConversion(data);
          }
          await _load();
        },
      ),
    );
  }

  Future<void> _delete(_ConversionEntry entry) async {
    final fp = entry.fromParsed;
    final tp = entry.toParsed;
    final desc = fp != null && tp != null
        ? '${fp['d']}mm ${fp['kg']}kg → ${tp['kg']}kg'
        : '${entry.fromPipe} → ${entry.toPipe}';
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Conversion'),
        content: Text('Delete $desc on ${_fmtDate(entry.date)}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirmed == true) { await ApiService().deleteConversion(entry.id); _load(); }
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    final totalQty = _items.fold(0.0, (s, e) => s + (double.tryParse(e.quantity) ?? 0));
    final uniquePipes = _items.map((e) => e.fromPipe).toSet().length;

    return Scaffold(
      backgroundColor: Colors.white,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAll,
              child: CustomScrollView(slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 120,
                  backgroundColor: _color,
                  foregroundColor: Colors.white,
                  leading: context.canPop()
                      ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())
                      : IconButton(icon: const Icon(Icons.menu_outlined), onPressed: openAppDrawer, tooltip: 'Open menu'),
                  title: const Text('Conversion'),
                  actions: [
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                            const SizedBox(width: 5),
                            Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                            const SizedBox(width: 3),
                            const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                          ]),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.add, color: Colors.white),
                      onPressed: () => _showAddEdit(),
                    ),
                    const SizedBox(width: 4),
                  ],
                  flexibleSpace: FlexibleSpaceBar(
                    background: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [_color, _colorDark],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: SafeArea(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(6, 64, 6, 4),
                          child: Row(children: [
                            _hStat('${_items.length}', 'Conversions'),
                            _hStat('${totalQty.toInt()}', 'Total Pipes'),
                            _hStat('$uniquePipes', 'Pipe Types'),
                          ]),
                        ),
                      ),
                    ),
                  ),
                ),
                _items.isEmpty
                    ? SliverFillRemaining(
                        child: Center(
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.sync_outlined, size: 48, color: Colors.grey.shade300),
                            const SizedBox(height: 12),
                            Text('No conversion entries', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                          ]),
                        ),
                      )
                    : SliverPadding(
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 20),
                        sliver: SliverList(
                          delegate: SliverChildBuilderDelegate(
                            (_, i) => _ConversionCard(entry: _items[i], color: _color,
                                onEdit: () => _showAddEdit(editing: _items[i]),
                                onDelete: () => _delete(_items[i])),
                            childCount: _items.length,
                          ),
                        ),
                      ),
              ]),
            ),
    );
  }
}

class _ConversionCard extends StatelessWidget {
  final _ConversionEntry entry;
  final Color color;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _ConversionCard({required this.entry, required this.color, required this.onEdit, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final fp = entry.fromParsed;
    final tp = entry.toParsed;
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.withOpacity(0.15))),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          Icon(Icons.sync_outlined, color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            if (fp != null)
              Row(children: [
                RichText(text: TextSpan(
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                  children: [
                    TextSpan(text: '${fp['d']} mm', style: const TextStyle(color: Color(0xFF374151))),
                    TextSpan(text: ' · ${fp['kg']} kg', style: TextStyle(color: Colors.grey[400])),
                  ],
                )),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  child: Icon(Icons.arrow_forward, size: 13, color: Colors.grey[400]),
                ),
                Text('${tp?['kg'] ?? ''} kg',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
              ])
            else
              Text('${entry.fromPipe} → ${entry.toPipe}', style: const TextStyle(fontSize: 12)),
            const SizedBox(height: 2),
            Text(_fmtDate(entry.date), style: const TextStyle(fontSize: 11, color: Colors.grey)),
            if (entry.notes != null && entry.notes!.isNotEmpty)
              Text(entry.notes!, style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ])),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
            Text('${double.tryParse(entry.quantity)?.toInt() ?? entry.quantity} pipes',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
            const SizedBox(height: 2),
            Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(icon: const Icon(Icons.edit_outlined, size: 18), color: Colors.grey, onPressed: onEdit, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
              const SizedBox(width: 4),
              IconButton(icon: const Icon(Icons.delete_outline, size: 18), color: Colors.red[300], onPressed: onDelete, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
            ]),
          ]),
        ]),
      ),
    );
  }
}

class _ConversionSheet extends StatefulWidget {
  final Color accentColor;
  final _ConversionEntry? initial;
  final Map<String, List<String>> pipesByDiameter;
  final List<String> diameters;
  final bool loadingPipes;
  final Future<void> Function(Map<String, dynamic>) onSubmit;
  const _ConversionSheet({required this.accentColor, this.initial, required this.pipesByDiameter, required this.diameters, required this.loadingPipes, required this.onSubmit});

  @override
  State<_ConversionSheet> createState() => _ConversionSheetState();
}

class _ConversionSheetState extends State<_ConversionSheet> {
  late DateTime _date;
  late String _diameter;
  late String _fromKg;
  late String _toKg;
  late TextEditingController _qtyCtrl;
  late TextEditingController _notesCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    _date = init != null ? (DateTime.tryParse(init.date) ?? DateTime.now()) : DateTime.now();
    _diameter = init?.fromParsed?['d'] ?? (widget.diameters.isNotEmpty ? widget.diameters.first : '');
    _fromKg = init?.fromParsed?['kg'] ?? '';
    _toKg = init?.toParsed?['kg'] ?? '';
    _qtyCtrl = TextEditingController(text: init?.quantity ?? '');
    _notesCtrl = TextEditingController(text: init?.notes ?? '');
  }

  @override
  void dispose() { _qtyCtrl.dispose(); _notesCtrl.dispose(); super.dispose(); }

  Future<void> _pickDate() async {
    final today = DateTime.now();
    final picked = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: today);
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    if (_diameter.isEmpty) { _snack('Please select a diameter'); return; }
    if (_fromKg.isEmpty) { _snack('Please select source pressure'); return; }
    if (_toKg.isEmpty) { _snack('Please select target pressure'); return; }
    if (_fromKg == _toKg) { _snack('From and To pressures must be different'); return; }
    final qty = double.tryParse(_qtyCtrl.text.trim()) ?? 0;
    if (qty <= 0) { _snack('Please enter a valid quantity'); return; }

    setState(() => _saving = true);
    try {
      await widget.onSubmit({
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'fromPipe': 'PCCP ${_diameter}mm ${_fromKg}kg',
        'toPipe': 'PCCP ${_diameter}mm ${_toKg}kg',
        'quantity': _qtyCtrl.text.trim(),
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) _snack('Error: $e');
    }
  }

  void _snack(String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));

  List<String> get _kgOptions => widget.pipesByDiameter[_diameter] ?? [];

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: Padding(
        padding: EdgeInsets.only(left: 20, right: 20, top: 20, bottom: bottom + 20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text(widget.initial != null ? 'Edit Conversion' : 'New Conversion',
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
            IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
          ]),
          Flexible(child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 12),

            // Date
            GestureDetector(
              onTap: _pickDate,
              child: InputDecorator(
                decoration: const InputDecoration(labelText: 'Date *', border: OutlineInputBorder(), suffixIcon: Icon(Icons.calendar_today_outlined)),
                child: Text(DateFormat('dd MMM yyyy').format(_date)),
              ),
            ),
            const SizedBox(height: 16),

            // Diameter chips
            const Text('Diameter *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 8),
            widget.loadingPipes
                ? const Text('Loading pipe configs…', style: TextStyle(fontSize: 12, color: Colors.grey))
                : widget.diameters.isEmpty
                    ? const Text('No pipe configs found', style: TextStyle(fontSize: 12, color: Colors.grey))
                    : Wrap(spacing: 8, runSpacing: 8, children: widget.diameters.map((d) {
                        final selected = d == _diameter;
                        return GestureDetector(
                          onTap: () => setState(() { _diameter = d; _fromKg = ''; _toKg = ''; }),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            decoration: BoxDecoration(
                              color: selected ? widget.accentColor : Colors.white,
                              border: Border.all(color: selected ? widget.accentColor : Colors.grey.shade300),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text('$d mm', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: selected ? Colors.white : Colors.grey.shade700)),
                          ),
                        );
                      }).toList()),
            const SizedBox(height: 16),

            // From → To pressure dropdowns
            const Text('Pressure Conversion *', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey)),
            const SizedBox(height: 8),
            Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
              Expanded(child: DropdownButtonFormField<String>(
                value: _fromKg.isEmpty ? null : _fromKg,
                decoration: const InputDecoration(labelText: 'From pressure', border: OutlineInputBorder()),
                items: _kgOptions.where((k) => k != _toKg).map((k) => DropdownMenuItem(value: k, child: Text('$k kg'))).toList(),
                onChanged: _diameter.isEmpty ? null : (v) => setState(() => _fromKg = v ?? ''),
                hint: const Text('From…'),
              )),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8),
                child: Icon(Icons.arrow_forward, color: widget.accentColor, size: 18),
              ),
              Expanded(child: DropdownButtonFormField<String>(
                value: _toKg.isEmpty ? null : _toKg,
                decoration: const InputDecoration(labelText: 'To pressure', border: OutlineInputBorder()),
                items: _kgOptions.where((k) => k != _fromKg).map((k) => DropdownMenuItem(value: k, child: Text('$k kg'))).toList(),
                onChanged: _diameter.isEmpty ? null : (v) => setState(() => _toKg = v ?? ''),
                hint: const Text('To…'),
              )),
            ]),

            // Live preview
            if (_diameter.isNotEmpty && _fromKg.isNotEmpty && _toKg.isNotEmpty) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(color: widget.accentColor.withOpacity(0.05), borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: widget.accentColor.withOpacity(0.2))),
                child: Row(children: [
                  const Text('Converting: ', style: TextStyle(fontSize: 11, color: Colors.grey)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: Colors.orange.shade50, borderRadius: BorderRadius.circular(6)),
                    child: Text('PCCP ${_diameter}mm ${_fromKg}kg', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.orange.shade700)),
                  ),
                  Padding(padding: const EdgeInsets.symmetric(horizontal: 6), child: Icon(Icons.arrow_forward, size: 12, color: widget.accentColor)),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(color: widget.accentColor.withOpacity(0.08), borderRadius: BorderRadius.circular(6)),
                    child: Text('PCCP ${_diameter}mm ${_toKg}kg', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: widget.accentColor)),
                  ),
                ]),
              ),
            ],
            const SizedBox(height: 16),

            // Quantity
            TextField(
              controller: _qtyCtrl,
              decoration: const InputDecoration(labelText: 'Quantity (pipes) *', border: OutlineInputBorder()),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: 12),

            // Notes
            TextField(
              controller: _notesCtrl,
              decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder()),
              maxLines: 2,
            ),
            const SizedBox(height: 16),

            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: _saving ? null : _submit,
                style: FilledButton.styleFrom(backgroundColor: widget.accentColor),
                child: _saving
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text(widget.initial != null ? 'Save Changes' : 'Add Conversion'),
              ),
            ),
          ]))),
        ]),
      ),
    );
  }
}

// ── Shared Widgets ────────────────────────────────────────────────────────────

class _BizCard extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final String? notes;

  const _BizCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    this.notes,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.withOpacity(0.15)),
      ),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: color.withOpacity(0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(subtitle),
            if (notes != null && notes!.isNotEmpty)
              Text(notes!,
                  style: const TextStyle(fontSize: 11, color: Colors.grey)),
          ],
        ),
        isThreeLine: notes != null && notes!.isNotEmpty,
      ),
    );
  }
}

String _fmtDate(String dateStr) {
  try {
    return DateFormat('dd MMM yyyy').format(DateTime.parse(dateStr));
  } catch (_) {
    return dateStr;
  }
}

class _FieldDef {
  final String key;
  final String label;
  final TextInputType type;
  const _FieldDef(this.key, this.label, this.type);
}

class _SimpleAddSheet extends StatefulWidget {
  final String title;
  final Color accentColor;
  final List<_FieldDef> fields;
  final Future<void> Function(Map<String, String>) onSubmit;

  const _SimpleAddSheet({
    required this.title,
    required this.accentColor,
    required this.fields,
    required this.onSubmit,
  });

  @override
  State<_SimpleAddSheet> createState() => _SimpleAddSheetState();
}

class _SimpleAddSheetState extends State<_SimpleAddSheet> {
  late final Map<String, TextEditingController> _controllers;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _controllers = {for (final f in widget.fields) f.key: TextEditingController()};
  }

  @override
  void dispose() {
    for (final c in _controllers.values) c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
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
          Text(widget.title,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          ...widget.fields.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextField(
                  controller: _controllers[f.key],
                  decoration: InputDecoration(
                    labelText: f.label,
                    border: const OutlineInputBorder(),
                  ),
                  keyboardType: f.type,
                ),
              )),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _submit,
              style: FilledButton.styleFrom(backgroundColor: widget.accentColor),
              child: _saving
                  ? const SizedBox(
                      height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Save'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await widget.onSubmit(
          {for (final e in _controllers.entries) e.key: e.value.text.trim()});
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}

// ── Loaded Pipes ──────────────────────────────────────────────────────────────

class LoadedPipesScreen extends StatefulWidget {
  const LoadedPipesScreen({super.key});
  @override
  State<LoadedPipesScreen> createState() => _LoadedPipesScreenState();
}

class _LoadedPipesScreenState extends State<LoadedPipesScreen> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF4C1D95);

  List<dynamic> _records = [];
  bool _loading = true;
  String _search = '';

  // date filter
  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  // bottom nav
  bool   _searchExpanded = false;
  final  _searchCtrl     = TextEditingController();

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _loadData();
  }

  @override
  void dispose() {
    _closeDateOverlay();
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
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _loadData();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String get _fromStr => DateFormat('yyyy-MM-dd').format(_from);
  String get _toStr   => DateFormat('yyyy-MM-dd').format(_to);

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getLoadingRecords(from: _fromStr, to: _toStr, size: 500);
      if (mounted) setState(() { _records = raw; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> get _filtered {
    if (_search.isEmpty) return _records;
    final q = _search.toLowerCase();
    return _records.where((r) {
      final pipe    = (r['pipeName']      ?? '').toString().toLowerCase();
      final vehicle = (r['vehicleNo']     ?? '').toString().toLowerCase();
      final driver  = (r['driverName']    ?? '').toString().toLowerCase();
      final vendor  = (r['vendorName']    ?? '').toString().toLowerCase();
      final ch      = (r['customerPoNo']  ?? '').toString().toLowerCase();
      return pipe.contains(q) || vehicle.contains(q) ||
             driver.contains(q) || vendor.contains(q) || ch.contains(q);
    }).toList();
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );

  Widget _buildFloatingNav() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.10), blurRadius: 20, offset: const Offset(0, 4))],
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 260),
            child: _searchExpanded ? _buildSearchExpanded() : _buildNavItems(),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchExpanded() => Row(
    key: const ValueKey('search'),
    children: [
      Container(
        margin: const EdgeInsets.all(8),
        width: 46, height: 46,
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [_color, _colorDark]),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.search, color: Colors.white, size: 20),
      ),
      Expanded(
        child: TextField(
          controller: _searchCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Search pipe, vehicle, driver, vendor…',
            hintStyle: TextStyle(fontSize: 13, color: Colors.grey),
            border: InputBorder.none,
          ),
          style: const TextStyle(fontSize: 14),
          onChanged: (v) => setState(() => _search = v),
        ),
      ),
      GestureDetector(
        onTap: () {
          _searchCtrl.clear();
          setState(() { _search = ''; _searchExpanded = false; });
        },
        child: Container(
          margin: const EdgeInsets.all(8),
          width: 46, height: 46,
          decoration: BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
          child: const Icon(Icons.close, size: 20, color: Colors.grey),
        ),
      ),
    ],
  );

  Widget _buildNavItems() => Row(
    key: const ValueKey('nav'),
    children: [
      _navItem(Icons.search,        'Search', active: false, onTap: () => setState(() => _searchExpanded = true)),
      _navItem(Icons.list_outlined, 'All',    active: true),
    ],
  );

  Widget _navItem(IconData icon, String label, {required bool active, VoidCallback? onTap}) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          margin: const EdgeInsets.all(6),
          decoration: active
              ? BoxDecoration(
                  gradient: const LinearGradient(colors: [_color, _colorDark]),
                  borderRadius: BorderRadius.circular(26),
                )
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 20, color: active ? Colors.white : Colors.grey.shade500),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600,
                color: active ? Colors.white : Colors.grey.shade500)),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final items       = _filtered;
    final totalPipes  = items.fold(0, (s, r) => s + (int.tryParse(r['quantity']?.toString() ?? '0') ?? 0));
    final uniqueTypes = items.map((r) => r['pipeName']?.toString() ?? '').toSet().length;

    return Scaffold(
      backgroundColor: Colors.white,
      bottomNavigationBar: _buildFloatingNav(),
      body: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 120,
          backgroundColor: _color,
          foregroundColor: Colors.white,
          leading: context.canPop()
              ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())
              : IconButton(icon: const Icon(Icons.menu_outlined), onPressed: openAppDrawer, tooltip: 'Open menu'),
          title: const Text('Loaded Pipes'),
          actions: [
            CompositedTransformTarget(
              link: _layerLink,
              child: GestureDetector(
                onTap: _toggleDateOverlay,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withOpacity(0.25)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                    const SizedBox(width: 5),
                    Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                    const SizedBox(width: 3),
                    const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                  ]),
                ),
              ),
            ),
            const SizedBox(width: 8),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [_color, _colorDark],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(6, 64, 6, 4),
                  child: Row(children: [
                    _hStat('${items.length}', 'Dispatches'),
                    _hStat('$totalPipes', 'Pipes Loaded'),
                    _hStat('$uniqueTypes', 'Pipe Types'),
                  ]),
                ),
              ),
            ),
          ),
        ),
        SliverFillRemaining(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _loadData,
                  child: items.isEmpty
                      ? Center(
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.local_shipping_outlined, size: 48, color: Colors.grey.shade300),
                            const SizedBox(height: 12),
                            Text('No records found',
                                style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                          ]),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                          itemCount: items.length,
                          itemBuilder: (ctx, i) => _RecordCard(
                            record: items[i],
                            onUpdated: _loadData,
                          ),
                        ),
                ),
        ),
      ]),
    );
  }
}

// ── Record Card ───────────────────────────────────────────────────────────────

class _RecordCard extends StatelessWidget {
  final Map<String, dynamic> record;
  final VoidCallback onUpdated;
  const _RecordCard({required this.record, required this.onUpdated});

  @override
  Widget build(BuildContext context) {
    final date      = _fmtDate(record['date']?.toString() ?? record['createdAt']?.toString() ?? '');
    final pipeName  = record['pipeName']?.toString() ?? '—';
    final qty       = record['quantity']?.toString() ?? '0';
    final vehicleNo = record['vehicleNo']?.toString() ?? '—';
    final driver    = record['driverName']?.toString() ?? '—';
    final contact   = record['driverContact']?.toString() ?? '';
    final vendor    = record['vendorName']?.toString() ?? record['vendor']?.toString() ?? '—';
    final chNo      = record['customerPoNo']?.toString() ?? '';
    final hasPhoto  = record['challanPhotoUrl'] != null && (record['challanPhotoUrl'] as String).isNotEmpty;
    final id        = record['id'] is int ? record['id'] as int : int.tryParse(record['id']?.toString() ?? '') ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.07), blurRadius: 12, offset: const Offset(0, 3)),
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4,  offset: const Offset(0, 1)),
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
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFF16A34A).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(date, style: const TextStyle(fontSize: 11, color: Color(0xFF16A34A), fontWeight: FontWeight.w600)),
                ),
                const Spacer(),
                if (chNo.isNotEmpty)
                  Text('CH: $chNo', style: const TextStyle(fontSize: 11, color: Colors.grey)),
              ],
            ),
            const SizedBox(height: 8),
            Text(pipeName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            _InfoRow(Icons.numbers, 'Qty: $qty pipes'),
            _InfoRow(Icons.local_shipping_outlined, '$vehicleNo · $driver${contact.isNotEmpty ? ' · $contact' : ''}'),
            if (vendor != '—') _InfoRow(Icons.business_outlined, vendor),
            const SizedBox(height: 10),
            Row(
              children: [
                _ActionBtn(
                  icon: Icons.receipt_long_outlined,
                  label: 'Delivery Challan',
                  color: const Color(0xFF2563EB),
                  onTap: () => showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    backgroundColor: Colors.transparent,
                    builder: (_) => _DeliveryChallanSheet(record: record, onSaved: onUpdated),
                  ),
                ),
                const SizedBox(width: 8),
                _ActionBtn(
                  icon: hasPhoto ? Icons.photo_outlined : Icons.upload_outlined,
                  label: hasPhoto ? 'View Photo' : 'Add Photo',
                  color: hasPhoto ? const Color(0xFF7C3AED) : const Color(0xFF64748B),
                  onTap: () => _handlePhoto(context, id, hasPhoto, record['challanPhotoUrl']?.toString()),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handlePhoto(BuildContext context, int id, bool hasPhoto, String? url) async {
    if (hasPhoto && url != null && url.isNotEmpty) {
      showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.black,
        builder: (_) => _PhotoLightbox(url: url, id: id, onDeleted: onUpdated),
      );
    } else {
      await _uploadPhoto(context, id);
    }
  }

  Future<void> _uploadPhoto(BuildContext context, int id) async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery, imageQuality: 85);
    if (picked == null) return;
    final bytes = await picked.readAsBytes();
    try {
      await ApiService().uploadChallanPhoto(id, bytes, picked.name);
      onUpdated();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Photo uploaded')));
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Upload failed: $e')));
      }
    }
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const _InfoRow(this.icon, this.text);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 3),
      child: Row(
        children: [
          Icon(icon, size: 13, color: Colors.grey),
          const SizedBox(width: 4),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 12, color: Color(0xFF374151)))),
        ],
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionBtn({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: color.withOpacity(0.08),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: color.withOpacity(0.2)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 15, color: color),
              const SizedBox(width: 4),
              Text(label, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Photo Lightbox ────────────────────────────────────────────────────────────

class _PhotoLightbox extends StatelessWidget {
  final String url;
  final int id;
  final VoidCallback onDeleted;
  const _PhotoLightbox({required this.url, required this.id, required this.onDeleted});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
                const Spacer(),
                TextButton.icon(
                  icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                  label: const Text('Delete', style: TextStyle(color: Colors.redAccent)),
                  onPressed: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (_) => AlertDialog(
                        title: const Text('Delete photo?'),
                        content: const Text('This action cannot be undone.'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
                        ],
                      ),
                    );
                    if (ok != true) return;
                    try {
                      await ApiService().deleteChallanPhoto(id);
                      onDeleted();
                      if (context.mounted) Navigator.pop(context);
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
                      }
                    }
                  },
                ),
              ],
            ),
          ),
          Expanded(
            child: InteractiveViewer(
              child: Center(
                child: Image.network(
                  url,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(Icons.broken_image, color: Colors.white, size: 64),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Delivery Challan Sheet ────────────────────────────────────────────────────

class _DeliveryChallanSheet extends StatefulWidget {
  final Map<String, dynamic> record;
  final VoidCallback onSaved;
  const _DeliveryChallanSheet({required this.record, required this.onSaved});

  @override
  State<_DeliveryChallanSheet> createState() => _DeliveryChallanSheetState();
}

class _DeliveryChallanSheetState extends State<_DeliveryChallanSheet> {
  late TextEditingController _chNoCtrl;
  late TextEditingController _pipeNoCtrl;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _chNoCtrl   = TextEditingController(text: widget.record['customerPoNo']?.toString() ?? '');
    _pipeNoCtrl = TextEditingController(text: widget.record['pipeNo']?.toString() ?? '');
  }

  @override
  void dispose() {
    _chNoCtrl.dispose();
    _pipeNoCtrl.dispose();
    super.dispose();
  }

  int get _id => widget.record['id'] is int
      ? widget.record['id'] as int
      : int.tryParse(widget.record['id']?.toString() ?? '') ?? 0;

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await ApiService().updateLoadingRecord(_id, {
        'customerPoNo': _chNoCtrl.text.trim(),
        'pipeNo':       _pipeNoCtrl.text.trim(),
      });
      widget.onSaved();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saved')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.record;
    final date    = _fmtDate(r['date']?.toString() ?? r['createdAt']?.toString() ?? '');
    final pipe    = r['pipeName']?.toString()    ?? '—';
    final qty     = r['quantity']?.toString()    ?? '0';
    final vehicle = r['vehicleNo']?.toString()   ?? '—';
    final driver  = r['driverName']?.toString()  ?? '—';
    final contact = r['driverContact']?.toString() ?? '';
    final vendor  = r['vendorName']?.toString()  ?? r['vendor']?.toString() ?? '—';
    final site    = r['siteAddress']?.toString() ?? '—';

    return DraggableScrollableSheet(
      initialChildSize: 0.92,
      maxChildSize: 0.97,
      minChildSize: 0.5,
      builder: (_, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(
          children: [
            // handle
            Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              width: 40, height: 4,
              decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
            ),
            // header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long_outlined, color: Color(0xFF2563EB)),
                  const SizedBox(width: 8),
                  const Text('Delivery Challan', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const Spacer(),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
                ],
              ),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView(
                controller: scrollCtrl,
                padding: const EdgeInsets.all(16),
                children: [
                  // Editable fields
                  const Text('Edit Challan Details', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF6B7280))),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _chNoCtrl,
                          decoration: InputDecoration(
                            labelText: 'CH. No.',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            isDense: true,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _pipeNoCtrl,
                          decoration: InputDecoration(
                            labelText: 'Pipe No.',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                            isDense: true,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: _saving
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save_outlined, size: 16),
                      label: Text(_saving ? 'Saving…' : 'Save Changes'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  // Preview challan
                  const Text('Preview', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: Color(0xFF6B7280))),
                  const SizedBox(height: 10),
                  _ChallanPreview(
                    chNo:    _chNoCtrl.text.trim().isNotEmpty ? _chNoCtrl.text : '—',
                    pipeNo:  _pipeNoCtrl.text.trim().isNotEmpty ? _pipeNoCtrl.text : '—',
                    date:    date,
                    pipe:    pipe,
                    qty:     qty,
                    vehicle: vehicle,
                    driver:  driver,
                    contact: contact,
                    vendor:  vendor,
                    site:    site,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Challan Preview Card ──────────────────────────────────────────────────────

class _ChallanPreview extends StatelessWidget {
  final String chNo, pipeNo, date, pipe, qty, vehicle, driver, contact, vendor, site;
  const _ChallanPreview({
    required this.chNo, required this.pipeNo, required this.date,
    required this.pipe, required this.qty, required this.vehicle,
    required this.driver, required this.contact, required this.vendor, required this.site,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: const Color(0xFF2563EB), width: 1.5),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: const BoxDecoration(
              color: Color(0xFF2563EB),
              borderRadius: BorderRadius.vertical(top: Radius.circular(8)),
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Text('PP PIPES PRODUCTS', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13)),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const Text('DELIVERY CHALLAN', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 11)),
                    Text('CH. No: $chNo', style: const TextStyle(color: Colors.white70, fontSize: 10)),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              children: [
                _ChallanRow('Date', date),
                _ChallanRow('Pipe No.', pipeNo),
                _ChallanRow('Pipe Name', pipe),
                _ChallanRow('Quantity', '$qty pipes'),
                _ChallanRow('Vehicle No.', vehicle),
                _ChallanRow('Driver', '$driver${contact.isNotEmpty ? ' ($contact)' : ''}'),
                if (vendor != '—') _ChallanRow('Vendor', vendor),
                if (site != '—') _ChallanRow('Site Address', site),
              ],
            ),
          ),
          Container(
            height: 1,
            color: const Color(0xFFE5E7EB),
            margin: const EdgeInsets.symmetric(horizontal: 12),
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                Text('Authorised Signatory', style: TextStyle(fontSize: 10, color: Colors.grey)),
                SizedBox(height: 24),
                Divider(thickness: 1),
                SizedBox(height: 2),
                Text('PP Pipes Products', style: TextStyle(fontSize: 10, color: Colors.grey)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChallanRow extends StatelessWidget {
  final String label;
  final String value;
  const _ChallanRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          ),
          const Text(': ', style: TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

// ── PDI ───────────────────────────────────────────────────────────────────────

const _pdiChecks = [
  ('finishing',     'Finishing'),
  ('colour',        'Colour'),
  ('numbering',     'Numbering'),
  ('ghola',         'Ghola'),
  ('qualityCheck',  'Quality Check'),
  ('diameterCheck', 'Diameter Check'),
];

class PdiScreen extends StatefulWidget {
  const PdiScreen({super.key});
  @override
  State<PdiScreen> createState() => _PdiScreenState();
}

class _PdiScreenState extends State<PdiScreen> {
  static const _emerald = Color(0xFF059669);
  static const _violet  = Color(0xFF7C3AED);

  bool _loading = true;
  List<Map<String, dynamic>> _entries = [];
  List<Map<String, dynamic>> _pipeOptions = [];   // {pipeName, available}
  List<String> _allThirdPartyOptions = [];

  late DateTime _from;
  late DateTime _to;
  String _search = '';
  bool _searchExpanded = false;
  final _searchCtrl = TextEditingController();

  // Date filter overlay
  final _layerLink  = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _loadAll();
  }

  @override
  void dispose() {
    _closeDateOverlay();
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
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _loadAll();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmt(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        ApiService().getPdiEntries(from: _fmt(_from), to: _fmt(_to)),
        ApiService().getProductionEntries(stageType: 'FINAL_TESTING', size: 500),
        ApiService().getPdiEntries(size: 2000),   // all entries for party name list
      ]);
      final entries      = results[0];
      final ftEntries    = results[1];
      final allEntries   = results[2];

      // Group final testing by pipe name and sum pipesCompleted
      final map = <String, int>{};
      for (final e in ftEntries.cast<Map<String, dynamic>>()) {
        final name = (e['pipeConfig']?['name'] ?? 'Config #${e['pipeConfigId']}') as String;
        map[name] = (map[name] ?? 0) + ((e['pipesCompleted'] as num?)?.toInt() ?? 0);
      }
      final pipeOpts = map.entries.map((e) => {'pipeName': e.key, 'available': e.value}).toList()
        ..sort((a, b) => (a['pipeName'] as String).compareTo(b['pipeName'] as String));

      // Unique third party names from ALL historical PDI entries
      final seen = <String>{};
      final partyNames = allEntries
          .cast<Map<String, dynamic>>()
          .map((e) => (e['thirdParty'] ?? '').toString().trim())
          .where((s) => s.isNotEmpty && seen.add(s))
          .toList()..sort();

      setState(() {
        _entries             = entries.cast<Map<String, dynamic>>();
        _pipeOptions         = pipeOpts;
        _allThirdPartyOptions = partyNames;
        _loading             = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  int _passCount(Map<String, dynamic> e) =>
      _pdiChecks.where((c) => e[c.$1] == true).length;

  List<Map<String, dynamic>> get _filtered {
    if (_search.trim().isEmpty) return _entries;
    final q = _search.toLowerCase();
    return _entries.where((e) =>
      (e['pipeName']   ?? '').toString().toLowerCase().contains(q) ||
      (e['thirdParty'] ?? '').toString().toLowerCase().contains(q)
    ).toList();
  }


  void _openAdd() {
    showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (_) => _PdiSheet(
        pipeOptions: _pipeOptions,
        thirdPartyOptions: _allThirdPartyOptions,
        accentColor: _violet,
        onSave: (rows) async {
          final created = await Future.wait(rows.map((r) => ApiService().createPdiEntry(r)));
          setState(() => _entries = [...created.reversed.toList(), ..._entries]);
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(created.length > 1 ? '${created.length} PDI entries added' : 'PDI entry added')));
        },
      ),
    );
  }

  void _openEdit(Map<String, dynamic> entry) {
    showModalBottomSheet(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (_) => _PdiSheet(
        initial: entry,
        pipeOptions: _pipeOptions,
        thirdPartyOptions: _allThirdPartyOptions,
        accentColor: _violet,
        onSave: (rows) async {
          final updated = await ApiService().updatePdiEntry(entry['id'] as int, rows.first);
          setState(() => _entries = _entries.map((e) => e['id'] == updated['id'] ? updated : e).toList());
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Entry updated')));
        },
      ),
    );
  }

  void _confirmDelete(Map<String, dynamic> entry) {
    showDialog(context: context, builder: (ctx) => AlertDialog(
      title: const Text('Delete PDI Entry'),
      content: Text('Delete PDI entry for ${entry['pipeName']} on ${_fmtDate(entry['date'] as String? ?? '')}?'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(
          onPressed: () async {
            Navigator.pop(ctx);
            try {
              await ApiService().deletePdiEntry(entry['id'] as int);
              setState(() => _entries = _entries.where((e) => e['id'] != entry['id']).toList());
              if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Entry deleted')));
            } catch (e) {
              if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
            }
          },
          style: FilledButton.styleFrom(backgroundColor: Colors.red),
          child: const Text('Delete'),
        ),
      ],
    ));
  }

  @override
  Widget build(BuildContext context) {
    final filtered    = _filtered;
    final totalQty    = filtered.fold(0.0, (s, e) => s + (double.tryParse(e['quantity']?.toString() ?? '') ?? 0));
    final avgPassed   = filtered.isEmpty ? 0.0 : filtered.fold(0, (s, e) => s + _passCount(e)) / filtered.length;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAll,
              child: CustomScrollView(slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 120,
                  backgroundColor: _violet,
                  leading: context.canPop()
                      ? IconButton(
                          icon: const Icon(Icons.arrow_back, color: Colors.white),
                          onPressed: () => context.pop(),
                        )
                      : IconButton(
                          icon: const Icon(Icons.menu_outlined, color: Colors.white),
                          onPressed: openAppDrawer,
                          tooltip: 'Open menu',
                        ),
                  title: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 200),
                    child: _searchExpanded
                        ? TextField(
                            key: const ValueKey('search'),
                            controller: _searchCtrl,
                            autofocus: true,
                            onChanged: (v) => setState(() => _search = v),
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            cursorColor: Colors.white,
                            decoration: InputDecoration(
                              hintText: 'Search pipe or third party…',
                              hintStyle: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 13),
                              filled: true,
                              fillColor: Colors.white.withOpacity(0.12),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              isDense: true,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                              focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide(color: Colors.white.withOpacity(0.3))),
                            ),
                          )
                        : const Align(
                            key: ValueKey('title'),
                            alignment: Alignment.centerLeft,
                            child: Text('PDI', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w600)),
                          ),
                  ),
                  actions: [
                    IconButton(
                      icon: Icon(
                        _searchExpanded ? Icons.search_off_rounded : Icons.search_rounded,
                        color: Colors.white, size: 22),
                      onPressed: () => setState(() {
                        _searchExpanded = !_searchExpanded;
                        if (!_searchExpanded) { _searchCtrl.clear(); _search = ''; }
                      }),
                    ),
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          margin: const EdgeInsets.only(right: 4),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withOpacity(0.25)),
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
                    IconButton(
                      icon: const Icon(Icons.add, color: Colors.white),
                      onPressed: _openAdd,
                      tooltip: 'Add Entry',
                    ),
                  ],
                  flexibleSpace: FlexibleSpaceBar(
                    background: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFF7C3AED), Color(0xFF4C1D95)],
                        ),
                      ),
                      child: SafeArea(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(16, 64, 16, 4),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                _statChip('${filtered.length}', 'Total'),
                                _statChip(totalQty.toStringAsFixed(0), 'Inspected'),
                                _statChip(
                                  filtered.isEmpty ? '—' : avgPassed.toStringAsFixed(1),
                                  'Avg Checks',
                                ),
                              ]),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),

                if (filtered.isEmpty)
                  const SliverFillRemaining(child: Center(child: Text('No PDI entries found')))
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 6, 12, 80),
                    sliver: SliverList(delegate: SliverChildBuilderDelegate((_, i) {
                      final e   = filtered[i];
                      final passed = _passCount(e);
                      final date = _fmtDate(e['date'] as String? ?? '');
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        elevation: 0,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            // Header row
                            Row(children: [
                              Expanded(child: Text(e['pipeName'] ?? '—', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: passed == _pdiChecks.length ? const Color(0xFFD1FAE5) : const Color(0xFFFEF3C7),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text('$passed/${_pdiChecks.length}', style: TextStyle(
                                  fontSize: 11, fontWeight: FontWeight.w700,
                                  color: passed == _pdiChecks.length ? const Color(0xFF065F46) : const Color(0xFF92400E),
                                )),
                              ),
                              const SizedBox(width: 8),
                              IconButton(
                                icon: const Icon(Icons.edit_outlined, size: 16),
                                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                padding: EdgeInsets.zero,
                                onPressed: () => _openEdit(e),
                                color: Colors.grey,
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, size: 16),
                                constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                                padding: EdgeInsets.zero,
                                onPressed: () => _confirmDelete(e),
                                color: Colors.red.shade300,
                              ),
                            ]),
                            const SizedBox(height: 4),
                            // Sub-info
                            Wrap(spacing: 12, runSpacing: 2, children: [
                              _chip(Icons.calendar_today_outlined, date),
                              _chip(Icons.format_list_numbered_outlined, '${double.tryParse(e['quantity']?.toString() ?? '0')?.toStringAsFixed(0) ?? 0} pipes'),
                              if ((e['thirdParty'] ?? '').toString().isNotEmpty)
                                _chip(Icons.person_outline, e['thirdParty'] as String),
                            ]),
                            // Checks grid
                            const SizedBox(height: 8),
                            Wrap(spacing: 6, runSpacing: 4, children: _pdiChecks.map((c) {
                              final ok = e[c.$1] == true;
                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: ok ? const Color(0xFFD1FAE5) : Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Icon(ok ? Icons.check_circle_outline : Icons.remove_circle_outline,
                                      size: 11, color: ok ? _emerald : Colors.grey.shade400),
                                  const SizedBox(width: 4),
                                  Text(c.$2, style: TextStyle(
                                    fontSize: 10, fontWeight: FontWeight.w600,
                                    color: ok ? const Color(0xFF065F46) : Colors.grey.shade400,
                                  )),
                                ]),
                              );
                            }).toList()),
                            if ((e['notes'] ?? '').toString().isNotEmpty) Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(e['notes'] as String, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                            ),
                          ]),
                        ),
                      );
                    }, childCount: filtered.length)),
                  ),
              ]),
            ),
    );
  }

  Widget _statChip(String value, String label) => Expanded(
    child: Container(
      margin: const EdgeInsets.only(right: 6),
      padding: const EdgeInsets.symmetric(vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(children: [
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
        const SizedBox(height: 1),
        Text(label, style: const TextStyle(color: Colors.white60, fontSize: 9, fontWeight: FontWeight.w500)),
      ]),
    ),
  );

  Widget _stat(String val, String label) => Expanded(child: Container(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Column(children: [
      Text(val, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70), textAlign: TextAlign.center),
    ]),
  ));

  Widget _chip(IconData icon, String text) => Row(mainAxisSize: MainAxisSize.min, children: [
    Icon(icon, size: 11, color: Colors.grey),
    const SizedBox(width: 3),
    Text(text, style: const TextStyle(fontSize: 11, color: Colors.grey)),
  ]);
}

// ── PDI Date Filter ───────────────────────────────────────────────────────────

// Aliases so existing code in this file continues to work unchanged
typedef _PdiDateFilter = BizDateFilter;
typedef _PdiDateDropdown = BizDateDropdown;
DateTime _pdiResolveFrom(String key) => bizResolveFrom(key);
DateTime _pdiResolveTo(String key)   => bizResolveTo(key);
const _pdiPresets = bizDatePresets;

// ── PDI Add/Edit Sheet ────────────────────────────────────────────────────────

class _PdiSheet extends StatefulWidget {
  final Map<String, dynamic>? initial;
  final List<Map<String, dynamic>> pipeOptions;
  final List<String> thirdPartyOptions;
  final Color accentColor;
  final Future<void> Function(List<Map<String, dynamic>>) onSave;

  const _PdiSheet({this.initial, required this.pipeOptions, required this.thirdPartyOptions, required this.accentColor, required this.onSave});

  @override
  State<_PdiSheet> createState() => _PdiSheetState();
}

class _PdiSheetState extends State<_PdiSheet> {
  bool get _isEdit => widget.initial != null;

  DateTime _date = DateTime.now();
  String _thirdParty = '';
  final _notesCtrl   = TextEditingController();

  // Edit mode fields
  String _pipeName = '';
  final _qtyCtrl   = TextEditingController();

  // Add mode — multi-pipe rows [{pipeName, qty}]
  List<Map<String, dynamic>> _pipeRows = [{'pipeName': '', 'qty': ''}];

  // Inspection checks
  Map<String, bool> _checks = {for (final c in _pdiChecks) c.$1: false};

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    if (init != null) {
      try { _date = DateTime.parse(init['date'] as String? ?? ''); } catch (_) {}
      _thirdParty      = init['thirdParty'] ?? '';
      _pipeName        = init['pipeName']   ?? '';
      _qtyCtrl.text    = init['quantity']?.toString() ?? '';
      _notesCtrl.text  = init['notes']     ?? '';
      for (final c in _pdiChecks) { _checks[c.$1] = init[c.$1] == true; }
    }
  }

  @override
  void dispose() { _notesCtrl.dispose(); _qtyCtrl.dispose(); super.dispose(); }

  int _availableFor(String pipeName) {
    final opt = widget.pipeOptions.firstWhere(
      (o) => o['pipeName'] == pipeName, orElse: () => {});
    return (opt['available'] as int?) ?? 0;
  }

  Future<void> _submit() async {
    if (_thirdParty.trim().isEmpty) { setState(() => _error = 'Third party name is required'); return; }
    if (_isEdit) {
      if (_pipeName.isEmpty) { setState(() => _error = 'Pipe name is required'); return; }
      if (_qtyCtrl.text.isEmpty) { setState(() => _error = 'Quantity is required'); return; }
      final avail = _availableFor(_pipeName);
      final entered = int.tryParse(_qtyCtrl.text) ?? 0;
      if (avail > 0 && entered > avail) {
        setState(() => _error = 'Qty exceeds available ($avail) for $_pipeName'); return;
      }
    } else {
      if (_pipeRows.any((r) => (r['pipeName'] as String).isEmpty || (r['qty'] as String).isEmpty)) {
        setState(() => _error = 'All pipes must have a name and quantity'); return;
      }
      for (final r in _pipeRows) {
        final name   = r['pipeName'] as String;
        final avail  = _availableFor(name);
        final entered = int.tryParse(r['qty'] as String) ?? 0;
        if (avail > 0 && entered > avail) {
          setState(() => _error = 'Qty $entered exceeds available ($avail) for $name'); return;
        }
      }
    }
    setState(() { _saving = true; _error = null; });
    try {
      final base = {
        'date':       DateFormat('yyyy-MM-dd').format(_date),
        'thirdParty': _thirdParty.trim(),
        'notes':      _notesCtrl.text.trim(),
        ..._checks,
      };
      final rows = _isEdit
          ? [{ ...base, 'pipeName': _pipeName, 'quantity': _qtyCtrl.text.trim() }]
          : _pipeRows.map((r) => { ...base, 'pipeName': r['pipeName'], 'quantity': r['qty'] }).toList();
      await widget.onSave(rows);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      setState(() { _saving = false; _error = e.toString(); });
    }
  }

  Widget _sectionLabel(String label) => Padding(
    padding: const EdgeInsets.only(bottom: 8),
    child: Row(children: [
      Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: widget.accentColor, letterSpacing: 1)),
      const SizedBox(width: 8),
      Expanded(child: Container(height: 1, color: Colors.grey.shade200)),
    ]),
  );

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    final passed = _checks.values.where((v) => v).length;

    return Container(
      decoration: const BoxDecoration(color: Color(0xFFF9FAFB), borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        // Gradient header
        Container(
          padding: const EdgeInsets.fromLTRB(20, 16, 12, 16),
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft, end: Alignment.bottomRight,
              colors: [Color(0xFF7C3AED), Color(0xFF4C1D95)],
            ),
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(_isEdit ? 'Edit PDI Entry' : 'New PDI Entry',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
              const SizedBox(height: 2),
              GestureDetector(
                onTap: () async {
                  final picked = await showDatePicker(context: context, initialDate: _date,
                      firstDate: DateTime(2023), lastDate: DateTime(2030),
                      builder: (ctx, child) => Theme(
                        data: Theme.of(ctx).copyWith(colorScheme: const ColorScheme.light(primary: Color(0xFF7C3AED), onPrimary: Colors.white)),
                        child: child!));
                  if (picked != null) setState(() => _date = picked);
                },
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.calendar_today_outlined, size: 12, color: Colors.white60),
                  const SizedBox(width: 4),
                  Text(DateFormat('dd MMM yyyy').format(_date),
                      style: const TextStyle(fontSize: 12, color: Colors.white60, fontWeight: FontWeight.w500)),
                  const Icon(Icons.arrow_drop_down, size: 14, color: Colors.white60),
                ]),
              ),
            ])),
            IconButton(icon: const Icon(Icons.close, color: Colors.white), onPressed: () => Navigator.pop(context)),
          ]),
        ),

        Flexible(child: SingleChildScrollView(child: Padding(
          padding: EdgeInsets.only(left: 20, right: 20, top: 16, bottom: bottom + 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 8),

            // Third party
            _sectionLabel('INSPECTION DETAILS'),
            _AutocompleteField(
              value: _thirdParty,
              onChanged: (v) => setState(() => _thirdParty = v),
              suggestions: widget.thirdPartyOptions,
              placeholder: 'Third Party Name *',
            ),
            const SizedBox(height: 16),

            // Pipes section
            _sectionLabel('PIPES'),
            if (_isEdit) ...[
              // Single pipe edit
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: _PipeDrop(
                  value: _pipeName,
                  options: widget.pipeOptions,
                  onChanged: (v) => setState(() { _pipeName = v; _qtyCtrl.clear(); }),
                )),
                const SizedBox(width: 12),
                SizedBox(width: 90, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  TextField(
                    controller: _qtyCtrl,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      labelText: 'Qty *',
                      border: const OutlineInputBorder(),
                      errorText: () {
                        final avail = _availableFor(_pipeName);
                        final entered = int.tryParse(_qtyCtrl.text) ?? 0;
                        return avail > 0 && entered > avail ? 'Max $avail' : null;
                      }(),
                    ),
                  ),
                  if (_pipeName.isNotEmpty && _availableFor(_pipeName) > 0)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text('Max ${_availableFor(_pipeName)}', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                    ),
                ])),
              ]),
            ] else ...[
              // Multi-pipe rows
              ..._pipeRows.asMap().entries.map((entry) {
                final i   = entry.key;
                final row = entry.value;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('${i + 1}', style: const TextStyle(fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w700)),
                    const SizedBox(width: 8),
                    Expanded(child: _PipeDrop(
                      value: row['pipeName'] as String,
                      options: widget.pipeOptions,
                      onChanged: (v) => setState(() => _pipeRows[i] = {...row, 'pipeName': v}),
                    )),
                    const SizedBox(width: 8),
                    SizedBox(width: 70, child: TextFormField(
                      initialValue: row['qty'] as String,
                      keyboardType: TextInputType.number,
                      onChanged: (v) => setState(() => _pipeRows[i] = {...row, 'qty': v}),
                      decoration: const InputDecoration(labelText: 'Qty', border: OutlineInputBorder(), contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 12)),
                    )),
                    const SizedBox(width: 4),
                    IconButton(
                      icon: const Icon(Icons.close, size: 16),
                      onPressed: _pipeRows.length > 1 ? () => setState(() => _pipeRows.removeAt(i)) : null,
                      color: Colors.red.shade300,
                      constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                      padding: EdgeInsets.zero,
                    ),
                  ]),
                );
              }),
              TextButton.icon(
                onPressed: () => setState(() => _pipeRows.add({'pipeName': '', 'qty': ''})),
                icon: const Icon(Icons.add_circle_outline, size: 16),
                label: const Text('Add Pipe'),
                style: TextButton.styleFrom(foregroundColor: const Color(0xFF7C3AED)),
              ),
            ],
            const SizedBox(height: 16),

            // Checks
            Row(children: [
              _sectionLabel('INSPECTION CHECKS').let((w) => Expanded(child: w)),
              if (passed > 0) Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: const Color(0xFFD1FAE5), borderRadius: BorderRadius.circular(10)),
                child: Text('$passed/${_pdiChecks.length} passed', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF065F46))),
              ),
            ]),
            GridView.count(
              crossAxisCount: 2, shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
              crossAxisSpacing: 8, mainAxisSpacing: 8, childAspectRatio: 3.8,
              children: _pdiChecks.map((c) {
                final ok = _checks[c.$1] ?? false;
                return GestureDetector(
                  onTap: () => setState(() => _checks[c.$1] = !ok),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: ok ? const Color(0xFFECFDF5) : Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: ok ? const Color(0xFF6EE7B7) : Colors.grey.shade200),
                    ),
                    child: Row(children: [
                      Icon(ok ? Icons.check_circle_outline : Icons.circle_outlined,
                          size: 14, color: ok ? const Color(0xFF059669) : Colors.grey.shade300),
                      const SizedBox(width: 6),
                      Expanded(child: Text(c.$2, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                          color: ok ? const Color(0xFF065F46) : Colors.grey.shade400))),
                    ]),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // Notes
            TextField(
              controller: _notesCtrl,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder()),
            ),

            if (_error != null) Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(_error!, style: const TextStyle(fontSize: 12, color: Colors.red)),
            ),
            const SizedBox(height: 20),

            DecoratedBox(
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF7C3AED), Color(0xFF4C1D95), Color(0xFF2563EB)]),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [BoxShadow(color: const Color(0xFF7C3AED).withOpacity(0.35), blurRadius: 10, offset: const Offset(0, 4))],
              ),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _saving ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.transparent, shadowColor: Colors.transparent,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: _saving ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.check_circle_outline, color: Colors.white),
                  label: Text(_saving ? 'Saving…' : _isEdit ? 'Save Changes' : _pipeRows.length > 1 ? 'Add ${_pipeRows.length} Entries' : 'Add Entry',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14)),
                ),
              ),
            ),
          ]),
        ))),
      ]),
    );
  }
}

// ── Pipe dropdown for PDI ─────────────────────────────────────────────────────

class _PipeDrop extends StatelessWidget {
  final String value;
  final List<Map<String, dynamic>> options;
  final ValueChanged<String> onChanged;
  const _PipeDrop({required this.value, required this.options, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value.isEmpty ? null : value,
          hint: const Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('Select pipe…', style: TextStyle(fontSize: 13, color: Colors.grey))),
          isExpanded: true,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          borderRadius: BorderRadius.circular(10),
          items: options.map((o) => DropdownMenuItem<String>(
            value: o['pipeName'] as String,
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              Flexible(child: Text(o['pipeName'] as String, style: const TextStyle(fontSize: 13), overflow: TextOverflow.ellipsis)),
              Text('${o['available']} avail.', style: const TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.w600)),
            ]),
          )).toList(),
          onChanged: (v) { if (v != null) onChanged(v); },
        ),
      ),
    );
  }
}

extension _Let<T> on T {
  R let<R>(R Function(T) block) => block(this);
}

// ─── Labour Screen ───────────────────────────────────────────────────────────

class LabourScreen extends StatefulWidget {
  const LabourScreen({super.key});
  @override
  State<LabourScreen> createState() => _LabourScreenState();
}

class _LabourScreenState extends State<LabourScreen> {
  static const _color = Color(0xFF4F46E5);

  bool _loadingData = true;
  List<Map<String, dynamic>> _items = [];
  bool _showOT = false;
  bool _showSearch = false;
  String _search = '';
  final _searchCtrl = TextEditingController();

  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  @override
  void initState() {
    super.initState();
    _to = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _load();
  }

  @override
  void dispose() {
    _closeDateOverlay();
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
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmtIso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loadingData = true);
    try {
      final data = await ApiService().getLabourEntries(
          fromDate: _fmtIso(_from), toDate: _fmtIso(_to));
      if (mounted) setState(() => _items = data.cast<Map<String, dynamic>>());
    } catch (_) {}
    if (mounted) setState(() => _loadingData = false);
  }

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  static int _toI(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  List<Map<String, dynamic>> get _filtered {
    var list = _showOT
        ? _items.where((e) => _toD(e['overtimeHours']) > 0 && _toI(e['overtimeLabourCount']) > 0).toList()
        : _items;
    if (_search.trim().isNotEmpty) {
      final q = _search.toLowerCase();
      list = list.where((e) => (e['contractorName'] ?? '').toString().toLowerCase().contains(q)).toList();
    }
    return list;
  }

  int get _totalLabours => _items.fold(0, (s, e) => s + _toI(e['labourCount']));
  double get _totalCost => _items.fold(0.0, (s, e) => s + _toI(e['labourCount']) * _toD(e['ratePerDay']));
  double get _totalOTCost => _items.fold(0.0, (s, e) {
    final h = _toD(e['overtimeHours']);
    final c = _toI(e['overtimeLabourCount']);
    final r = _toD(e['overtimeRatePerHour']);
    return s + h * c * r;
  });
  String _fmtNum(double n) {
    if (n >= 100000) return '₹${(n / 100000).toStringAsFixed(1)}L';
    if (n >= 1000) return '₹${(n / 1000).toStringAsFixed(1)}K';
    return '₹${n.toStringAsFixed(0)}';
  }

  void _showAddEdit([Map<String, dynamic>? editing]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LabourSheet(
        initial: editing,
        onSubmit: (data) async {
          if (editing != null) {
            await ApiService().updateLabourEntry(editing['id'] as int, data);
          } else {
            await ApiService().createLabourEntry(data);
          }
          _load();
        },
      ),
    );
  }

  void _showOTSheet(Map<String, dynamic> entry) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LabourOTSheet(
        entry: entry,
        onSubmit: (otData) async {
          final updated = <String, dynamic>{...entry, ...otData};
          await ApiService().updateLabourEntry(_toI(entry['id']), updated);
          _load();
        },
      ),
    );
  }

  Future<void> _delete(int id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Entry'),
        content: const Text('This will permanently delete this labour record.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (ok == true) {
      await ApiService().deleteLabourEntry(id);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final tc = _totalCost;
    final toc = _totalOTCost;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: _loadingData
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 106,
                  toolbarHeight: 46,
                  backgroundColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  scrolledUnderElevation: 0,
                  flexibleSpace: FlexibleSpaceBar(
                    collapseMode: CollapseMode.pin,
                    background: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF4F46E5), Color(0xFF3730A3)],
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
                              _hStat('${_items.length}', 'Entries'),
                              _hStat('$_totalLabours', 'Labours'),
                              _hStat(tc > 0 ? _fmtNum(tc) : '—', 'Daily Cost'),
                              _hStat(toc > 0 ? _fmtNum(toc) : '—', 'OT Cost'),
                            ]),
                          ),
                        ),
                      ]),
                    ),
                  ),
                  title: const Text('Labour',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white)),
                  actions: [
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                            const SizedBox(width: 5),
                            Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                            const SizedBox(width: 3),
                            const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                          ]),
                        ),
                      ),
                    ),
                  ],
                ),

                if (filtered.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.people_outline, size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No entries found',
                            style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _LabourCard(
                          entry: filtered[i],
                          onEdit: () => _showAddEdit(filtered[i]),
                          onOT: () => _showOTSheet(filtered[i]),
                          onDelete: () => _delete(_toI(filtered[i]['id'])),
                        ),
                        childCount: filtered.length,
                      ),
                    ),
                  ),
              ]),
            ),
      bottomNavigationBar: _buildFloatingNav(),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddEdit(),
        backgroundColor: _color,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }

  List<String> get _labourSuggestions {
    final q = _search.trim().toLowerCase();
    if (q.isEmpty) return [];
    final seen = <String>{};
    return _items
        .map((e) => e['contractorName']?.toString() ?? '')
        .where((n) => n.isNotEmpty && n.toLowerCase().contains(q) && seen.add(n.toLowerCase()))
        .take(6)
        .toList();
  }

  Widget _buildLabourSuggestions() {
    final suggs = _labourSuggestions;
    if (!_showSearch || suggs.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.10), blurRadius: 16, offset: const Offset(0, -4)),
          BoxShadow(color: _color.withValues(alpha: 0.07), blurRadius: 24, offset: const Offset(0, -8)),
        ],
      ),
      constraints: const BoxConstraints(maxHeight: 210),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: ListView.separated(
          padding: const EdgeInsets.symmetric(vertical: 4),
          shrinkWrap: true,
          itemCount: suggs.length,
          separatorBuilder: (_, __) => Divider(height: 1, indent: 16, endIndent: 16, color: Colors.grey.shade100),
          itemBuilder: (_, i) {
            final name = suggs[i];
            final q = _search.trim().toLowerCase();
            final idx = name.toLowerCase().indexOf(q);
            return InkWell(
              onTap: () => setState(() {
                _searchCtrl.text = name;
                _search = name;
              }),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(children: [
                  const Icon(Icons.people_outline, size: 15, color: Color(0xFF94A3B8)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: idx >= 0
                        ? RichText(
                            text: TextSpan(
                              style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B), fontWeight: FontWeight.w500),
                              children: [
                                if (idx > 0) TextSpan(text: name.substring(0, idx)),
                                TextSpan(
                                    text: name.substring(idx, idx + q.length),
                                    style: const TextStyle(color: _color, fontWeight: FontWeight.w700)),
                                TextSpan(text: name.substring(idx + q.length)),
                              ],
                            ),
                          )
                        : Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                  ),
                ]),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildFloatingNav() {
    return Container(
      color: Colors.transparent,
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildLabourSuggestions(),
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
                  transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
                  child: _showSearch ? _buildLabourSearchExpanded() : _buildLabourNavItems(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLabourSearchExpanded() {
    return Row(
      key: const ValueKey('lsearch'),
      children: [
        Container(
          margin: const EdgeInsets.all(8),
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [_color, Color(0xFF3730A3)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
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
              hintText: 'Search contractor…',
              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
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
            child: const Icon(Icons.close, size: 18, color: Color(0xFF64748B)),
          ),
        ),
      ],
    );
  }

  Widget _buildLabourNavItems() {
    return Row(
      key: const ValueKey('lnav'),
      children: [
        _lFloatItem(
          icon: Icons.search,
          label: 'Search',
          active: false,
          onTap: () => setState(() => _showSearch = true),
        ),
        _lFloatItem(
          icon: Icons.people_outline,
          label: 'Labour Data',
          active: !_showOT,
          onTap: () => setState(() { _showOT = false; }),
        ),
        _lFloatItem(
          icon: Icons.access_time_outlined,
          label: 'OT Data',
          active: _showOT,
          onTap: () => setState(() { _showOT = true; }),
        ),
      ],
    );
  }

  Widget _lFloatItem({
    required IconData icon,
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    final iconColor = active ? Colors.white : const Color(0xFF94A3B8);
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
                    colors: [_color, Color(0xFF3730A3)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.all(Radius.circular(26)),
                )
              : null,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22, color: iconColor),
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

class _LabourCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final VoidCallback onEdit;
  final VoidCallback onOT;
  final VoidCallback onDelete;

  const _LabourCard(
      {required this.entry, required this.onEdit, required this.onOT, required this.onDelete});

  static const _color = Color(0xFF4F46E5);

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  static int _toI(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    final p = s.split('-');
    return p.length == 3 ? '${p[2]}/${p[1]}/${p[0]}' : s;
  }

  @override
  Widget build(BuildContext context) {
    final name = entry['contractorName']?.toString() ?? '';
    final date = entry['date']?.toString() ?? '';
    final count = _toI(entry['labourCount']);
    final rate = _toD(entry['ratePerDay']);
    final dailyCost = count > 0 && rate > 0 ? count * rate : 0.0;
    final otHours = _toD(entry['overtimeHours']);
    final otCount = _toI(entry['overtimeLabourCount']);
    final otRate = _toD(entry['overtimeRatePerHour']);
    final hasOT = otHours > 0 && otCount > 0;
    final otLbrHrs = hasOT ? otHours * otCount : 0.0;
    final otCost = otLbrHrs > 0 && otRate > 0 ? otLbrHrs * otRate : 0.0;
    final notes = entry['notes']?.toString() ?? '';

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade100),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: _color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.people_outline, color: _color, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(name.isEmpty ? 'Unknown Contractor' : name,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                Text(_fmtDate(date),
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
              Text('$count labours',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
              if (dailyCost > 0)
                Text('₹${dailyCost.toStringAsFixed(0)}',
                    style: const TextStyle(fontSize: 11, color: _color, fontWeight: FontWeight.w600)),
            ]),
          ]),

          if (hasOT) ...[
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFFFFFBEB),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFFFDE68A)),
              ),
              child: Row(children: [
                const Icon(Icons.access_time, size: 13, color: Color(0xFFF59E0B)),
                const SizedBox(width: 6),
                Text('$otCount × ${otHours}h OT',
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xFF92400E), fontWeight: FontWeight.w600)),
                const Spacer(),
                if (otCost > 0)
                  Text('₹${otCost.toStringAsFixed(0)}',
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFF065F46), fontWeight: FontWeight.w700)),
              ]),
            ),
          ],

          const SizedBox(height: 6),
          Row(children: [
            InkWell(
              onTap: onOT,
              borderRadius: BorderRadius.circular(6),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: hasOT ? const Color(0xFFFFFBEB) : Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                      color: hasOT ? const Color(0xFFFDE68A) : Colors.grey.shade200),
                ),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.access_time,
                      size: 12, color: hasOT ? const Color(0xFFF59E0B) : Colors.grey),
                  const SizedBox(width: 4),
                  Text(hasOT ? 'Edit OT' : 'Add OT',
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: hasOT ? const Color(0xFFF59E0B) : Colors.grey)),
                ]),
              ),
            ),
            if (notes.isNotEmpty) ...[
              const SizedBox(width: 8),
              Expanded(
                child: Text(notes,
                    style: TextStyle(fontSize: 10, color: Colors.grey.shade500),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ),
            ],
            const Spacer(),
            IconButton(
              icon: const Icon(Icons.edit_outlined, size: 16),
              color: Colors.grey,
              onPressed: onEdit,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 10),
            IconButton(
              icon: Icon(Icons.delete_outline, size: 16, color: Colors.red.shade300),
              onPressed: onDelete,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ]),
        ]),
      ),
    );
  }
}

class _LabourSheet extends StatefulWidget {
  final Map<String, dynamic>? initial;
  final Future<void> Function(Map<String, dynamic>) onSubmit;
  const _LabourSheet({this.initial, required this.onSubmit});
  @override
  State<_LabourSheet> createState() => _LabourSheetState();
}

class _LabourSheetState extends State<_LabourSheet> {
  static const _color = Color(0xFF4F46E5);

  late DateTime _date;
  final _contractorCtrl = TextEditingController();
  final _countCtrl = TextEditingController();
  final _rateCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _submitting = false;
  String? _errContractor, _errCount;

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  @override
  void initState() {
    super.initState();
    final e = widget.initial;
    _date = e != null
        ? (DateTime.tryParse(e['date']?.toString() ?? '') ?? DateTime.now())
        : DateTime.now();
    _contractorCtrl.text = e?['contractorName']?.toString() ?? '';
    _countCtrl.text = e?['labourCount']?.toString() ?? '';
    final r = _toD(e?['ratePerDay']);
    _rateCtrl.text = r > 0 ? r.toStringAsFixed(2) : '';
    _notesCtrl.text = e?['notes']?.toString() ?? '';
  }

  @override
  void dispose() {
    _contractorCtrl.dispose();
    _countCtrl.dispose();
    _rateCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(colorScheme: const ColorScheme.light(primary: _color)),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    final contractor = _contractorCtrl.text.trim();
    final count = int.tryParse(_countCtrl.text.trim()) ?? 0;
    bool hasErr = false;
    setState(() {
      _errContractor = contractor.isEmpty ? 'Required' : null;
      _errCount = count <= 0 ? 'Must be ≥ 1' : null;
      hasErr = contractor.isEmpty || count <= 0;
    });
    if (hasErr) return;
    setState(() => _submitting = true);
    try {
      final e = widget.initial;
      await widget.onSubmit({
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'contractorName': contractor,
        'labourCount': count,
        'ratePerDay': _rateCtrl.text.trim(),
        'overtimeHours': e?['overtimeHours'] ?? '',
        'overtimeLabourCount': e?['overtimeLabourCount'] ?? 0,
        'overtimeRatePerHour': e?['overtimeRatePerHour'] ?? '',
        'notes': _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (err) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $err')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final count = int.tryParse(_countCtrl.text) ?? 0;
    final rate = double.tryParse(_rateCtrl.text) ?? 0;
    final dailyTotal = count > 0 && rate > 0 ? count * rate : 0.0;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFF4F46E5), Color(0xFF2563EB)]),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Row(children: [
              const Icon(Icons.people_outline, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Text(widget.initial != null ? 'Edit Labour Entry' : 'Add Labour Entry',
                  style: const TextStyle(
                      fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: const Icon(Icons.close, color: Colors.white70, size: 20),
              ),
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _lbl('DATE'),
                GestureDetector(
                  onTap: _pickDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade200),
                      borderRadius: BorderRadius.circular(10),
                      color: Colors.grey.shade50,
                    ),
                    child: Row(children: [
                      Icon(Icons.calendar_today_outlined, size: 15, color: Colors.grey.shade500),
                      const SizedBox(width: 10),
                      Text(DateFormat('dd MMM yyyy').format(_date),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                    ]),
                  ),
                ),
                const SizedBox(height: 14),

                _lbl('CONTRACTOR NAME *'),
                TextField(
                  controller: _contractorCtrl,
                  textCapitalization: TextCapitalization.words,
                  onChanged: (_) => setState(() => _errContractor = null),
                  decoration: _iDeco(hint: 'Enter contractor / agency name', err: _errContractor),
                ),
                const SizedBox(height: 14),

                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _lbl('NO. OF LABOURS *'),
                    TextField(
                      controller: _countCtrl,
                      keyboardType: TextInputType.number,
                      onChanged: (_) => setState(() => _errCount = null),
                      decoration: _iDeco(hint: '0', err: _errCount),
                    ),
                  ])),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _lbl('RATE / DAY (OPTIONAL)'),
                    TextField(
                      controller: _rateCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      onChanged: (_) => setState(() {}),
                      decoration: _iDeco(hint: '₹ 0.00'),
                    ),
                  ])),
                ]),
                const SizedBox(height: 14),

                if (dailyTotal > 0) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEDE9FE),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Row(children: [
                      const Text('Daily Total',
                          style: TextStyle(
                              fontSize: 12,
                              color: Color(0xFF5B21B6),
                              fontWeight: FontWeight.w600)),
                      const Spacer(),
                      Text('₹${dailyTotal.toStringAsFixed(2)}',
                          style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: Color(0xFF5B21B6))),
                      const SizedBox(width: 6),
                      Text('($count × ₹${rate.toStringAsFixed(0)})',
                          style: const TextStyle(fontSize: 10, color: Color(0xFF7C3AED))),
                    ]),
                  ),
                  const SizedBox(height: 14),
                ],

                _lbl('NOTES (OPTIONAL)'),
                TextField(
                  controller: _notesCtrl,
                  maxLines: 2,
                  decoration: _iDeco(hint: 'Any additional details…'),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _submitting ? null : _submit,
                    style: FilledButton.styleFrom(
                      backgroundColor: _color,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _submitting
                        ? const SizedBox(
                            height: 18,
                            width: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(widget.initial != null ? 'Save Changes' : 'Add Entry',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _lbl(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(t,
        style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.bold,
            color: Colors.grey.shade400,
            letterSpacing: 1.2)),
  );

  InputDecoration _iDeco({required String hint, String? err}) => InputDecoration(
    hintText: hint,
    hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
    errorText: err,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    filled: true,
    fillColor: Colors.grey.shade50,
    border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: Colors.grey.shade200)),
    enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: Colors.grey.shade200)),
    focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _color)),
    errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Colors.red)),
    focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Colors.red)),
  );
}

// ─── Labour OT Sheet ─────────────────────────────────────────────────────────

class _LabourOTSheet extends StatefulWidget {
  final Map<String, dynamic> entry;
  final Future<void> Function(Map<String, dynamic>) onSubmit;
  const _LabourOTSheet({required this.entry, required this.onSubmit});
  @override
  State<_LabourOTSheet> createState() => _LabourOTSheetState();
}

class _LabourOTSheetState extends State<_LabourOTSheet> {
  static const _amber = Color(0xFFF59E0B);

  final _hoursCtrl = TextEditingController();
  final _countCtrl = TextEditingController();
  final _rateCtrl  = TextEditingController();
  bool _submitting = false;
  String? _errHours, _errCount;

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  static int _toI(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    final p = s.split('-');
    return p.length == 3 ? '${p[2]}/${p[1]}/${p[0]}' : s;
  }

  @override
  void initState() {
    super.initState();
    final e = widget.entry;
    final h  = _toD(e['overtimeHours']);
    final c  = _toI(e['overtimeLabourCount']);
    final r  = _toD(e['overtimeRatePerHour']);
    if (h > 0) _hoursCtrl.text = h == h.truncateToDouble() ? h.toInt().toString() : h.toString();
    if (c > 0) _countCtrl.text = '$c';
    if (r > 0) _rateCtrl.text  = r.toStringAsFixed(2);
  }

  @override
  void dispose() {
    _hoursCtrl.dispose();
    _countCtrl.dispose();
    _rateCtrl.dispose();
    super.dispose();
  }

  bool get _hasExisting =>
      _toD(widget.entry['overtimeHours']) > 0 && _toI(widget.entry['overtimeLabourCount']) > 0;

  Future<void> _submit({bool clear = false}) async {
    if (!clear) {
      final h = double.tryParse(_hoursCtrl.text) ?? 0;
      final c = int.tryParse(_countCtrl.text) ?? 0;
      bool hasErr = false;
      setState(() {
        _errHours = h <= 0 ? 'Required' : null;
        _errCount = c <= 0 ? 'Required' : null;
        hasErr = h <= 0 || c <= 0;
      });
      if (hasErr) return;
    }
    setState(() => _submitting = true);
    try {
      await widget.onSubmit({
        'overtimeHours': clear ? '' : _hoursCtrl.text.trim(),
        'overtimeLabourCount': clear ? 0 : (int.tryParse(_countCtrl.text.trim()) ?? 0),
        'overtimeRatePerHour': clear ? '' : _rateCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (err) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $err')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final h = double.tryParse(_hoursCtrl.text) ?? 0;
    final c = int.tryParse(_countCtrl.text) ?? 0;
    final r = double.tryParse(_rateCtrl.text) ?? 0;
    final totalHrs  = h > 0 && c > 0 ? h * c : 0.0;
    final totalCost = totalHrs > 0 && r > 0 ? totalHrs * r : 0.0;
    final labourCount = _toI(widget.entry['labourCount']);
    final date = widget.entry['date']?.toString() ?? '';
    final name = widget.entry['contractorName']?.toString() ?? '';

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Header
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFFF59E0B), Color(0xFFF97316)]),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Row(children: [
              const Icon(Icons.access_time, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Record Overtime',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
                Text('$name · ${_fmtDate(date)}',
                    style: const TextStyle(fontSize: 11, color: Colors.white70)),
              ])),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: const Icon(Icons.close, color: Colors.white70, size: 20),
              ),
            ]),
          ),

          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Context chip
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: Row(children: [
                    const Icon(Icons.people_outline, size: 14, color: Color(0xFFF59E0B)),
                    const SizedBox(width: 6),
                    Text('$labourCount labours present on ${_fmtDate(date)}',
                        style: const TextStyle(fontSize: 12, color: Color(0xFF92400E))),
                  ]),
                ),
                const SizedBox(height: 16),

                // OT Hours + OT Count
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _lbl('OT HOURS *'),
                    TextField(
                      controller: _hoursCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      autofocus: true,
                      onChanged: (_) => setState(() => _errHours = null),
                      decoration: _iDeco(hint: 'e.g. 2.5', err: _errHours),
                    ),
                    const SizedBox(height: 4),
                    Text('0.5 = 30 mins', style: TextStyle(fontSize: 9, color: Colors.grey.shade400)),
                  ])),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _lbl('NO. OF LABOURS *'),
                    TextField(
                      controller: _countCtrl,
                      keyboardType: TextInputType.number,
                      onChanged: (_) => setState(() => _errCount = null),
                      decoration: _iDeco(hint: '0', err: _errCount),
                    ),
                    const SizedBox(height: 4),
                    Text('Who worked OT', style: TextStyle(fontSize: 9, color: Colors.grey.shade400)),
                  ])),
                ]),
                const SizedBox(height: 14),

                _lbl('RATE / HOUR / LABOUR (OPTIONAL)'),
                TextField(
                  controller: _rateCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  onChanged: (_) => setState(() {}),
                  decoration: _iDeco(hint: '₹ 0.00'),
                ),

                if (totalHrs > 0) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFFBEB),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFFDE68A)),
                    ),
                    child: Column(children: [
                      Row(children: [
                        const Icon(Icons.access_time, size: 13, color: Color(0xFFF59E0B)),
                        const SizedBox(width: 6),
                        const Text('OT Summary',
                            style: TextStyle(fontSize: 12, color: Color(0xFF92400E), fontWeight: FontWeight.w600)),
                        const Spacer(),
                        Text('${totalHrs.toStringAsFixed(1)} labour-hrs',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF92400E))),
                        Text(' ($c × ${h}h)',
                            style: const TextStyle(fontSize: 10, color: Color(0xFFF59E0B))),
                      ]),
                      if (totalCost > 0) ...[
                        const SizedBox(height: 4),
                        Row(children: [
                          const Text('OT Cost',
                              style: TextStyle(fontSize: 12, color: Color(0xFF92400E), fontWeight: FontWeight.w600)),
                          const Spacer(),
                          Text('₹${totalCost.toStringAsFixed(2)}',
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF065F46))),
                        ]),
                      ],
                    ]),
                  ),
                ],

                const SizedBox(height: 16),
                Row(children: [
                  if (_hasExisting)
                    TextButton.icon(
                      onPressed: _submitting ? null : () => _submit(clear: true),
                      icon: const Icon(Icons.clear, size: 14),
                      label: const Text('Clear OT', style: TextStyle(fontSize: 12)),
                      style: TextButton.styleFrom(foregroundColor: Colors.red),
                    ),
                  const Spacer(),
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel'),
                  ),
                  const SizedBox(width: 8),
                  FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: _submitting
                        ? const SizedBox(width: 14, height: 14,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.access_time, size: 14),
                    label: const Text('Save OT', style: TextStyle(fontWeight: FontWeight.bold)),
                    style: FilledButton.styleFrom(
                      backgroundColor: _amber,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _lbl(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(t,
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold,
            color: Colors.grey.shade400, letterSpacing: 1.2)),
  );

  InputDecoration _iDeco({required String hint, String? err}) => InputDecoration(
    hintText: hint,
    hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
    errorText: err,
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    filled: true,
    fillColor: Colors.grey.shade50,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: Colors.grey.shade200)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: Colors.grey.shade200)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: _amber)),
    errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Colors.red)),
    focusedErrorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Colors.red)),
  );
}

// ─── Store Material Screen ────────────────────────────────────────────────────

class StoreMaterialScreen extends StatefulWidget {
  const StoreMaterialScreen({super.key});
  @override
  State<StoreMaterialScreen> createState() => _StoreMaterialScreenState();
}

class _StoreMaterialScreenState extends State<StoreMaterialScreen> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF4C1D95);

  bool _loadingData = true;
  List<Map<String, dynamic>> _items = [];
  List<Map<String, dynamic>> _products = [];
  bool _showSearch = false;
  String _search = '';
  final _searchCtrl = TextEditingController();

  // date filter
  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  @override
  void initState() {
    super.initState();
    _to = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _load();
    _loadProducts();
  }

  @override
  void dispose() {
    _closeDateOverlay();
    _searchCtrl.dispose();
    super.dispose();
  }

  String _fmtIso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loadingData = true);
    try {
      final data = await ApiService().getStoreRoomMaterials(
          from: _fmtIso(_from), to: _fmtIso(_to));
      if (mounted) setState(() => _items = data.cast<Map<String, dynamic>>());
    } catch (_) {}
    if (mounted) setState(() => _loadingData = false);
  }

  Future<void> _loadProducts() async {
    try {
      final data = await ApiService().getProductsRaw(size: 1000);
      if (mounted) setState(() => _products = data);
    } catch (_) {}
  }

  void _closeDateOverlay() {
    _dateOverlay?.remove();
    _dateOverlay = null;
  }

  void _toggleDateOverlay() {
    if (_dateOverlay != null) { _closeDateOverlay(); return; }
    final entry = OverlayEntry(
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  static int _toI(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  List<Map<String, dynamic>> get _filtered {
    if (_search.trim().isEmpty) return _items;
    final q = _search.toLowerCase();
    return _items.where((e) =>
      (e['itemName'] ?? '').toString().toLowerCase().contains(q) ||
      (e['notes'] ?? '').toString().toLowerCase().contains(q)
    ).toList();
  }

  List<String> get _searchSuggestions {
    final q = _search.trim().toLowerCase();
    if (q.isEmpty) return [];
    final seen = <String>{};
    return _items
        .map((e) => e['itemName']?.toString() ?? '')
        .where((n) => n.isNotEmpty && n.toLowerCase().contains(q) && seen.add(n.toLowerCase()))
        .take(6)
        .toList();
  }

  void _showAddEdit([Map<String, dynamic>? editing]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _StoreMaterialSheet(
        initial: editing,
        products: _products,
        onSubmit: (data) async {
          if (editing != null) {
            await ApiService().updateStoreRoomMaterial(_toI(editing['id']), data);
          } else {
            await ApiService().createStoreRoomMaterial(data);
          }
          _load();
        },
      ),
    );
  }

  Future<void> _delete(int id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Entry'),
        content: const Text('This will permanently delete this store material record.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (ok == true) {
      await ApiService().deleteStoreRoomMaterial(id);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: _loadingData
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 106,
                  toolbarHeight: 46,
                  backgroundColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  scrolledUnderElevation: 0,
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
                              _hStat('${_items.length}', 'Entries'),
                              _hStat('${_uniqueItems}', 'Items'),
                            ]),
                          ),
                        ),
                      ]),
                    ),
                  ),
                  title: const Text('Store Material',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white)),
                  actions: [
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                            const SizedBox(width: 5),
                            Text(_dateFilter.isActive ? _dateFilter.label : 'Filter by Date',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                            const SizedBox(width: 3),
                            const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                          ]),
                        ),
                      ),
                    ),
                  ],
                ),

                if (filtered.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.archive_outlined, size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No entries found',
                            style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _StoreMaterialCard(
                          entry: filtered[i],
                          onEdit: () => _showAddEdit(filtered[i]),
                          onDelete: () => _delete(_toI(filtered[i]['id'])),
                        ),
                        childCount: filtered.length,
                      ),
                    ),
                  ),
              ]),
            ),
      bottomNavigationBar: _buildFloatingNav(),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddEdit(),
        backgroundColor: _color,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }

  int get _uniqueItems {
    final seen = <String>{};
    for (final e in _items) {
      final name = e['itemName']?.toString() ?? '';
      if (name.isNotEmpty) seen.add(name.toLowerCase());
    }
    return seen.length;
  }

  Widget _buildFloatingNav() {
    return Container(
      color: Colors.transparent,
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildSuggestions(),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
              child: Container(
                height: 64,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(32),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.13), blurRadius: 24, spreadRadius: -2, offset: const Offset(0, 6)),
                    BoxShadow(color: _color.withValues(alpha: 0.12), blurRadius: 40, offset: const Offset(0, 10)),
                  ],
                ),
                clipBehavior: Clip.hardEdge,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 260),
                  transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
                  child: _showSearch ? _buildSearchExpanded() : _buildNavItems(),
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
      key: const ValueKey('smsearch'),
      children: [
        Container(
          margin: const EdgeInsets.all(8),
          width: 48, height: 48,
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [_color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
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
              hintText: 'Search items…',
              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
              border: InputBorder.none,
              isDense: true,
            ),
          ),
        ),
        GestureDetector(
          onTap: () => setState(() { _showSearch = false; _search = ''; _searchCtrl.clear(); }),
          child: Container(
            margin: const EdgeInsets.all(10),
            width: 40, height: 40,
            decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(20)),
            child: const Icon(Icons.close, size: 18, color: Color(0xFF64748B)),
          ),
        ),
      ],
    );
  }

  Widget _buildNavItems() {
    return Row(
      key: const ValueKey('smnav'),
      children: [
        _smFloatItem(icon: Icons.search, label: 'Search', active: false, onTap: () => setState(() => _showSearch = true)),
        _smFloatItem(icon: Icons.archive_outlined, label: 'All Entries', active: true, onTap: () {}),
      ],
    );
  }

  Widget _smFloatItem({required IconData icon, required String label, required bool active, required VoidCallback onTap}) {
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
                  gradient: LinearGradient(colors: [_color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  borderRadius: BorderRadius.all(Radius.circular(26)),
                )
              : null,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 22, color: active ? Colors.white : const Color(0xFF94A3B8)),
              const SizedBox(height: 3),
              Text(label, style: TextStyle(fontSize: 9.5, fontWeight: active ? FontWeight.w700 : FontWeight.w500, color: active ? Colors.white : const Color(0xFF94A3B8), letterSpacing: 0.2)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSuggestions() {
    final suggs = _searchSuggestions;
    if (!_showSearch || suggs.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.10), blurRadius: 16, offset: const Offset(0, -4)),
          BoxShadow(color: _color.withValues(alpha: 0.07), blurRadius: 24, offset: const Offset(0, -8)),
        ],
      ),
      constraints: const BoxConstraints(maxHeight: 210),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: ListView.separated(
          padding: const EdgeInsets.symmetric(vertical: 4),
          shrinkWrap: true,
          itemCount: suggs.length,
          separatorBuilder: (_, __) => Divider(height: 1, indent: 16, endIndent: 16, color: Colors.grey.shade100),
          itemBuilder: (_, i) {
            final name = suggs[i];
            final q = _search.trim().toLowerCase();
            final idx = name.toLowerCase().indexOf(q);
            return InkWell(
              onTap: () => setState(() { _searchCtrl.text = name; _search = name; }),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(children: [
                  const Icon(Icons.archive_outlined, size: 15, color: Color(0xFF94A3B8)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: idx >= 0
                        ? RichText(
                            text: TextSpan(
                              style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B), fontWeight: FontWeight.w500),
                              children: [
                                if (idx > 0) TextSpan(text: name.substring(0, idx)),
                                TextSpan(text: name.substring(idx, idx + q.length), style: const TextStyle(color: _color, fontWeight: FontWeight.w700)),
                                TextSpan(text: name.substring(idx + q.length)),
                              ],
                            ),
                          )
                        : Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                  ),
                ]),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );
}

// ── Store Material Card ───────────────────────────────────────────────────────

class _StoreMaterialCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _StoreMaterialCard({required this.entry, required this.onEdit, required this.onDelete});

  static const _color = Color(0xFF7C3AED);

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    final p = s.split('-');
    return p.length == 3 ? '${p[2]}/${p[1]}/${p[0]}' : s;
  }

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  Color _badgeColor(String type) {
    switch (type) {
      case 'RAW_MATERIAL': return const Color(0xFFF59E0B);
      case 'FINISHED_PIPE': return const Color(0xFF7C3AED);
      default: return const Color(0xFF64748B);
    }
  }

  String _badgeLabel(String type) {
    switch (type) {
      case 'RAW_MATERIAL': return 'Raw Material';
      case 'FINISHED_PIPE': return 'Finished Pipe';
      default: return 'General';
    }
  }

  @override
  Widget build(BuildContext context) {
    final date = entry['date']?.toString() ?? '';
    final itemName = entry['itemName']?.toString() ?? '';
    final itemType = entry['itemType']?.toString() ?? 'GENERAL';
    final qty = _toD(entry['quantity']);
    final uom = entry['uom']?.toString() ?? '';
    final notes = entry['notes']?.toString() ?? '';
    final badgeColor = _badgeColor(itemType);

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2)),
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 1)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.archive_outlined, color: _color, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(itemName.isEmpty ? '—' : itemName,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Row(children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: badgeColor.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(_badgeLabel(itemType),
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: badgeColor)),
                  ),
                  const SizedBox(width: 6),
                  Text(_fmtDate(date), style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                ]),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
              Text(qty == qty.truncateToDouble() ? qty.toStringAsFixed(0) : qty.toStringAsFixed(2),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: _color)),
              if (uom.isNotEmpty)
                Text(uom, style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
            ]),
            const SizedBox(width: 4),
            Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(onPressed: onEdit, icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF94A3B8)), padding: const EdgeInsets.all(4), constraints: const BoxConstraints()),
              IconButton(onPressed: onDelete, icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFF94A3B8)), padding: const EdgeInsets.all(4), constraints: const BoxConstraints()),
            ]),
          ]),
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(notes, style: TextStyle(fontSize: 12, color: Colors.grey.shade600), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
        ]),
      ),
    );
  }
}

// ── Store Material Sheet ──────────────────────────────────────────────────────

class _StoreMaterialSheet extends StatefulWidget {
  final Map<String, dynamic>? initial;
  final List<Map<String, dynamic>> products;
  final Future<void> Function(Map<String, dynamic>) onSubmit;

  const _StoreMaterialSheet({this.initial, required this.products, required this.onSubmit});

  @override
  State<_StoreMaterialSheet> createState() => _StoreMaterialSheetState();
}

class _StoreMaterialSheetState extends State<_StoreMaterialSheet> {
  static const _color = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF2563EB);

  late DateTime _date;
  final _itemCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String _uom = '';
  String _itemType = 'GENERAL';
  bool _submitting = false;
  String? _errItem;
  String? _errQty;
  bool _showProductList = false;
  List<Map<String, dynamic>> _filteredProducts = [];

  bool get _isEdit => widget.initial != null;

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  @override
  void initState() {
    super.initState();
    final e = widget.initial;
    _date = e != null && (e['date']?.toString().length ?? 0) >= 10
        ? DateTime.tryParse(e['date'].toString().substring(0, 10)) ?? DateTime.now()
        : DateTime.now();
    if (e != null) {
      _itemCtrl.text = e['itemName']?.toString() ?? '';
      _uom = e['uom']?.toString() ?? '';
      _itemType = e['itemType']?.toString() ?? 'GENERAL';
      final qty = _toD(e['quantity']);
      _qtyCtrl.text = qty == qty.truncateToDouble() ? qty.toStringAsFixed(0) : qty.toStringAsFixed(2);
      _notesCtrl.text = e['notes']?.toString() ?? '';
    }
    _filteredProducts = widget.products;
  }

  @override
  void dispose() {
    _itemCtrl.dispose();
    _qtyCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  void _filterProducts(String q) {
    setState(() {
      _showProductList = q.trim().isNotEmpty;
      _filteredProducts = q.trim().isEmpty
          ? widget.products
          : widget.products.where((p) => (p['name'] ?? '').toString().toLowerCase().contains(q.toLowerCase())).toList();
    });
  }

  void _selectProduct(Map<String, dynamic> p) {
    setState(() {
      _itemCtrl.text = p['name']?.toString() ?? '';
      _uom = p['unitOfMeasure']?.toString() ?? '';
      _itemType = p['itemType']?.toString() ?? 'GENERAL';
      _showProductList = false;
      _errItem = null;
    });
  }

  Future<void> _submit() async {
    final itemName = _itemCtrl.text.trim();
    final qty = double.tryParse(_qtyCtrl.text.trim());
    setState(() {
      _errItem = itemName.isEmpty ? 'Item name is required' : null;
      _errQty = qty == null || qty <= 0 ? 'Enter a valid quantity' : null;
    });
    if (_errItem != null || _errQty != null) return;

    setState(() => _submitting = true);
    try {
      await widget.onSubmit({
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'itemName': itemName,
        'itemType': _itemType,
        'quantity': qty.toString(),
        'uom': _uom,
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (_) {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [_color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
            child: Row(children: [
              const Icon(Icons.archive_outlined, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Text(_isEdit ? 'Edit Entry' : 'Add Store Material',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 30, height: 30,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(15)),
                  child: const Icon(Icons.close, color: Colors.white, size: 16),
                ),
              ),
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Date
                const Text('Date', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now());
                    if (d != null) setState(() => _date = d);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
                    child: Row(children: [
                      const Icon(Icons.calendar_today_outlined, size: 16, color: Color(0xFF64748B)),
                      const SizedBox(width: 8),
                      Text(DateFormat('dd MMM yyyy').format(_date), style: const TextStyle(fontSize: 14)),
                    ]),
                  ),
                ),
                const SizedBox(height: 14),

                // Item Name with autocomplete
                const Text('Item Name*', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                TextField(
                  controller: _itemCtrl,
                  style: const TextStyle(fontSize: 14),
                  onChanged: (v) {
                    _filterProducts(v);
                    if (_errItem != null) setState(() => _errItem = null);
                  },
                  decoration: InputDecoration(
                    hintText: 'Search or type item name…',
                    errorText: _errItem,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                    suffixIcon: _uom.isNotEmpty
                        ? Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(color: const Color(0xFF7C3AED).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(4)),
                              child: Text(_uom, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _color)),
                            ),
                          )
                        : null,
                  ),
                ),
                if (_showProductList && _filteredProducts.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Container(
                    constraints: const BoxConstraints(maxHeight: 200),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.grey.shade200),
                      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, 2))],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: ListView.builder(
                        shrinkWrap: true,
                        itemCount: _filteredProducts.length > 8 ? 8 : _filteredProducts.length,
                        itemBuilder: (_, i) {
                          final p = _filteredProducts[i];
                          final name = p['name']?.toString() ?? '';
                          final uom = p['unitOfMeasure']?.toString() ?? '';
                          return InkWell(
                            onTap: () => _selectProduct(p),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                              child: Row(children: [
                                Expanded(child: Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500))),
                                if (uom.isNotEmpty)
                                  Text(uom, style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                              ]),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 14),

                // Quantity + UOM row
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    flex: 2,
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('Quantity*', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _qtyCtrl,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        style: const TextStyle(fontSize: 14),
                        onChanged: (_) => setState(() => _errQty = null),
                        decoration: InputDecoration(
                          hintText: '0.00',
                          errorText: _errQty,
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          isDense: true,
                        ),
                      ),
                    ]),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('Unit', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                      const SizedBox(height: 6),
                      TextField(
                        controller: TextEditingController(text: _uom),
                        style: const TextStyle(fontSize: 14),
                        onChanged: (v) => setState(() => _uom = v),
                        decoration: InputDecoration(
                          hintText: 'pcs',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          isDense: true,
                        ),
                      ),
                    ]),
                  ),
                ]),
                const SizedBox(height: 14),

                // Notes
                const Text('Notes (optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                TextField(
                  controller: _notesCtrl,
                  maxLines: 2,
                  style: const TextStyle(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Additional details…',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    style: FilledButton.styleFrom(backgroundColor: _color, padding: const EdgeInsets.symmetric(vertical: 14)),
                    icon: _submitting
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.check_circle_outline),
                    label: Text(_submitting ? 'Saving…' : _isEdit ? 'Save Changes' : 'Add Entry'),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

// ─── Maintenance Screen ───────────────────────────────────────────────────────

class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key});
  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  static const _color = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF2563EB);

  static const _processes = [
    'Fabrication', 'Fabrication Testing', 'Moulding', 'Spinning',
    'Demoulding', 'Curing 1', 'Winding', 'Coating', 'Final Testing',
    'General / Other',
  ];

  bool _loadingData = true;
  List<Map<String, dynamic>> _items = [];
  bool _searchExpanded = false;
  String _search = '';
  final _searchCtrl = TextEditingController();
  String _preset = '';
  late DateTime _from, _to;

  final _layerLink  = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();

  @override
  void initState() {
    super.initState();
    _to = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _load();
  }

  @override
  void dispose() {
    _closeDateOverlay();
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
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _preset = f.preset;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmtIso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loadingData = true);
    try {
      final data = await ApiService().getMaintenanceEntries(from: _fmtIso(_from), to: _fmtIso(_to));
      if (mounted) setState(() => _items = data.cast<Map<String, dynamic>>());
    } catch (_) {}
    if (mounted) setState(() => _loadingData = false);
  }

  void _showDateSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (_) => _BizDateSheet(
        preset: _preset, from: _from, to: _to,
        onApply: (preset, from, to) {
          setState(() { _preset = preset; _from = from; _to = to; });
          _load();
        },
        onClear: () {
          final now = DateTime.now();
          setState(() { _preset = ''; _to = now; _from = now.subtract(const Duration(days: 29)); });
          _load();
        },
      ),
    );
  }

  String get _filterLabel {
    const labels = {
      'today': 'Today', 'yesterday': 'Yesterday', 'this_week': 'This Week',
      'last_week': 'Last Week', 'this_month': 'This Month', 'last_month': 'Last Month',
      'this_quarter': 'This Quarter', 'this_year': 'This Year',
    };
    if (labels.containsKey(_preset)) return labels[_preset]!;
    if (_preset == 'custom') return '${DateFormat('dd MMM').format(_from)} – ${DateFormat('dd MMM').format(_to)}';
    return 'Filter by Date';
  }

  static int _toI(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  List<Map<String, dynamic>> get _filtered {
    if (_search.trim().isEmpty) return _items;
    final q = _search.toLowerCase();
    return _items.where((e) =>
      (e['vendor'] ?? '').toString().toLowerCase().contains(q) ||
      (e['process'] ?? '').toString().toLowerCase().contains(q) ||
      (e['notes'] ?? '').toString().toLowerCase().contains(q)
    ).toList();
  }

  double get _totalAmount => _filtered.fold(0.0, (s, e) => s + _toD(e['amount']));

  List<String> get _vendorSuggestions {
    final q = _search.trim().toLowerCase();
    if (q.isEmpty) return [];
    final seen = <String>{};
    return _items
        .map((e) => e['vendor']?.toString() ?? '')
        .where((n) => n.isNotEmpty && n.toLowerCase().contains(q) && seen.add(n.toLowerCase()))
        .take(6)
        .toList();
  }

  List<String> get _allVendors {
    final seen = <String>{};
    return _items
        .map((e) => e['vendor']?.toString() ?? '')
        .where((n) => n.isNotEmpty && seen.add(n.toLowerCase()))
        .toList()
      ..sort();
  }

  void _showAddEdit([Map<String, dynamic>? editing]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _MaintenanceSheet(
        initial: editing,
        vendorHistory: _allVendors,
        processes: _processes,
        onSubmit: (data) async {
          if (editing != null) {
            await ApiService().updateMaintenanceEntry(_toI(editing['id']), data);
          } else {
            await ApiService().createMaintenanceEntry(data);
          }
          _load();
        },
      ),
    );
  }

  Future<void> _delete(int id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Entry'),
        content: const Text('This will permanently delete this maintenance record.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (ok == true) {
      await ApiService().deleteMaintenanceEntry(id);
      _load();
    }
  }

  String _fmtAmount(double v) {
    if (v >= 100000) return '₹${(v / 100000).toStringAsFixed(1)}L';
    if (v >= 1000) return '₹${(v / 1000).toStringAsFixed(1)}K';
    return '₹${v.toStringAsFixed(0)}';
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final total = _totalAmount;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: _loadingData
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 120,
                  backgroundColor: const Color(0xFF7C3AED),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  scrolledUnderElevation: 0,
                  leading: context.canPop()
                      ? IconButton(
                          icon: const Icon(Icons.arrow_back, color: Colors.white),
                          onPressed: () => context.pop(),
                        )
                      : IconButton(
                          icon: const Icon(Icons.menu_outlined, color: Colors.white),
                          onPressed: openAppDrawer,
                          tooltip: 'Open menu',
                        ),
                  title: const Text('Maintenance', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w600)),
                  actions: [
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withOpacity(0.25)),
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
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.add, color: Colors.white),
                      onPressed: () => _showAddEdit(),
                      tooltip: 'Add Entry',
                    ),
                  ],
                  flexibleSpace: FlexibleSpaceBar(
                    background: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF7C3AED), Color(0xFF4C1D95)],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: SafeArea(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(6, 64, 6, 4),
                          child: Row(children: [
                            _hStat('${filtered.length}', 'Entries'),
                            _hStat(total > 0 ? _fmtAmount(total) : '—', 'Total Cost'),
                          ]),
                        ),
                      ),
                    ),
                  ),
                ),

                if (filtered.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.build_outlined, size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No entries found', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  )
                else ...[
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _MaintenanceCard(
                          entry: filtered[i],
                          onEdit: () => _showAddEdit(filtered[i]),
                          onDelete: () => _delete(_toI(filtered[i]['id'])),
                        ),
                        childCount: filtered.length,
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Container(
                      margin: const EdgeInsets.fromLTRB(12, 4, 12, 100),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [Color(0xFF6D28D9), _color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(children: [
                        const Text('Total', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white70)),
                        const Spacer(),
                        Text('₹${total.toStringAsFixed(2)}',
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
                      ]),
                    ),
                  ),
                ],
              ]),
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
            _buildSuggestions(),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
              child: Container(
                height: 64,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(32),
                  boxShadow: [
                    BoxShadow(color: Colors.black.withValues(alpha: 0.13), blurRadius: 24, spreadRadius: -2, offset: const Offset(0, 6)),
                    BoxShadow(color: _color.withValues(alpha: 0.12), blurRadius: 40, offset: const Offset(0, 10)),
                  ],
                ),
                clipBehavior: Clip.hardEdge,
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 260),
                  transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
                  child: _searchExpanded ? _buildSearchExpanded() : _buildNavItems(),
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
      key: const ValueKey('mtsearch'),
      children: [
        Container(
          margin: const EdgeInsets.all(8), width: 48, height: 48,
          decoration: const BoxDecoration(
            gradient: LinearGradient(colors: [Color(0xFF6D28D9), _color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
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
              hintText: 'Search vendor or process…',
              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
              border: InputBorder.none, isDense: true,
            ),
          ),
        ),
        GestureDetector(
          onTap: () => setState(() { _searchExpanded = false; _search = ''; _searchCtrl.clear(); }),
          child: Container(
            margin: const EdgeInsets.all(10), width: 40, height: 40,
            decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(20)),
            child: const Icon(Icons.close, size: 18, color: Color(0xFF64748B)),
          ),
        ),
      ],
    );
  }

  Widget _buildNavItems() {
    return Row(
      key: const ValueKey('mtnav'),
      children: [
        _mtFloatItem(icon: Icons.search, label: 'Search', active: false, onTap: () => setState(() => _searchExpanded = true)),
        _mtFloatItem(icon: Icons.build_outlined, label: 'All Entries', active: true, onTap: () {}),
      ],
    );
  }

  Widget _mtFloatItem({required IconData icon, required String label, required bool active, required VoidCallback onTap}) {
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
                  gradient: LinearGradient(colors: [Color(0xFF6D28D9), _color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  borderRadius: BorderRadius.all(Radius.circular(26)),
                )
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 22, color: active ? Colors.white : const Color(0xFF94A3B8)),
            const SizedBox(height: 3),
            Text(label, style: TextStyle(fontSize: 9.5, fontWeight: active ? FontWeight.w700 : FontWeight.w500, color: active ? Colors.white : const Color(0xFF94A3B8), letterSpacing: 0.2)),
          ]),
        ),
      ),
    );
  }

  Widget _buildSuggestions() {
    final suggs = _vendorSuggestions;
    if (!_searchExpanded || suggs.isEmpty) return const SizedBox.shrink();
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.10), blurRadius: 16, offset: const Offset(0, -4)),
          BoxShadow(color: _color.withValues(alpha: 0.07), blurRadius: 24, offset: const Offset(0, -8)),
        ],
      ),
      constraints: const BoxConstraints(maxHeight: 210),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: ListView.separated(
          padding: const EdgeInsets.symmetric(vertical: 4),
          shrinkWrap: true,
          itemCount: suggs.length,
          separatorBuilder: (_, __) => Divider(height: 1, indent: 16, endIndent: 16, color: Colors.grey.shade100),
          itemBuilder: (_, i) {
            final name = suggs[i];
            final q = _search.trim().toLowerCase();
            final idx = name.toLowerCase().indexOf(q);
            return InkWell(
              onTap: () => setState(() { _searchCtrl.text = name; _search = name; }),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                child: Row(children: [
                  const Icon(Icons.store_outlined, size: 15, color: Color(0xFF94A3B8)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: idx >= 0
                        ? RichText(text: TextSpan(
                            style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B), fontWeight: FontWeight.w500),
                            children: [
                              if (idx > 0) TextSpan(text: name.substring(0, idx)),
                              TextSpan(text: name.substring(idx, idx + q.length), style: const TextStyle(color: _color, fontWeight: FontWeight.w700)),
                              TextSpan(text: name.substring(idx + q.length)),
                            ],
                          ))
                        : Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                  ),
                ]),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );
}

// ── Maintenance Card ──────────────────────────────────────────────────────────

class _MaintenanceCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _MaintenanceCard({required this.entry, required this.onEdit, required this.onDelete});

  static const _color = Color(0xFF7C3AED);

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    try {
      final d = DateTime.parse(s.substring(0, 10));
      return DateFormat('dd MMM yyyy').format(d);
    } catch (_) { return s; }
  }

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    final date = entry['date']?.toString() ?? '';
    final process = entry['process']?.toString() ?? '';
    final vendor = entry['vendor']?.toString() ?? '';
    final amount = _toD(entry['amount']);
    final notes = entry['notes']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2)),
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 1)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.build_outlined, color: _color, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(vendor.isEmpty ? '—' : vendor,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Row(children: [
                  if (process.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF3C7),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(process, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF92400E))),
                    ),
                    const SizedBox(width: 6),
                  ],
                  Text(_fmtDate(date), style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                ]),
              ]),
            ),
            Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisSize: MainAxisSize.min, children: [
              Text('₹${amount.toStringAsFixed(2)}',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
            ]),
            const SizedBox(width: 4),
            Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(onPressed: onEdit, icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF94A3B8)), padding: const EdgeInsets.all(4), constraints: const BoxConstraints()),
              IconButton(onPressed: onDelete, icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFF94A3B8)), padding: const EdgeInsets.all(4), constraints: const BoxConstraints()),
            ]),
          ]),
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(notes, style: TextStyle(fontSize: 12, color: Colors.grey.shade600), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
        ]),
      ),
    );
  }
}

// ── Maintenance Sheet ─────────────────────────────────────────────────────────

class _MaintenanceSheet extends StatefulWidget {
  final Map<String, dynamic>? initial;
  final List<String> vendorHistory;
  final List<String> processes;
  final Future<void> Function(Map<String, dynamic>) onSubmit;

  const _MaintenanceSheet({this.initial, required this.vendorHistory, required this.processes, required this.onSubmit});

  @override
  State<_MaintenanceSheet> createState() => _MaintenanceSheetState();
}

class _MaintenanceSheetState extends State<_MaintenanceSheet> {
  static const _color = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF2563EB);

  late DateTime _date;
  String _process = '';
  final _vendorCtrl = TextEditingController();
  final _amountCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _submitting = false;
  String? _errProcess;
  String? _errVendor;
  String? _errAmount;
  bool _showVendorList = false;
  List<String> _filteredVendors = [];

  bool get _isEdit => widget.initial != null;

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  @override
  void initState() {
    super.initState();
    final e = widget.initial;
    _date = e != null && (e['date']?.toString().length ?? 0) >= 10
        ? DateTime.tryParse(e['date'].toString().substring(0, 10)) ?? DateTime.now()
        : DateTime.now();
    if (e != null) {
      _process = e['process']?.toString() ?? '';
      _vendorCtrl.text = e['vendor']?.toString() ?? '';
      final amt = _toD(e['amount']);
      _amountCtrl.text = amt > 0 ? amt.toStringAsFixed(2) : '';
      _notesCtrl.text = e['notes']?.toString() ?? '';
    }
    _filteredVendors = widget.vendorHistory;
  }

  @override
  void dispose() {
    _vendorCtrl.dispose();
    _amountCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  void _filterVendors(String q) {
    setState(() {
      _showVendorList = q.trim().isNotEmpty;
      _filteredVendors = q.trim().isEmpty
          ? widget.vendorHistory
          : widget.vendorHistory.where((v) => v.toLowerCase().contains(q.toLowerCase())).toList();
    });
  }

  Future<void> _submit() async {
    final vendor = _vendorCtrl.text.trim();
    final amount = double.tryParse(_amountCtrl.text.trim());
    setState(() {
      _errProcess = _process.isEmpty ? 'Select a process' : null;
      _errVendor = vendor.isEmpty ? 'Vendor is required' : null;
      _errAmount = amount == null || amount < 0 ? 'Enter a valid amount' : null;
    });
    if (_errProcess != null || _errVendor != null || _errAmount != null) return;

    setState(() => _submitting = true);
    try {
      await widget.onSubmit({
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'process': _process,
        'vendor': vendor,
        'amount': amount.toString(),
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (_) {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFF6D28D9), _color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
            child: Row(children: [
              const Icon(Icons.build_outlined, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Text(_isEdit ? 'Edit Maintenance Entry' : 'Add Maintenance Entry',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 30, height: 30,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(15)),
                  child: const Icon(Icons.close, color: Colors.white, size: 16),
                ),
              ),
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Date', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now());
                    if (d != null) setState(() => _date = d);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
                    child: Row(children: [
                      const Icon(Icons.calendar_today_outlined, size: 16, color: Color(0xFF64748B)),
                      const SizedBox(width: 8),
                      Text(DateFormat('dd MMM yyyy').format(_date), style: const TextStyle(fontSize: 14)),
                    ]),
                  ),
                ),
                const SizedBox(height: 14),

                const Text('Production Process*', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: _errProcess != null ? Colors.red : Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _process.isEmpty ? null : _process,
                      hint: const Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('Select process…', style: TextStyle(fontSize: 13, color: Colors.grey))),
                      isExpanded: true,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      borderRadius: BorderRadius.circular(10),
                      items: widget.processes.map((p) => DropdownMenuItem(value: p, child: Text(p, style: const TextStyle(fontSize: 13)))).toList(),
                      onChanged: (v) { if (v != null) setState(() { _process = v; _errProcess = null; }); },
                    ),
                  ),
                ),
                if (_errProcess != null) ...[
                  const SizedBox(height: 4),
                  Text(_errProcess!, style: const TextStyle(fontSize: 11, color: Colors.red)),
                ],
                const SizedBox(height: 14),

                const Text('Vendor*', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                TextField(
                  controller: _vendorCtrl,
                  style: const TextStyle(fontSize: 14),
                  onChanged: (v) {
                    _filterVendors(v);
                    if (_errVendor != null) setState(() => _errVendor = null);
                  },
                  decoration: InputDecoration(
                    hintText: 'Type vendor name…',
                    errorText: _errVendor,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                ),
                if (_showVendorList && _filteredVendors.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Container(
                    constraints: const BoxConstraints(maxHeight: 160),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.grey.shade200),
                      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 8, offset: const Offset(0, 2))],
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: ListView.builder(
                        shrinkWrap: true,
                        itemCount: _filteredVendors.length > 6 ? 6 : _filteredVendors.length,
                        itemBuilder: (_, i) => InkWell(
                          onTap: () => setState(() { _vendorCtrl.text = _filteredVendors[i]; _showVendorList = false; _errVendor = null; }),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            child: Text(_filteredVendors[i], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 14),

                const Text('Amount (₹)*', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                TextField(
                  controller: _amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(fontSize: 14),
                  onChanged: (_) => setState(() => _errAmount = null),
                  decoration: InputDecoration(
                    hintText: '0.00',
                    prefixText: '₹ ',
                    errorText: _errAmount,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 14),

                const Text('Notes (optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                TextField(
                  controller: _notesCtrl,
                  maxLines: 2,
                  style: const TextStyle(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Additional details…',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    style: FilledButton.styleFrom(backgroundColor: _color, padding: const EdgeInsets.symmetric(vertical: 14)),
                    icon: _submitting
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.check_circle_outline),
                    label: Text(_submitting ? 'Saving…' : _isEdit ? 'Save Changes' : 'Add Entry'),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

// ─── Cutting Screen ───────────────────────────────────────────────────────────

class CuttingScreen extends StatefulWidget {
  const CuttingScreen({super.key});
  @override
  State<CuttingScreen> createState() => _CuttingScreenState();
}

class _CuttingScreenState extends State<CuttingScreen> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF4C1D95);
  static const _pink      = Color(0xFFDB2777);

  bool _loadingData = true;
  List<Map<String, dynamic>> _items = [];
  List<String> _sheets = [];
  bool _loadingSheets = true;

  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  static final _sheetRe = RegExp(r'^1\.6MM SHEET \d+$');
  static int _diameter(String name) => int.tryParse(name.split(' ').last) ?? 0;

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _loadSheets();
    _load();
  }

  @override
  void dispose() {
    _closeDateOverlay();
    super.dispose();
  }

  void _closeDateOverlay() {
    _dateOverlay?.remove();
    _dateOverlay = null;
  }

  void _toggleDateOverlay() {
    if (_dateOverlay != null) { _closeDateOverlay(); return; }
    final entry = OverlayEntry(
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmtIso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _loadSheets() async {
    try {
      final raw = await ApiService().getProductsRaw(size: 200, itemType: 'RAW_MATERIAL');
      final names = raw
          .map((p) => p['name']?.toString() ?? '')
          .where((n) => _sheetRe.hasMatch(n))
          .toList()
        ..sort((a, b) => _diameter(a).compareTo(_diameter(b)));
      if (mounted) setState(() { _sheets = names; _loadingSheets = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingSheets = false);
    }
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loadingData = true);
    try {
      final data = await ApiService().getCuttingEntries(from: _fmtIso(_from), to: _fmtIso(_to));
      if (mounted) setState(() => _items = data.cast<Map<String, dynamic>>());
    } catch (_) {}
    if (mounted) setState(() => _loadingData = false);
  }

  static int _toI(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  int get _totalSheets => _items.fold(0, (s, e) => s + _toI(e['quantity']));
  int get _fromSizes   => _items.map((e) => e['fromSheet']?.toString() ?? '').toSet().length;
  int get _toSizes     => _items.map((e) => e['toSheet']?.toString()   ?? '').toSet().length;

  void _showAddEdit([Map<String, dynamic>? editing]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CuttingSheet(
        initial: editing,
        sheets: _sheets,
        loadingSheets: _loadingSheets,
        onSubmit: (data) async {
          if (editing != null) {
            await ApiService().updateCuttingEntry(_toI(editing['id']), data);
          } else {
            await ApiService().createCuttingEntry(data);
          }
          _load();
        },
      ),
    );
  }

  Future<void> _delete(int id, String from, String to) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Entry'),
        content: Text('Delete cutting $from → $to?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true),  child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (ok == true) {
      await ApiService().deleteCuttingEntry(id);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: _loadingData
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 106,
                  toolbarHeight: 46,
                  backgroundColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  scrolledUnderElevation: 0,
                  flexibleSpace: FlexibleSpaceBar(
                    collapseMode: CollapseMode.pin,
                    background: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF6D28D9), _color, _colorDark],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Stack(children: [
                        Positioned(
                          right: -24, top: -24,
                          child: Container(
                            width: 110, height: 110,
                            decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.06)),
                          ),
                        ),
                        Align(
                          alignment: Alignment.bottomLeft,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(6, 0, 6, 10),
                            child: Row(children: [
                              _hStat('${_items.length}', 'Total Cuts'),
                              _hStat('$_totalSheets', 'Total Sheets'),
                              _hStat('$_fromSizes', 'From Sizes'),
                              _hStat('$_toSizes', 'To Sizes'),
                            ]),
                          ),
                        ),
                      ]),
                    ),
                  ),
                  title: const Text('Sheet Cutting',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white)),
                  actions: [
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                            const SizedBox(width: 5),
                            Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                            const SizedBox(width: 3),
                            const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                          ]),
                        ),
                      ),
                    ),
                  ],
                ),

                if (_items.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.content_cut, size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No cutting entries found', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _CuttingCard(
                          entry: _items[i],
                          onEdit:   () => _showAddEdit(_items[i]),
                          onDelete: () => _delete(
                            _toI(_items[i]['id']),
                            _items[i]['fromSheet']?.toString() ?? '',
                            _items[i]['toSheet']?.toString()   ?? '',
                          ),
                        ),
                        childCount: _items.length,
                      ),
                    ),
                  ),
              ]),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddEdit(),
        backgroundColor: _pink,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 8, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );
}

// ── Cutting Card ──────────────────────────────────────────────────────────────

class _CuttingCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _CuttingCard({required this.entry, required this.onEdit, required this.onDelete});

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    try { return DateFormat('dd MMM yyyy').format(DateTime.parse(s.substring(0, 10))); }
    catch (_) { return s; }
  }

  static int _toI(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    final date      = entry['date']?.toString() ?? '';
    final fromSheet = entry['fromSheet']?.toString() ?? '';
    final toSheet   = entry['toSheet']?.toString()   ?? '';
    final qty       = _toI(entry['quantity']);
    final notes     = entry['notes']?.toString() ?? '';

    return Container(
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
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.content_cut, color: Color(0xFFDB2777), size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(color: const Color(0xFFFFF1F2), borderRadius: BorderRadius.circular(6)),
                    child: Text(fromSheet, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFBE123C))),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 6),
                    child: Icon(Icons.arrow_forward, size: 14, color: Color(0xFFFDA4AF)),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                    decoration: BoxDecoration(color: const Color(0xFFFDF2F8), borderRadius: BorderRadius.circular(6)),
                    child: Text(toSheet, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF9D174D))),
                  ),
                ]),
                const SizedBox(height: 3),
                Text(_fmtDate(date), style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
              ]),
            ),
            Text('$qty sheets', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
            const SizedBox(width: 4),
            Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(onPressed: onEdit,   icon: const Icon(Icons.edit_outlined,  size: 18, color: Color(0xFF94A3B8)), padding: const EdgeInsets.all(4), constraints: const BoxConstraints()),
              IconButton(onPressed: onDelete, icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFF94A3B8)), padding: const EdgeInsets.all(4), constraints: const BoxConstraints()),
            ]),
          ]),
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(notes, style: TextStyle(fontSize: 12, color: Colors.grey.shade600), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
        ]),
      ),
    );
  }
}

// ── Cutting Sheet ─────────────────────────────────────────────────────────────

class _CuttingSheet extends StatefulWidget {
  final Map<String, dynamic>? initial;
  final List<String> sheets;
  final bool loadingSheets;
  final Future<void> Function(Map<String, dynamic>) onSubmit;

  const _CuttingSheet({this.initial, required this.sheets, required this.loadingSheets, required this.onSubmit});

  @override
  State<_CuttingSheet> createState() => _CuttingSheetState();
}

class _CuttingSheetState extends State<_CuttingSheet> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF2563EB);
  static const _pink      = Color(0xFFDB2777);

  late DateTime _date;
  String _fromSheet = '';
  String _toSheet   = '';
  final _qtyCtrl   = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _submitting = false;
  String? _errFrom, _errTo, _errQty;

  bool get _isEdit => widget.initial != null;

  static int _diameter(String name) => int.tryParse(name.split(' ').last) ?? 0;

  List<String> get _toSheets {
    if (_fromSheet.isEmpty) return [];
    final fromDia = _diameter(_fromSheet);
    return widget.sheets.where((s) => _diameter(s) < fromDia).toList();
  }

  @override
  void initState() {
    super.initState();
    final e = widget.initial;
    _date = e != null && (e['date']?.toString().length ?? 0) >= 10
        ? DateTime.tryParse(e['date'].toString().substring(0, 10)) ?? DateTime.now()
        : DateTime.now();
    if (e != null) {
      _fromSheet      = e['fromSheet']?.toString() ?? '';
      _toSheet        = e['toSheet']?.toString()   ?? '';
      _qtyCtrl.text   = e['quantity']?.toString()  ?? '';
      _notesCtrl.text = e['notes']?.toString()     ?? '';
    }
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  void _onFromChange(String val) {
    setState(() {
      _fromSheet = val;
      _errFrom   = null;
      if (_toSheet.isNotEmpty && _diameter(_toSheet) >= _diameter(val)) _toSheet = '';
      _errTo = null;
    });
  }

  Future<void> _submit() async {
    final qty = int.tryParse(_qtyCtrl.text.trim());
    setState(() {
      _errFrom = _fromSheet.isEmpty ? 'Select a From sheet' : null;
      _errTo   = _toSheet.isEmpty   ? 'Select a To sheet'   : null;
      _errQty  = (qty == null || qty < 1) ? 'Enter a valid quantity (≥ 1)' : null;
    });
    if (_errFrom != null || _errTo != null || _errQty != null) return;

    setState(() => _submitting = true);
    try {
      await widget.onSubmit({
        'date':      DateFormat('yyyy-MM-dd').format(_date),
        'fromSheet': _fromSheet,
        'toSheet':   _toSheet,
        'quantity':  qty,
        'notes':     _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (_) {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final toSheets = _toSheets;

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFF6D28D9), _color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
            child: Row(children: [
              const Icon(Icons.content_cut, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Text(_isEdit ? 'Edit Cutting Entry' : 'Record Cutting',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 30, height: 30,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(15)),
                  child: const Icon(Icons.close, color: Colors.white, size: 16),
                ),
              ),
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                const Text('Date', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now());
                    if (d != null) setState(() => _date = d);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
                    child: Row(children: [
                      const Icon(Icons.calendar_today_outlined, size: 16, color: Color(0xFF64748B)),
                      const SizedBox(width: 8),
                      Text(DateFormat('dd MMM yyyy').format(_date), style: const TextStyle(fontSize: 14)),
                    ]),
                  ),
                ),
                const SizedBox(height: 14),

                Row(children: [
                  const Text('Sheet Cutting*', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                  const SizedBox(width: 8),
                  Text('larger → smaller', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
                ]),
                const SizedBox(height: 6),

                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: _errFrom != null ? Colors.red : Colors.grey.shade300),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _fromSheet.isEmpty ? null : _fromSheet,
                            hint: const Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('From…', style: TextStyle(fontSize: 12, color: Colors.grey))),
                            isExpanded: true,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            borderRadius: BorderRadius.circular(10),
                            items: widget.sheets.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 12)))).toList(),
                            onChanged: widget.loadingSheets ? null : (v) { if (v != null) _onFromChange(v); },
                          ),
                        ),
                      ),
                      if (_errFrom != null) ...[
                        const SizedBox(height: 3),
                        Text(_errFrom!, style: const TextStyle(fontSize: 10, color: Colors.red)),
                      ],
                    ]),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 10),
                    child: Icon(Icons.arrow_forward, size: 18, color: Color(0xFFFDA4AF)),
                  ),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: _errTo != null ? Colors.red : Colors.grey.shade300),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _toSheet.isEmpty ? null : _toSheet,
                            hint: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              child: Text(_fromSheet.isEmpty ? 'From first' : 'To…', style: const TextStyle(fontSize: 12, color: Colors.grey)),
                            ),
                            isExpanded: true,
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            borderRadius: BorderRadius.circular(10),
                            items: toSheets.map((s) => DropdownMenuItem(value: s, child: Text(s, style: const TextStyle(fontSize: 12)))).toList(),
                            onChanged: (widget.loadingSheets || _fromSheet.isEmpty || toSheets.isEmpty)
                                ? null
                                : (v) { if (v != null) setState(() { _toSheet = v; _errTo = null; }); },
                          ),
                        ),
                      ),
                      if (_errTo != null) ...[
                        const SizedBox(height: 3),
                        Text(_errTo!, style: const TextStyle(fontSize: 10, color: Colors.red)),
                      ],
                    ]),
                  ),
                ]),

                if (_fromSheet.isNotEmpty && _toSheet.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF1F2),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFFECDD3)),
                    ),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      Text('Cutting:', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFFFFF1F2), borderRadius: BorderRadius.circular(4)),
                        child: Text(_fromSheet, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFBE123C))),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 6),
                        child: Icon(Icons.arrow_forward, size: 13, color: Color(0xFFFDA4AF)),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: const Color(0xFFFDF2F8), borderRadius: BorderRadius.circular(4)),
                        child: Text(_toSheet, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF9D174D))),
                      ),
                    ]),
                  ),
                ],
                const SizedBox(height: 14),

                const Text('Quantity (sheets)*', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                TextField(
                  controller: _qtyCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(fontSize: 14),
                  onChanged: (_) => setState(() => _errQty = null),
                  decoration: InputDecoration(
                    hintText: 'Number of sheets cut…',
                    errorText: _errQty,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 14),

                const Text('Notes (optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                TextField(
                  controller: _notesCtrl,
                  maxLines: 2,
                  style: const TextStyle(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Any remarks…',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    style: FilledButton.styleFrom(backgroundColor: _color, padding: const EdgeInsets.symmetric(vertical: 14)),
                    icon: _submitting
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.check_circle_outline),
                    label: Text(_submitting ? 'Saving…' : _isEdit ? 'Save Changes' : 'Add Entry'),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

// ─── Diesel Maintenance Screen ────────────────────────────────────────────────

class DieselMaintenanceScreen extends StatefulWidget {
  const DieselMaintenanceScreen({super.key});
  @override
  State<DieselMaintenanceScreen> createState() => _DieselMaintenanceScreenState();
}

class _DieselMaintenanceScreenState extends State<DieselMaintenanceScreen> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF4C1D95);

  static const _processes = [
    'Fabrication', 'Fabrication Testing', 'Moulding', 'Spinning',
    'Demoulding', 'Curing 1', 'Winding', 'Coating', 'Final Testing',
    'General / Other',
  ];

  static const _productionProcesses = {
    'Fabrication', 'Moulding', 'Spinning', 'Demoulding',
    'Curing 1', 'Winding', 'Coating',
  };
  static const _testingProcesses = {'Fabrication Testing', 'Final Testing'};

  bool _loadingData = true;
  List<Map<String, dynamic>> _items = [];

  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  String _activeTab      = 'all';
  bool   _searchExpanded = false;
  String _search         = '';
  final  _searchCtrl     = TextEditingController();

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _load();
  }

  @override
  void dispose() {
    _closeDateOverlay();
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
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  List<Map<String, dynamic>> get _filtered {
    return _items.where((e) {
      final process = (e['process'] ?? '').toString();
      if (_activeTab == 'production' && !_productionProcesses.contains(process)) return false;
      if (_activeTab == 'testing'    && !_testingProcesses.contains(process))    return false;
      if (_activeTab == 'general'    && process != 'General / Other')             return false;
      if (_search.trim().isNotEmpty) {
        final q = _search.toLowerCase();
        return process.toLowerCase().contains(q) ||
               (e['notes'] ?? '').toString().toLowerCase().contains(q);
      }
      return true;
    }).toList();
  }

  String _fmtIso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loadingData = true);
    try {
      final data = await ApiService().getDieselEntries(from: _fmtIso(_from), to: _fmtIso(_to));
      if (mounted) setState(() => _items = data.cast<Map<String, dynamic>>());
    } catch (_) {}
    if (mounted) setState(() => _loadingData = false);
  }

  static int _toI(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  void _showAddEdit([Map<String, dynamic>? editing]) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DieselSheet(
        initial: editing,
        processes: _processes,
        onSubmit: (data) async {
          if (editing != null) {
            await ApiService().updateDieselEntry(_toI(editing['id']), data);
          } else {
            await ApiService().createDieselEntry(data);
          }
          _load();
        },
      ),
    );
  }

  Future<void> _delete(int id, String date, String process) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Entry'),
        content: Text('Delete diesel entry for $process on $date?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true),  child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (ok == true) {
      await ApiService().deleteDieselEntry(id);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _filtered;
    final total = items.fold(0.0, (s, e) => s + _toD(e['quantity']));

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      bottomNavigationBar: _buildFloatingNav(),
      body: _loadingData
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 106,
                  toolbarHeight: 46,
                  backgroundColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  scrolledUnderElevation: 0,
                  flexibleSpace: FlexibleSpaceBar(
                    collapseMode: CollapseMode.pin,
                    background: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF6D28D9), _color, _colorDark],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Stack(children: [
                        Positioned(
                          right: -24, top: -24,
                          child: Container(
                            width: 110, height: 110,
                            decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.06)),
                          ),
                        ),
                        Align(
                          alignment: Alignment.bottomLeft,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(6, 0, 6, 10),
                            child: Row(children: [
                              _hStat('${items.length}', 'Entries'),
                              _hStat(total > 0 ? '${total.toStringAsFixed(1)}L' : '—', 'Total Diesel'),
                            ]),
                          ),
                        ),
                      ]),
                    ),
                  ),
                  title: const Text('Diesel Maintenance',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white)),
                  actions: [
                    IconButton(
                      icon: const Icon(Icons.add, color: Colors.white),
                      onPressed: () => _showAddEdit(),
                      tooltip: 'Add Entry',
                    ),
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                            const SizedBox(width: 5),
                            Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                            const SizedBox(width: 3),
                            const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                          ]),
                        ),
                      ),
                    ),
                  ],
                ),

                if (items.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.local_gas_station_outlined, size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No diesel entries found', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  )
                else ...[
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _DieselCard(
                          entry: items[i],
                          onEdit:   () => _showAddEdit(items[i]),
                          onDelete: () => _delete(
                            _toI(items[i]['id']),
                            items[i]['date']?.toString() ?? '',
                            items[i]['process']?.toString() ?? '',
                          ),
                        ),
                        childCount: items.length,
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Container(
                      margin: const EdgeInsets.fromLTRB(12, 4, 12, 100),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(colors: [Color(0xFF6D28D9), _color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(children: [
                        const Text('Total', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white70)),
                        const Spacer(),
                        Text('${total.toStringAsFixed(2)} L',
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
                      ]),
                    ),
                  ),
                ],
              ]),
            ),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );

  Widget _buildFloatingNav() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.10), blurRadius: 20, offset: const Offset(0, 4))],
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 260),
            child: _searchExpanded ? _buildSearchExpanded() : _buildNavItems(),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchExpanded() => Row(
    key: const ValueKey('search'),
    children: [
      Container(
        margin: const EdgeInsets.all(8),
        width: 48, height: 48,
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [_color, _colorDark]),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.search, color: Colors.white, size: 20),
      ),
      Expanded(
        child: TextField(
          controller: _searchCtrl,
          autofocus: true,
          decoration: const InputDecoration(hintText: 'Search process or notes…', border: InputBorder.none, isDense: true),
          style: const TextStyle(fontSize: 14),
          onChanged: (v) => setState(() => _search = v),
        ),
      ),
      GestureDetector(
        onTap: () => setState(() { _searchExpanded = false; _search = ''; _searchCtrl.clear(); }),
        child: Container(
          margin: const EdgeInsets.all(8),
          width: 40, height: 40,
          decoration: BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
          child: Icon(Icons.close, size: 18, color: Colors.grey.shade500),
        ),
      ),
    ],
  );

  Widget _buildNavItems() => Row(
    key: const ValueKey('nav'),
    children: [
      _navItem(Icons.search, 'Search', '', onTap: () => setState(() => _searchExpanded = true)),
      _navItem(Icons.list_outlined, 'All', 'all'),
      _navItem(Icons.factory_outlined, 'Production', 'production'),
      _navItem(Icons.science_outlined, 'Testing', 'testing'),
      _navItem(Icons.miscellaneous_services_outlined, 'General', 'general'),
    ],
  );

  Widget _navItem(IconData icon, String label, String tab, {VoidCallback? onTap}) {
    final active = tab.isNotEmpty && _activeTab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: onTap ?? () => setState(() => _activeTab = tab),
        child: Container(
          margin: const EdgeInsets.all(6),
          decoration: active
              ? BoxDecoration(
                  gradient: const LinearGradient(colors: [_color, _colorDark]),
                  borderRadius: BorderRadius.circular(26),
                )
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 20, color: active ? Colors.white : Colors.grey.shade500),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600,
                color: active ? Colors.white : Colors.grey.shade500)),
          ]),
        ),
      ),
    );
  }
}

// ── Diesel Card ───────────────────────────────────────────────────────────────

class _DieselCard extends StatelessWidget {
  final Map<String, dynamic> entry;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _DieselCard({required this.entry, required this.onEdit, required this.onDelete});

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    try { return DateFormat('dd MMM yyyy').format(DateTime.parse(s.substring(0, 10))); }
    catch (_) { return s; }
  }

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  @override
  Widget build(BuildContext context) {
    final date    = entry['date']?.toString()    ?? '';
    final process = entry['process']?.toString() ?? '';
    final qty     = _toD(entry['quantity']);
    final notes   = entry['notes']?.toString()   ?? '';

    return Container(
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
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            const Icon(Icons.local_gas_station_outlined, color: Color(0xFFE11D48), size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(process.isEmpty ? '—' : process,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                    maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Row(children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFFFF1F2), borderRadius: BorderRadius.circular(4)),
                    child: Text('Diesel', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFFBE123C))),
                  ),
                  const SizedBox(width: 6),
                  Text(_fmtDate(date), style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                ]),
              ]),
            ),
            RichText(text: TextSpan(
              children: [
                TextSpan(text: qty.toStringAsFixed(2), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
                const TextSpan(text: ' L', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF94A3B8))),
              ],
            )),
            const SizedBox(width: 4),
            Row(mainAxisSize: MainAxisSize.min, children: [
              IconButton(onPressed: onEdit,   icon: const Icon(Icons.edit_outlined,  size: 18, color: Color(0xFF94A3B8)), padding: const EdgeInsets.all(4), constraints: const BoxConstraints()),
              IconButton(onPressed: onDelete, icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFF94A3B8)), padding: const EdgeInsets.all(4), constraints: const BoxConstraints()),
            ]),
          ]),
          if (notes.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(notes, style: TextStyle(fontSize: 12, color: Colors.grey.shade600), maxLines: 2, overflow: TextOverflow.ellipsis),
          ],
        ]),
      ),
    );
  }
}

// ── Diesel Sheet ──────────────────────────────────────────────────────────────

class _DieselSheet extends StatefulWidget {
  final Map<String, dynamic>? initial;
  final List<String> processes;
  final Future<void> Function(Map<String, dynamic>) onSubmit;

  const _DieselSheet({this.initial, required this.processes, required this.onSubmit});

  @override
  State<_DieselSheet> createState() => _DieselSheetState();
}

class _DieselSheetState extends State<_DieselSheet> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF2563EB);

  late DateTime _date;
  String _process = '';
  final _qtyCtrl   = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _submitting = false;
  String? _errProcess, _errQty;

  bool get _isEdit => widget.initial != null;

  static double _toD(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  @override
  void initState() {
    super.initState();
    final e = widget.initial;
    _date = e != null && (e['date']?.toString().length ?? 0) >= 10
        ? DateTime.tryParse(e['date'].toString().substring(0, 10)) ?? DateTime.now()
        : DateTime.now();
    if (e != null) {
      _process        = e['process']?.toString() ?? '';
      final qty = _toD(e['quantity']);
      _qtyCtrl.text   = qty > 0 ? qty.toStringAsFixed(2) : '';
      _notesCtrl.text = e['notes']?.toString() ?? '';
    }
  }

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final qty = double.tryParse(_qtyCtrl.text.trim());
    setState(() {
      _errProcess = _process.isEmpty ? 'Select a production process' : null;
      _errQty     = (qty == null || qty <= 0) ? 'Enter a valid quantity' : null;
    });
    if (_errProcess != null || _errQty != null) return;

    setState(() => _submitting = true);
    try {
      await widget.onSubmit({
        'date':     DateFormat('yyyy-MM-dd').format(_date),
        'process':  _process,
        'quantity': qty.toString(),
        'notes':    _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (_) {
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFF6D28D9), _color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
            child: Row(children: [
              const Icon(Icons.local_gas_station_outlined, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Text(_isEdit ? 'Edit Diesel Entry' : 'Add Diesel Entry',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 30, height: 30,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(15)),
                  child: const Icon(Icons.close, color: Colors.white, size: 16),
                ),
              ),
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                const Text('Date', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now());
                    if (d != null) setState(() => _date = d);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
                    child: Row(children: [
                      const Icon(Icons.calendar_today_outlined, size: 16, color: Color(0xFF64748B)),
                      const SizedBox(width: 8),
                      Text(DateFormat('dd MMM yyyy').format(_date), style: const TextStyle(fontSize: 14)),
                    ]),
                  ),
                ),
                const SizedBox(height: 14),

                const Text('Production Process*', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: _errProcess != null ? Colors.red : Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _process.isEmpty ? null : _process,
                      hint: const Padding(padding: EdgeInsets.symmetric(horizontal: 12), child: Text('Select a process…', style: TextStyle(fontSize: 13, color: Colors.grey))),
                      isExpanded: true,
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      borderRadius: BorderRadius.circular(10),
                      items: widget.processes.map((p) => DropdownMenuItem(value: p, child: Text(p, style: const TextStyle(fontSize: 13)))).toList(),
                      onChanged: (v) { if (v != null) setState(() { _process = v; _errProcess = null; }); },
                    ),
                  ),
                ),
                if (_errProcess != null) ...[
                  const SizedBox(height: 4),
                  Text(_errProcess!, style: const TextStyle(fontSize: 11, color: Colors.red)),
                ],
                const SizedBox(height: 14),

                const Text('Quantity (Litres)*', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                TextField(
                  controller: _qtyCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(fontSize: 14),
                  onChanged: (_) => setState(() => _errQty = null),
                  decoration: InputDecoration(
                    hintText: 'e.g. 50',
                    suffixText: 'L',
                    suffixStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF94A3B8)),
                    errorText: _errQty,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 14),

                const Text('Notes (optional)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                const SizedBox(height: 6),
                TextField(
                  controller: _notesCtrl,
                  maxLines: 3,
                  style: const TextStyle(fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Optional notes…',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 20),

                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    onPressed: _submitting ? null : _submit,
                    style: FilledButton.styleFrom(backgroundColor: _color, padding: const EdgeInsets.symmetric(vertical: 14)),
                    icon: _submitting
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Icons.check_circle_outline),
                    label: Text(_submitting ? 'Saving…' : _isEdit ? 'Save Changes' : 'Add Entry'),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

// ─── Transport Report Screen ──────────────────────────────────────────────────

enum _TransportTab { transporter, customer, trips }

class _TripData {
  final int id;
  final String date, pipeName, vehicleNo, driverName, driverContact;
  final String vendor, siteAddress, transportRate, rateType, notes;
  final int quantity;
  final double totalAmount;

  const _TripData({
    required this.id, required this.date, required this.pipeName,
    required this.vehicleNo, required this.driverName, required this.driverContact,
    required this.vendor, required this.siteAddress, required this.transportRate,
    required this.rateType, required this.notes, required this.quantity,
    required this.totalAmount,
  });

  static int _i(dynamic v) {
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v?.toString() ?? '') ?? 0;
  }

  static double _compute(int qty, String rate, String rt) {
    final r = double.tryParse(rate) ?? 0;
    return rt == 'per_trip' ? r : qty * r;
  }

  factory _TripData.fromMap(Map<String, dynamic> m) {
    final qty  = _i(m['quantity']);
    final rate = m['transportRate']?.toString() ?? '';
    final rt   = m['rateType']?.toString() ?? 'per_pipe';
    return _TripData(
      id:            _i(m['id']),
      date:          m['date']?.toString() ?? '',
      pipeName:      m['pipeName']?.toString() ?? '',
      vehicleNo:     m['vehicleNo']?.toString() ?? '',
      driverName:    m['driverName']?.toString() ?? '',
      driverContact: m['driverContact']?.toString() ?? '',
      vendor:        m['vendor']?.toString() ?? '',
      siteAddress:   m['siteAddress']?.toString() ?? '',
      transportRate: rate,
      rateType:      rt,
      notes:         m['notes']?.toString() ?? '',
      quantity:      qty,
      totalAmount:   _compute(qty, rate, rt),
    );
  }
}

class TransportReportScreen extends StatefulWidget {
  const TransportReportScreen({super.key});
  @override
  State<TransportReportScreen> createState() => _TransportReportScreenState();
}

class _TransportReportScreenState extends State<TransportReportScreen> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF4C1D95);

  bool _loading = true;
  List<_TripData> _trips = [];
  _TransportTab _tab = _TransportTab.transporter;

  String _search = '';
  String _vendorFilter = '';
  final _searchCtrl = TextEditingController();
  bool _searchExpanded = false;

  // date filter
  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  // expanded sets
  final _expandedVendors   = <String>{};
  final _expandedSites     = <String>{};
  final _expandedTrips     = <int>{};

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _load();
  }

  @override
  void dispose() {
    _closeDateOverlay();
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
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmtIso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getLoadingRecords(from: _fmtIso(_from), to: _fmtIso(_to), size: 1000);
      final trips = raw.cast<Map<String, dynamic>>().map(_TripData.fromMap).toList();
      trips.sort((a, b) => b.date.compareTo(a.date));
      if (mounted) {
        setState(() { _trips = trips; });
        // auto-expand all
        _expandedVendors
          ..clear()
          ..addAll(_vendorSummaries.map((v) => v.$1));
        _expandedSites
          ..clear()
          ..addAll(_siteSummaries.map((s) => s.$1));
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<_TripData> get _filtered {
    var list = _trips;
    if (_vendorFilter.isNotEmpty) {
      list = list.where((t) => t.vendor.toLowerCase() == _vendorFilter.toLowerCase()).toList();
    }
    if (_search.trim().isNotEmpty) {
      final q = _search.toLowerCase();
      list = list.where((t) =>
        t.pipeName.toLowerCase().contains(q) ||
        t.vehicleNo.toLowerCase().contains(q) ||
        t.driverName.toLowerCase().contains(q) ||
        t.vendor.toLowerCase().contains(q) ||
        t.siteAddress.toLowerCase().contains(q)
      ).toList();
    }
    return list;
  }

  // Vendor summaries: (vendor, trips, totalPipes, totalAmount, trucks, siteCount)
  List<(String, List<_TripData>, int, double, int, int)> get _vendorSummaries {
    final map = <String, List<_TripData>>{};
    for (final t in _filtered) {
      (map[t.vendor.isEmpty ? 'Unknown' : t.vendor] ??= []).add(t);
    }
    return map.entries.map((e) {
      final trips = e.value;
      final totalPipes  = trips.fold(0,   (s, t) => s + t.quantity);
      final totalAmount = trips.fold(0.0, (s, t) => s + t.totalAmount);
      final trucks = trips.map((t) => t.vehicleNo).where((v) => v.isNotEmpty).toSet().length;
      final sites  = trips.map((t) => t.siteAddress).where((s) => s.isNotEmpty).toSet().length;
      return (e.key, trips, totalPipes, totalAmount, trucks, sites);
    }).toList()
      ..sort((a, b) => b.$4.compareTo(a.$4));
  }

  // Site summaries: (site, trips, totalPipes, totalAmount, vendors, pipeTypes)
  List<(String, List<_TripData>, int, double, Set<String>, Set<String>)> get _siteSummaries {
    final map = <String, List<_TripData>>{};
    for (final t in _filtered) {
      (map[t.siteAddress.isEmpty ? 'Unknown Site' : t.siteAddress] ??= []).add(t);
    }
    return map.entries.map((e) {
      final trips       = e.value;
      final totalPipes  = trips.fold(0,   (s, t) => s + t.quantity);
      final totalAmount = trips.fold(0.0, (s, t) => s + t.totalAmount);
      final vendors     = trips.map((t) => t.vendor).where((v) => v.isNotEmpty).toSet();
      final pipeTypes   = trips.map((t) => t.pipeName).where((p) => p.isNotEmpty).toSet();
      return (e.key, trips, totalPipes, totalAmount, vendors, pipeTypes);
    }).toList()
      ..sort((a, b) => b.$3.compareTo(a.$3));
  }

  List<String> get _allVendors =>
    _trips.map((t) => t.vendor).where((v) => v.isNotEmpty).toSet().toList()..sort();

  double get _grandTotal    => _filtered.fold(0.0, (s, t) => s + t.totalAmount);
  int    get _grandPipes    => _filtered.fold(0,   (s, t) => s + t.quantity);
  double get _avgRate {
    final withRate = _filtered.where((t) => (double.tryParse(t.transportRate) ?? 0) > 0).toList();
    if (withRate.isEmpty) return 0;
    return withRate.fold(0.0, (s, t) => s + (double.tryParse(t.transportRate) ?? 0)) / withRate.length;
  }

  static String _fmtAmt(double v) {
    if (v == 0) return '—';
    if (v >= 10000000) return '₹${(v / 10000000).toStringAsFixed(2)}Cr';
    if (v >= 100000)   return '₹${(v / 100000).toStringAsFixed(2)}L';
    if (v >= 1000)     return '₹${(v / 1000).toStringAsFixed(1)}K';
    return '₹${v.toStringAsFixed(2)}';
  }

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    try { return DateFormat('dd MMM yyyy').format(DateTime.parse(s.substring(0, 10))); }
    catch (_) { return s; }
  }

  void _openEdit(_TripData trip) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TransportEditSheet(
        trip: trip,
        onSubmit: (data) async {
          await ApiService().updateLoadingRecord(trip.id, data);
          _load();
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final total    = _grandTotal;
    final pipes    = _grandPipes;
    final avg      = _avgRate;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      bottomNavigationBar: _buildFloatingNav(),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(slivers: [
                // ── AppBar ──────────────────────────────────────────────────
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 130,
                  toolbarHeight: 46,
                  backgroundColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  scrolledUnderElevation: 0,
                  flexibleSpace: FlexibleSpaceBar(
                    collapseMode: CollapseMode.pin,
                    background: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF6D28D9), _color, _colorDark],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Stack(children: [
                        Positioned(
                          right: -24, top: -24,
                          child: Container(
                            width: 110, height: 110,
                            decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.06)),
                          ),
                        ),
                        Align(
                          alignment: Alignment.bottomLeft,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(6, 0, 6, 10),
                            child: Row(children: [
                              _hStat('${filtered.length}', 'Total Trips'),
                              _hStat('$pipes', 'Total Pipes'),
                              _hStat(total > 0 ? _fmtAmt(total) : '—', 'Total Payable'),
                              _hStat(avg > 0 ? '₹${avg.toStringAsFixed(0)}' : '—', 'Avg Rate'),
                            ]),
                          ),
                        ),
                      ]),
                    ),
                  ),
                  title: const Text('Transport Report',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white)),
                  actions: [
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                            const SizedBox(width: 5),
                            Text(_dateFilter.isActive ? _dateFilter.label : 'Filter by Date',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                            const SizedBox(width: 3),
                            const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                          ]),
                        ),
                      ),
                    ),
                  ],
                ),

                // ── Vendor filter chips ──────────────────────────────────────
                if (_allVendors.isNotEmpty)
                  SliverToBoxAdapter(
                    child: Container(
                      color: Colors.white,
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                      child: SizedBox(
                        height: 30,
                        child: ListView(scrollDirection: Axis.horizontal, children: [
                          _vendorChip('All', ''),
                          ..._allVendors.map((v) => _vendorChip(v, v)),
                        ]),
                      ),
                    ),
                  ),

                // ── Tab content ──────────────────────────────────────────────
                if (filtered.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.local_shipping_outlined, size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No transport records found', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                      ]),
                    ),
                  )
                else if (_tab == _TransportTab.transporter)
                  _buildTransporterTab()
                else if (_tab == _TransportTab.customer)
                  _buildCustomerTab()
                else
                  _buildAllTripsTab(),
              ]),
            ),
    );
  }

  Widget _buildFloatingNav() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.10), blurRadius: 20, offset: const Offset(0, 4))],
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 260),
            child: _searchExpanded ? _buildSearchExpanded() : _buildNavItems(),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchExpanded() => Row(
    key: const ValueKey('search'),
    children: [
      Container(
        margin: const EdgeInsets.all(8),
        width: 46, height: 46,
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [_color, _colorDark]),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.search, color: Colors.white, size: 20),
      ),
      Expanded(
        child: TextField(
          controller: _searchCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Search pipe, vehicle, driver, site…',
            hintStyle: TextStyle(fontSize: 13, color: Colors.grey),
            border: InputBorder.none,
          ),
          style: const TextStyle(fontSize: 14),
          onChanged: (v) => setState(() => _search = v),
        ),
      ),
      GestureDetector(
        onTap: () {
          _searchCtrl.clear();
          setState(() { _search = ''; _searchExpanded = false; });
        },
        child: Container(
          margin: const EdgeInsets.all(8),
          width: 46, height: 46,
          decoration: BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
          child: const Icon(Icons.close, size: 20, color: Colors.grey),
        ),
      ),
    ],
  );

  Widget _buildNavItems() => Row(
    key: const ValueKey('nav'),
    children: [
      _navItem(Icons.search,                 'Search',      null, onTap: () => setState(() => _searchExpanded = true)),
      _navItem(Icons.business_outlined,      'Transporter', _TransportTab.transporter),
      _navItem(Icons.location_on_outlined,   'Customer',    _TransportTab.customer),
      _navItem(Icons.local_shipping_outlined,'All Trips',   _TransportTab.trips),
    ],
  );

  Widget _navItem(IconData icon, String label, _TransportTab? tab, {VoidCallback? onTap}) {
    final active = tab != null && _tab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: onTap ?? () { if (tab != null) setState(() => _tab = tab); },
        child: Container(
          margin: const EdgeInsets.all(6),
          decoration: active
              ? BoxDecoration(
                  gradient: const LinearGradient(colors: [_color, _colorDark]),
                  borderRadius: BorderRadius.circular(26),
                )
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 20, color: active ? Colors.white : Colors.grey.shade500),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600,
                color: active ? Colors.white : Colors.grey.shade500)),
          ]),
        ),
      ),
    );
  }

  Widget _vendorChip(String label, String value) {
    final active = _vendorFilter == value;
    return GestureDetector(
      onTap: () => setState(() => _vendorFilter = value),
      child: Container(
        margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: active ? _color : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: active ? Colors.white : Colors.grey.shade600)),
      ),
    );
  }

  // ── Transporter Tab ──────────────────────────────────────────────────────────

  Widget _buildTransporterTab() {
    final summaries = _vendorSummaries;
    final grandTotal = _grandTotal;
    final grandPipes = _grandPipes;
    final filteredLen = _filtered.length;

    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 100),
      sliver: SliverList(
        delegate: SliverChildListDelegate([
          for (final vs in summaries) _buildVendorCard(vs),
          // Grand total footer
          if (summaries.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 4),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF6D28D9), _color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Grand Total Payable', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white70)),
                  const SizedBox(height: 2),
                  Text('$filteredLen trips · $grandPipes pipes', style: const TextStyle(fontSize: 10, color: Colors.white54)),
                ]),
                const Spacer(),
                Text(_fmtAmt(grandTotal), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
              ]),
            ),
        ]),
      ),
    );
  }

  Widget _buildVendorCard((String, List<_TripData>, int, double, int, int) vs) {
    final (vendor, trips, totalPipes, totalAmount, trucks, siteCount) = vs;
    final expanded = _expandedVendors.contains(vendor);

    // Group by truck
    final byTruck = <String, (int, int)>{};
    for (final t in trips) {
      final key = t.vehicleNo.isEmpty ? '—' : t.vehicleNo;
      final cur = byTruck[key] ?? (0, 0);
      byTruck[key] = (cur.$1 + 1, cur.$2 + t.quantity);
    }

    // Group by site
    final bySite = <String, List<_TripData>>{};
    for (final t in trips) {
      final key = t.siteAddress.isEmpty ? 'Unknown Site' : t.siteAddress;
      (bySite[key] ??= []).add(t);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.07), blurRadius: 12, offset: const Offset(0, 3))],
      ),
      clipBehavior: Clip.hardEdge,
      child: Column(children: [
        // Header
        GestureDetector(
          onTap: () => setState(() { expanded ? _expandedVendors.remove(vendor) : _expandedVendors.add(vendor); }),
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFFA78BFA), Color(0xFF818CF8)], begin: Alignment.topLeft, end: Alignment.bottomRight),
            ),
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.business_outlined, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(vendor, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white.withValues(alpha: 0.3))),
                      child: Text('${trips.length} trips', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.white)),
                    ),
                  ]),
                  const SizedBox(height: 4),
                  Row(children: [
                    Icon(Icons.local_shipping_outlined, size: 11, color: Colors.white.withValues(alpha: 0.7)),
                    const SizedBox(width: 3),
                    Text('$totalPipes pipes', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.7))),
                    const SizedBox(width: 10),
                    Icon(Icons.fire_truck_outlined, size: 11, color: Colors.white.withValues(alpha: 0.7)),
                    const SizedBox(width: 3),
                    Text('$trucks trucks', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.7))),
                    const SizedBox(width: 10),
                    Icon(Icons.location_on_outlined, size: 11, color: Colors.white.withValues(alpha: 0.7)),
                    const SizedBox(width: 3),
                    Text('$siteCount sites', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.7))),
                  ]),
                ]),
              ),
              const SizedBox(width: 8),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(_fmtAmt(totalAmount), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.white)),
                const SizedBox(height: 2),
                Text('total payable', style: TextStyle(fontSize: 9, color: Colors.white.withValues(alpha: 0.6))),
              ]),
              const SizedBox(width: 8),
              Icon(expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, color: Colors.white, size: 20),
            ]),
          ),
        ),

        if (expanded) ...[
          // Truck-wise chips
          Container(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 8),
            color: const Color(0xFFF5F3FF),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('TRUCK-WISE SUMMARY', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF7C3AED), letterSpacing: 1)),
              const SizedBox(height: 6),
              Wrap(spacing: 6, runSpacing: 6, children: byTruck.entries.map((e) => Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE9D5FF))),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(Icons.local_shipping_outlined, size: 12, color: Color(0xFF7C3AED)),
                  const SizedBox(width: 4),
                  Text(e.key, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
                  const SizedBox(width: 4),
                  Text('· ${e.value.$1} trips · ${e.value.$2} pipes', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                ]),
              )).toList()),
            ]),
          ),

          // Site breakdown
          for (final site in bySite.entries)
            _buildSiteBreakdown(site.key, site.value),

          // Sub-total
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFFE9D5FF), width: 2)),
              color: Color(0xFFF5F3FF),
            ),
            child: Row(children: [
              const Text('Sub-total', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              const Spacer(),
              Text('${trips.length} trips · $totalPipes pipes', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              const SizedBox(width: 12),
              Text(_fmtAmt(totalAmount), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
            ]),
          ),
        ],
      ]),
    );
  }

  Widget _buildSiteBreakdown(String site, List<_TripData> trips) {
    final totalPipes = trips.fold(0, (s, t) => s + t.quantity);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        color: const Color(0xFFEEF2FF),
        child: Row(children: [
          const Icon(Icons.location_on_outlined, size: 13, color: Color(0xFF4F46E5)),
          const SizedBox(width: 6),
          Expanded(child: Text(site, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)))),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: const Color(0xFFE0E7FF), borderRadius: BorderRadius.circular(8)),
            child: Text('${trips.length} trips', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF4F46E5))),
          ),
          const SizedBox(width: 8),
          Text('$totalPipes pipes', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF374151))),
        ]),
      ),
      for (final t in trips)
        Container(
          padding: const EdgeInsets.fromLTRB(14, 8, 14, 8),
          decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9)))),
          child: Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                  decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(4)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.local_shipping_outlined, size: 10, color: Color(0xFF64748B)),
                    const SizedBox(width: 3),
                    Text(t.vehicleNo.isEmpty ? '—' : t.vehicleNo, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF374151))),
                  ]),
                ),
                const SizedBox(width: 6),
                Expanded(child: Text(t.pipeName.isEmpty ? '—' : t.pipeName, style: const TextStyle(fontSize: 11, color: Color(0xFF374151)), maxLines: 1, overflow: TextOverflow.ellipsis)),
              ]),
              const SizedBox(height: 2),
              Text(_fmtDate(t.date), style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
            ])),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(4)),
              child: Text('${t.quantity}', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
            ),
          ]),
        ),
    ]);
  }

  // ── Customer Tab ──────────────────────────────────────────────────────────────

  Widget _buildCustomerTab() {
    final summaries   = _siteSummaries;
    final grandTotal  = _grandTotal;
    final grandPipes  = _grandPipes;
    final filteredLen = _filtered.length;

    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 100),
      sliver: SliverList(
        delegate: SliverChildListDelegate([
          for (final cs in summaries) _buildCustomerCard(cs),
          if (summaries.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 4),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF4F46E5), _color], begin: Alignment.topLeft, end: Alignment.bottomRight),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Grand Total Delivered', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.white70)),
                  const SizedBox(height: 2),
                  Text('$filteredLen trips · $grandPipes pipes', style: const TextStyle(fontSize: 10, color: Colors.white54)),
                ]),
                const Spacer(),
                Text(_fmtAmt(grandTotal), style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white)),
              ]),
            ),
        ]),
      ),
    );
  }

  Widget _buildCustomerCard((String, List<_TripData>, int, double, Set<String>, Set<String>) cs) {
    final (site, trips, totalPipes, totalAmount, vendors, pipeTypes) = cs;
    final expanded = _expandedSites.contains(site);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.07), blurRadius: 12, offset: const Offset(0, 3))],
      ),
      clipBehavior: Clip.hardEdge,
      child: Column(children: [
        GestureDetector(
          onTap: () => setState(() { expanded ? _expandedSites.remove(site) : _expandedSites.add(site); }),
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFFA78BFA), Color(0xFF818CF8)], begin: Alignment.topLeft, end: Alignment.bottomRight),
            ),
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Container(
                width: 40, height: 40,
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
                child: const Icon(Icons.location_on_outlined, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(child: Text(site, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white), maxLines: 2, overflow: TextOverflow.ellipsis)),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(10), border: Border.all(color: Colors.white.withValues(alpha: 0.3))),
                      child: Text('${trips.length} trips', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.white)),
                    ),
                  ]),
                  const SizedBox(height: 4),
                  Row(children: [
                    Icon(Icons.local_shipping_outlined, size: 11, color: Colors.white.withValues(alpha: 0.7)),
                    const SizedBox(width: 3),
                    Text('$totalPipes pipes', style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.7))),
                    const SizedBox(width: 10),
                    Icon(Icons.business_outlined, size: 11, color: Colors.white.withValues(alpha: 0.7)),
                    const SizedBox(width: 3),
                    Expanded(child: Text(vendors.take(2).join(', ') + (vendors.length > 2 ? '…' : ''), style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.7)), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ]),
                  if (pipeTypes.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Wrap(spacing: 4, runSpacing: 4, children: pipeTypes.take(3).map((pt) =>
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(4)),
                        child: Text(pt, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: Colors.white.withValues(alpha: 0.85))),
                      )
                    ).toList()),
                  ],
                ]),
              ),
              const SizedBox(width: 8),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text(_fmtAmt(totalAmount), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.white)),
                const SizedBox(height: 2),
                Text('total transport', style: TextStyle(fontSize: 9, color: Colors.white.withValues(alpha: 0.6))),
              ]),
              const SizedBox(width: 6),
              Icon(expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down, color: Colors.white, size: 20),
            ]),
          ),
        ),
        if (expanded) ...[
          for (final t in trips)
            _buildCustomerTripRow(t),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFFE0E7FF), width: 2)),
              color: Color(0xFFF0F4FF),
            ),
            child: Row(children: [
              const Text('Sub-total', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
              const Spacer(),
              Text('$totalPipes pipes', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
              const SizedBox(width: 12),
              Text(_fmtAmt(totalAmount), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
            ]),
          ),
        ],
      ]),
    );
  }

  Widget _buildCustomerTripRow(_TripData t) {
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
      decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9)))),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(_fmtDate(t.date), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
            const SizedBox(width: 8),
            Expanded(child: Text(t.pipeName.isEmpty ? '—' : t.pipeName, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)), maxLines: 1, overflow: TextOverflow.ellipsis)),
          ]),
          const SizedBox(height: 2),
          Row(children: [
            if (t.vendor.isNotEmpty) ...[
              const Icon(Icons.business_outlined, size: 10, color: Color(0xFF94A3B8)),
              const SizedBox(width: 3),
              Text(t.vendor, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
              const SizedBox(width: 8),
            ],
            if (t.vehicleNo.isNotEmpty) ...[
              const Icon(Icons.local_shipping_outlined, size: 10, color: Color(0xFF94A3B8)),
              const SizedBox(width: 3),
              Text(t.vehicleNo, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
            ],
          ]),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text('${t.quantity} pipes', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
          if (t.totalAmount > 0)
            Text(_fmtAmt(t.totalAmount), style: const TextStyle(fontSize: 11, color: Color(0xFF7C3AED))),
        ]),
        const SizedBox(width: 4),
        GestureDetector(
          onTap: () => _openEdit(t),
          child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.edit_outlined, size: 16, color: Color(0xFF94A3B8))),
        ),
      ]),
    );
  }

  // ── All Trips Tab ─────────────────────────────────────────────────────────────

  Widget _buildAllTripsTab() {
    final trips      = _filtered;
    final grandTotal = _grandTotal;
    final grandPipes = _grandPipes;

    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 100),
      sliver: SliverList(
        delegate: SliverChildListDelegate([
          // Header info
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(children: [
              Text('${trips.length} trip${trips.length != 1 ? 's' : ''} · $grandPipes pipes', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
              const Spacer(),
              Text(_fmtAmt(grandTotal), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF7C3AED))),
            ]),
          ),
          for (final t in trips) _buildTripCard(t),
        ]),
      ),
    );
  }

  Widget _buildTripCard(_TripData t) {
    final expanded = _expandedTrips.contains(t.id);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2))],
      ),
      clipBehavior: Clip.hardEdge,
      child: Column(children: [
        GestureDetector(
          onTap: () => setState(() { expanded ? _expandedTrips.remove(t.id) : _expandedTrips.add(t.id); }),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              // Expand toggle
              Container(
                width: 22, height: 22,
                decoration: BoxDecoration(
                  color: expanded ? _color : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Icon(expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_right, size: 14, color: expanded ? Colors.white : Colors.grey.shade400),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Text(_fmtDate(t.date), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                    const SizedBox(width: 8),
                    Expanded(child: Text(t.pipeName.isEmpty ? '—' : t.pipeName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)), maxLines: 1, overflow: TextOverflow.ellipsis)),
                  ]),
                  const SizedBox(height: 3),
                  Row(children: [
                    if (t.vehicleNo.isNotEmpty) ...[
                      const Icon(Icons.local_shipping_outlined, size: 11, color: Color(0xFF94A3B8)),
                      const SizedBox(width: 3),
                      Text(t.vehicleNo, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                      const SizedBox(width: 8),
                    ],
                    if (t.vendor.isNotEmpty) ...[
                      const Icon(Icons.business_outlined, size: 11, color: Color(0xFF94A3B8)),
                      const SizedBox(width: 3),
                      Expanded(child: Text(t.vendor, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)), maxLines: 1, overflow: TextOverflow.ellipsis)),
                    ],
                  ]),
                ]),
              ),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('${t.quantity} pipes', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
                if (t.totalAmount > 0)
                  Text(_fmtAmt(t.totalAmount), style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF7C3AED))),
              ]),
            ]),
          ),
        ),
        if (expanded) ...[
          Container(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFFF5F3FF), Color(0xFFEEF2FF)], begin: Alignment.topLeft, end: Alignment.bottomRight),
              border: Border(top: BorderSide(color: Color(0xFFE9D5FF))),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Details grid
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: _detailItem('Driver', t.driverName.isEmpty ? '—' : t.driverName, Icons.person_outlined)),
                Expanded(child: _detailItem('Contact', t.driverContact.isEmpty ? '—' : t.driverContact, Icons.phone_outlined)),
              ]),
              const SizedBox(height: 8),
              _detailItem('Site / Delivery Address', t.siteAddress.isEmpty ? '—' : t.siteAddress, Icons.location_on_outlined),
              const SizedBox(height: 8),
              Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Expanded(child: _detailItem(
                  'Amount Breakdown',
                  t.rateType == 'per_trip'
                      ? 'Fixed trip rate'
                      : '${t.quantity} pipes × ₹${t.transportRate.isEmpty ? '0' : t.transportRate}${t.totalAmount > 0 ? ' = ${_fmtAmt(t.totalAmount)}' : ''}',
                  Icons.currency_rupee,
                )),
                if (t.notes.isNotEmpty)
                  Expanded(child: _detailItem('Notes', t.notes, Icons.notes_outlined)),
              ]),
              const SizedBox(height: 10),
              GestureDetector(
                onTap: () => _openEdit(t),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: const Color(0xFFE9D5FF)),
                  ),
                  child: const Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.edit_outlined, size: 14, color: Color(0xFF7C3AED)),
                    SizedBox(width: 6),
                    Text('Edit Record', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF7C3AED))),
                  ]),
                ),
              ),
            ]),
          ),
        ],
      ]),
    );
  }

  Widget _detailItem(String label, String value, IconData icon) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Icon(icon, size: 10, color: const Color(0xFF7C3AED)),
        const SizedBox(width: 4),
        Text(label.toUpperCase(), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Color(0xFF7C3AED), letterSpacing: 0.8)),
      ]),
      const SizedBox(height: 3),
      Text(value, style: const TextStyle(fontSize: 12, color: Color(0xFF374151))),
    ]),
  );

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 8, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );
}

// ── Transport Edit Sheet ──────────────────────────────────────────────────────

class _TransportEditSheet extends StatefulWidget {
  final _TripData trip;
  final Future<void> Function(Map<String, dynamic>) onSubmit;

  const _TransportEditSheet({required this.trip, required this.onSubmit});

  @override
  State<_TransportEditSheet> createState() => _TransportEditSheetState();
}

class _TransportEditSheetState extends State<_TransportEditSheet> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF2563EB);

  late DateTime _date;
  final _pipeCtrl    = TextEditingController();
  final _qtyCtrl     = TextEditingController();
  final _vehicleCtrl = TextEditingController();
  final _vendorCtrl  = TextEditingController();
  final _driverCtrl  = TextEditingController();
  final _contactCtrl = TextEditingController();
  final _siteCtrl    = TextEditingController();
  final _rateCtrl    = TextEditingController();
  final _notesCtrl   = TextEditingController();
  String _rateType   = 'per_pipe';
  bool _submitting   = false;

  @override
  void initState() {
    super.initState();
    final t = widget.trip;
    _date = t.date.length >= 10
        ? DateTime.tryParse(t.date.substring(0, 10)) ?? DateTime.now()
        : DateTime.now();
    _pipeCtrl.text    = t.pipeName;
    _qtyCtrl.text     = t.quantity > 0 ? t.quantity.toString() : '';
    _vehicleCtrl.text = t.vehicleNo;
    _vendorCtrl.text  = t.vendor;
    _driverCtrl.text  = t.driverName;
    _contactCtrl.text = t.driverContact;
    _siteCtrl.text    = t.siteAddress;
    _rateCtrl.text    = t.transportRate;
    _notesCtrl.text   = t.notes;
    _rateType         = t.rateType.isEmpty ? 'per_pipe' : t.rateType;
  }

  @override
  void dispose() {
    _pipeCtrl.dispose(); _qtyCtrl.dispose(); _vehicleCtrl.dispose();
    _vendorCtrl.dispose(); _driverCtrl.dispose(); _contactCtrl.dispose();
    _siteCtrl.dispose(); _rateCtrl.dispose(); _notesCtrl.dispose();
    super.dispose();
  }

  double get _previewTotal {
    final qty  = int.tryParse(_qtyCtrl.text.trim()) ?? 0;
    final rate = double.tryParse(_rateCtrl.text.trim()) ?? 0;
    return _rateType == 'per_trip' ? rate : qty * rate;
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await widget.onSubmit({
        'date':          DateFormat('yyyy-MM-dd').format(_date),
        'pipeName':      _pipeCtrl.text.trim(),
        'quantity':      int.tryParse(_qtyCtrl.text.trim()) ?? 0,
        'vehicleNo':     _vehicleCtrl.text.trim(),
        'vendor':        _vendorCtrl.text.trim(),
        'driverName':    _driverCtrl.text.trim(),
        'driverContact': _contactCtrl.text.trim(),
        'siteAddress':   _siteCtrl.text.trim(),
        'transportRate': _rateCtrl.text.trim(),
        'rateType':      _rateType,
        'notes':         _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (_) {
      setState(() => _submitting = false);
    }
  }

  Widget _field(String label, TextEditingController ctrl, {TextInputType? type, String? hint}) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
      const SizedBox(height: 4),
      TextField(
        controller: ctrl,
        keyboardType: type,
        style: const TextStyle(fontSize: 13),
        decoration: InputDecoration(
          hintText: hint,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          isDense: true,
        ),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final preview = _previewTotal;
    final qty     = int.tryParse(_qtyCtrl.text.trim()) ?? 0;
    final rate    = double.tryParse(_rateCtrl.text.trim()) ?? 0;

    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFF6D28D9), _color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
            child: Row(children: [
              const Icon(Icons.edit_outlined, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Edit Loading Record', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
                  Text('${widget.trip.pipeName} · ${DateFormat('dd MMM yyyy').format(_date)}',
                      style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.75))),
                ]),
              ),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 30, height: 30,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(15)),
                  child: const Icon(Icons.close, color: Colors.white, size: 16),
                ),
              ),
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Date + Qty + Vehicle
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Date', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                    const SizedBox(height: 4),
                    GestureDetector(
                      onTap: () async {
                        final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now().add(const Duration(days: 1)));
                        if (d != null) setState(() => _date = d);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                        decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
                        child: Row(children: [
                          const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF64748B)),
                          const SizedBox(width: 6),
                          Text(DateFormat('dd MMM yy').format(_date), style: const TextStyle(fontSize: 13)),
                        ]),
                      ),
                    ),
                  ])),
                  const SizedBox(width: 8),
                  Expanded(child: _field('Qty', _qtyCtrl, type: TextInputType.number)),
                  const SizedBox(width: 8),
                  Expanded(child: _field('Vehicle No', _vehicleCtrl)),
                ]),
                const SizedBox(height: 12),

                _field('Pipe Name', _pipeCtrl),
                const SizedBox(height: 12),

                // Transport Rate — highlighted box
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF5F3FF),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE9D5FF), width: 1.5),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      const Text('TRANSPORT RATE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF7C3AED), letterSpacing: 0.8)),
                      const Spacer(),
                      // Rate type toggle
                      Container(
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(8), border: Border.all(color: const Color(0xFFE9D5FF))),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          for (final rt in [('per_pipe', '₹/Pipe'), ('per_trip', '₹/Trip')])
                            GestureDetector(
                              onTap: () => setState(() => _rateType = rt.$1),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                decoration: BoxDecoration(
                                  color: _rateType == rt.$1 ? _color : Colors.transparent,
                                  borderRadius: BorderRadius.circular(7),
                                ),
                                child: Text(rt.$2, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _rateType == rt.$1 ? Colors.white : Colors.grey.shade500)),
                              ),
                            ),
                        ]),
                      ),
                    ]),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _rateCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        prefixText: '₹ ',
                        hintText: '0.00',
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE9D5FF))),
                        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFDDD6FE))),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        isDense: true,
                      ),
                    ),
                    if (rate > 0) ...[
                      const SizedBox(height: 6),
                      Text(
                        _rateType == 'per_trip'
                            ? 'Trip total = ₹${preview.toStringAsFixed(2)}'
                            : '$qty pipes × ₹${_rateCtrl.text} = ₹${preview.toStringAsFixed(2)}',
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF374151)),
                      ),
                    ],
                  ]),
                ),
                const SizedBox(height: 12),

                _field('Vendor / Transporter', _vendorCtrl),
                const SizedBox(height: 12),

                Row(children: [
                  Expanded(child: _field('Driver Name', _driverCtrl)),
                  const SizedBox(width: 8),
                  Expanded(child: _field('Driver Contact', _contactCtrl, type: TextInputType.phone)),
                ]),
                const SizedBox(height: 12),

                _field('Site / Delivery Address', _siteCtrl),
                const SizedBox(height: 12),

                _field('Notes (optional)', _notesCtrl),
                const SizedBox(height: 20),

                Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13)),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: _submitting ? null : _submit,
                      style: FilledButton.styleFrom(backgroundColor: _color, padding: const EdgeInsets.symmetric(vertical: 13)),
                      icon: _submitting
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save_outlined, size: 16),
                      label: Text(_submitting ? 'Saving…' : 'Save Changes'),
                    ),
                  ),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

// ─── Discard Screen ───────────────────────────────────────────────────────────

class _DiscardData {
  final int id;
  final String date, process, pipeName, quantity, notes;

  const _DiscardData({
    required this.id, required this.date, required this.process,
    required this.pipeName, required this.quantity, required this.notes,
  });

  factory _DiscardData.fromMap(Map<String, dynamic> m) => _DiscardData(
    id:       m['id'] is int ? m['id'] : int.tryParse(m['id']?.toString() ?? '') ?? 0,
    date:     m['date']?.toString() ?? '',
    process:  m['process']?.toString() ?? '',
    pipeName: m['pipeName']?.toString() ?? '',
    quantity: m['quantity']?.toString() ?? '0',
    notes:    m['notes']?.toString() ?? '',
  );

  double get qty => double.tryParse(quantity) ?? 0;
}

class DiscardScreen extends StatefulWidget {
  const DiscardScreen({super.key});
  @override
  State<DiscardScreen> createState() => _DiscardScreenState();
}

class _DiscardScreenState extends State<DiscardScreen> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF4C1D95);
  static const _red       = Color(0xFFEF4444);

  static const _processes = [
    'Fabrication', 'Fabrication Testing', 'Moulding', 'Spinning',
    'Demoulding', 'Curing 1', 'Winding', 'Coating', 'Final Testing', 'General / Other',
  ];

  bool _loading = true;
  List<_DiscardData> _entries = [];
  List<String> _pipes = [];

  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = DateTime(_to.year, _to.month, 1);
    _load();
    _loadPipes();
  }

  @override
  void dispose() {
    _closeDateOverlay();
    super.dispose();
  }

  void _closeDateOverlay() {
    _dateOverlay?.remove();
    _dateOverlay = null;
  }

  void _toggleDateOverlay() {
    if (_dateOverlay != null) { _closeDateOverlay(); return; }
    final entry = OverlayEntry(
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime(_to.year, _to.month, 1);
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmtIso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getDiscardEntries(from: _fmtIso(_from), to: _fmtIso(_to));
      final entries = raw.cast<Map<String, dynamic>>().map(_DiscardData.fromMap).toList();
      if (mounted) setState(() => _entries = entries);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadPipes() async {
    try {
      final raw = await ApiService().getPipeConfigs(size: 500);
      final names = raw.cast<Map<String, dynamic>>()
          .map((m) => m['name']?.toString() ?? '')
          .where((n) => n.isNotEmpty)
          .toList()
        ..sort();
      if (mounted) setState(() => _pipes = names);
    } catch (_) {}
  }

  double get _totalQty => _entries.fold(0.0, (s, e) => s + e.qty);

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    try { return DateFormat('dd MMM yyyy').format(DateTime.parse(s.substring(0, 10))); }
    catch (_) { return s; }
  }

  void _openAdd() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DiscardSheet(
        pipes: _pipes,
        onSubmit: (data) async {
          final created = await ApiService().createDiscardEntry(data);
          final entry = _DiscardData.fromMap(created);
          setState(() => _entries = [entry, ..._entries]);
        },
      ),
    );
  }

  void _openEdit(_DiscardData entry) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _DiscardSheet(
        initial: entry,
        pipes: _pipes,
        onSubmit: (data) async {
          final updated = await ApiService().updateDiscardEntry(entry.id, data);
          final e = _DiscardData.fromMap(updated);
          setState(() => _entries = _entries.map((x) => x.id == entry.id ? e : x).toList());
        },
      ),
    );
  }

  Future<void> _confirmDelete(_DiscardData entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Entry', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        content: Text('Delete discard entry for ${entry.pipeName} on ${_fmtDate(entry.date)}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: _red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await ApiService().deleteDiscardEntry(entry.id);
      setState(() => _entries = _entries.where((x) => x.id != entry.id).toList());
    }
  }

  @override
  Widget build(BuildContext context) {
    final totalQty = _totalQty;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      floatingActionButton: FloatingActionButton(
        onPressed: _openAdd,
        backgroundColor: _color,
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(slivers: [
                // ── AppBar ──────────────────────────────────────────────────
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 106,
                  toolbarHeight: 46,
                  backgroundColor: Colors.transparent,
                  foregroundColor: Colors.white,
                  elevation: 0,
                  scrolledUnderElevation: 0,
                  flexibleSpace: FlexibleSpaceBar(
                    collapseMode: CollapseMode.pin,
                    background: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFF6D28D9), _color, _colorDark],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: Stack(children: [
                        Positioned(
                          right: -24, top: -24,
                          child: Container(
                            width: 110, height: 110,
                            decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.06)),
                          ),
                        ),
                        // Stats strip
                        Align(
                          alignment: Alignment.bottomLeft,
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(6, 0, 6, 10),
                            child: Row(children: [
                              _hStat('${_entries.length}', 'Entries'),
                              _hStat(totalQty > 0 ? totalQty.toStringAsFixed(0) : '—', 'Total Discarded'),
                              _hStat(
                                _entries.map((e) => e.pipeName).toSet().length.toString(),
                                'Pipe Types',
                              ),
                              _hStat(
                                _entries.map((e) => e.process).toSet().length.toString(),
                                'Processes',
                              ),
                            ]),
                          ),
                        ),
                      ]),
                    ),
                  ),
                  title: Row(children: [
                    const Icon(Icons.delete_outline, size: 18, color: Color(0xFFFCA5A5)),
                    const SizedBox(width: 6),
                    const Text('Discard', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white)),
                  ]),
                  actions: [
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                            const SizedBox(width: 5),
                            Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                            const SizedBox(width: 3),
                            const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                          ]),
                        ),
                      ),
                    ),
                  ],
                ),

                // ── List ──────────────────────────────────────────────────────
                if (_entries.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.delete_outline, size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No discard entries found', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text('Tap + to add an entry', style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
                      ]),
                    ),
                  )
                else ...[
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
                    sliver: SliverToBoxAdapter(
                      child: Row(children: [
                        Text('${_entries.length} entr${_entries.length != 1 ? 'ies' : 'y'}', style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                        const Spacer(),
                        if (totalQty > 0)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(20)),
                            child: Text('Total: ${totalQty.toStringAsFixed(0)} pipes discarded',
                                style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: _red)),
                          ),
                      ]),
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 100),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _buildCard(_entries[i]),
                        childCount: _entries.length,
                      ),
                    ),
                  ),
                ],
              ]),
            ),
    );
  }

  Widget _buildCard(_DiscardData e) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          // Left — trash icon
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(color: const Color(0xFFFEE2E2), borderRadius: BorderRadius.circular(10)),
            child: const Icon(Icons.delete_outline, size: 18, color: _red),
          ),
          const SizedBox(width: 10),
          // Middle — details
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(e.pipeName.isEmpty ? '—' : e.pipeName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)), maxLines: 1, overflow: TextOverflow.ellipsis)),
                const SizedBox(width: 6),
                // Process badge (amber)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(8)),
                  child: Text(e.process.isEmpty ? '—' : e.process, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFFB45309))),
                ),
              ]),
              const SizedBox(height: 3),
              Row(children: [
                const Icon(Icons.calendar_today_outlined, size: 10, color: Color(0xFF94A3B8)),
                const SizedBox(width: 3),
                Text(_fmtDate(e.date), style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                if (e.notes.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  const Icon(Icons.notes_outlined, size: 10, color: Color(0xFF94A3B8)),
                  const SizedBox(width: 3),
                  Expanded(child: Text(e.notes, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)), maxLines: 1, overflow: TextOverflow.ellipsis)),
                ],
              ]),
            ]),
          ),
          const SizedBox(width: 8),
          // Right — quantity
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(e.qty.toStringAsFixed(0), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: _red)),
            const Text('pipes', style: TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
          ]),
          const SizedBox(width: 8),
          // Action icons
          Column(children: [
            GestureDetector(
              onTap: () => _openEdit(e),
              child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.edit_outlined, size: 16, color: Color(0xFF94A3B8))),
            ),
            GestureDetector(
              onTap: () => _confirmDelete(e),
              child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.delete_outline, size: 16, color: Color(0xFF94A3B8))),
            ),
          ]),
        ]),
      ),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 8, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );
}

// ─── Discard Sheet ─────────────────────────────────────────────────────────────

class _DiscardSheet extends StatefulWidget {
  final _DiscardData? initial;
  final List<String> pipes;
  final Future<void> Function(Map<String, dynamic>) onSubmit;

  const _DiscardSheet({this.initial, required this.pipes, required this.onSubmit});

  @override
  State<_DiscardSheet> createState() => _DiscardSheetState();
}

class _DiscardSheetState extends State<_DiscardSheet> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF2563EB);
  static const _red       = Color(0xFFEF4444);

  static const _processes = [
    'Fabrication', 'Fabrication Testing', 'Moulding', 'Spinning',
    'Demoulding', 'Curing 1', 'Winding', 'Coating', 'Final Testing', 'General / Other',
  ];

  late DateTime _date;
  String _process  = '';
  String _pipeName = '';
  final _pipeCtrl  = TextEditingController();
  final _qtyCtrl   = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _submitting = false;
  bool _showPipeSuggestions = false;

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    _date    = init != null && init.date.length >= 10
        ? DateTime.tryParse(init.date.substring(0, 10)) ?? DateTime.now()
        : DateTime.now();
    _process        = init?.process  ?? '';
    _pipeName       = init?.pipeName ?? '';
    _pipeCtrl.text  = _pipeName;
    _qtyCtrl.text   = init != null && init.quantity != '0' ? init.quantity : '';
    _notesCtrl.text = init?.notes ?? '';
  }

  @override
  void dispose() {
    _pipeCtrl.dispose(); _qtyCtrl.dispose(); _notesCtrl.dispose();
    super.dispose();
  }

  List<String> get _pipeSuggestions {
    final q = _pipeCtrl.text.toLowerCase();
    if (q.isEmpty) return widget.pipes;
    return widget.pipes.where((p) => p.toLowerCase().contains(q)).toList();
  }

  Future<void> _submit() async {
    if (_date == null) return;
    if (_process.isEmpty) { _showSnack('Please select a process'); return; }
    if (_pipeCtrl.text.trim().isEmpty) { _showSnack('Please enter a pipe name'); return; }
    final qty = double.tryParse(_qtyCtrl.text.trim()) ?? 0;
    if (qty <= 0) { _showSnack('Please enter a valid quantity'); return; }

    setState(() => _submitting = true);
    try {
      await widget.onSubmit({
        'date':     DateFormat('yyyy-MM-dd').format(_date),
        'process':  _process,
        'pipeName': _pipeCtrl.text.trim(),
        'quantity': _qtyCtrl.text.trim(),
        'notes':    _notesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (_) {
      setState(() => _submitting = false);
    }
  }

  void _showSnack(String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), duration: const Duration(seconds: 2)));

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Header
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFF6D28D9), _color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
            child: Row(children: [
              const Icon(Icons.delete_outline, color: Color(0xFFFCA5A5), size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(widget.initial == null ? 'Add Discard Entry' : 'Edit Discard Entry',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 30, height: 30,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(15)),
                  child: const Icon(Icons.close, color: Colors.white, size: 16),
                ),
              ),
            ]),
          ),

          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Date
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('DATE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.5)),
                    const SizedBox(height: 6),
                    GestureDetector(
                      onTap: () async {
                        final d = await showDatePicker(
                          context: context,
                          initialDate: _date,
                          firstDate: DateTime(2020),
                          lastDate: DateTime.now().add(const Duration(days: 1)),
                        );
                        if (d != null) setState(() => _date = d);
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                        decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
                        child: Row(children: [
                          const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF64748B)),
                          const SizedBox(width: 6),
                          Text(DateFormat('dd MMM yyyy').format(_date), style: const TextStyle(fontSize: 13)),
                        ]),
                      ),
                    ),
                  ])),
                ]),
                const SizedBox(height: 14),

                // Process
                const Text('PROCESS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.5)),
                const SizedBox(height: 6),
                Wrap(spacing: 6, runSpacing: 6, children: _processes.map((p) {
                  final sel = _process == p;
                  return GestureDetector(
                    onTap: () => setState(() => _process = p),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: sel ? const Color(0xFFFEF3C7) : Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: sel ? const Color(0xFFD97706) : Colors.transparent, width: 1.5),
                      ),
                      child: Text(p, style: TextStyle(fontSize: 11, fontWeight: sel ? FontWeight.w700 : FontWeight.w500, color: sel ? const Color(0xFFB45309) : Colors.grey.shade600)),
                    ),
                  );
                }).toList()),
                const SizedBox(height: 14),

                // Pipe Name
                const Text('PIPE NAME', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.5)),
                const SizedBox(height: 6),
                TextField(
                  controller: _pipeCtrl,
                  style: const TextStyle(fontSize: 13),
                  onChanged: (_) => setState(() => _showPipeSuggestions = true),
                  onTap: ()    => setState(() => _showPipeSuggestions = true),
                  decoration: InputDecoration(
                    hintText: 'Search pipe name…',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    isDense: true,
                  ),
                ),
                if (_showPipeSuggestions && _pipeSuggestions.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Container(
                    constraints: const BoxConstraints(maxHeight: 160),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      border: Border.all(color: Colors.grey.shade200),
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 10)],
                    ),
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: _pipeSuggestions.length,
                      itemBuilder: (_, i) {
                        final p = _pipeSuggestions[i];
                        return GestureDetector(
                          onTap: () => setState(() {
                            _pipeCtrl.text = p;
                            _pipeName = p;
                            _showPipeSuggestions = false;
                          }),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            decoration: BoxDecoration(
                              border: i > 0 ? const Border(top: BorderSide(color: Color(0xFFF1F5F9))) : null,
                            ),
                            child: Text(p, style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B))),
                          ),
                        );
                      },
                    ),
                  ),
                ],
                const SizedBox(height: 14),

                // Quantity + Notes row
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('QUANTITY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.5)),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _qtyCtrl,
                        keyboardType: TextInputType.number,
                        style: const TextStyle(fontSize: 13),
                        decoration: InputDecoration(
                          hintText: '0',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          isDense: true,
                          suffixText: 'pipes',
                          suffixStyle: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                        ),
                      ),
                    ]),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('NOTES', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.5)),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _notesCtrl,
                        style: const TextStyle(fontSize: 13),
                        decoration: InputDecoration(
                          hintText: 'Optional…',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          isDense: true,
                        ),
                      ),
                    ]),
                  ),
                ]),
                const SizedBox(height: 20),

                Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13)),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: _submitting ? null : _submit,
                      style: FilledButton.styleFrom(backgroundColor: _color, padding: const EdgeInsets.symmetric(vertical: 13)),
                      icon: _submitting
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save_outlined, size: 16),
                      label: Text(_submitting ? 'Saving…' : widget.initial == null ? 'Add Entry' : 'Save Changes'),
                    ),
                  ),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

// ─── Extra Fab Screen ─────────────────────────────────────────────────────────

class _ExtraFabData {
  final int    id;
  final String date, vendorName, particular;
  final String rate, quantity, taxPercent, lineTotal;
  final String notes, invoiceNo, vehicleNo, invoiceData;
  final String subTotal, discountPercent, billPrice, taxable;
  final bool   gstInclusive;
  final String roundingOff, finalBill;

  const _ExtraFabData({
    required this.id, required this.date, required this.vendorName,
    required this.particular, required this.rate, required this.quantity,
    required this.taxPercent, required this.lineTotal,
    required this.notes, required this.invoiceNo, required this.vehicleNo,
    required this.invoiceData, required this.subTotal, required this.discountPercent,
    required this.billPrice, required this.taxable, required this.gstInclusive,
    required this.roundingOff, required this.finalBill,
  });

  factory _ExtraFabData.fromMap(Map<String, dynamic> m) => _ExtraFabData(
    id:              m['id'] is int ? m['id'] : int.tryParse(m['id']?.toString() ?? '') ?? 0,
    date:            m['date']?.toString() ?? '',
    vendorName:      m['vendorName']?.toString() ?? '',
    particular:      m['particular']?.toString() ?? 'Fabrication Charges',
    rate:            m['rate']?.toString() ?? '',
    quantity:        m['quantity']?.toString() ?? '',
    taxPercent:      m['taxPercent']?.toString() ?? '0',
    lineTotal:       m['lineTotal']?.toString() ?? '',
    notes:           m['notes']?.toString() ?? '',
    invoiceNo:       m['invoiceNo']?.toString() ?? '',
    vehicleNo:       m['vehicleNo']?.toString() ?? '',
    invoiceData:     m['invoiceData']?.toString() ?? '',
    subTotal:        m['subTotal']?.toString() ?? '',
    discountPercent: m['discountPercent']?.toString() ?? '0',
    billPrice:       m['billPrice']?.toString() ?? '',
    taxable:         m['taxable']?.toString() ?? '',
    gstInclusive:    m['gstInclusive'] == true || m['gstInclusive']?.toString() == 'true',
    roundingOff:     m['roundingOff']?.toString() ?? '0',
    finalBill:       m['finalBill']?.toString() ?? '',
  );

  double get finalBillAmt => double.tryParse(finalBill) ?? 0;
}

class ExtraFabScreen extends StatefulWidget {
  const ExtraFabScreen({super.key});
  @override
  State<ExtraFabScreen> createState() => _ExtraFabScreenState();
}

class _ExtraFabScreenState extends State<ExtraFabScreen> {
  static const _color    = Color(0xFFB45309);
  static const _colorDark = Color(0xFF92400E);
  static const _amber    = Color(0xFFD97706);
  static const _yellow   = Color(0xFFCA8A04);
  static const _amberBg  = Color(0xFFFEF3C7);

  bool _loading = true;
  List<_ExtraFabData> _entries = [];
  List<String> _vendors = [];

  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = DateTime(_to.year, _to.month, 1);
    _load();
    _loadOptions();
  }

  @override
  void dispose() {
    _closeDateOverlay();
    super.dispose();
  }

  void _closeDateOverlay() {
    _dateOverlay?.remove();
    _dateOverlay = null;
  }

  void _toggleDateOverlay() {
    if (_dateOverlay != null) { _closeDateOverlay(); return; }
    final entry = OverlayEntry(
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime(_to.year, _to.month, 1);
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmtIso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _load() async {
    if (!mounted) return;
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getExtraFabEntries(from: _fmtIso(_from), to: _fmtIso(_to));
      final entries = raw.cast<Map<String, dynamic>>().map(_ExtraFabData.fromMap).toList();
      if (mounted) setState(() => _entries = entries);
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadOptions() async {
    try {
      final vendors = await ApiService().getVendors();
      final names = vendors.map((v) => (v['name'] ?? v['vendorName'] ?? '').toString()).where((n) => n.isNotEmpty).toList()..sort();
      if (mounted) setState(() => _vendors = names);
    } catch (_) {}
  }

  double get _totalFinalBill => _entries.fold(0.0, (s, e) => s + e.finalBillAmt);

  static String _fmtAmt(double v) {
    if (v == 0) return '—';
    return '₹${v.toLocaleString()}';
  }

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    try { return DateFormat('dd MMM yyyy').format(DateTime.parse(s.substring(0, 10))); }
    catch (_) { return s; }
  }

  void _openAdd() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ExtraFabSheet(
        vendors: _vendors,
        onSubmit: (data) async {
          final created = await ApiService().createExtraFabEntry(data);
          final e = _ExtraFabData.fromMap(created);
          setState(() => _entries = [e, ..._entries]);
        },
      ),
    );
  }

  void _openEdit(_ExtraFabData entry) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ExtraFabSheet(
        initial: entry,
        vendors: _vendors,
        onSubmit: (data) async {
          final updated = await ApiService().updateExtraFabEntry(entry.id, data);
          final e = _ExtraFabData.fromMap(updated);
          setState(() => _entries = _entries.map((x) => x.id == entry.id ? e : x).toList());
        },
      ),
    );
  }

  Future<void> _confirmDelete(_ExtraFabData entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Delete Entry', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
        content: Text('Delete extra fab entry for ${entry.vendorName} on ${_fmtDate(entry.date)}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await ApiService().deleteExtraFabEntry(entry.id);
      setState(() => _entries = _entries.where((x) => x.id != entry.id).toList());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: CustomScrollView(slivers: [
                SliverAppBar(
                  pinned: true,
                  expandedHeight: 120,
                  backgroundColor: _color,
                  foregroundColor: Colors.white,
                  leading: context.canPop()
                      ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())
                      : IconButton(icon: const Icon(Icons.menu_outlined), onPressed: openAppDrawer, tooltip: 'Open menu'),
                  title: const Text('Extra Fabrication'),
                  actions: [
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                            const SizedBox(width: 5),
                            Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                                style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                            const SizedBox(width: 3),
                            const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                          ]),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.add, color: Colors.white),
                      onPressed: _openAdd,
                    ),
                    const SizedBox(width: 4),
                  ],
                  flexibleSpace: FlexibleSpaceBar(
                    background: Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [_color, _colorDark],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                      ),
                      child: SafeArea(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(6, 64, 6, 4),
                          child: Row(children: [
                            _hStat('${_entries.length}', 'Entries'),
                            _hStat(_totalFinalBill > 0 ? _fmtAmt(_totalFinalBill) : '—', 'Final Bill'),
                            _hStat(_entries.map((e) => e.vendorName).toSet().length.toString(), 'Vendors'),
                            _hStat(_entries.where((e) => e.gstInclusive).length.toString(), 'GST Bills'),
                          ]),
                        ),
                      ),
                    ),
                  ),
                ),

                if (_entries.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        Icon(Icons.hardware_outlined, size: 48, color: Colors.grey.shade300),
                        const SizedBox(height: 12),
                        Text('No extra fab entries found', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text('Tap + to add an entry', style: TextStyle(color: Colors.grey.shade400, fontSize: 12)),
                      ]),
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 12, 20),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (_, i) => _buildCard(_entries[i]),
                        childCount: _entries.length,
                      ),
                    ),
                  ),
              ]),
            ),
    );
  }

  Widget _buildCard(_ExtraFabData e) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2))],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(children: [
          Container(
            width: 38, height: 38,
            decoration: BoxDecoration(color: _amberBg, borderRadius: BorderRadius.circular(10)),
            child: Icon(Icons.hardware_outlined, size: 18, color: _amber),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text(e.vendorName.isEmpty ? '—' : e.vendorName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)), maxLines: 1, overflow: TextOverflow.ellipsis)),
                if (e.gstInclusive) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                    decoration: BoxDecoration(color: const Color(0xFFDCFCE7), borderRadius: BorderRadius.circular(8)),
                    child: const Text('GST', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF16A34A))),
                  ),
                ],
              ]),
              const SizedBox(height: 3),
              Row(children: [
                const Icon(Icons.calendar_today_outlined, size: 10, color: Color(0xFF94A3B8)),
                const SizedBox(width: 3),
                Text(_fmtDate(e.date), style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                if (e.invoiceNo.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  const Icon(Icons.receipt_outlined, size: 10, color: Color(0xFF94A3B8)),
                  const SizedBox(width: 3),
                  Text(e.invoiceNo, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
                ],
                if (e.vehicleNo.isNotEmpty) ...[
                  const SizedBox(width: 8),
                  Expanded(child: Text(e.vehicleNo, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8)), maxLines: 1, overflow: TextOverflow.ellipsis)),
                ],
              ]),
              if (e.quantity.isNotEmpty && e.quantity != '0') ...[
                const SizedBox(height: 2),
                Text('Qty: ${e.quantity} × ₹${e.rate} (Tax: ${e.taxPercent}%)', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
              ],
            ]),
          ),
          const SizedBox(width: 8),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(_fmtAmt(e.finalBillAmt), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: _yellow)),
            if (e.discountPercent.isNotEmpty && e.discountPercent != '0')
              Text('${e.discountPercent}% off', style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
          ]),
          const SizedBox(width: 8),
          Column(children: [
            GestureDetector(
              onTap: () => _openEdit(e),
              child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.edit_outlined, size: 16, color: Color(0xFF94A3B8))),
            ),
            GestureDetector(
              onTap: () => _confirmDelete(e),
              child: const Padding(padding: EdgeInsets.all(4), child: Icon(Icons.delete_outline, size: 16, color: Color(0xFF94A3B8))),
            ),
          ]),
        ]),
      ),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );
}

// ─── Extra Fab Sheet ──────────────────────────────────────────────────────────

class _ExtraFabSheet extends StatefulWidget {
  final _ExtraFabData? initial;
  final List<String> vendors;
  final Future<void> Function(Map<String, dynamic>) onSubmit;

  const _ExtraFabSheet({this.initial, required this.vendors, required this.onSubmit});

  @override
  State<_ExtraFabSheet> createState() => _ExtraFabSheetState();
}

class _ExtraFabSheetState extends State<_ExtraFabSheet> {
  static const _amber   = Color(0xFFD97706);
  static const _yellow  = Color(0xFFCA8A04);
  static const _amberBg = Color(0xFFFEF3C7);

  late DateTime _date;
  bool _gstInclusive       = false;
  bool _showVendorSugs     = false;
  bool _submitting         = false;

  final _particularCtrl    = TextEditingController();
  final _rateCtrl          = TextEditingController();
  final _qtyCtrl           = TextEditingController();
  final _taxCtrl           = TextEditingController();
  final _notesCtrl         = TextEditingController();
  final _invoiceCtrl       = TextEditingController();
  final _vehicleCtrl       = TextEditingController();
  final _invoiceDataCtrl   = TextEditingController();
  final _vendorCtrl        = TextEditingController();
  final _discountCtrl      = TextEditingController();
  final _roundingCtrl      = TextEditingController();

  // Computed values (updated via _recompute)
  String _lineTotal   = '';
  String _subTotal    = '';
  String _billPrice   = '';
  String _taxable     = '';
  String _finalBill   = '';

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    _date = init != null && init.date.length >= 10
        ? DateTime.tryParse(init.date.substring(0, 10)) ?? DateTime.now()
        : DateTime.now();
    _gstInclusive         = init?.gstInclusive ?? false;
    _particularCtrl.text  = init?.particular ?? 'Fabrication Charges';
    _rateCtrl.text        = (init?.rate.isNotEmpty == true && init?.rate != '0') ? init!.rate : '';
    _qtyCtrl.text         = (init?.quantity.isNotEmpty == true && init?.quantity != '0') ? init!.quantity : '';
    _taxCtrl.text         = init?.taxPercent ?? '0';
    _notesCtrl.text       = init?.notes ?? '';
    _invoiceCtrl.text     = init?.invoiceNo ?? '';
    _vehicleCtrl.text     = init?.vehicleNo ?? '';
    _invoiceDataCtrl.text = init?.invoiceData ?? '';
    _vendorCtrl.text      = init?.vendorName ?? '';
    _discountCtrl.text    = init?.discountPercent ?? '0';
    _roundingCtrl.text    = init?.roundingOff ?? '0';

    _recompute();
    for (final c in [_rateCtrl, _qtyCtrl, _taxCtrl, _discountCtrl, _roundingCtrl]) {
      c.addListener(_recompute);
    }
  }

  void _recompute() {
    final rate = double.tryParse(_rateCtrl.text.trim()) ?? 0;
    final qty  = double.tryParse(_qtyCtrl.text.trim()) ?? 0;
    final tax  = double.tryParse(_taxCtrl.text.trim()) ?? 0;
    final disc = double.tryParse(_discountCtrl.text.trim()) ?? 0;
    final rnd  = double.tryParse(_roundingCtrl.text.trim()) ?? 0;

    final lt  = rate > 0 && qty > 0 ? rate * qty * (1 + tax / 100) : 0.0;
    final sub = lt;
    final bp  = sub > 0 ? (sub - sub * disc / 100).clamp(0, double.infinity) : 0.0;
    final fb  = bp + rnd;

    setState(() {
      _lineTotal = lt > 0 ? lt.toStringAsFixed(2) : '';
      _subTotal  = sub > 0 ? sub.toStringAsFixed(2) : '';
      _billPrice = bp > 0 ? bp.toStringAsFixed(2) : '';
      _taxable   = bp > 0 ? bp.toStringAsFixed(2) : '';
      _finalBill = fb > 0 ? fb.toStringAsFixed(2) : '';
    });
  }

  @override
  void dispose() {
    for (final c in [_particularCtrl, _rateCtrl, _qtyCtrl, _taxCtrl, _notesCtrl,
                     _invoiceCtrl, _vehicleCtrl, _invoiceDataCtrl, _vendorCtrl,
                     _discountCtrl, _roundingCtrl]) {
      c.dispose();
    }
    super.dispose();
  }

  List<String> get _vendorSuggestions {
    final q = _vendorCtrl.text.toLowerCase();
    if (q.isEmpty) return widget.vendors;
    return widget.vendors.where((v) => v.toLowerCase().contains(q)).toList();
  }

  Future<void> _submit() async {
    if (_vendorCtrl.text.trim().isEmpty) { _snack('Please enter a vendor name'); return; }
    final rate = double.tryParse(_rateCtrl.text.trim()) ?? 0;
    final qty  = double.tryParse(_qtyCtrl.text.trim()) ?? 0;
    if (rate <= 0) { _snack('Please enter a rate'); return; }
    if (qty  <= 0) { _snack('Please enter a quantity'); return; }

    setState(() => _submitting = true);
    try {
      await widget.onSubmit({
        'date':            DateFormat('yyyy-MM-dd').format(_date),
        'vendorName':      _vendorCtrl.text.trim(),
        'particular':      _particularCtrl.text.trim(),
        'rate':            _rateCtrl.text.trim(),
        'quantity':        _qtyCtrl.text.trim(),
        'taxPercent':      _taxCtrl.text.trim().isEmpty ? '0' : _taxCtrl.text.trim(),
        'lineTotal':       _lineTotal,
        'notes':           _notesCtrl.text.trim(),
        'invoiceNo':       _invoiceCtrl.text.trim(),
        'vehicleNo':       _vehicleCtrl.text.trim(),
        'invoiceData':     _invoiceDataCtrl.text.trim(),
        'subTotal':        _subTotal,
        'discountPercent': _discountCtrl.text.trim().isEmpty ? '0' : _discountCtrl.text.trim(),
        'billPrice':       _billPrice,
        'taxable':         _taxable,
        'gstInclusive':    _gstInclusive,
        'roundingOff':     _roundingCtrl.text.trim().isEmpty ? '0' : _roundingCtrl.text.trim(),
        'finalBill':       _finalBill,
      });
      if (mounted) Navigator.pop(context);
    } catch (_) {
      setState(() => _submitting = false);
    }
  }

  void _snack(String msg) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), duration: const Duration(seconds: 2)));

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(text, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.5)),
  );

  Widget _textField(TextEditingController ctrl, {TextInputType? type, String? hint, String? suffix, VoidCallback? onChanged}) => TextField(
    controller: ctrl,
    keyboardType: type,
    style: const TextStyle(fontSize: 13),
    onChanged: onChanged != null ? (_) => onChanged() : null,
    decoration: InputDecoration(
      hintText: hint,
      suffixText: suffix,
      suffixStyle: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      isDense: true,
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Header
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [Color(0xFFB45309), Color(0xFFD97706), Color(0xFFF59E0B)], begin: Alignment.topLeft, end: Alignment.bottomRight),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 16),
            child: Row(children: [
              const Icon(Icons.hardware_outlined, color: Color(0xFFFDE68A), size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(widget.initial == null ? 'Add Extra Fab Entry' : 'Edit Extra Fab Entry',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white)),
              ),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 30, height: 30,
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(15)),
                  child: const Icon(Icons.close, color: Colors.white, size: 16),
                ),
              ),
            ]),
          ),

          Flexible(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, MediaQuery.of(context).viewInsets.bottom + 16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                // ── Line Item ──────────────────────────────────────
                _sectionHeader('LINE ITEM'),
                _label('PARTICULAR'),
                _textField(_particularCtrl, hint: 'Fabrication Charges'),
                const SizedBox(height: 10),

                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('RATE (₹)'),
                    _textField(_rateCtrl, type: const TextInputType.numberWithOptions(decimal: true), hint: '0.00'),
                  ])),
                  const SizedBox(width: 8),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('QUANTITY'),
                    _textField(_qtyCtrl, type: TextInputType.number, hint: '0'),
                  ])),
                  const SizedBox(width: 8),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('TAX (%)'),
                    _textField(_taxCtrl, type: const TextInputType.numberWithOptions(decimal: true), hint: '0'),
                  ])),
                ]),
                if (_lineTotal.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(color: _amberBg, borderRadius: BorderRadius.circular(8)),
                    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                      const Text('Line Total', style: TextStyle(fontSize: 11, color: Color(0xFF92400E))),
                      Text('₹$_lineTotal', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: _yellow)),
                    ]),
                  ),
                ],
                const SizedBox(height: 14),

                // ── Note + Invoice + Vehicle + Invoice Data ────────
                _label('NOTE'),
                _textField(_notesCtrl, hint: 'Optional notes…'),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('INVOICE NUMBER'),
                    _textField(_invoiceCtrl, hint: 'INV-001'),
                  ])),
                  const SizedBox(width: 8),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _label('VEHICLE NUMBER'),
                    _textField(_vehicleCtrl, hint: 'MH-01-AB-1234'),
                  ])),
                ]),
                const SizedBox(height: 10),
                _label('INVOICE DATA'),
                TextField(
                  controller: _invoiceDataCtrl,
                  maxLines: 3,
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    hintText: 'Additional invoice details…',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    isDense: true,
                  ),
                ),
                const SizedBox(height: 18),

                // ── Purchase Details ───────────────────────────────
                _sectionHeader('PURCHASE DETAILS'),
                _label('PURCHASE DATE'),
                GestureDetector(
                  onTap: () async {
                    final d = await showDatePicker(context: context, initialDate: _date, firstDate: DateTime(2020), lastDate: DateTime.now().add(const Duration(days: 1)));
                    if (d != null) setState(() => _date = d);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
                    decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(10)),
                    child: Row(children: [
                      const Icon(Icons.calendar_today_outlined, size: 14, color: Color(0xFF64748B)),
                      const SizedBox(width: 6),
                      Text(DateFormat('dd MMM yyyy').format(_date), style: const TextStyle(fontSize: 13)),
                    ]),
                  ),
                ),
                const SizedBox(height: 10),
                _label('VENDOR NAME'),
                TextField(
                  controller: _vendorCtrl,
                  style: const TextStyle(fontSize: 13),
                  onChanged: (_) => setState(() => _showVendorSugs = true),
                  onTap:    ()  => setState(() => _showVendorSugs = true),
                  decoration: InputDecoration(
                    hintText: 'Type or select vendor…',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    isDense: true,
                  ),
                ),
                if (_showVendorSugs && _vendorSuggestions.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  _suggestionList(_vendorSuggestions, (v) => setState(() { _vendorCtrl.text = v; _showVendorSugs = false; })),
                ],
                const SizedBox(height: 18),

                // ── Bill Summary ───────────────────────────────────
                _sectionHeader('BILL SUMMARY'),
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFFBEB),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  padding: const EdgeInsets.all(12),
                  child: Column(children: [
                    _summaryRow('Sub Total', _subTotal),
                    _divider(),
                    Row(children: [
                      const Text('Discount on Bill (%)', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                      const Spacer(),
                      SizedBox(
                        width: 70,
                        child: TextField(
                          controller: _discountCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          textAlign: TextAlign.right,
                          style: const TextStyle(fontSize: 12),
                          decoration: InputDecoration(
                            hintText: '0',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                            isDense: true,
                          ),
                        ),
                      ),
                    ]),
                    _divider(),
                    _summaryRow('Bill Price', _billPrice),
                    _summaryRow('Taxable', _taxable),
                    _divider(),
                    Row(children: [
                      const Text('GST Inclusive', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                      const Spacer(),
                      GestureDetector(
                        onTap: () => setState(() => _gstInclusive = !_gstInclusive),
                        child: Container(
                          width: 42, height: 22,
                          decoration: BoxDecoration(
                            color: _gstInclusive ? _amber : Colors.grey.shade300,
                            borderRadius: BorderRadius.circular(11),
                          ),
                          child: AnimatedAlign(
                            duration: const Duration(milliseconds: 150),
                            alignment: _gstInclusive ? Alignment.centerRight : Alignment.centerLeft,
                            child: Container(
                              width: 18, height: 18,
                              margin: const EdgeInsets.symmetric(horizontal: 2),
                              decoration: const BoxDecoration(shape: BoxShape.circle, color: Colors.white),
                            ),
                          ),
                        ),
                      ),
                    ]),
                    _divider(),
                    Row(children: [
                      const Text('Rounding Off', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                      const Spacer(),
                      SizedBox(
                        width: 70,
                        child: TextField(
                          controller: _roundingCtrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                          textAlign: TextAlign.right,
                          style: const TextStyle(fontSize: 12),
                          decoration: InputDecoration(
                            hintText: '0.00',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                            isDense: true,
                          ),
                        ),
                      ),
                    ]),
                    _divider(),
                    Row(children: [
                      const Text('Final Bill', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF1E293B))),
                      const Spacer(),
                      Text(
                        _finalBill.isNotEmpty ? '₹$_finalBill' : '—',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: _yellow),
                      ),
                    ]),
                  ]),
                ),
                const SizedBox(height: 20),

                Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () => Navigator.pop(context),
                      style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13)),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: FilledButton.icon(
                      onPressed: _submitting ? null : _submit,
                      style: FilledButton.styleFrom(backgroundColor: _amber, padding: const EdgeInsets.symmetric(vertical: 13)),
                      icon: _submitting
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : const Icon(Icons.save_outlined, size: 16),
                      label: Text(_submitting ? 'Saving…' : widget.initial == null ? 'Add Entry' : 'Save Changes'),
                    ),
                  ),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _sectionHeader(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 10),
    child: Text(text, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, color: _yellow, letterSpacing: 0.8)),
  );

  Widget _divider() => const Padding(padding: EdgeInsets.symmetric(vertical: 6), child: Divider(height: 1, color: Color(0xFFFDE68A)));

  Widget _summaryRow(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(children: [
      Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
      const Spacer(),
      Text(value.isNotEmpty ? '₹$value' : '—', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
    ]),
  );

  Widget _suggestionList(List<String> items, void Function(String) onPick) => Container(
    constraints: const BoxConstraints(maxHeight: 150),
    decoration: BoxDecoration(
      color: Colors.white,
      border: Border.all(color: Colors.grey.shade200),
      borderRadius: BorderRadius.circular(10),
      boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 10)],
    ),
    child: ListView.builder(
      shrinkWrap: true,
      itemCount: items.length,
      itemBuilder: (_, i) => GestureDetector(
        onTap: () => onPick(items[i]),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(border: i > 0 ? const Border(top: BorderSide(color: Color(0xFFF1F5F9))) : null),
          child: Text(items[i], style: const TextStyle(fontSize: 13, color: Color(0xFF1E293B))),
        ),
      ),
    ),
  );
}

// ─────────────────────────────────────────────
// Testing Lab Screen
// ─────────────────────────────────────────────

class TestingLabScreen extends StatefulWidget {
  const TestingLabScreen({super.key});
  @override
  State<TestingLabScreen> createState() => _TestingLabScreenState();
}

class _TestingLabEntry {
  final int id;
  final String date;
  final bool csEnabled;
  final String csDay7;
  final String csDay28;
  final bool ppEnabled;
  final String ppNotes;
  final bool npEnabled;
  final String npNotes;
  final bool btEnabled;
  final String btNotes;

  const _TestingLabEntry({
    required this.id, required this.date,
    required this.csEnabled, required this.csDay7, required this.csDay28,
    required this.ppEnabled, required this.ppNotes,
    required this.npEnabled, required this.npNotes,
    required this.btEnabled, required this.btNotes,
  });

  factory _TestingLabEntry.fromJson(Map<String, dynamic> j) => _TestingLabEntry(
    id: (j['id'] as num).toInt(),
    date: j['date']?.toString() ?? '',
    csEnabled: j['csEnabled'] == true,
    csDay7: j['csDay7']?.toString() ?? '',
    csDay28: j['csDay28']?.toString() ?? '',
    ppEnabled: j['ppEnabled'] == true,
    ppNotes: j['ppNotes']?.toString() ?? '',
    npEnabled: j['npEnabled'] == true,
    npNotes: j['npNotes']?.toString() ?? '',
    btEnabled: j['btEnabled'] == true,
    btNotes: j['btNotes']?.toString() ?? '',
  );
}

class _TestingLabScreenState extends State<TestingLabScreen> {
  static const _color     = Color(0xFF0891B2);
  static const _colorDark = Color(0xFF0E7490);

  List<_TestingLabEntry> _allItems = [];
  bool _loading = true;

  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter();
  late DateTime _from, _to;

  String _activeTab      = 'all';
  bool   _searchExpanded = false;
  String _search         = '';
  final  _searchCtrl     = TextEditingController();

  @override
  void initState() {
    super.initState();
    _to   = DateTime.now();
    _from = _to.subtract(const Duration(days: 29));
    _load();
  }

  @override
  void dispose() {
    _closeDateOverlay();
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
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 29));
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmt(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getTestingLabEntries(
        fromDate: _fmt(_from), toDate: _fmt(_to),
      );
      setState(() {
        _allItems = raw.map((e) => _TestingLabEntry.fromJson(e as Map<String, dynamic>)).toList();
        _loading  = false;
      });
    } catch (_) { setState(() => _loading = false); }
  }

  List<_TestingLabEntry> get _filtered {
    return _allItems.where((e) {
      if (_activeTab == 'cs'      && !e.csEnabled) return false;
      if (_activeTab == 'perm'    && !e.ppEnabled && !e.npEnabled) return false;
      if (_activeTab == 'boiling' && !e.btEnabled) return false;
      if (_search.trim().isNotEmpty) {
        final q = _search.toLowerCase();
        return e.date.contains(q) ||
               e.csDay7.contains(q) || e.csDay28.contains(q) ||
               e.ppNotes.toLowerCase().contains(q) ||
               e.npNotes.toLowerCase().contains(q) ||
               e.btNotes.toLowerCase().contains(q);
      }
      return true;
    }).toList();
  }

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    final p = s.split('-');
    return p.length == 3 ? '${p[2]}/${p[1]}/${p[0]}' : s;
  }

  Future<void> _showAddEdit({_TestingLabEntry? editing}) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _TestingLabSheet(
        initial: editing,
        onSubmit: (data) async {
          if (editing != null) {
            await ApiService().updateTestingLabEntry(editing.id, data);
          } else {
            await ApiService().createTestingLabEntry(data);
          }
          await _load();
        },
      ),
    );
  }

  Future<void> _delete(_TestingLabEntry entry) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Entry'),
        content: Text('Delete testing lab entry for ${_fmtDate(entry.date)}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await ApiService().deleteTestingLabEntry(entry.id);
      _load();
    }
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );

  Widget _buildFloatingNav() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 6, 20, 14),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.10), blurRadius: 20, offset: const Offset(0, 4))],
          ),
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 260),
            child: _searchExpanded ? _buildSearchExpanded() : _buildNavItems(),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchExpanded() => Row(
    key: const ValueKey('search'),
    children: [
      Container(
        margin: const EdgeInsets.all(8),
        width: 46, height: 46,
        decoration: const BoxDecoration(
          gradient: LinearGradient(colors: [_color, _colorDark]),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.search, color: Colors.white, size: 20),
      ),
      Expanded(
        child: TextField(
          controller: _searchCtrl,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Search entries…',
            hintStyle: TextStyle(fontSize: 13, color: Colors.grey),
            border: InputBorder.none,
          ),
          style: const TextStyle(fontSize: 14),
          onChanged: (v) => setState(() => _search = v),
        ),
      ),
      GestureDetector(
        onTap: () {
          _searchCtrl.clear();
          setState(() { _search = ''; _searchExpanded = false; });
        },
        child: Container(
          margin: const EdgeInsets.all(8),
          width: 46, height: 46,
          decoration: BoxDecoration(color: Colors.grey.shade100, shape: BoxShape.circle),
          child: const Icon(Icons.close, size: 20, color: Colors.grey),
        ),
      ),
    ],
  );

  Widget _buildNavItems() => Row(
    key: const ValueKey('nav'),
    children: [
      _navItem(Icons.search,             'Search',  '',        onTap: () => setState(() => _searchExpanded = true)),
      _navItem(Icons.list_outlined,      'All',     'all'),
      _navItem(Icons.compress_outlined,  'CS',      'cs'),
      _navItem(Icons.water_drop_outlined,'Perm',    'perm'),
      _navItem(Icons.local_fire_department_outlined, 'Boiling', 'boiling'),
    ],
  );

  Widget _navItem(IconData icon, String label, String tab, {VoidCallback? onTap}) {
    final active = tab.isNotEmpty && _activeTab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: onTap ?? () => setState(() => _activeTab = tab),
        child: Container(
          margin: const EdgeInsets.all(6),
          decoration: active
              ? const BoxDecoration(
                  gradient: LinearGradient(colors: [_color, _colorDark]),
                  borderRadius: BorderRadius.all(Radius.circular(26)),
                )
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 20, color: active ? Colors.white : Colors.grey.shade500),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600,
                color: active ? Colors.white : Colors.grey.shade500)),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final items = _filtered;
    final csCount      = items.where((e) => e.csEnabled).length;
    final permCount    = items.where((e) => e.ppEnabled || e.npEnabled).length;
    final boilingCount = items.where((e) => e.btEnabled).length;

    return Scaffold(
      backgroundColor: Colors.white,
      bottomNavigationBar: _buildFloatingNav(),
      body: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 120,
          backgroundColor: _color,
          foregroundColor: Colors.white,
          leading: context.canPop()
              ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())
              : IconButton(icon: const Icon(Icons.menu_outlined), onPressed: openAppDrawer, tooltip: 'Open menu'),
          title: const Text('Testing Lab'),
          actions: [
            CompositedTransformTarget(
              link: _layerLink,
              child: GestureDetector(
                onTap: _toggleDateOverlay,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withOpacity(0.25)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    const Icon(Icons.calendar_today_outlined, size: 13, color: Colors.white),
                    const SizedBox(width: 5),
                    Text(_dateFilter.isActive ? _dateFilter.label : 'Date',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
                    const SizedBox(width: 3),
                    const Icon(Icons.keyboard_arrow_down, size: 14, color: Colors.white),
                  ]),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton(
              icon: const Icon(Icons.add, color: Colors.white),
              onPressed: _showAddEdit,
            ),
            const SizedBox(width: 4),
          ],
          flexibleSpace: FlexibleSpaceBar(
            background: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [_color, _colorDark],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: SafeArea(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(6, 64, 6, 4),
                  child: Row(children: [
                    _hStat('${items.length}', 'Entries'),
                    _hStat('$csCount', 'CS Tests'),
                    _hStat('$permCount', 'Perm'),
                    _hStat('$boilingCount', 'Boiling'),
                  ]),
                ),
              ),
            ),
          ),
        ),
        SliverFillRemaining(
          child: _loading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: items.isEmpty
                      ? Center(
                          child: Column(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.science_outlined, size: 48, color: Colors.grey.shade300),
                            const SizedBox(height: 12),
                            Text('No testing lab entries',
                                style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
                          ]),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                          itemCount: items.length,
                          itemBuilder: (_, i) => _TestingLabCard(
                            entry: items[i],
                            color: _color,
                            onEdit: () => _showAddEdit(editing: items[i]),
                            onDelete: () => _delete(items[i]),
                          ),
                        ),
                ),
        ),
      ]),
    );
  }
}

class _TestingLabCard extends StatelessWidget {
  final _TestingLabEntry entry;
  final Color color;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  const _TestingLabCard({required this.entry, required this.color, required this.onEdit, required this.onDelete});

  static String _fmtDate(String s) {
    if (s.length < 10) return s;
    final p = s.split('-');
    return p.length == 3 ? '${p[2]}/${p[1]}/${p[0]}' : s;
  }

  Widget _testBadge(String label, Color c) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
    decoration: BoxDecoration(color: c.withOpacity(0.12), borderRadius: BorderRadius.circular(20)),
    child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c)),
  );

  @override
  Widget build(BuildContext context) {
    final anyEnabled = entry.csEnabled || entry.ppEnabled || entry.npEnabled || entry.btEnabled;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.07), blurRadius: 12, offset: const Offset(0, 3)),
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4,  offset: const Offset(0, 1)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Container(
              width: 36, height: 36,
              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
              child: Icon(Icons.science_outlined, color: color, size: 18),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(_fmtDate(entry.date),
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
            ),
            IconButton(icon: const Icon(Icons.edit_outlined, size: 18), color: Colors.grey, onPressed: onEdit, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
            const SizedBox(width: 4),
            IconButton(icon: const Icon(Icons.delete_outline, size: 18), color: Colors.red[300], onPressed: onDelete, padding: EdgeInsets.zero, constraints: const BoxConstraints()),
          ]),
          if (anyEnabled) ...[
            const SizedBox(height: 8),
            const Divider(height: 1),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              if (entry.csEnabled) _testBadge('CS', color),
              if (entry.ppEnabled) _testBadge('Press. Perm', Colors.indigo),
              if (entry.npEnabled) _testBadge('Norm. Perm', Colors.teal),
              if (entry.btEnabled) _testBadge('Boiling', Colors.orange),
            ]),
            if (entry.csEnabled && (entry.csDay7.isNotEmpty || entry.csDay28.isNotEmpty)) ...[
              const SizedBox(height: 8),
              Row(children: [
                if (entry.csDay7.isNotEmpty)
                  Expanded(child: _csValue('Day 7', entry.csDay7, color)),
                if (entry.csDay7.isNotEmpty && entry.csDay28.isNotEmpty)
                  const SizedBox(width: 8),
                if (entry.csDay28.isNotEmpty)
                  Expanded(child: _csValue('Day 28', entry.csDay28, color)),
              ]),
            ],
            if (entry.ppEnabled && entry.ppNotes.isNotEmpty) ...[
              const SizedBox(height: 6),
              _noteRow('Press. Perm', entry.ppNotes, Colors.indigo),
            ],
            if (entry.npEnabled && entry.npNotes.isNotEmpty) ...[
              const SizedBox(height: 6),
              _noteRow('Norm. Perm', entry.npNotes, Colors.teal),
            ],
            if (entry.btEnabled && entry.btNotes.isNotEmpty) ...[
              const SizedBox(height: 6),
              _noteRow('Boiling', entry.btNotes, Colors.orange),
            ],
          ],
        ]),
      ),
    );
  }

  Widget _csValue(String label, String value, Color c) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
    decoration: BoxDecoration(color: c.withOpacity(0.06), borderRadius: BorderRadius.circular(8)),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: c.withOpacity(0.7))),
      const SizedBox(height: 2),
      Text('$value N/mm²', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: c)),
    ]),
  );

  Widget _noteRow(String label, String note, Color c) => Row(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text('$label: ', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: c)),
      Expanded(child: Text(note, style: const TextStyle(fontSize: 11, color: Colors.grey))),
    ],
  );
}

class _TestingLabSheet extends StatefulWidget {
  final _TestingLabEntry? initial;
  final Future<void> Function(Map<String, dynamic>) onSubmit;
  const _TestingLabSheet({this.initial, required this.onSubmit});
  @override
  State<_TestingLabSheet> createState() => _TestingLabSheetState();
}

class _TestingLabSheetState extends State<_TestingLabSheet> {
  static const _color = Color(0xFF0891B2);

  late DateTime _date;

  bool _csEnabled = false;
  final _csDay7Ctrl  = TextEditingController();
  final _csDay28Ctrl = TextEditingController();

  bool _ppEnabled = false;
  final _ppNotesCtrl = TextEditingController();

  bool _npEnabled = false;
  final _npNotesCtrl = TextEditingController();

  bool _btEnabled = false;
  final _btNotesCtrl = TextEditingController();

  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    final e = widget.initial;
    _date = e != null
        ? (DateTime.tryParse(e.date) ?? DateTime.now())
        : DateTime.now();
    if (e != null) {
      _csEnabled = e.csEnabled;
      _csDay7Ctrl.text  = e.csDay7;
      _csDay28Ctrl.text = e.csDay28;
      _ppEnabled = e.ppEnabled;
      _ppNotesCtrl.text = e.ppNotes;
      _npEnabled = e.npEnabled;
      _npNotesCtrl.text = e.npNotes;
      _btEnabled = e.btEnabled;
      _btNotesCtrl.text = e.btNotes;
    }
  }

  @override
  void dispose() {
    _csDay7Ctrl.dispose(); _csDay28Ctrl.dispose();
    _ppNotesCtrl.dispose(); _npNotesCtrl.dispose(); _btNotesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      builder: (ctx, child) => Theme(
        data: Theme.of(ctx).copyWith(colorScheme: const ColorScheme.light(primary: _color)),
        child: child!,
      ),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await widget.onSubmit({
        'date':      DateFormat('yyyy-MM-dd').format(_date),
        'csEnabled': _csEnabled,
        'csDay7':    _csDay7Ctrl.text.trim(),
        'csDay28':   _csDay28Ctrl.text.trim(),
        'ppEnabled': _ppEnabled,
        'ppNotes':   _ppNotesCtrl.text.trim(),
        'npEnabled': _npEnabled,
        'npNotes':   _npNotesCtrl.text.trim(),
        'btEnabled': _btEnabled,
        'btNotes':   _btNotesCtrl.text.trim(),
      });
      if (mounted) Navigator.pop(context);
    } catch (err) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $err')));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Widget _lbl(String t) => Padding(
    padding: const EdgeInsets.only(bottom: 6),
    child: Text(t, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold,
        color: Colors.grey.shade400, letterSpacing: 1.2)),
  );

  InputDecoration _iDeco({required String hint}) => InputDecoration(
    hintText: hint,
    hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
    isDense: true,
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    filled: true,
    fillColor: Colors.grey.shade50,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade200)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: Colors.grey.shade200)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: _color)),
  );

  Widget _section({required IconData icon, required String title, required Color color,
      required bool enabled, required ValueChanged<bool> onToggle, required Widget child}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: enabled ? color.withOpacity(0.04) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: enabled ? color.withOpacity(0.2) : Colors.grey.shade200),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InkWell(
          onTap: () => setState(() => onToggle(!enabled)),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(children: [
              Icon(icon, size: 18, color: enabled ? color : Colors.grey.shade400),
              const SizedBox(width: 10),
              Text(title, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13,
                  color: enabled ? color : Colors.grey.shade600)),
              const Spacer(),
              Switch(value: enabled, onChanged: onToggle, activeColor: color,
                  materialTapTargetSize: MaterialTapTargetSize.shrinkWrap),
            ]),
          ),
        ),
        if (enabled)
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
            child: child,
          ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SafeArea(
        top: false,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(colors: [_color, Color(0xFF0E7490)]),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
            child: Row(children: [
              const Icon(Icons.science_outlined, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Text(widget.initial != null ? 'Edit Lab Entry' : 'Add Lab Entry',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white)),
              const Spacer(),
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: const Icon(Icons.close, color: Colors.white70, size: 20),
              ),
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _lbl('DATE'),
                GestureDetector(
                  onTap: _pickDate,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade200),
                      borderRadius: BorderRadius.circular(10),
                      color: Colors.grey.shade50,
                    ),
                    child: Row(children: [
                      Icon(Icons.calendar_today_outlined, size: 15, color: Colors.grey.shade500),
                      const SizedBox(width: 10),
                      Text(DateFormat('dd MMM yyyy').format(_date),
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500)),
                    ]),
                  ),
                ),
                const SizedBox(height: 16),

                _section(
                  icon: Icons.compress_outlined,
                  title: 'Compressive Strength (CS)',
                  color: _color,
                  enabled: _csEnabled,
                  onToggle: (v) => setState(() => _csEnabled = v),
                  child: Column(children: [
                    Row(children: [
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        _lbl('DAY 7 (N/mm²)'),
                        TextField(
                          controller: _csDay7Ctrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: _iDeco(hint: '0.0'),
                        ),
                      ])),
                      const SizedBox(width: 10),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        _lbl('DAY 28 (N/mm²)'),
                        TextField(
                          controller: _csDay28Ctrl,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: _iDeco(hint: '0.0'),
                        ),
                      ])),
                    ]),
                  ]),
                ),

                _section(
                  icon: Icons.water_drop_outlined,
                  title: 'Pressure Permeability (PP)',
                  color: Colors.indigo,
                  enabled: _ppEnabled,
                  onToggle: (v) => setState(() => _ppEnabled = v),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _lbl('NOTES'),
                    TextField(controller: _ppNotesCtrl, maxLines: 2,
                        decoration: _iDeco(hint: 'Test notes or observations…')),
                  ]),
                ),

                _section(
                  icon: Icons.water_outlined,
                  title: 'Normal Permeability (NP)',
                  color: Colors.teal,
                  enabled: _npEnabled,
                  onToggle: (v) => setState(() => _npEnabled = v),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _lbl('NOTES'),
                    TextField(controller: _npNotesCtrl, maxLines: 2,
                        decoration: _iDeco(hint: 'Test notes or observations…')),
                  ]),
                ),

                _section(
                  icon: Icons.local_fire_department_outlined,
                  title: 'Boiling Test (BT)',
                  color: Colors.orange,
                  enabled: _btEnabled,
                  onToggle: (v) => setState(() => _btEnabled = v),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _lbl('NOTES'),
                    TextField(controller: _btNotesCtrl, maxLines: 2,
                        decoration: _iDeco(hint: 'Test notes or observations…')),
                  ]),
                ),

                const SizedBox(height: 4),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _submitting ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _color,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _submitting
                        ? const SizedBox(width: 20, height: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text(widget.initial != null ? 'Update Entry' : 'Save Entry',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

extension on double {
  String toLocaleString() {
    if (this >= 10000000) return '${(this / 10000000).toStringAsFixed(2)}Cr';
    if (this >= 100000) return '${(this / 100000).toStringAsFixed(2)}L';
    if (this >= 1000) return '${(this / 1000).toStringAsFixed(1)}K';
    return toStringAsFixed(2);
  }
}

// ── PCCP Production Processes ─────────────────────────────────────────────────

class _StageInfo {
  final String stageType;
  final String name;
  final IconData icon;
  final Color color;
  const _StageInfo(this.stageType, this.name, this.icon, this.color);
}

const _pccpStages = [
  _StageInfo('FABRICATION',         'Fabrication',     Icons.hardware_outlined,            Color(0xFF7C3AED)),
  _StageInfo('FABRICATION_TESTING', 'Fab Testing',     Icons.science_outlined,             Color(0xFF0891B2)),
  _StageInfo('MOULDING',            'Moulding',        Icons.view_in_ar_outlined,          Color(0xFF2563EB)),
  _StageInfo('SPINNING',            'Spinning',        Icons.rotate_right_outlined,        Color(0xFF0D9488)),
  _StageInfo('DEMOULDING',          'Demoulding',      Icons.open_in_new_outlined,         Color(0xFF059669)),
  _StageInfo('CURING_1',            'Curing 1',        Icons.water_drop_outlined,          Color(0xFF0284C7)),
  _StageInfo('WINDING',             'Winding',         Icons.loop_outlined,                Color(0xFFCA8A04)),
  _StageInfo('COATING',             'Coating',         Icons.format_paint_outlined,        Color(0xFFEA580C)),
  _StageInfo('CURING_2',            'Curing 2',        Icons.water_outlined,               Color(0xFF6366F1)),
  _StageInfo('FINAL_TESTING',       'Final Testing',   Icons.check_circle_outline,         Color(0xFF16A34A)),
  _StageInfo('PDI',                 'PDI',             Icons.assignment_turned_in_outlined, Color(0xFF059669)),
];

class PccpScreen extends StatefulWidget {
  const PccpScreen({super.key});
  @override
  State<PccpScreen> createState() => _PccpScreenState();
}

class _PccpScreenState extends State<PccpScreen> {
  static const _color     = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF5B21B6);

  bool _loading = true;
  Map<String, int> _stageCounts = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    try {
      final entries = await ApiService().getProductionEntries(from: today, to: today, size: 2000);
      final counts = <String, int>{};
      for (final raw in entries) {
        final e = raw as Map;
        final st = e['stageType']?.toString() ?? '';
        counts[st] = (counts[st] ?? 0) + ((e['pipesCompleted'] as num?)?.toInt() ?? 0);
      }
      if (mounted) setState(() { _stageCounts = counts; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final totalToday = _stageCounts.values.fold(0, (s, v) => s + v);
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
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
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          GestureDetector(
                            onTap: () => context.pop(),
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
                          const Expanded(
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('PCCP', style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                              Text('Production Processes', style: TextStyle(color: Colors.white70, fontSize: 13)),
                            ]),
                          ),
                          if (_loading)
                            const SizedBox(width: 20, height: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                        ]),
                        const SizedBox(height: 14),
                        // Stat strip
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(children: [
                            const Icon(Icons.layers_outlined, color: Colors.white, size: 18),
                            const SizedBox(width: 8),
                            Text(
                              totalToday > 0 ? '$totalToday pipes completed today' : 'No entries today',
                              style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                            const Spacer(),
                            Text(DateFormat('d MMM').format(DateTime.now()),
                              style: const TextStyle(color: Colors.white60, fontSize: 12)),
                          ]),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // ── Stage cards grid ──
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 16, 14, 32),
              sliver: SliverGrid(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) {
                    final s = _pccpStages[i];
                    final count = _stageCounts[s.stageType] ?? 0;
                    return _PccpStageCard(
                      info: s,
                      count: count,
                      onTap: () {
                        if (s.stageType == 'PDI') {
                          context.push('/business/pdi');
                        } else {
                          context.push('/business/pccp/stage', extra: {
                            'stageType': s.stageType,
                            'name': s.name,
                            'colorValue': s.color.value,
                          });
                        }
                      },
                    );
                  },
                  childCount: _pccpStages.length,
                ),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  mainAxisExtent: 138,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PccpStageCard extends StatelessWidget {
  final _StageInfo info;
  final int count;
  final VoidCallback onTap;
  const _PccpStageCard({required this.info, required this.count, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 8, offset: const Offset(0, 2)),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(info.icon, color: info.color, size: 30),
            const SizedBox(height: 10),
            Text(info.name,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.grey[800]),
              textAlign: TextAlign.center),
            const SizedBox(height: 4),
            Text(
              count > 0 ? '$count pipes today' : '—',
              style: TextStyle(
                fontSize: 11,
                color: count > 0 ? info.color : Colors.grey[400],
                fontWeight: count > 0 ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── PCCP Stage Detail ─────────────────────────────────────────────────────────

class PccpStageScreen extends StatefulWidget {
  final String stageType;
  final String stageName;
  final Color color;
  const PccpStageScreen({super.key, required this.stageType, required this.stageName, required this.color});
  @override
  State<PccpStageScreen> createState() => _PccpStageScreenState();
}

class _PccpStageScreenState extends State<PccpStageScreen> {
  bool _loading = true;
  List<Map<String, dynamic>> _entries = [];
  late DateTime _from, _to;
  String _search = '';
  bool _searchOpen = false;
  final _searchCtrl = TextEditingController();
  final _searchFocus = FocusNode();

  // Date filter overlay (PDI-style)
  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  _PdiDateFilter _dateFilter = const _PdiDateFilter(preset: 'this_month');

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _to   = now;
    _from = DateTime(now.year, now.month, 1);
    _load();
  }

  @override
  void dispose() {
    _closeDateOverlay();
    _searchCtrl.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _closeDateOverlay() {
    _dateOverlay?.remove();
    _dateOverlay = null;
  }

  void _toggleDateOverlay() {
    if (_dateOverlay != null) { _closeDateOverlay(); return; }
    final entry = OverlayEntry(
      builder: (_) => _PdiDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime(DateTime.now().year, DateTime.now().month, 1);
            _to   = f.to   ?? DateTime.now();
          });
          _load();
        },
        onDismiss: _closeDateOverlay,
      ),
    );
    Overlay.of(context).insert(entry);
    _dateOverlay = entry;
  }

  String _fmt(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await ApiService().getProductionEntries(
        stageType: widget.stageType,
        from: _fmt(_from),
        to: _fmt(_to),
        size: 1000,
      );
      if (mounted) setState(() { _entries = data.cast<Map<String, dynamic>>(); _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_search.trim().isEmpty) return _entries;
    final q = _search.toLowerCase();
    return _entries.where((e) {
      final pipe = (e['pipeConfig']?['name'] ?? '').toString().toLowerCase();
      final date = (e['entryDate'] as String? ?? '').toLowerCase();
      return pipe.contains(q) || date.contains(q);
    }).toList();
  }

  int get _totalPipes => _entries.fold(0, (s, e) => s + ((e['pipesCompleted'] as num?)?.toInt() ?? 0));

  void _showAddSheet(BuildContext context, Color color) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _ProductionEntrySheet(
        stageType: widget.stageType,
        stageName: widget.stageName,
        color: color,
        onSuccess: (int count) {
          _load();
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(SnackBar(
              content: Text('$count ${count == 1 ? 'entry' : 'entries'} saved'),
              backgroundColor: color,
              duration: const Duration(seconds: 2),
            ));
          }
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final color     = widget.color;
    final colorDark = HSLColor.fromColor(color).withLightness(
      (HSLColor.fromColor(color).lightness - 0.15).clamp(0, 1)).toColor();
    final filtered = _filtered;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      floatingActionButton: FloatingActionButton(
        backgroundColor: color,
        onPressed: () => _showAddSheet(context, color),
        child: const Icon(Icons.add, color: Colors.white),
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: CustomScrollView(
          slivers: [
            // ── Hero ──
            SliverToBoxAdapter(
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [colorDark, color],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: SafeArea(
                  bottom: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(children: [
                          if (!_searchOpen) ...[
                            GestureDetector(
                              onTap: () => context.pop(),
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
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(widget.stageName,
                                style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
                              const Text('PCCP Production Stage', style: TextStyle(color: Colors.white70, fontSize: 12)),
                            ])),
                          ] else
                            Expanded(
                              child: TextField(
                                controller: _searchCtrl,
                                focusNode: _searchFocus,
                                style: const TextStyle(color: Colors.white, fontSize: 14),
                                decoration: InputDecoration(
                                  hintText: 'Search pipe or date…',
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
                          if (_loading && !_searchOpen)
                            const Padding(
                              padding: EdgeInsets.only(right: 6),
                              child: SizedBox(width: 18, height: 18,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)),
                            ),
                          const SizedBox(width: 6),
                          GestureDetector(
                            onTap: () {
                              setState(() {
                                _searchOpen = !_searchOpen;
                                if (!_searchOpen) { _search = ''; _searchCtrl.clear(); }
                              });
                              if (_searchOpen) {
                                Future.delayed(const Duration(milliseconds: 50), () => _searchFocus.requestFocus());
                              }
                            },
                            child: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.18),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(_searchOpen ? Icons.close : Icons.search, color: Colors.white, size: 18),
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
                        // Stats strip
                        Row(children: [
                          Expanded(child: _statChip(Icons.bar_chart_outlined, '${_entries.length}', 'entries')),
                          const SizedBox(width: 8),
                          Expanded(child: _statChip(Icons.layers_outlined, '$_totalPipes', 'pipes total')),
                        ]),
                      ],
                    ),
                  ),
                ),
              ),
            ),

            // ── Entries list ──
            filtered.isEmpty && !_loading
              ? SliverFillRemaining(
                  child: Center(
                    child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.inbox_outlined, size: 48, color: Colors.grey[300]),
                      const SizedBox(height: 10),
                      Text('No ${widget.stageName} entries found',
                        style: TextStyle(fontSize: 14, color: Colors.grey[500])),
                    ]),
                  ),
                )
              : SliverPadding(
                  padding: const EdgeInsets.fromLTRB(14, 12, 14, 32),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (ctx, i) => _EntryTile(entry: filtered[i], color: color),
                      childCount: filtered.length,
                    ),
                  ),
                ),
          ],
        ),
      ),
    );
  }

  Widget _statChip(IconData icon, String value, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, color: Colors.white70, size: 14),
        const SizedBox(width: 6),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w700)),
          Text(label, style: const TextStyle(color: Colors.white60, fontSize: 10)),
        ]),
      ]),
    );
  }
}

class _EntryTile extends StatelessWidget {
  final Map<String, dynamic> entry;
  final Color color;
  const _EntryTile({required this.entry, required this.color});

  @override
  Widget build(BuildContext context) {
    final pipeName  = entry['pipeConfig']?['name']?.toString() ?? 'Pipe #${entry['pipeConfigId']}';
    final pipes     = (entry['pipesCompleted'] as num?)?.toInt() ?? 0;
    final rawDate   = entry['entryDate'] as String? ?? '';
    final dateStr   = rawDate.isNotEmpty
      ? DateFormat('d MMM yyyy').format(DateTime.tryParse(rawDate) ?? DateTime.now())
      : '—';
    final shift     = entry['shiftName']?.toString();
    final batchNo   = entry['batchNumber']?.toString();
    final orderNo   = entry['productionOrderId'] != null ? 'PRD #${entry['productionOrderId']}' : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 6, offset: const Offset(0, 1))],
      ),
      child: Row(children: [
        Container(
          width: 5,
          height: 60,
          decoration: BoxDecoration(
            color: color,
            borderRadius: const BorderRadius.horizontal(left: Radius.circular(12)),
          ),
        ),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(pipeName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1F2937))),
                const SizedBox(height: 3),
                Row(children: [
                  const Icon(Icons.calendar_today_outlined, size: 11, color: Color(0xFF9CA3AF)),
                  const SizedBox(width: 4),
                  Text(dateStr, style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
                  if (shift != null) ...[
                    const SizedBox(width: 10),
                    const Icon(Icons.schedule_outlined, size: 11, color: Color(0xFF9CA3AF)),
                    const SizedBox(width: 4),
                    Text('Shift $shift', style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280))),
                  ],
                ]),
                if (batchNo != null || orderNo != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 3),
                    child: Text(
                      [if (batchNo != null) 'Batch $batchNo', if (orderNo != null) orderNo].join(' · '),
                      style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)),
                    ),
                  ),
              ])),
              const SizedBox(width: 12),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('$pipes', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color)),
                Text('pipes', style: TextStyle(fontSize: 10, color: color.withOpacity(0.7), fontWeight: FontWeight.w500)),
              ]),
            ]),
          ),
        ),
      ]),
    );
  }
}

// ─── Production Entry Sheet ───────────────────────────────────────────────────

class _OrderEntry {
  final Map<String, dynamic> order;
  final TextEditingController processedCtrl = TextEditingController();
  final TextEditingController completedCtrl = TextEditingController();
  _OrderEntry(this.order);
  void dispose() {
    processedCtrl.dispose();
    completedCtrl.dispose();
  }
}

class _ProductionEntrySheet extends StatefulWidget {
  final String stageType;
  final String stageName;
  final Color color;
  final void Function(int count) onSuccess;

  const _ProductionEntrySheet({
    required this.stageType,
    required this.stageName,
    required this.color,
    required this.onSuccess,
  });

  @override
  State<_ProductionEntrySheet> createState() => _ProductionEntrySheetState();
}

class _ProductionEntrySheetState extends State<_ProductionEntrySheet> {
  final _api = ApiService();
  List<Map<String, dynamic>> _orders = [];
  bool _loading = true;
  String _search = '';
  DateTime _date = DateTime.now();
  final Map<int, _OrderEntry> _selected = {};
  bool _submitting = false;
  // Coating-only: sand mix selection
  String _sandType = 'plaster'; // 'plaster' | 'crushed'
  // Cache of pipeConfigId → COATING materials (fetched lazily for COATING stage)
  final Map<int, List<dynamic>> _coatingMaterials = {};

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  @override
  void dispose() {
    for (final e in _selected.values) e.dispose();
    super.dispose();
  }

  Future<void> _loadOrders() async {
    try {
      final raw = await _api.getProductionOrders(size: 200);
      final filtered = raw
          .where((o) {
            final s = (o['status'] ?? '').toString();
            return s != 'COMPLETED' && s != 'CANCELLED';
          })
          .cast<Map<String, dynamic>>()
          .toList();
      if (mounted) setState(() { _orders = filtered; _loading = false; });

      // For COATING, pre-fetch pipe config materials for all unique configs
      if (widget.stageType == 'COATING') {
        final configIds = filtered
            .map((o) => o['pipeConfigId'])
            .whereType<int>()
            .toSet();
        for (final id in configIds) {
          if (_coatingMaterials.containsKey(id)) continue;
          try {
            final config = await _api.getPipeConfig(id);
            final mats = (config['materials'] as List? ?? [])
                .cast<Map<String, dynamic>>()
                .where((m) => m['stageType'] == 'COATING')
                .toList();
            _coatingMaterials[id] = mats;
          } catch (_) {}
        }
      }
    } catch (_) {
      if (mounted) setState(() { _loading = false; });
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_search.trim().isEmpty) return _orders;
    final q = _search.toLowerCase();
    return _orders.where((o) {
      final name = (o['pipeConfig']?['name'] ?? o['pipeName'] ?? '').toString().toLowerCase();
      final num = (o['poNumber'] ?? '').toString().toLowerCase();
      return name.contains(q) || num.contains(q);
    }).toList();
  }

  void _toggleOrder(Map<String, dynamic> order) {
    final id = order['id'] as int;
    setState(() {
      if (_selected.containsKey(id)) {
        _selected[id]!.dispose();
        _selected.remove(id);
      } else {
        _selected[id] = _OrderEntry(order);
      }
    });
  }

  Widget _sandToggleBtn(String type, String label) {
    final active = _sandType == type;
    return GestureDetector(
      onTap: () => setState(() => _sandType = type),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: active ? Colors.grey[900] : Colors.transparent,
          borderRadius: BorderRadius.circular(7),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: active ? Colors.white : Colors.grey[600],
          ),
        ),
      ),
    );
  }

  Future<void> _submit() async {
    if (_selected.isEmpty) return;
    setState(() => _submitting = true);
    int successCount = 0;
    final dateStr = _date.toIso8601String().split('T')[0];
    for (final entry in _selected.values) {
      final processed = int.tryParse(entry.processedCtrl.text.trim()) ?? 0;
      final completed = int.tryParse(entry.completedCtrl.text.trim()) ?? 0;
      if (processed == 0 && completed == 0) continue;
      try {
        final payload = <String, dynamic>{
          'productionOrderId': entry.order['id'],
          'stageType': widget.stageType,
          'pipesProcessed': processed,
          'pipesCompleted': completed,
          'entryDate': dateStr,
        };

        // COATING: send explicit consumption for the selected sand only
        if (widget.stageType == 'COATING') {
          final configId = entry.order['pipeConfigId'] as int?;
          final mats = configId != null ? (_coatingMaterials[configId] ?? []) : [];
          final sandKey = _sandType == 'plaster' ? 'plaster sand' : 'crushed sand';
          final sandMat = mats.cast<Map<String, dynamic>>().where((m) {
            final name = (m['materialProduct']?['name'] ?? '').toString().toLowerCase();
            return name.contains(sandKey);
          }).toList();
          if (sandMat.isNotEmpty) {
            final mat = sandMat.first;
            final qtyPerPipe = double.tryParse(mat['quantityPerPipe']?.toString() ?? '0') ?? 0;
            final scrap = double.tryParse(mat['scrapPercent']?.toString() ?? '0') ?? 0;
            final rawQty = qtyPerPipe * completed;
            final consumedQty = scrap > 0 ? rawQty * (1 + scrap / 100) : rawQty;
            payload['consumptions'] = [
              {
                'pipeConfigMaterialId': mat['id'],
                'materialProductId': mat['materialProductId'],
                'consumedQty': consumedQty,
                'uom': mat['uom'] ?? 'kg',
              }
            ];
          }
        }

        await _api.createProductionEntry(payload);
        successCount++;
      } catch (_) {}
    }
    if (mounted) {
      Navigator.pop(context);
      widget.onSuccess(successCount);
    }
  }


  @override
  Widget build(BuildContext context) {
    final mq = MediaQuery.of(context);
    return Container(
      height: mq.size.height * 0.88,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(children: [
        // Handle
        Center(
          child: Container(
            margin: const EdgeInsets.only(top: 10),
            width: 36, height: 4,
            decoration: BoxDecoration(color: Colors.grey[300], borderRadius: BorderRadius.circular(2)),
          ),
        ),
        // Header
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 14, 18, 0),
          child: Row(children: [
            Icon(Icons.add_task, color: widget.color, size: 22),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Add ${widget.stageName} Entry',
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFF1A1A2E)),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, size: 22),
              onPressed: () => Navigator.pop(context),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ]),
        ),
        const Divider(height: 18),
        // Date icon + Search bar row
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 18),
          child: Row(children: [
            // Calendar icon button
            GestureDetector(
              onTap: () async {
                final picked = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now(),
                );
                if (picked != null) setState(() => _date = picked);
              },
              child: Container(
                width: 42, height: 42,
                decoration: BoxDecoration(
                  color: widget.color.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: widget.color.withOpacity(0.25)),
                ),
                child: Icon(Icons.calendar_today, size: 18, color: widget.color),
              ),
            ),
            const SizedBox(width: 10),
            // Search field
            Expanded(
              child: TextField(
                onChanged: (v) => setState(() => _search = v),
                decoration: InputDecoration(
                  hintText: 'Search pipe orders…',
                  hintStyle: TextStyle(fontSize: 13, color: Colors.grey[400]),
                  prefixIcon: const Icon(Icons.search, size: 18),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  filled: true, fillColor: Colors.grey[50],
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: Colors.grey[200]!),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                    borderSide: BorderSide(color: Colors.grey[200]!),
                  ),
                ),
              ),
            ),
          ]),
        ),
        const SizedBox(height: 10),
        // Coating: Sand Mix toggle
        if (widget.stageType == 'COATING') ...[
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(children: [
              const Text('Sand Mix', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1A1A2E))),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.grey[100],
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(children: [
                    Expanded(child: _sandToggleBtn('plaster', 'Plaster Sand')),
                    const SizedBox(width: 4),
                    Expanded(child: _sandToggleBtn('crushed', 'Crushed & Dust')),
                  ]),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 10),
        ],
        // Order list
        Expanded(
          child: _loading
              ? Center(child: CircularProgressIndicator(color: widget.color))
              : _filtered.isEmpty
                  ? Center(
                      child: Text(
                        _search.isEmpty ? 'No active production orders' : 'No orders match "$_search"',
                        style: TextStyle(color: Colors.grey[400], fontSize: 14),
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
                      itemCount: _filtered.length,
                      itemBuilder: (ctx, i) {
                        final order = _filtered[i];
                        final id = order['id'] as int;
                        final isSelected = _selected.containsKey(id);
                        final pipeName = (order['pipeConfig']?['name'] ?? order['pipeName'] ?? 'Unknown').toString();
                        final poNum = (order['poNumber'] ?? '#$id').toString();
                        final planned = order['plannedQty'] ?? 0;
                        final entry = _selected[id];
                        return GestureDetector(
                          onTap: () => _toggleOrder(order),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 180),
                            margin: const EdgeInsets.only(bottom: 8),
                            decoration: BoxDecoration(
                              color: isSelected ? widget.color.withOpacity(0.07) : Colors.grey[50],
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected ? widget.color : Colors.grey[200]!,
                                width: isSelected ? 1.5 : 1,
                              ),
                            ),
                            child: Column(children: [
                              Padding(
                                padding: const EdgeInsets.all(12),
                                child: Row(children: [
                                  AnimatedContainer(
                                    duration: const Duration(milliseconds: 180),
                                    width: 20, height: 20,
                                    decoration: BoxDecoration(
                                      color: isSelected ? widget.color : Colors.transparent,
                                      borderRadius: BorderRadius.circular(5),
                                      border: Border.all(
                                        color: isSelected ? widget.color : Colors.grey[400]!,
                                        width: 1.5,
                                      ),
                                    ),
                                    child: isSelected
                                        ? const Icon(Icons.check, size: 13, color: Colors.white)
                                        : null,
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(pipeName, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1A1A2E))),
                                      const SizedBox(height: 2),
                                      Text('$poNum · Planned: $planned pipes', style: TextStyle(fontSize: 11, color: Colors.grey[500])),
                                    ],
                                  )),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: Colors.orange[50],
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      (order['status'] ?? '').toString().replaceAll('_', ' '),
                                      style: TextStyle(fontSize: 10, color: Colors.orange[700], fontWeight: FontWeight.w600),
                                    ),
                                  ),
                                ]),
                              ),
                              if (isSelected) ...[
                                Divider(height: 1, color: widget.color.withOpacity(0.2)),
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
                                  child: Row(children: [
                                    Expanded(
                                      child: _QtyField(
                                        controller: entry!.processedCtrl,
                                        label: 'Processed',
                                        color: widget.color,
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: _QtyField(
                                        controller: entry.completedCtrl,
                                        label: 'Completed',
                                        color: widget.color,
                                      ),
                                    ),
                                  ]),
                                ),
                              ],
                            ]),
                          ),
                        );
                      },
                    ),
        ),
        // Submit button
        SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.fromLTRB(18, 10, 18, mq.viewInsets.bottom > 0 ? 8 : 16),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: (_selected.isEmpty || _submitting) ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: widget.color,
                  disabledBackgroundColor: Colors.grey[200],
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: _submitting
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Text(
                        _selected.isEmpty
                            ? 'Select orders to save'
                            : 'Save ${_selected.length} ${_selected.length == 1 ? 'Entry' : 'Entries'}',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
              ),
            ),
          ),
        ),
      ]),
    );
  }
}

class _QtyField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final Color color;

  const _QtyField({required this.controller, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600], fontWeight: FontWeight.w500)),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.next,
          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            isDense: true,
            hintText: '0',
            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
            filled: true, fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: color.withOpacity(0.4)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: color.withOpacity(0.3)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: color, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
