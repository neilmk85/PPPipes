import '../../utils/parse.dart' as p;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

// ---- Debtors Screen ----

class DebtorsScreen extends ConsumerStatefulWidget {
  const DebtorsScreen({super.key});

  @override
  ConsumerState<DebtorsScreen> createState() => _DebtorsScreenState();
}

class _DebtorsScreenState extends ConsumerState<DebtorsScreen> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;
  bool _showSearch = false;
  String _query = '';
  final _searchCtrl = TextEditingController();
  final Set<int> _expanded = {};
  DateTimeRange _range = DateTimeRange(
    start: DateTime.now().subtract(const Duration(days: 30)),
    end: DateTime.now(),
  );
  final _fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final from = DateFormat('yyyy-MM-dd').format(_range.start);
      final to = DateFormat('yyyy-MM-dd').format(_range.end);
      final outletId = ref.read(authProvider).user?.outletId ?? 0;
      final data = await ApiService().getDebtorsLedger(from, to, outletId);
      setState(() { _items = data; _loading = false; });
    } catch (e) {
      setState(() { _loading = false; _error = e.toString(); });
    }
  }

  Future<void> _pickRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialDateRange: _range,
    );
    if (picked != null) {
      setState(() => _range = picked);
      _load();
    }
  }

  List<dynamic> get _filtered {
    if (_query.isEmpty) return _items;
    final q = _query.toLowerCase();
    return _items.where((item) =>
      (item['customerName'] ?? item['name'] ?? '').toString().toLowerCase().contains(q) ||
      (item['phone'] ?? '').toString().contains(q) ||
      (item['gstin'] ?? '').toString().toLowerCase().contains(q)
    ).toList();
  }

  double get _totalDue      => _items.fold(0.0, (sum, item) => sum + p.d(item['outstanding'] ?? item['outstandingAmount']));
  double get _totalInvoiced => _items.fold(0.0, (sum, item) => sum + p.d(item['totalInvoiced'] ?? item['totalBilled']));
  double get _totalPaid     => _items.fold(0.0, (sum, item) => sum + p.d(item['totalPaid']));

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 120,
          toolbarHeight: 46,
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.white,
          elevation: 0,
          scrolledUnderElevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text(
            'Debtors Ledger',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white),
          ),
          actions: [
            IconButton(icon: const Icon(Icons.date_range, color: Colors.white), onPressed: _pickRange),
            IconButton(icon: const Icon(Icons.refresh, color: Colors.white), onPressed: _load),
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
              child: Stack(children: [
                Positioned(right: -24, top: -24,
                  child: Container(width: 110, height: 110,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.06)))),
                Align(
                  alignment: Alignment.bottomLeft,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(6, 0, 6, 10),
                    child: Row(children: [
                      _hStat('${_items.length}', 'Parties'),
                      _hStat(_fmt.format(_totalInvoiced), 'Invoiced'),
                      _hStat(_fmt.format(_totalPaid), 'Received'),
                      _hStat(_fmt.format(_totalDue), 'Outstanding'),
                    ]),
                  ),
                ),
              ]),
            ),
          ),
        ),
        if (_loading)
          const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
        else if (_error != null)
          SliverFillRemaining(
            child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text(_error!),
              const SizedBox(height: 16),
              FilledButton(onPressed: _load,
                style: FilledButton.styleFrom(backgroundColor: _color),
                child: const Text('Retry')),
            ])),
          )
        else if (filtered.isEmpty)
          SliverFillRemaining(
            child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.account_balance_wallet_outlined, size: 48, color: Colors.grey.shade300),
              const SizedBox(height: 12),
              Text(
                _query.isNotEmpty ? 'No debtors match your search' : 'No debtors in this period',
                style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600),
              ),
            ])),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => _DebtorCard(
                  item: filtered[i] as Map<String, dynamic>,
                  fmt: _fmt,
                  color: _color,
                  expanded: _expanded.contains(i),
                  onToggle: () => setState(() {
                    if (_expanded.contains(i)) _expanded.remove(i);
                    else _expanded.add(i);
                  }),
                ),
                childCount: filtered.length,
              ),
            ),
          ),
      ]),
      bottomNavigationBar: _buildFloatingNav(),
    );
  }

  Widget _buildFloatingNav() {
    return Container(
      color: Colors.transparent,
      child: SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
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
        ]),
      ),
    );
  }

  Widget _buildSearchExpanded() {
    return Row(key: const ValueKey('dsearch'), children: [
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
          onChanged: (v) => setState(() => _query = v),
          decoration: InputDecoration(
            hintText: 'Search debtors…',
            hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
            border: InputBorder.none, isDense: true,
          ),
        ),
      ),
      GestureDetector(
        onTap: () => setState(() { _showSearch = false; _query = ''; _searchCtrl.clear(); }),
        child: Container(
          margin: const EdgeInsets.all(10),
          width: 40, height: 40,
          decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(20)),
          child: const Icon(Icons.close, size: 18, color: Color(0xFF64748B)),
        ),
      ),
    ]);
  }

  Widget _buildNavItems() {
    return Row(key: const ValueKey('dnav'), children: [
      _floatItem(icon: Icons.search, label: 'Search', active: false, onTap: () => setState(() => _showSearch = true)),
      _floatItem(icon: Icons.account_balance_wallet_outlined, label: 'All', active: true, onTap: () {}),
    ]);
  }

  Widget _floatItem({required IconData icon, required String label, required bool active, required VoidCallback onTap}) {
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
                  borderRadius: BorderRadius.all(Radius.circular(26)))
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 22, color: active ? Colors.white : const Color(0xFF94A3B8)),
            const SizedBox(height: 3),
            Text(label, style: TextStyle(
              fontSize: 9.5,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              color: active ? Colors.white : const Color(0xFF94A3B8),
              letterSpacing: 0.2,
            )),
          ]),
        ),
      ),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 8.5, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );
}

