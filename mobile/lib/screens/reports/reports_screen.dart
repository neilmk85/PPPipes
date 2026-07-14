import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:pos_mobile/main.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../utils/parse.dart' as sp;
import '../../widgets/date_filter_dropdown.dart';
import 'daybook_screen.dart';
import 'debtors_screen.dart';
import 'gst_screen.dart';
import 'ledger_screen.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  DateTime _from = DateTime.now().subtract(const Duration(days: 7));
  DateTime _to = DateTime.now();
  Map<String, dynamic>? _summary;
  List<dynamic> _topProducts = [];
  List<dynamic> _dailyTrend = [];
  bool _loading = false;
  bool _exporting = false;

  final _fmt = DateFormat('yyyy-MM-dd');

  // PDI-style date filter overlay
  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;
  BizDateFilter _dateFilter = const BizDateFilter(preset: 'this_week');

  @override
  void initState() {
    super.initState();
    _from = bizResolveFrom('this_week');
    _to   = bizResolveTo('this_week');
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
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
      builder: (_) => BizDateDropdown(
        layerLink: _layerLink,
        filter: _dateFilter,
        onApply: (f) {
          _closeDateOverlay();
          setState(() {
            _dateFilter = f;
            _from = f.from ?? DateTime.now().subtract(const Duration(days: 7));
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

  Future<void> _load() async {
    final outletId = ref.read(authProvider).user?.outletId;
    if (outletId == null) return;
    setState(() => _loading = true);
    try {
      final from = _fmt.format(_from);
      final to = _fmt.format(_to);
      final results = await Future.wait([
        ApiService().getSalesSummary(outletId, from, to),
        ApiService().getTopProducts(outletId, from, to),
        ApiService().getDailyTrend(outletId, from, to),
      ]);
      setState(() {
        _summary = results[0] as Map<String, dynamic>;
        _topProducts = results[1] as List;
        _dailyTrend = results[2] as List;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      setState(() => _loading = false);
    }
  }


  Future<void> _exportPdf() async {
    if (_summary == null) return;
    setState(() => _exporting = true);
    try {
      final doc = pw.Document();
      final outletName =
          ref.read(authProvider).user?.outletName ?? 'Sales Report';

      doc.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4,
          header: (ctx) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(outletName,
                  style: pw.TextStyle(
                      fontSize: 18, fontWeight: pw.FontWeight.bold)),
              pw.Text(
                  'Sales Report  •  ${_fmt.format(_from)} to ${_fmt.format(_to)}',
                  style: pw.TextStyle(
                      fontSize: 11,
                      color: PdfColors.grey600)),
              pw.Divider(),
            ],
          ),
          build: (ctx) => [
            // Summary
            pw.Text('Summary',
                style: pw.TextStyle(
                    fontSize: 14, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            pw.Table(
              border: pw.TableBorder.all(color: PdfColors.grey300),
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                  children: [
                    _pdfCell('Metric', bold: true),
                    _pdfCell('Value', bold: true),
                  ],
                ),
                pw.TableRow(children: [
                  _pdfCell('Total Sales'),
                  _pdfCell(
                      '₹${_n(_summary!['totalSales'])}'),
                ]),
                pw.TableRow(children: [
                  _pdfCell('Total Orders'),
                  _pdfCell('${_summary!['totalOrders'] ?? 0}'),
                ]),
                pw.TableRow(children: [
                  _pdfCell('Avg Order Value'),
                  _pdfCell(
                      '₹${_n(_summary!['avgOrderValue'])}'),
                ]),
                pw.TableRow(children: [
                  _pdfCell('Items Sold'),
                  _pdfCell('${_summary!['totalItemsSold'] ?? 0}'),
                ]),
              ],
            ),
            pw.SizedBox(height: 20),
            // Daily trend table
            if (_dailyTrend.isNotEmpty) ...[
              pw.Text('Daily Trend',
                  style: pw.TextStyle(
                      fontSize: 14, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 8),
              pw.Table(
                border: pw.TableBorder.all(color: PdfColors.grey300),
                children: [
                  pw.TableRow(
                    decoration:
                        const pw.BoxDecoration(color: PdfColors.grey200),
                    children: [
                      _pdfCell('Date', bold: true),
                      _pdfCell('Sales', bold: true),
                      _pdfCell('Orders', bold: true),
                    ],
                  ),
                  ..._dailyTrend.map(
                    (d) => pw.TableRow(children: [
                      _pdfCell(d['date'] ?? ''),
                      _pdfCell(
                          '₹${_n(d['totalSales'])}'),
                      _pdfCell('${d['orderCount'] ?? 0}'),
                    ]),
                  ),
                ],
              ),
              pw.SizedBox(height: 20),
            ],
            // Top products
            if (_topProducts.isNotEmpty) ...[
              pw.Text('Top Products',
                  style: pw.TextStyle(
                      fontSize: 14, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 8),
              pw.Table(
                border: pw.TableBorder.all(color: PdfColors.grey300),
                children: [
                  pw.TableRow(
                    decoration:
                        const pw.BoxDecoration(color: PdfColors.grey200),
                    children: [
                      _pdfCell('Product', bold: true),
                      _pdfCell('Units', bold: true),
                      _pdfCell('Revenue', bold: true),
                    ],
                  ),
                  ..._topProducts.map(
                    (p) => pw.TableRow(children: [
                      _pdfCell(p['productName'] ?? ''),
                      _pdfCell(
                          sp.d(p['totalQuantity']).toStringAsFixed(0)),
                      _pdfCell(
                          '₹${_n(p['totalRevenue'])}'),
                    ]),
                  ),
                ],
              ),
            ],
          ],
        ),
      );

      await Printing.sharePdf(
        bytes: await doc.save(),
        filename:
            'sales_report_${_fmt.format(_from)}_${_fmt.format(_to)}.pdf',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  pw.Widget _pdfCell(String text, {bool bold = false}) => pw.Padding(
        padding: const pw.EdgeInsets.all(6),
        child: pw.Text(
          text,
          style: pw.TextStyle(
              fontSize: 10,
              fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal),
        ),
      );

  String _n(dynamic v) => sp.d(v).toStringAsFixed(0);

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
                    fontSize: 9, color: Colors.white70, letterSpacing: 0.2),
                textAlign: TextAlign.center),
          ],
        ),
      );

  Widget _buildFloatingNav() {
    final perms = ref.read(authProvider).user?.cardPermissions;
    final showDebtors   = perms == null || perms.reports.contains('debtors');
    final showCreditors = perms == null || perms.reports.contains('creditors');

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
                        offset: const Offset(0, 6)),
                    BoxShadow(
                        color: _color.withValues(alpha: 0.12),
                        blurRadius: 40,
                        offset: const Offset(0, 10)),
                  ],
                ),
                clipBehavior: Clip.hardEdge,
                child: Row(
                  children: [
                    _navItem(
                        icon: Icons.bar_chart_outlined,
                        label: 'Sales',
                        active: true,
                        onTap: () {}),
                    if (showDebtors)
                      _navItem(
                          icon: Icons.account_balance_wallet_outlined,
                          label: 'Debtors',
                          active: false,
                          onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const DebtorsScreen()))),
                    if (showCreditors)
                      _navItem(
                          icon: Icons.store_outlined,
                          label: 'Creditors',
                          active: false,
                          onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const CreditorScreen()))),
                    _navItem(
                        icon: Icons.receipt_outlined,
                        label: 'GST',
                        active: false,
                        onTap: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                                builder: (_) => const GstScreen()))),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _navItem({
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
                      end: Alignment.bottomRight),
                  borderRadius: BorderRadius.all(Radius.circular(26)))
              : null,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
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
            ],
          ),
        ),
      ),
    );
  }

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
              icon: const Icon(Icons.menu_outlined),
              onPressed: openAppDrawer,
            ),
            title: const Text(
              'Reports',
              style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  color: Colors.white),
            ),
            actions: [
              CompositedTransformTarget(
                link: _layerLink,
                child: GestureDetector(
                  onTap: _toggleDateOverlay,
                  child: Container(
                    margin: const EdgeInsets.symmetric(vertical: 8),
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
                  icon: const Icon(Icons.refresh),
                  onPressed: _load,
                  color: Colors.white),
              IconButton(
                icon: _exporting
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.share_outlined, color: Colors.white),
                onPressed:
                    _summary == null || _exporting ? null : _exportPdf,
              ),
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
                    padding: const EdgeInsets.fromLTRB(16, 52, 16, 8),
                    child: Row(
                      children: [
                        _hStat(
                          _summary != null
                              ? '₹${_n(_summary!['totalSales'])}'
                              : '—',
                          'Total Sales',
                        ),
                        _hStat(
                          _summary != null
                              ? '${_summary!['totalOrders'] ?? 0}'
                              : '—',
                          'Orders',
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
          if (_loading)
            const SliverFillRemaining(
                child: Center(child: CircularProgressIndicator()))
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 100),
              sliver: SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (_summary != null)
                      _SummaryCards(summary: _summary!),
                    const SizedBox(height: 24),
                    if (_dailyTrend.isNotEmpty) ...[
                      const Text('Daily Sales Trend',
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 12),
                      _DailyTrendChart(
                          data: _dailyTrend, displayFmt: DateFormat('dd MMM')),
                      const SizedBox(height: 24),
                    ],
                    if (_topProducts.isNotEmpty) ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Top Products',
                              style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold)),
                          Text('${_topProducts.length} products',
                              style: const TextStyle(
                                  color: Colors.grey, fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      _TopProductsList(products: _topProducts),
                    ],
                    const SizedBox(height: 24),
                    const Text('More Reports',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    Builder(builder: (ctx) {
                      final perms = ref.read(authProvider).user?.cardPermissions;
                      final canDebtors   = perms == null || perms.reports.contains('debtors');
                      final canCreditors = perms == null || perms.reports.contains('creditors');
                      final canDaybook   = perms == null || perms.reports.contains('daybook');
                      final canLedger    = perms == null || perms.reports.contains('ledger');
                      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        if (canDebtors)
                          _MoreReportsTile(
                            icon: Icons.account_balance_wallet_outlined,
                            color: const Color(0xFFE53935),
                            title: 'Debtors Ledger',
                            subtitle: 'Customer outstanding receivables',
                            onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => const DebtorsScreen())),
                          ),
                        if (canCreditors)
                          _MoreReportsTile(
                            icon: Icons.store_outlined,
                            color: const Color(0xFF5E35B1),
                            title: 'Creditors Ledger',
                            subtitle: 'Vendor outstanding payables',
                            onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => const CreditorScreen())),
                          ),
                        if (canDaybook)
                          _MoreReportsTile(
                            icon: Icons.book_outlined,
                            color: const Color(0xFF0891B2),
                            title: 'Day Book',
                            subtitle: 'Daily transaction journal',
                            onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => const DaybookScreen())),
                          ),
                        if (canLedger)
                          _MoreReportsTile(
                            icon: Icons.account_balance_outlined,
                            color: const Color(0xFF7C3AED),
                            title: 'Ledger',
                            subtitle: 'Account-wise balance summary',
                            onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) => const LedgerScreen())),
                          ),
                        _MoreReportsTile(
                          icon: Icons.receipt_outlined,
                          color: const Color(0xFF1565C0),
                          title: 'GST Reports',
                          subtitle: 'GSTR-1, GSTR-3B & HSN summary',
                          onTap: () => Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) => const GstScreen())),
                        ),
                      ]);
                    }),
                    const SizedBox(height: 16),
                  ],
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: _buildFloatingNav(),
    );
  }
}

