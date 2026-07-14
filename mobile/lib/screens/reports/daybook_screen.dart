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
  Set<String> _selectedTypes = {};
  final Set<String> _expandedDays = {};

  DateTimeRange _range = DateTimeRange(
    start: DateTime.now(),
    end: DateTime.now(),
  );

  final _amtFmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
  final _dateFmt = DateFormat('yyyy-MM-dd');
  final _displayDateFmt = DateFormat('d MMM yyyy');

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
      setState(() {
        _entries = data;
        _loading = false;
        // Auto-expand all days on fresh load
        _expandedDays.clear();
        for (final e in data) {
          final d = (e['date'] ?? '').toString().substring(0, 10);
          if (d.isNotEmpty) _expandedDays.add(d);
        }
      });
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

  Set<String> get _allTypes {
    final types = <String>{};
    for (final e in _entries) {
      final t = (e['voucherType'] ?? '').toString().trim();
      if (t.isNotEmpty) types.add(t);
    }
    return types;
  }

  List<dynamic> get _filtered {
    var list = _entries;
    if (_selectedTypes.isNotEmpty) {
      list = list.where((e) => _selectedTypes.contains((e['voucherType'] ?? '').toString().trim())).toList();
    }
    if (_query.isNotEmpty) {
      final q = _query.toLowerCase();
      list = list.where((e) =>
        (e['party'] ?? '').toString().toLowerCase().contains(q) ||
        (e['voucherType'] ?? '').toString().toLowerCase().contains(q) ||
        (e['narration'] ?? '').toString().toLowerCase().contains(q) ||
        (e['voucherNo'] ?? '').toString().toLowerCase().contains(q)
      ).toList();
    }
    return list;
  }

  Map<String, List<dynamic>> get _groupedByDate {
    final filtered = _filtered;
    final map = <String, List<dynamic>>{};
    for (final e in filtered) {
      final d = (e['date'] ?? '').toString();
      final key = d.length >= 10 ? d.substring(0, 10) : d;
      map.putIfAbsent(key, () => []).add(e);
    }
    // Sort dates descending
    final sorted = Map.fromEntries(
      map.entries.toList()..sort((a, b) => b.key.compareTo(a.key)),
    );
    return sorted;
  }

  double get _totalDebit  => _filtered.fold(0.0, (s, e) => s + p.d(e['debit']));
  double get _totalCredit => _filtered.fold(0.0, (s, e) => s + p.d(e['credit']));

  Color _typeColor(String type) {
    switch (type.toUpperCase()) {
      case 'INVOICE':           return const Color(0xFF2563EB);
      case 'PAYMENT_RECEIVED':
      case 'RECEIPT':           return const Color(0xFF16A34A);
      case 'VENDOR_PAYMENT':
      case 'PAYMENT':           return const Color(0xFFDC2626);
      case 'CREDIT_NOTE':
      case 'CREDIT NOTE':       return const Color(0xFFD97706);
      case 'PURCHASE_BILL':
      case 'PURCHASE BILL':     return const Color(0xFF7C3AED);
      case 'SALE_RETURN':
      case 'SALE RETURN':       return const Color(0xFFEA580C);
      case 'PURCHASE_RETURN':
      case 'PURCHASE RETURN':   return const Color(0xFF0D9488);
      case 'VENDOR_CREDIT':
      case 'VENDOR CREDIT':     return const Color(0xFF6366F1);
      case 'EXPENSE':           return const Color(0xFFDB2777);
      default:                  return const Color(0xFF64748B);
    }
  }

  String _typeLabel(String type) => type.replaceAll('_', ' ');

  @override
  Widget build(BuildContext context) {
    final grouped = _groupedByDate;
    final allTypes = _allTypes.toList()..sort();
    final filtered = _filtered;

    final sliverItems = <Widget>[];

    // Filter chips
    if (!_loading && _entries.isNotEmpty) {
      sliverItems.add(SliverToBoxAdapter(
        child: SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            children: [
              _typeChip('All', _selectedTypes.isEmpty, () => setState(() => _selectedTypes.clear())),
              ...allTypes.map((t) => _typeChip(
                _typeLabel(t), _selectedTypes.contains(t),
                () => setState(() {
                  if (_selectedTypes.contains(t)) {
                    _selectedTypes.remove(t);
                  } else {
                    _selectedTypes.add(t);
                  }
                }),
                color: _typeColor(t),
              )),
            ],
          ),
        ),
      ));
    }

    if (_loading) {
      sliverItems.add(const SliverFillRemaining(child: Center(child: CircularProgressIndicator())));
    } else if (_error != null) {
      sliverItems.add(SliverFillRemaining(
        child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.error_outline, size: 48, color: Colors.red),
          const SizedBox(height: 12),
          Text(_error!),
          const SizedBox(height: 16),
          FilledButton(onPressed: _load,
            style: FilledButton.styleFrom(backgroundColor: _color),
            child: const Text('Retry')),
        ])),
      ));
    } else if (filtered.isEmpty) {
      sliverItems.add(SliverFillRemaining(
        child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.book_outlined, size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text(
            _query.isNotEmpty || _selectedTypes.isNotEmpty
                ? 'No entries match your filter'
                : 'No transactions on this date',
            style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600),
          ),
        ])),
      ));
    } else {
      // Build date groups
      for (final entry in grouped.entries) {
        final dateKey = entry.key;
        final dayEntries = entry.value;
        final isExpanded = _expandedDays.contains(dateKey);
        final dayDebit  = dayEntries.fold(0.0, (s, e) => s + p.d(e['debit']));
        final dayCredit = dayEntries.fold(0.0, (s, e) => s + p.d(e['credit']));

        DateTime? parsedDate;
        try { parsedDate = DateTime.parse(dateKey); } catch (_) {}

        sliverItems.add(SliverToBoxAdapter(
          child: GestureDetector(
            onTap: () => setState(() {
              if (isExpanded) _expandedDays.remove(dateKey);
              else _expandedDays.add(dateKey);
            }),
            child: Container(
              margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_color, _colorDark]),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(children: [
                Icon(Icons.calendar_today_outlined, color: Colors.white.withValues(alpha: 0.9), size: 15),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    parsedDate != null ? _displayDateFmt.format(parsedDate) : dateKey,
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                ),
                Text('${dayEntries.length} entries', style: const TextStyle(color: Colors.white70, fontSize: 11)),
                const SizedBox(width: 10),
                _miniStat(_amtFmt.format(dayDebit), 'Dr'),
                const SizedBox(width: 8),
                _miniStat(_amtFmt.format(dayCredit), 'Cr'),
                const SizedBox(width: 6),
                Icon(isExpanded ? Icons.expand_less : Icons.expand_more, color: Colors.white70, size: 18),
              ]),
            ),
          ),
        ));

        if (isExpanded) {
          sliverItems.add(SliverPadding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 0),
            sliver: SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) {
                  final e = dayEntries[i] as Map<String, dynamic>;
                  final debit  = p.d(e['debit']);
                  final credit = p.d(e['credit']);
                  final typeStr = (e['voucherType'] ?? '').toString();
                  final tc = _typeColor(typeStr);
                  return Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6, offset: const Offset(0, 2)),
                      ],
                      border: Border(left: BorderSide(color: tc, width: 3)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(10, 10, 12, 10),
                      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: tc.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(_typeLabel(typeStr),
                                  style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: tc, letterSpacing: 0.2)),
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(e['voucherNo'] ?? '',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                                  overflow: TextOverflow.ellipsis),
                            ),
                          ]),
                          if ((e['party'] ?? '').toString().isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(e['party'] ?? '',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
                          ],
                          if ((e['narration'] ?? '').toString().isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(e['narration'] ?? '',
                                style: TextStyle(fontSize: 11.5, color: Colors.grey.shade500),
                                maxLines: 1, overflow: TextOverflow.ellipsis),
                          ],
                        ])),
                        const SizedBox(width: 12),
                        Column(crossAxisAlignment: CrossAxisAlignment.end, mainAxisAlignment: MainAxisAlignment.center, children: [
                          if (debit > 0)
                            Text(_amtFmt.format(debit),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF2563EB))),
                          if (credit > 0)
                            Text(_amtFmt.format(credit),
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF16A34A))),
                          Text(debit > 0 ? 'Dr' : 'Cr',
                              style: TextStyle(fontSize: 10, color: Colors.grey.shade400)),
                        ]),
                      ]),
                    ),
                  );
                },
                childCount: dayEntries.length,
              ),
            ),
          ));
        }
      }

      // Grand total footer
      sliverItems.add(SliverToBoxAdapter(
        child: Container(
          margin: const EdgeInsets.fromLTRB(12, 8, 12, 8),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(children: [
            const Expanded(
              child: Text('Grand Total', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
            ),
            Text('Dr: ${_amtFmt.format(_totalDebit)}',
                style: const TextStyle(color: Color(0xFF93C5FD), fontWeight: FontWeight.w700, fontSize: 12)),
            const SizedBox(width: 16),
            Text('Cr: ${_amtFmt.format(_totalCredit)}',
                style: const TextStyle(color: Color(0xFF86EFAC), fontWeight: FontWeight.w700, fontSize: 12)),
          ]),
        ),
      ));

      sliverItems.add(const SliverToBoxAdapter(child: SizedBox(height: 80)));
    }

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
                      _hStat('${_filtered.length}', 'Entries'),
                      _hStat(_amtFmt.format(_totalDebit),  'Total Dr'),
                      _hStat(_amtFmt.format(_totalCredit), 'Total Cr'),
                    ]),
                  )),
              ]),
            ),
          ),
        ),
        ...sliverItems,
      ]),
      bottomNavigationBar: _buildFloatingNav(),
    );
  }

  Widget _typeChip(String label, bool selected, VoidCallback onTap, {Color? color}) {
    final c = color ?? _color;
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        margin: const EdgeInsets.only(right: 6),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        decoration: BoxDecoration(
          color: selected ? c : Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? c : const Color(0xFFE2E8F0)),
          boxShadow: selected ? [BoxShadow(color: c.withValues(alpha: 0.25), blurRadius: 6, offset: const Offset(0, 2))] : [],
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            color: selected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _miniStat(String value, String label) => Row(mainAxisSize: MainAxisSize.min, children: [
    Text(label, style: const TextStyle(color: Colors.white60, fontSize: 10)),
    const SizedBox(width: 3),
    Text(value, style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
  ]);

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
      _floatItem(icon: Icons.search,        label: 'Search',   active: false, onTap: () => setState(() => _showSearch = true)),
      _floatItem(icon: Icons.book_outlined, label: 'Day Book', active: true,  onTap: () {}),
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