// ---- Creditor Screen ----

class CreditorScreen extends ConsumerStatefulWidget {
  const CreditorScreen({super.key});

  @override
  ConsumerState<CreditorScreen> createState() => _CreditorScreenState();
}

class _CreditorScreenState extends ConsumerState<CreditorScreen> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;
  bool _showSearch = false;
  String _query = '';
  final _searchCtrl = TextEditingController();
  final Set<int> _expanded = {};
  DateTimeRange _range = DateTimeRange(
    start: DateTime.now().subtract(const Duration(days: 30)),
    end: DateTime.now(),
  );
  final _fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final from = DateFormat('yyyy-MM-dd').format(_range.start);
      final to = DateFormat('yyyy-MM-dd').format(_range.end);
      final outletId = ref.read(authProvider).user?.outletId ?? 0;
      final data = await ApiService().getCreditorsLedger(from, to, outletId);
      setState(() { _items = data; _loading = false; });
    } catch (e) {
      setState(() { _loading = false; _error = e.toString(); });
    }
  }

  Future<void> _pickRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialDateRange: _range,
    );
    if (picked != null) {
      setState(() => _range = picked);
      _load();
    }
  }

  List<dynamic> get _filtered {
    if (_query.isEmpty) return _items;
    final q = _query.toLowerCase();
    return _items.where((item) =>
      (item['vendorName'] ?? item['supplierName'] ?? item['name'] ?? '').toString().toLowerCase().contains(q) ||
      (item['phone'] ?? '').toString().contains(q) ||
      (item['gstin'] ?? '').toString().toLowerCase().contains(q)
    ).toList();
  }

  double get _totalDue     => _items.fold(0.0, (sum, item) => sum + p.d(item['outstanding'] ?? item['outstandingAmount']));
  double get _totalBilled  => _items.fold(0.0, (sum, item) => sum + p.d(item['totalBilled']));
  double get _totalPaid    => _items.fold(0.0, (sum, item) => sum + p.d(item['totalPaid']));

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 120,
          toolbarHeight: 46,
          backgroundColor: Colors.transparent,
          foregroundColor: Colors.white,
          elevation: 0,
          scrolledUnderElevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.pop(context),
          ),
          title: const Text(
            'Creditors Ledger',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white),
          ),
          actions: [
            IconButton(icon: const Icon(Icons.date_range, color: Colors.white), onPressed: _pickRange),
            IconButton(icon: const Icon(Icons.refresh, color: Colors.white), onPressed: _load),
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
              child: Stack(children: [
                Positioned(right: -24, top: -24,
                  child: Container(width: 110, height: 110,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.06)))),
                Align(
                  alignment: Alignment.bottomLeft,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(6, 0, 6, 10),
                    child: Row(children: [
                      _hStat('${_items.length}', 'Parties'),
                      _hStat(_fmt.format(_totalBilled), 'Billed'),
                      _hStat(_fmt.format(_totalPaid), 'Paid'),
                      _hStat(_fmt.format(_totalDue), 'Outstanding'),
                    ]),
                  ),
                ),
              ]),
            ),
          ),
        ),
        if (_loading)
          const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
        else if (_error != null)
          SliverFillRemaining(
            child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              const Icon(Icons.error_outline, size: 48, color: Colors.red),
              const SizedBox(height: 12),
              Text(_error!),
              const SizedBox(height: 16),
              FilledButton(onPressed: _load,
                style: FilledButton.styleFrom(backgroundColor: _color),
                child: const Text('Retry')),
            ])),
          )
        else if (filtered.isEmpty)
          SliverFillRemaining(
            child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.account_balance_wallet_outlined, size: 48, color: Colors.grey.shade300),
              const SizedBox(height: 12),
              Text(
                _query.isNotEmpty ? 'No creditors match your search' : 'No creditors in this period',
                style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600),
              ),
            ])),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => _CreditorCard(
                  item: filtered[i] as Map<String, dynamic>,
                  fmt: _fmt,
                  color: _color,
                  expanded: _expanded.contains(i),
                  onToggle: () => setState(() {
                    if (_expanded.contains(i)) _expanded.remove(i);
                    else _expanded.add(i);
                  }),
                ),
                childCount: filtered.length,
              ),
            ),
          ),
      ]),
      bottomNavigationBar: _buildFloatingNav(),
    );
  }

  Widget _buildFloatingNav() {
    return Container(
      color: Colors.transparent,
      child: SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
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
        ]),
      ),
    );
  }

  Widget _buildSearchExpanded() {
    return Row(key: const ValueKey('csearch'), children: [
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
          onChanged: (v) => setState(() => _query = v),
          decoration: InputDecoration(
            hintText: 'Search creditors…',
            hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
            border: InputBorder.none, isDense: true,
          ),
        ),
      ),
      GestureDetector(
        onTap: () => setState(() { _showSearch = false; _query = ''; _searchCtrl.clear(); }),
        child: Container(
          margin: const EdgeInsets.all(10),
          width: 40, height: 40,
          decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(20)),
          child: const Icon(Icons.close, size: 18, color: Color(0xFF64748B)),
        ),
      ),
    ]);
  }

  Widget _buildNavItems() {
    return Row(key: const ValueKey('cnav'), children: [
      _floatItem(icon: Icons.search, label: 'Search', active: false, onTap: () => setState(() => _showSearch = true)),
      _floatItem(icon: Icons.account_balance_wallet_outlined, label: 'All', active: true, onTap: () {}),
    ]);
  }

  Widget _floatItem({required IconData icon, required String label, required bool active, required VoidCallback onTap}) {
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
                  borderRadius: BorderRadius.all(Radius.circular(26)))
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 22, color: active ? Colors.white : const Color(0xFF94A3B8)),
            const SizedBox(height: 3),
            Text(label, style: TextStyle(
              fontSize: 9.5,
              fontWeight: active ? FontWeight.w700 : FontWeight.w500,
              color: active ? Colors.white : const Color(0xFF94A3B8),
              letterSpacing: 0.2,
            )),
          ]),
        ),
      ),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 8.5, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );
}