class _SummaryCards extends StatelessWidget {
  static const _color = Color(0xFF4F46E5);
  final Map<String, dynamic> summary;
  const _SummaryCards({required this.summary});

  @override
  Widget build(BuildContext context) {
    final cards = [
      ('Total Sales', '₹${_n(summary['totalSales'])}', Icons.attach_money),
      ('Orders', '${sp.i(summary['totalOrders'])}', Icons.receipt_long),
      ('Avg Order', '₹${_n(summary['avgOrderValue'])}', Icons.trending_up),
      ('Items Sold', '${sp.i(summary['totalItemsSold'])}', Icons.inventory),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.8,
      children: cards.map((c) {
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: _color.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: _color.withValues(alpha: 0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(c.$3, color: _color, size: 20),
              const SizedBox(height: 4),
              Text(c.$2,
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: _color)),
              Text(c.$1,
                  style: const TextStyle(
                      color: Colors.grey, fontSize: 12)),
            ],
          ),
        );
      }).toList(),
    );
  }

  static String _n(dynamic v) => sp.d(v).toStringAsFixed(0);
}

class _DailyTrendChart extends StatelessWidget {
  final List<dynamic> data;
  final DateFormat displayFmt;
  const _DailyTrendChart({required this.data, required this.displayFmt});

