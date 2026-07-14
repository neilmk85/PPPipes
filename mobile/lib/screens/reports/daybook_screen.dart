import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../utils/parse.dart' as p;

class DaybookScreen extends ConsumerStatefulWidget {
  const DaybookScreen({super.key});

  @override
  ConsumerState<DaybookScreen> createState() => _DaybookScreenState();
}

class _DaybookScreenState extends ConsumerState<DaybookScreen> {
  static const _color = Color(0xFF0891B2);
  static const _colorDark = Color(0xFF0E7490);

  List<dynamic> _entries = [];
  bool _loading = true;
  String? _error;
  bool _showSearch = false;
  String _query = '';
  final _searchCtrl = TextEditingController();

  DateTimeRange _range = DateTimeRange(
    start: DateTime.now(),
    end: DateTime.now(),
  );

  final _amtFmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
  final _dateFmt = DateFormat('yyyy-MM-dd');

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
      final outletId = ref.read(authProvider).user?.outletId ?? 0;
      final from = _dateFmt.format(_range.start);
      final to   = _dateFmt.format(_range.end);
      final data = await ApiService().getDaybook(outletId, from, to);
      setState(() { _entries = data; _loading = false; });
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
    if (_query.isEmpty) return _entries;
    final q = _query.toLowerCase();
    return _entries.where((e) =>
      (e['party'] ?? '').toString().toLowerCase().contains(q) ||
      (e['voucherType'] ?? '').toString().toLowerCase().contains(q) ||
      (e['narration'] ?? '').toString().toLowerCase().contains(q) ||
      (e['voucherNo'] ?? '').toString().toLowerCase().contains(q)
    ).toList();
  }

  double get _totalDebit  => _entries.fold(0.0, (s, e) => s + p.d(e['debit']));
  double get _totalCredit => _entries.fold(0.0, (s, e) => s + p.d(e['credit']));

  Color _typeColor(String type) {
    switch (type.toUpperCase()) {
      case 'INVOICE':         return const Color(0xFF2563EB);
      case 'RECEIPT':         return const Color(0xFF16A34A);
      case 'PAYMENT':         return const Color(0xFFDC2626);
      case 'CREDIT NOTE':     return const Color(0xFFD97706);
      case 'PURCHASE BILL':   return const Color(0xFF7C3AED);
      case 'SALE RETURN':     return const Color(0xFFEA580C);
      case 'PURCHASE RETURN': return const Color(0xFF0D9488);
      case 'VENDOR CREDIT':   return const Color(0xFF6366F1);
      default:                return const Color(0xFF64748B);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
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
          title: const Text('Day Book',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white)),
          actions: [
            IconButton(icon: const Icon(Icons.date_range, color: Colors.white), onPressed: _pickRange),
            IconButton(icon: const Icon(Icons.refresh, color: Colors.white), onPressed: _load),
          ],
          flexibleSpace: FlexibleSpaceBar(
            collapseMode: CollapseMode.pin,
            background: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [_color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight),
              ),
              child: Stack(children: [
                Positioned(right: -24, top: -24,
                  child: Container(width: 110, height: 110,
                    decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.06)))),
                Align(alignment: Alignment.bottomLeft,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(6, 0, 6, 10),
                    child: Row(children: [
                      _hStat('${filtered.length}', 'Entries'),
                      _hStat(_amtFmt.format(_totalDebit),  'Debit'),
                      _hStat(_amtFmt.format(_totalCredit), 'Credit'),
                    ]),
                  )),
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
              Icon(Icons.book_outlined, size: 48, color: Colors.grey.shade300),
              const SizedBox(height: 12),
              Text(
                _query.isNotEmpty ? 'No entries match your search' : 'No transactions on this date',
                style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600),
              ),
            ])),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) {
                  final e = filtered[i] as Map<String, dynamic>;
                  final debit  = p.d(e['debit']);
                  final credit = p.d(e['credit']);
                  final typeStr = (e['voucherType'] ?? '').toString();
                  final tc = _typeColor(typeStr);
                  return Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2)),
                      ],
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Container(
                          width: 40, height: 40,
                          decoration: BoxDecoration(
                            color: tc.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            debit > 0 ? Icons.arrow_upward : Icons.arrow_downward,
                            color: tc, size: 18,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: tc.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(typeStr,
                                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: tc, letterSpacing: 0.2)),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(e['voucherNo'] ?? '',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                  overflow: TextOverflow.ellipsis),
                            ),
                            Text(e['date'] ?? '',
                                style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
                          ]),
                          if ((e['party'] ?? '').toString().isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(e['party'] ?? '',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
                          ],
                          if ((e['narration'] ?? '').toString().isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(e['narration'] ?? '',
                                style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                                maxLines: 1, overflow: TextOverflow.ellipsis),
                          ],
                        ])),
                        const SizedBox(width: 12),
                        Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                          if (debit > 0)
                            Text(_amtFmt.format(debit),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF2563EB))),
                          if (credit > 0)
                            Text(_amtFmt.format(credit),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF16A34A))),
                          const SizedBox(height: 2),
                          Text(debit > 0 ? 'Dr' : 'Cr',
                              style: TextStyle(fontSize: 10, color: Colors.grey.shade400)),
                        ]),
                      ]),
                    ),
                  );
                },
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
        child: Padding(
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
      ),
    );
  }

  Widget _buildSearchExpanded() {
    return Row(key: const ValueKey('dbsearch'), children: [
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
            hintText: 'Search party, type, narration…',
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
    return Row(key: const ValueKey('dbnav'), children: [
      _floatItem(icon: Icons.search,       label: 'Search', active: false, onTap: () => setState(() => _showSearch = true)),
      _floatItem(icon: Icons.book_outlined, label: 'Day Book', active: true,  onTap: () {}),
      _floatItem(icon: Icons.date_range,   label: 'Date',   active: false, onTap: _pickRange),
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
      Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white)),
      Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
    ]),
  );
}