// ---- Shared Party Card with Aging ----

Color _agingColor(int days) {
  if (days <= 0)  return const Color(0xFF16A34A);  // current
  if (days <= 30) return const Color(0xFF2563EB);  // 1-30
  if (days <= 60) return const Color(0xFFD97706);  // 31-60
  if (days <= 90) return const Color(0xFFEA580C);  // 61-90
  return const Color(0xFFDC2626);                  // 90+
}

String _agingLabel(int days) {
  if (days <= 0)  return 'Current';
  if (days <= 30) return '1-30d';
  if (days <= 60) return '31-60d';
  if (days <= 90) return '61-90d';
  return '90+ d';
}

class _DebtorCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final NumberFormat fmt;
  final Color color;
  final bool expanded;
  final VoidCallback onToggle;

  const _DebtorCard({
    required this.item,
    required this.fmt,
    required this.color,
    required this.expanded,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final name = item['customerName'] ?? item['name'] ?? 'Unknown';
    final phone = item['phone']?.toString();
    final outstanding = p.d(item['outstanding'] ?? item['outstandingAmount']);
    final totalInvoiced = p.d(item['totalInvoiced'] ?? item['totalBilled']);
    final totalPaid = p.d(item['totalPaid']);
    final current   = p.d(item['current']);
    final d1_30     = p.d(item['days1_30']);
    final d31_60    = p.d(item['days31_60']);
    final d61_90    = p.d(item['days61_90']);
    final d90plus   = p.d(item['days90plus']);
    final invoices  = (item['invoices'] as List?) ?? [];

    final hasAging = (current + d1_30 + d31_60 + d61_90 + d90plus) > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2)),
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 1)),
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Main row
        InkWell(
          onTap: invoices.isNotEmpty ? onToggle : null,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: color.withValues(alpha: 0.10),
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: TextStyle(color: color, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFF1E293B))),
                    if (phone != null && phone.isNotEmpty)
                      Text(phone, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(fmt.format(outstanding),
                      style: TextStyle(fontWeight: FontWeight.bold, color: outstanding > 0 ? color : Colors.grey, fontSize: 14)),
                  const Text('Receivable', style: TextStyle(fontSize: 10, color: Colors.grey)),
                ]),
                if (invoices.isNotEmpty) ...[
                  const SizedBox(width: 4),
                  Icon(expanded ? Icons.expand_less : Icons.expand_more, color: Colors.grey.shade400, size: 20),
                ],
              ]),
              // Summary row
              if (totalInvoiced > 0 || totalPaid > 0) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(children: [
                    _summaryCol('Invoiced', totalInvoiced, const Color(0xFF64748B)),
                    _vDivider(),
                    _summaryCol('Received', totalPaid, const Color(0xFF16A34A)),
                    _vDivider(),
                    _summaryCol('Due', outstanding, outstanding > 0 ? color : Colors.grey),
                  ]),
                ),
              ],
              // Aging buckets
              if (hasAging) ...[
                const SizedBox(height: 8),
                Row(children: [
                  if (current > 0)   _agingChip('Current', current),
                  if (d1_30 > 0)     _agingChip('1-30d',   d1_30),
                  if (d31_60 > 0)    _agingChip('31-60d',  d31_60),
                  if (d61_90 > 0)    _agingChip('61-90d',  d61_90),
                  if (d90plus > 0)   _agingChip('90+d',    d90plus),
                ]),
              ],
            ]),
          ),
        ),
        // Expanded invoices
        if (expanded && invoices.isNotEmpty) ...[
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Invoices', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.3)),
              const SizedBox(height: 6),
              ...invoices.map((inv) => _InvoiceRow(inv: inv as Map<String, dynamic>, fmt: fmt)),
            ]),
          ),
        ],
      ]),
    );
  }

  Widget _summaryCol(String label, double val, Color c) => Expanded(
    child: Column(children: [
      Text(fmt.format(val), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c), overflow: TextOverflow.ellipsis),
      Text(label, style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
    ]),
  );

  Widget _vDivider() => Container(width: 1, height: 24, color: const Color(0xFFE2E8F0), margin: const EdgeInsets.symmetric(horizontal: 6));

  Widget _agingChip(String label, double amount) {
    final days = label == 'Current' ? 0 : int.tryParse(label.split('-')[0].replaceAll('+d', '').replaceAll('d', '')) ?? 0;
    final c = _agingColor(days);
    return Container(
      margin: const EdgeInsets.only(right: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: c)),
        Text(fmt.format(amount), style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: c)),
      ]),
    );
  }
}