  @override
  Widget build(BuildContext context) {
    final spots = data.asMap().entries.map((e) {
      final amount = sp.d(e.value['totalSales']);
      return FlSpot(e.key.toDouble(), amount);
    }).toList();

    final maxY = spots.isEmpty
        ? 1.0
        : spots.map((s) => s.y).reduce((a, b) => a > b ? a : b) * 1.2;

    return SizedBox(
      height: 220,
      child: LineChart(
        LineChartData(
          minY: 0,
          maxY: maxY == 0 ? 1 : maxY,
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (v) =>
                const FlLine(color: Color(0xFFEEEEEE), strokeWidth: 1),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 48,
                getTitlesWidget: (value, meta) {
                  if (value == 0) return const SizedBox.shrink();
                  return Text(
                    _compact(value),
                    style: const TextStyle(
                        color: Colors.grey, fontSize: 10),
                  );
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 28,
                interval: data.length <= 7
                    ? 1
                    : (data.length / 5).ceilToDouble(),
                getTitlesWidget: (value, meta) {
                  final idx = value.toInt();
                  if (idx < 0 || idx >= data.length) {
                    return const SizedBox.shrink();
                  }
                  final dateStr = data[idx]['date'] as String? ?? '';
                  String label = '';
                  try {
                    final dt = DateTime.parse(dateStr);
                    label = displayFmt.format(dt);
                  } catch (_) {
                    label = dateStr.length >= 5
                        ? dateStr.substring(5)
                        : dateStr;
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(label,
                        style: const TextStyle(
                            color: Colors.grey, fontSize: 10)),
                  );
                },
              ),
            ),
            topTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false)),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              color: const Color(0xFF4F46E5),
              barWidth: 3,
              dotData: FlDotData(
                show: data.length <= 14,
                getDotPainter: (spot, _, __, ___) => FlDotCirclePainter(
                  radius: 3,
                  color: const Color(0xFF4F46E5),
                  strokeWidth: 0,
                ),
              ),
              belowBarData: BarAreaData(
                show: true,
                color: const Color(0xFF4F46E5).withValues(alpha: 0.1),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _compact(double v) {
    if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)}K';
    return v.toStringAsFixed(0);
  }
}

