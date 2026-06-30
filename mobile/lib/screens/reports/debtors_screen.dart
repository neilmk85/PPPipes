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
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final from = DateFormat('yyyy-MM-dd').format(_range.start);
      final to = DateFormat('yyyy-MM-dd').format(_range.end);
      final outletId = ref.read(authProvider).user?.outletId ?? 0;
      final data = await ApiService().getDebtorsLedger(from, to, outletId);
      setState(() {
        _items = data;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
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
      (item['phone'] ?? '').toString().contains(q)
    ).toList();
  }

  double get _totalDue => _items.fold(0.0, (sum, item) => sum + p.d(item['outstandingAmount']));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 106,
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
                    child: Row(children: [
                      _hStat('${_items.length}', 'Parties'),
                      _hStat(_fmt.format(_totalDue), 'Receivable'),
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
            child: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 12),
                Text(_error!),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _load,
                  style: FilledButton.styleFrom(backgroundColor: _color),
                  child: const Text('Retry'),
                ),
              ]),
            ),
          )
        else if (_filtered.isEmpty)
          SliverFillRemaining(
            child: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.account_balance_wallet_outlined, size: 48, color: Colors.grey.shade300),
                const SizedBox(height: 12),
                Text(
                  _query.isNotEmpty ? 'No debtors match your search' : 'No debtors in this period',
                  style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600),
                ),
              ]),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) {
                  final item = _filtered[i] as Map<String, dynamic>;
                  final due = p.d(item['outstandingAmount']);
                  return _LedgerCard(
                    name: item['customerName'] ?? item['name'] ?? 'Unknown',
                    phone: item['phone'],
                    amount: due,
                    fmt: _fmt,
                    label: 'Receivable',
                  );
                },
                childCount: _filtered.length,
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
        width: 48,
        height: 48,
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
            border: InputBorder.none,
            isDense: true,
          ),
        ),
      ),
      GestureDetector(
        onTap: () => setState(() { _showSearch = false; _query = ''; _searchCtrl.clear(); }),
        child: Container(
          margin: const EdgeInsets.all(10),
          width: 40,
          height: 40,
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
                  borderRadius: BorderRadius.all(Radius.circular(26)),
                )
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 22, color: active ? Colors.white : const Color(0xFF94A3B8)),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? Colors.white : const Color(0xFF94A3B8),
                letterSpacing: 0.2,
              ),
            ),
          ]),
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
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final from = DateFormat('yyyy-MM-dd').format(_range.start);
      final to = DateFormat('yyyy-MM-dd').format(_range.end);
      final outletId = ref.read(authProvider).user?.outletId ?? 0;
      final data = await ApiService().getCreditorsLedger(from, to, outletId);
      setState(() {
        _items = data;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
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
      (item['vendorName'] ?? item['name'] ?? '').toString().toLowerCase().contains(q) ||
      (item['phone'] ?? '').toString().contains(q)
    ).toList();
  }

  double get _totalDue => _items.fold(0.0, (sum, item) => sum + p.d(item['outstandingAmount']));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: CustomScrollView(slivers: [
        SliverAppBar(
          pinned: true,
          expandedHeight: 106,
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
                    child: Row(children: [
                      _hStat('${_items.length}', 'Parties'),
                      _hStat(_fmt.format(_totalDue), 'Payable'),
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
            child: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.red),
                const SizedBox(height: 12),
                Text(_error!),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _load,
                  style: FilledButton.styleFrom(backgroundColor: _color),
                  child: const Text('Retry'),
                ),
              ]),
            ),
          )
        else if (_filtered.isEmpty)
          SliverFillRemaining(
            child: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.account_balance_wallet_outlined, size: 48, color: Colors.grey.shade300),
                const SizedBox(height: 12),
                Text(
                  _query.isNotEmpty ? 'No creditors match your search' : 'No creditors in this period',
                  style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600),
                ),
              ]),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) {
                  final item = _filtered[i] as Map<String, dynamic>;
                  final due = p.d(item['outstandingAmount']);
                  return _LedgerCard(
                    name: item['vendorName'] ?? item['name'] ?? 'Unknown',
                    phone: item['phone'],
                    amount: due,
                    fmt: _fmt,
                    label: 'Payable',
                  );
                },
                childCount: _filtered.length,
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
        width: 48,
        height: 48,
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
            border: InputBorder.none,
            isDense: true,
          ),
        ),
      ),
      GestureDetector(
        onTap: () => setState(() { _showSearch = false; _query = ''; _searchCtrl.clear(); }),
        child: Container(
          margin: const EdgeInsets.all(10),
          width: 40,
          height: 40,
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
                  borderRadius: BorderRadius.all(Radius.circular(26)),
                )
              : null,
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, size: 22, color: active ? Colors.white : const Color(0xFF94A3B8)),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                fontSize: 9.5,
                fontWeight: active ? FontWeight.w700 : FontWeight.w500,
                color: active ? Colors.white : const Color(0xFF94A3B8),
                letterSpacing: 0.2,
              ),
            ),
          ]),
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

// ---- Shared Widgets ----

class _LedgerCard extends StatelessWidget {
  final String name;
  final String? phone;
  final double amount;
  final NumberFormat fmt;
  final String label;

  const _LedgerCard({
    required this.name,
    this.phone,
    required this.amount,
    required this.fmt,
    required this.label,
  });

  static const _color = Color(0xFF4F46E5);

  @override
  Widget build(BuildContext context) {
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
        child: Row(children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: _color.withValues(alpha: 0.10),
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: const TextStyle(color: _color, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
              if (phone != null) Text(phone!, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            Text(fmt.format(amount), style: const TextStyle(fontWeight: FontWeight.bold, color: _color, fontSize: 14)),
            Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
          ]),
        ]),
      ),
    );
  }
}