class _CreditorCard extends StatelessWidget {
  final Map<String, dynamic> item;
  final NumberFormat fmt;
  final Color color;
  final bool expanded;
  final VoidCallback onToggle;

  const _CreditorCard({
    required this.item,
    required this.fmt,
    required this.color,
    required this.expanded,
    required this.onToggle,
  });

  @override
  Widget build(BuildContext context) {
    final name = item['vendorName'] ?? item['supplierName'] ?? item['name'] ?? 'Unknown';
    final phone = item['phone']?.toString();
    final outstanding = p.d(item['outstanding'] ?? item['outstandingAmount']);
    final totalBilled  = p.d(item['totalBilled']);
    final totalPaid    = p.d(item['totalPaid']);
    final current      = p.d(item['current']);
    final d1_30        = p.d(item['days1_30']);
    final d31_60       = p.d(item['days31_60']);
    final d61_90       = p.d(item['days61_90']);
    final d90plus      = p.d(item['days90plus']);
    final bills        = (item['bills'] as List?) ?? [];

    final hasAging = (current + d1_30 + d31_60 + d61_90 + d90plus) > 0;
    const creditorColor = Color(0xFF7C3AED);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2)),
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 1)),
        ],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        InkWell(
          onTap: bills.isNotEmpty ? onToggle : null,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: creditorColor.withValues(alpha: 0.10),
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : '?',
                    style: const TextStyle(color: creditorColor, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: Color(0xFF1E293B))),
                    if (phone != null && phone.isNotEmpty)
                      Text(phone, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                  ]),
                ),
                Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                  Text(fmt.format(outstanding),
                      style: TextStyle(fontWeight: FontWeight.bold, color: outstanding > 0 ? creditorColor : Colors.grey, fontSize: 14)),
                  const Text('Payable', style: TextStyle(fontSize: 10, color: Colors.grey)),
                ]),
                if (bills.isNotEmpty) ...[
                  const SizedBox(width: 4),
                  Icon(expanded ? Icons.expand_less : Icons.expand_more, color: Colors.grey.shade400, size: 20),
                ],
              ]),
              if (totalBilled > 0 || totalPaid > 0) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(8)),
                  child: Row(children: [
                    _summaryCol('Billed', totalBilled, const Color(0xFF64748B)),
                    _vDivider(),
                    _summaryCol('Paid', totalPaid, const Color(0xFF16A34A)),
                    _vDivider(),
                    _summaryCol('Due', outstanding, outstanding > 0 ? creditorColor : Colors.grey),
                  ]),
                ),
              ],
              if (hasAging) ...[
                const SizedBox(height: 8),
                Row(children: [
                  if (current > 0)   _agingChip('Current', current),
                  if (d1_30 > 0)     _agingChip('1-30d',   d1_30),
                  if (d31_60 > 0)    _agingChip('31-60d',  d31_60),
                  if (d61_90 > 0)    _agingChip('61-90d',  d61_90),
                  if (d90plus > 0)   _agingChip('90+d',    d90plus),
                ]),
              ],
            ]),
          ),
        ),
        if (expanded && bills.isNotEmpty) ...[
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('Bills', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF64748B), letterSpacing: 0.3)),
              const SizedBox(height: 6),
              ...bills.map((bill) => _BillRow(bill: bill as Map<String, dynamic>, fmt: fmt)),
            ]),
          ),
        ],
      ]),
    );
  }

  Widget _summaryCol(String label, double val, Color c) => Expanded(
    child: Column(children: [
      Text(fmt.format(val), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: c), overflow: TextOverflow.ellipsis),
      Text(label, style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8))),
    ]),
  );

  Widget _vDivider() => Container(width: 1, height: 24, color: const Color(0xFFE2E8F0), margin: const EdgeInsets.symmetric(horizontal: 6));

  Widget _agingChip(String label, double amount) {
    final days = label == 'Current' ? 0 : int.tryParse(label.split('-')[0].replaceAll('+d', '').replaceAll('d', '')) ?? 0;
    final c = _agingColor(days);
    return Container(
      margin: const EdgeInsets.only(right: 4),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: c)),
        Text(fmt.format(amount), style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, color: c)),
      ]),
    );
  }
}

