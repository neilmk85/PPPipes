import '../../utils/parse.dart' as sp;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../widgets/date_filter_dropdown.dart';

class GstScreen extends ConsumerStatefulWidget {
  const GstScreen({super.key});

  @override
  ConsumerState<GstScreen> createState() => _GstScreenState();
}

class _GstScreenState extends ConsumerState<GstScreen> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  String _tab = 'gstr1';
  Map<String, dynamic>? _gstr1;
  Map<String, dynamic>? _gstr3b;
  List<dynamic> _hsnSummary = [];
  bool _loading = true;
  String? _error;
  BizDateFilter _dateFilter = BizDateFilter(
    preset: 'this_month',
    from: bizResolveFrom('this_month'),
    to: bizResolveTo('this_month'),
  );
  final LayerLink _layerLink = LayerLink();
  OverlayEntry? _overlayEntry;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _overlayEntry?.remove();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final from = DateFormat('yyyy-MM-dd').format(_dateFilter.from ?? bizResolveFrom('this_month'));
      final to = DateFormat('yyyy-MM-dd').format(_dateFilter.to ?? DateTime.now());
      final outletId = ref.read(authProvider).user?.outletId ?? 0;
      final results = await Future.wait([
        ApiService().getGstr1(from, to, outletId),
        ApiService().getGstr3b(from, to, outletId),
        ApiService().getHsnSummary(from, to, outletId),
      ]);
      setState(() {
        _gstr1 = results[0] as Map<String, dynamic>;
        _gstr3b = results[1] as Map<String, dynamic>;
        _hsnSummary = results[2] as List<dynamic>;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  void _toggleDateDropdown() {
    if (_overlayEntry != null) {
      _dismissDropdown();
      return;
    }
    _overlayEntry = OverlayEntry(
      builder: (_) => BizDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          setState(() => _dateFilter = f);
          _dismissDropdown();
          _load();
        },
        onDismiss: _dismissDropdown,
      ),
    );
    Overlay.of(context).insert(_overlayEntry!);
  }

  void _dismissDropdown() {
    _overlayEntry?.remove();
    _overlayEntry = null;
  }

  Widget _buildTabContent() {
    switch (_tab) {
      case 'gstr3b':
        return _Gstr3bTab(data: _gstr3b ?? {});
      case 'hsn':
        return _HsnTab(data: _hsnSummary);
      default:
        return _Gstr1Tab(data: _gstr1 ?? {});
    }
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
                child: Row(
                  children: [
                    _navItem(
                        icon: Icons.description_outlined,
                        label: 'GSTR-1',
                        tab: 'gstr1'),
                    _navItem(
                        icon: Icons.receipt_long_outlined,
                        label: 'GSTR-3B',
                        tab: 'gstr3b'),
                    _navItem(
                        icon: Icons.grid_view_outlined,
                        label: 'HSN',
                        tab: 'hsn'),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _navItem(
      {required IconData icon, required String label, required String tab}) {
    final active = _tab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _tab = tab),
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
            Text(value,
                style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Colors.white)),
            Text(label,
                style: const TextStyle(
                    fontSize: 9,
                    color: Colors.white70,
                    letterSpacing: 0.2),
                textAlign: TextAlign.center),
          ],
        ),
      );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: CustomScrollView(
        slivers: [
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
              'GST Reports',
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
                child: IconButton(
                  icon: const Icon(Icons.date_range, color: Colors.white),
                  onPressed: _toggleDateDropdown,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.refresh, color: Colors.white),
                onPressed: _load,
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
                            _hStat(
                              _tab == 'gstr1'
                                  ? 'GSTR-1'
                                  : _tab == 'gstr3b'
                                      ? 'GSTR-3B'
                                      : 'HSN',
                              'View',
                            ),
                            _hStat(_dateFilter.label, 'Period'),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          if (_loading)
            const SliverFillRemaining(
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline,
                        size: 48, color: Colors.red),
                    const SizedBox(height: 12),
                    Text(_error!),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _load,
                      style: FilledButton.styleFrom(backgroundColor: _color),
                      child: const Text('Retry'),
                    ),
                  ],
                ),
              ),
            )
          else
            SliverFillRemaining(child: _buildTabContent()),
        ],
      ),
      bottomNavigationBar: _buildFloatingNav(),
    );
  }
}

class _Gstr1Tab extends StatelessWidget {
  final Map<String, dynamic> data;
  const _Gstr1Tab({required this.data});

