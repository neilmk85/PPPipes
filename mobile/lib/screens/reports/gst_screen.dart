import '../../utils/parse.dart' as sp;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

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
  DateTimeRange _range = DateTimeRange(
    start: DateTime(DateTime.now().year, DateTime.now().month, 1),
    end: DateTime.now(),
  );

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
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
              IconButton(
                icon: const Icon(Icons.date_range, color: Colors.white),
                onPressed: _pickRange,
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
                            _hStat(
                              '${DateFormat('dd MMM').format(_range.start)} – ${DateFormat('dd MMM').format(_range.end)}',
                              'Period',
                            ),
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
    final totalTax = sp.d(data['totalTax']);
    final totalInvoices = data['totalInvoices'] ?? 0;
    final igst = sp.d(data['totalIgst']);
    final cgst = sp.d(data['totalCgst']);
    final sgst = sp.d(data['totalSgst']);

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
              ('IGST', fmt.format(igst)),
              ('CGST', fmt.format(cgst)),
              ('SGST', fmt.format(sgst)),
            ],
          ),
          if (data['b2b'] != null || data['b2c'] != null) ...[
            const SizedBox(height: 16),
            _GstSummaryCard(
              title: 'Breakdown',
              color: const Color(0xFF1976D2),
              rows: [
                if (data['b2bTaxableValue'] != null)
                  ('B2B Taxable', fmt.format(sp.d(data['b2bTaxableValue']))),
                if (data['b2cTaxableValue'] != null)
                  ('B2C Taxable', fmt.format(sp.d(data['b2cTaxableValue']))),
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
    final outwardTax = sp.d(data['outwardTaxLiability']);
    final inputCredit = sp.d(data['inputTaxCredit']);
    final netPayable = outwardTax - inputCredit;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _GstSummaryCard(
            title: 'GSTR-3B Summary',
            color: const Color(0xFF00796B),
            rows: [
              ('Outward Tax Liability', fmt.format(outwardTax)),
              ('Input Tax Credit', fmt.format(inputCredit)),
              ('Net Payable', fmt.format(netPayable)),
            ],
          ),
          const SizedBox(height: 16),
          _GstSummaryCard(
            title: 'Tax Breakup',
            color: const Color(0xFF00897B),
            rows: [
              if (data['igstPayable'] != null)
                ('IGST Payable', fmt.format(sp.d(data['igstPayable']))),
              if (data['cgstPayable'] != null)
                ('CGST Payable', fmt.format(sp.d(data['cgstPayable']))),
              if (data['sgstPayable'] != null)
                ('SGST Payable', fmt.format(sp.d(data['sgstPayable']))),
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