class _InvoiceRow extends StatelessWidget {
  final Map<String, dynamic> inv;
  final NumberFormat fmt;
  const _InvoiceRow({required this.inv, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final no = inv['invoiceNumber'] ?? inv['invoiceNo'] ?? inv['refNo'] ?? '';
    final date = _shortDate(inv['issueDate'] ?? inv['date'] ?? '');
    final due = _shortDate(inv['dueDate'] ?? '');
    final outstanding = p.d(inv['outstanding'] ?? inv['outstandingAmount']);
    final total = p.d(inv['totalAmount'] ?? inv['amount']);
    final days = (inv['daysOverdue'] as num?)?.toInt() ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(no, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: _agingColor(days).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(_agingLabel(days),
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: _agingColor(days))),
            ),
          ]),
          const SizedBox(height: 2),
          Text('$date${due.isNotEmpty ? ' · Due $due' : ''}',
              style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8))),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(fmt.format(outstanding),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: outstanding > 0 ? const Color(0xFF4F46E5) : Colors.grey)),
          if (total > outstanding)
            Text('of ${fmt.format(total)}',
                style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
        ]),
      ]),
    );
  }

  String _shortDate(String raw) {
    if (raw.isEmpty) return '';
    try {
      final d = DateTime.parse(raw);
      return DateFormat('d MMM yy').format(d);
    } catch (_) {
      return raw.length >= 10 ? raw.substring(0, 10) : raw;
    }
  }
}