  @override
  Widget build(BuildContext context) {
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final totalTaxableValue = sp.d(data['totalTaxableValue']);
    final cgst = sp.d(data['totalCgst']);
    final sgst = sp.d(data['totalSgst']);
    final igst = sp.d(data['totalIgst']);
    final totalTax = cgst + sgst + igst;
    final totalInvoices = data['totalInvoices'] ?? 0;

    final b2bList = (data['b2b'] as List?) ?? [];
    final b2csList = (data['b2cs'] as List?) ?? [];
    final b2bTaxable = b2bList.fold<double>(
        0, (s, r) => s + sp.d((r as Map<String, dynamic>)['taxableValue']));
    final b2csTaxable = b2csList.fold<double>(
        0, (s, r) => s + sp.d((r as Map<String, dynamic>)['taxableValue']));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _GstSummaryCard(
            title: 'GSTR-1 Summary',
            color: const Color(0xFF1565C0),
            rows: [
              ('Total Invoices', totalInvoices.toString()),
              ('Taxable Value', fmt.format(totalTaxableValue)),
              ('Total Tax', fmt.format(totalTax)),
              ('CGST', fmt.format(cgst)),
              ('SGST', fmt.format(sgst)),
              if (igst > 0) ('IGST', fmt.format(igst)),
            ],
          ),
          if (b2bList.isNotEmpty || b2csList.isNotEmpty) ...[
            const SizedBox(height: 16),
            _GstSummaryCard(
              title: 'Breakdown',
              color: const Color(0xFF1976D2),
              rows: [
                if (b2bList.isNotEmpty)
                  ('B2B Invoices', b2bList.length.toString()),
                if (b2bTaxable > 0)
                  ('B2B Taxable', fmt.format(b2bTaxable)),
                if (b2csList.isNotEmpty)
                  ('B2CS Groups', b2csList.length.toString()),
                if (b2csTaxable > 0)
                  ('B2CS Taxable', fmt.format(b2csTaxable)),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Gstr3bTab extends StatelessWidget {
  final Map<String, dynamic> data;
  const _Gstr3bTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    final sec31 = (data['section3_1_taxable'] as Map<String, dynamic>?) ?? {};
    final sec4 = (data['section4_itc'] as Map<String, dynamic>?) ?? {};
    final netTax = (data['netTaxPayable'] as Map<String, dynamic>?) ?? {};
    final itcCarry = (data['itcCarryForward'] as Map<String, dynamic>?) ?? {};

    final outwardCgst = sp.d(sec31['cgst']);
    final outwardSgst = sp.d(sec31['sgst']);
    final outwardTax = outwardCgst + outwardSgst;
    final taxableValue = sp.d(sec31['taxableValue']);

    final itcCgst = sp.d(sec4['cgst']);
    final itcSgst = sp.d(sec4['sgst']);
    final itcIgst = sp.d(sec4['igst']);
    final totalItc = itcCgst + itcSgst + itcIgst;

    final netCgst = sp.d(netTax['cgst']);
    final netSgst = sp.d(netTax['sgst']);
    final netIgst = sp.d(netTax['igst']);
    final netTotal = sp.d(netTax['total']);

    final carryTotal = sp.d(itcCarry['total']);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _GstSummaryCard(
            title: '3.1 — Outward Tax Liability',
            color: const Color(0xFF00796B),
            rows: [
              ('Invoices', (data['billCount'] ?? 0).toString()),
              ('Taxable Value', fmt.format(taxableValue)),
              ('CGST', fmt.format(outwardCgst)),
              ('SGST', fmt.format(outwardSgst)),
              ('Total Output Tax', fmt.format(outwardTax)),
            ],
          ),
          const SizedBox(height: 16),
          _GstSummaryCard(
            title: '4 — Input Tax Credit (ITC)',
            color: const Color(0xFF1565C0),
            rows: [
              if (itcIgst > 0) ('IGST Credit', fmt.format(itcIgst)),
              ('CGST Credit', fmt.format(itcCgst)),
              ('SGST Credit', fmt.format(itcSgst)),
              ('Total ITC', fmt.format(totalItc)),
            ],
          ),
          const SizedBox(height: 16),
          _GstSummaryCard(
            title: 'Net Tax Payable',
            color: const Color(0xFF7B1FA2),
            rows: [
              if (netIgst > 0) ('IGST Payable', fmt.format(netIgst)),
              ('CGST Payable', fmt.format(netCgst)),
              ('SGST Payable', fmt.format(netSgst)),
              ('Total Payable', fmt.format(netTotal)),
              if (carryTotal > 0) ('ITC Carry Forward', fmt.format(carryTotal)),
            ],
          ),
        ],
      ),
    );
  }
}

class _HsnTab extends StatelessWidget {
  final List<dynamic> data;
  const _HsnTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final fmt =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    if (data.isEmpty) {
      return const Center(child: Text('No HSN data available'));
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
      itemCount: data.length,
      itemBuilder: (ctx, i) {
        final item = data[i] as Map<String, dynamic>;
        final taxableVal = sp.d(item['taxableValue']);
        final tax = sp.d(item['totalTax']);
        return Container(
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
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color:
                        const Color(0xFF4F46E5).withValues(alpha: 0.10),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(
                    child: Text(
                      item['hsnCode'] ?? '?',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 11,
                        color: Color(0xFF4F46E5),
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item['description'] ?? item['hsnCode'] ?? '',
                        style:
                            const TextStyle(fontWeight: FontWeight.w600),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        'Qty: ${item['quantity'] ?? '-'} | '
                        'Rate: ${item['taxRate'] ?? '-'}%',
                        style: const TextStyle(
                            fontSize: 12, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(fmt.format(taxableVal),
                        style:
                            const TextStyle(fontWeight: FontWeight.bold)),
                    Text('Tax: ${fmt.format(tax)}',
                        style: const TextStyle(
                            fontSize: 11, color: Colors.grey)),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _GstSummaryCard extends StatelessWidget {
  final String title;
  final Color color;
  final List<(String, String)> rows;

  const _GstSummaryCard({
    required this.title,
    required this.color,
    required this.rows,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: color.withValues(alpha: 0.06),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: color.withValues(alpha: 0.2)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: color, fontSize: 14)),
            const Divider(height: 20),
            ...rows.map(
              (r) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(r.$1,
                        style: const TextStyle(
                            fontSize: 13, color: Colors.grey)),
                    Text(r.$2,
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.bold)),
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
