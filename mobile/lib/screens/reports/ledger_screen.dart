import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../utils/parse.dart' as p;

class LedgerScreen extends ConsumerStatefulWidget {
  const LedgerScreen({super.key});

  @override
  ConsumerState<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends ConsumerState<LedgerScreen> {
  static const _color = Color(0xFF7C3AED);
  static const _colorDark = Color(0xFF6D28D9);

  List<dynamic> _accounts = [];
  bool _loading = true;
  String? _error;
  bool _showSearch = false;
  String _query = '';
  final _searchCtrl = TextEditingController();

  DateTimeRange _range = DateTimeRange(
    start: DateTime(DateTime.now().year, DateTime.now().month, 1),
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
      final data = await ApiService().getLedger(outletId, from, to);
      final accounts = (data['accounts'] as List?) ?? [];
      setState(() { _accounts = accounts; _loading = false; });
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
    if (_query.isEmpty) return _accounts;
    final q = _query.toLowerCase();
    return _accounts.where((a) =>
      (a['name'] ?? '').toString().toLowerCase().contains(q) ||
      (a['accountType'] ?? '').toString().toLowerCase().contains(q)
    ).toList();
  }

  Color _typeColor(String type) {
    switch (type.toUpperCase()) {
      case 'DEBTOR':
      case 'CUSTOMER':       return const Color(0xFF2563EB);
      case 'CREDITOR':
      case 'VENDOR':
      case 'SUPPLIER':       return const Color(0xFF7C3AED);
      case 'BANK':           return const Color(0xFF0891B2);
      case 'CASH':           return const Color(0xFF16A34A);
      case 'EXPENSE':        return const Color(0xFFDC2626);
      case 'INCOME':
      case 'REVENUE':        return const Color(0xFF059669);
      default:               return const Color(0xFF64748B);
    }
  }

  IconData _typeIcon(String type) {
    switch (type.toUpperCase()) {
      case 'DEBTOR':
      case 'CUSTOMER':       return Icons.person_outlined;
      case 'CREDITOR':
      case 'VENDOR':
      case 'SUPPLIER':       return Icons.store_outlined;
      case 'BANK':           return Icons.account_balance_outlined;
      case 'CASH':           return Icons.payments_outlined;
      case 'EXPENSE':        return Icons.trending_down_outlined;
      case 'INCOME':
      case 'REVENUE':        return Icons.trending_up_outlined;
      default:               return Icons.account_circle_outlined;
    }
  }

  String _partyType(String accountType) {
    switch (accountType.toUpperCase()) {
      case 'DEBTOR':
      case 'CUSTOMER': return 'customer';
      default:         return 'supplier';
    }
  }

  void _openDetail(Map<String, dynamic> account) {
    final partyId = account['partyId'];
    if (partyId == null) return;
    final typeStr = (account['accountType'] ?? '').toString();

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _LedgerDetailSheet(
        account: account,
        partyId: partyId is int ? partyId : int.tryParse(partyId.toString()) ?? 0,
        partyType: _partyType(typeStr),
        from: _dateFmt.format(_range.start),
        to: _dateFmt.format(_range.end),
        outletId: ref.read(authProvider).user?.outletId ?? 0,
        amtFmt: _amtFmt,
        color: _typeColor(typeStr),
      ),
    );
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
          title: const Text('Ledger',
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
                      _hStat('${filtered.length}', 'Accounts'),
                      _hStat(
                        _amtFmt.format(_accounts.fold(0.0, (s, a) => s + p.d(a['debit']))),
                        'Total Dr',
                      ),
                      _hStat(
                        _amtFmt.format(_accounts.fold(0.0, (s, a) => s + p.d(a['credit']))),
                        'Total Cr',
                      ),
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
              Icon(Icons.account_balance_outlined, size: 48, color: Colors.grey.shade300),
              const SizedBox(height: 12),
              Text(
                _query.isNotEmpty ? 'No accounts match your search' : 'No ledger data for this period',
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
                  final a = filtered[i] as Map<String, dynamic>;
                  final typeStr = (a['accountType'] ?? '').toString();
                  final tc = _typeColor(typeStr);
                  final opening = p.d(a['openingBalance']);
                  final debit   = p.d(a['debit']);
                  final credit  = p.d(a['credit']);
                  final closing = p.d(a['closingBalance']);
                  final hasDetail = a['partyId'] != null;

                  return GestureDetector(
                    onTap: hasDetail ? () => _openDetail(a) : null,
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 8, offset: const Offset(0, 2)),
                        ],
                        border: hasDetail ? Border.all(color: tc.withValues(alpha: 0.15)) : null,
                      ),
                      child: Column(children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                          child: Row(children: [
                            Container(
                              width: 38, height: 38,
                              decoration: BoxDecoration(
                                color: tc.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(9),
                              ),
                              child: Icon(_typeIcon(typeStr), color: tc, size: 18),
                            ),
                            const SizedBox(width: 10),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(a['name'] ?? '',
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E293B))),
                              const SizedBox(height: 1),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                decoration: BoxDecoration(
                                  color: tc.withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(typeStr,
                                    style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w700, color: tc, letterSpacing: 0.2)),
                              ),
                            ])),
                            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              Text(_amtFmt.format(closing.abs()),
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    color: closing >= 0 ? const Color(0xFF2563EB) : const Color(0xFF16A34A),
                                  )),
                              Text(closing >= 0 ? 'Dr Balance' : 'Cr Balance',
                                  style: TextStyle(fontSize: 9.5, color: Colors.grey.shade500)),
                            ]),
                            if (hasDetail) ...[
                              const SizedBox(width: 6),
                              Icon(Icons.chevron_right, color: tc.withValues(alpha: 0.5), size: 18),
                            ],
                          ]),
                        ),
                        Container(
                          margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(children: [
                            _amtCol('Opening', opening, const Color(0xFF64748B)),
                            _divider(),
                            _amtCol('Debit', debit, const Color(0xFF2563EB)),
                            _divider(),
                            _amtCol('Credit', credit, const Color(0xFF16A34A)),
                            _divider(),
                            _amtCol('Closing', closing.abs(), closing >= 0 ? const Color(0xFF2563EB) : const Color(0xFF16A34A)),
                          ]),
                        ),
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

  Widget _amtCol(String label, double amount, Color color) => Expanded(
    child: Column(children: [
      Text(_amtFmt.format(amount.abs()),
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: color),
          overflow: TextOverflow.ellipsis),
      const SizedBox(height: 2),
      Text(label, style: const TextStyle(fontSize: 9.5, color: Color(0xFF94A3B8))),
    ]),
  );

  Widget _divider() => Container(width: 1, height: 28, color: const Color(0xFFE2E8F0), margin: const EdgeInsets.symmetric(horizontal: 4));

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
    return Row(key: const ValueKey('lgsearch'), children: [
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
            hintText: 'Search accounts…',
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
    return Row(key: const ValueKey('lgnav'), children: [
      _floatItem(icon: Icons.search,                  label: 'Search', active: false, onTap: () => setState(() => _showSearch = true)),
      _floatItem(icon: Icons.account_balance_outlined, label: 'Ledger', active: true,  onTap: () {}),
      _floatItem(icon: Icons.date_range,              label: 'Date',   active: false, onTap: _pickRange),
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

// ---- Ledger Detail Bottom Sheet ----

class _LedgerDetailSheet extends StatefulWidget {
  final Map<String, dynamic> account;
  final int partyId;
  final String partyType;
  final String from;
  final String to;
  final int outletId;
  final NumberFormat amtFmt;
  final Color color;

  const _LedgerDetailSheet({
    required this.account,
    required this.partyId,
    required this.partyType,
    required this.from,
    required this.to,
    required this.outletId,
    required this.amtFmt,
    required this.color,
  });

  @override
  State<_LedgerDetailSheet> createState() => _LedgerDetailSheetState();
}

class _LedgerDetailSheetState extends State<_LedgerDetailSheet> {
  List<dynamic> _entries = [];
  double _openingBalance = 0;
  double _closingBalance = 0;
  bool _loading = true;
  String? _error;
  final _dateFmt = DateFormat('d MMM yy');

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await ApiService().getLedgerDetail(
        widget.outletId, widget.partyId, widget.partyType, widget.from, widget.to,
      );
      setState(() {
        _entries = (data['entries'] as List?) ?? [];
        _openingBalance = p.d(data['openingBalance']);
        _closingBalance = p.d(data['closingBalance']);
        _loading = false;
      });
    } catch (e) {
      setState(() { _loading = false; _error = e.toString(); });
    }
  }

  Color _voucherColor(String type) {
    switch (type.toUpperCase()) {
      case 'INVOICE':         return const Color(0xFF2563EB);
      case 'PAYMENT_RECEIVED':
      case 'RECEIPT':         return const Color(0xFF16A34A);
      case 'VENDOR_PAYMENT':
      case 'PAYMENT':         return const Color(0xFFDC2626);
      case 'CREDIT_NOTE':     return const Color(0xFFD97706);
      case 'PURCHASE_BILL':   return const Color(0xFF7C3AED);
      default:                return const Color(0xFF64748B);
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.account['name'] ?? '';
    final c = widget.color;

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (ctx, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFFF9FAFB),
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Column(children: [
          // Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 6),
              width: 36, height: 4,
              decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
            ),
          ),
          // Header
          Container(
            margin: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [c, Color.lerp(c, Colors.black, 0.2)!]),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Column(children: [
              Row(children: [
                Expanded(
                  child: Text(name,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                ),
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    width: 32, height: 32,
                    decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), shape: BoxShape.circle),
                    child: const Icon(Icons.close, color: Colors.white, size: 16),
                  ),
                ),
              ]),
              const SizedBox(height: 10),
              Row(children: [
                _sheetStat(widget.amtFmt.format(_openingBalance.abs()),
                    _openingBalance >= 0 ? 'Opening Dr' : 'Opening Cr'),
                _sheetStat(widget.amtFmt.format(_closingBalance.abs()),
                    _closingBalance >= 0 ? 'Closing Dr' : 'Closing Cr'),
                _sheetStat('${_entries.length}', 'Transactions'),
              ]),
            ]),
          ),
          // Entries
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
                    : _entries.isEmpty
                        ? Center(
                            child: Column(mainAxisSize: MainAxisSize.min, children: [
                              Icon(Icons.receipt_long_outlined, size: 48, color: Colors.grey.shade300),
                              const SizedBox(height: 8),
                              Text('No transactions', style: TextStyle(color: Colors.grey.shade500)),
                            ]),
                          )
                        : ListView.builder(
                            controller: scrollCtrl,
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                            itemCount: _entries.length,
                            itemBuilder: (ctx, i) {
                              final e = _entries[i] as Map<String, dynamic>;
                              final vType = (e['voucherType'] ?? '').toString();
                              final vc = _voucherColor(vType);
                              final debit  = p.d(e['debit']);
                              final credit = p.d(e['credit']);
                              final balance = p.d(e['balance'] ?? e['runningBalance']);
                              final dateStr = (e['date'] ?? '').toString();
                              String formattedDate = dateStr;
                              try {
                                formattedDate = _dateFmt.format(DateTime.parse(dateStr));
                              } catch (_) {}

                              return Container(
                                margin: const EdgeInsets.only(bottom: 6),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(10),
                                  boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 6)],
                                  border: Border(left: BorderSide(color: vc, width: 3)),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.fromLTRB(10, 10, 12, 10),
                                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                      Row(children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                                          decoration: BoxDecoration(
                                            color: vc.withValues(alpha: 0.1),
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: Text(vType.replaceAll('_', ' '),
                                              style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: vc)),
                                        ),
                                        const SizedBox(width: 6),
                                        Expanded(
                                          child: Text(e['voucherNo'] ?? '',
                                              style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8)),
                                              overflow: TextOverflow.ellipsis),
                                        ),
                                        Text(formattedDate,
                                            style: const TextStyle(fontSize: 10.5, color: Color(0xFF94A3B8))),
                                      ]),
                                      if ((e['particulars'] ?? e['narration'] ?? '').toString().isNotEmpty) ...[
                                        const SizedBox(height: 3),
                                        Text(e['particulars'] ?? e['narration'] ?? '',
                                            style: const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                                            maxLines: 1, overflow: TextOverflow.ellipsis),
                                      ],
                                    ])),
                                    const SizedBox(width: 10),
                                    Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                      if (debit > 0)
                                        Text(widget.amtFmt.format(debit),
                                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                                      if (credit > 0)
                                        Text(widget.amtFmt.format(credit),
                                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF16A34A))),
                                      if (balance != 0)
                                        Text(widget.amtFmt.format(balance.abs()),
                                            style: TextStyle(
                                              fontSize: 10.5,
                                              color: Colors.grey.shade500,
                                              fontWeight: FontWeight.w500,
                                            )),
                                    ]),
                                  ]),
                                ),
                              );
                            },
                          ),
          ),
        ]),
      ),
    );
  }

  Widget _sheetStat(String value, String label) => Expanded(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12),
          overflow: TextOverflow.ellipsis),
      const SizedBox(height: 2),
      Text(label, style: const TextStyle(color: Colors.white70, fontSize: 9), textAlign: TextAlign.center),
    ]),
  );
}