class _BillRow extends StatelessWidget {
  final Map<String, dynamic> bill;
  final NumberFormat fmt;
  const _BillRow({required this.bill, required this.fmt});

  @override
  Widget build(BuildContext context) {
    final no = bill['billNumber'] ?? bill['billNo'] ?? bill['refNo'] ?? '';
    final date = _shortDate(bill['billDate'] ?? bill['date'] ?? '');
    final due = _shortDate(bill['dueDate'] ?? '');
    final outstanding = p.d(bill['outstanding'] ?? bill['outstandingAmount']);
    final total = p.d(bill['totalAmount'] ?? bill['amount']);
    final days = (bill['daysOverdue'] as num?)?.toInt() ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text(no, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
              decoration: BoxDecoration(
                color: _agingColor(days).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(_agingLabel(days),
                  style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: _agingColor(days))),
            ),
          ]),
          const SizedBox(height: 2),
          Text('$date${due.isNotEmpty ? ' · Due $due' : ''}',
              style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8))),
        ])),
        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Text(fmt.format(outstanding),
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: outstanding > 0 ? const Color(0xFF7C3AED) : Colors.grey)),
          if (total > outstanding)
            Text('of ${fmt.format(total)}',
                style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
        ]),
      ]),
    );
  }

  String _shortDate(String raw) {
    if (raw.isEmpty) return '';
    try {
      final d = DateTime.parse(raw);
      return DateFormat('d MMM yy').format(d);
    } catch (_) {
      return raw.length >= 10 ? raw.substring(0, 10) : raw;
    }
  }
}