class _TopProductsList extends StatelessWidget {
  final List<dynamic> products;
  const _TopProductsList({required this.products});

  @override
  Widget build(BuildContext context) {
    final maxRevenue = products.isEmpty
        ? 1.0
        : products
            .map((p) => sp.d(p['totalRevenue']))
            .reduce((a, b) => a > b ? a : b);

    return Column(
      children: products.asMap().entries.map((entry) {
        final i = entry.key;
        final p = entry.value;
        final qty = sp.d(p['totalQuantity']);
        final revenue = sp.d(p['totalRevenue']);
        final pct = maxRevenue > 0 ? revenue / maxRevenue : 0.0;

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: _rankColor(i).withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text('${i + 1}',
                          style: TextStyle(
                              color: _rankColor(i),
                              fontWeight: FontWeight.bold,
                              fontSize: 11)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(p['productName'] ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w500)),
                  ),
                  Text(
                    '₹${revenue.toStringAsFixed(0)}',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: _rankColor(i)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const SizedBox(width: 34),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: pct.toDouble(),
                        backgroundColor: Colors.grey.shade200,
                        color: _rankColor(i),
                        minHeight: 5,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('${qty.toStringAsFixed(0)} units',
                      style: const TextStyle(
                          color: Colors.grey, fontSize: 11)),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Color _rankColor(int rank) {
    return switch (rank) {
      0 => const Color(0xFFFFD700),
      1 => const Color(0xFFC0C0C0),
      2 => const Color(0xFFCD7F32),
      _ => const Color(0xFF4F46E5),
    };
  }
}

class _MoreReportsTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _MoreReportsTile({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
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
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style:
                            const TextStyle(fontWeight: FontWeight.bold)),
                    Text(subtitle,
                        style: const TextStyle(
                            fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right,
                  color: Colors.grey.withValues(alpha: 0.6)),
            ],
          ),
        ),
      ),
    );
  }
}
