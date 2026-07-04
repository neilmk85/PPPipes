import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';

import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../utils/parse.dart' as p;
import '../../widgets/date_filter_dropdown.dart';

// ── Colour constants ──────────────────────────────────────────────────────────
const _violet     = Color(0xFF7C3AED);
const _blue       = Color(0xFF2563EB);

// ── Formatters ────────────────────────────────────────────────────────────────
String _fmt(dynamic v) {
  final n = p.d(v);
  if (n == n.truncateToDouble()) return n.toInt().toString();
  return n.toStringAsFixed(2);
}

String _extractDiameter(String name) {
  final re = RegExp(r'(\d{3,4})\s*mm', caseSensitive: false);
  final m = re.firstMatch(name);
  if (m != null) return '${m.group(1)} mm';
  final re2 = RegExp(r'\b(\d{3,4})\b');
  final m2 = re2.firstMatch(name);
  return m2 != null ? '${m2.group(1)} mm' : name;
}


// ── Decorative hero painter ───────────────────────────────────────────────────
class _HeroPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    // Dot grid
    final dot = Paint()..color = Colors.white.withValues(alpha: 0.07);
    const step = 24.0;
    for (double x = 0; x < size.width; x += step) {
      for (double y = 0; y < size.height; y += step) {
        canvas.drawCircle(Offset(x, y), 1.0, dot);
      }
    }
    // Top-right blob
    canvas.drawCircle(
      Offset(size.width + 40, -40),
      110,
      Paint()
        ..color = Colors.white.withValues(alpha: 0.05)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 30),
    );
    // Bottom-left blob
    canvas.drawCircle(
      Offset(size.width * 0.35, size.height + 10),
      130,
      Paint()
        ..color = const Color(0xFF60A5FA).withValues(alpha: 0.10)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 40),
    );
  }

  @override
  bool shouldRepaint(_HeroPainter old) => false;
}

// ── Card header ───────────────────────────────────────────────────────────────
class _CardHeader extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;

  const _CardHeader({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [_violet, _blue]),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        children: [
          Container(
            width: 34, height: 34,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: Colors.amber.shade300, size: 16),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13)),
                Text(subtitle,
                    style: TextStyle(color: Colors.blue.shade100, fontSize: 10)),
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

// ── Thin column header row ────────────────────────────────────────────────────
Widget _tHead(List<(String, TextAlign)> cols) {
  return Container(
    color: const Color(0xFFF8FAFC),
    child: Row(
      children: cols.map((c) => Expanded(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          child: Text(c.$1.toUpperCase(),
              textAlign: c.$2,
              style: const TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF64748B),
                  letterSpacing: 0.7)),
        ),
      )).toList(),
    ),
  );
}

// ── Data row ──────────────────────────────────────────────────────────────────
class _DRow extends StatelessWidget {
  final List<(String, TextAlign, Color?)> cells;
  final bool footer;

  const _DRow(this.cells, {this.footer = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: footer ? const Color(0xFFF5F3FF) : null,
      child: Row(
        children: cells.map((c) => Expanded(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
            child: Text(c.$1,
                textAlign: c.$2,
                style: TextStyle(
                    fontSize: 12,
                    fontWeight: footer ? FontWeight.bold : FontWeight.normal,
                    color: c.$3 ??
                        (footer
                            ? const Color(0xFF1E293B)
                            : const Color(0xFF334155)))),
          ),
        )).toList(),
      ),
    );
  }
}

Widget _div() => const Divider(height: 1, color: Color(0xFFF1F5F9));
Widget _hdiv() => const Divider(height: 1, color: Color(0xFFE2E8F0));

Widget _empty(String msg) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 28),
      child: Center(
        child: Column(children: [
          Icon(Icons.inventory_2_outlined, size: 30, color: Colors.grey.shade300),
          const SizedBox(height: 8),
          Text(msg, style: TextStyle(fontSize: 12, color: Colors.grey.shade400)),
        ]),
      ),
    );

// ── Data card wrapper ─────────────────────────────────────────────────────────
class _Card extends StatelessWidget {
  final Widget header;
  final Widget child;
  const _Card({required this.header, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          // tight crisp drop shadow
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.18),
            blurRadius: 8,
            spreadRadius: -2,
            offset: const Offset(0, 4),
          ),
          // wide ambient glow
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.10),
            blurRadius: 32,
            spreadRadius: 0,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Container(
          color: Colors.white,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [header, child],
          ),
        ),
      ),
    );
  }
}

// ── Stat tile ─────────────────────────────────────────────────────────────────
class _StatTile extends StatelessWidget {
  final String value;
  final String label;
  final String sub;
  final bool warn;
  final bool last;

  const _StatTile({
    required this.value, required this.label,
    required this.sub, required this.warn, this.last = false,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        decoration: BoxDecoration(
          border: Border(
            right: last
                ? BorderSide.none
                : BorderSide(color: Colors.white.withValues(alpha: 0.12)),
          ),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: TextStyle(
              fontSize: 16, fontWeight: FontWeight.w800,
              color: warn ? const Color(0xFFFCA5A5) : Colors.white)),
          Text(label, style: TextStyle(
              fontSize: 9, color: Colors.blue.shade200, height: 1.3)),
          Text(sub, style: TextStyle(
              fontSize: 8, color: Colors.white.withValues(alpha: 0.4))),
        ]),
      ),
    );
  }
}

// ── Main screen ───────────────────────────────────────────────────────────────
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  bool _loading = true;
  String? _error;

  List<dynamic> _inventory         = [];
  List<dynamic> _intermediateStock = [];
  List<dynamic> _allStagesStock    = [];
  List<dynamic> _productionOrders  = [];

  BizDateFilter _dateFilter = const BizDateFilter();
  final _layerLink = LayerLink();
  OverlayEntry? _dateOverlay;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (!mounted) return;
    setState(() { _loading = true; _error = null; });
    try {
      final auth = ref.read(authProvider);
      final outletId = auth.user?.outletId ?? 1;
      final results = await Future.wait([
        ApiService().getInventoryByOutlet(outletId),
        ApiService().getIntermediateStock(
          fromDate: _dateFilter.from != null ? DateFormat('yyyy-MM-dd').format(_dateFilter.from!) : null,
          toDate:   _dateFilter.to   != null ? DateFormat('yyyy-MM-dd').format(_dateFilter.to!)   : null,
        ),
        ApiService().getAllStagesStock(
          fromDate: _dateFilter.from != null ? DateFormat('yyyy-MM-dd').format(_dateFilter.from!) : null,
          toDate:   _dateFilter.to   != null ? DateFormat('yyyy-MM-dd').format(_dateFilter.to!)   : null,
        ),
        ApiService().getProductionOrderSummaries(),
      ]);
      if (!mounted) return;
      final allOrders = results[3];
      final filtered = allOrders.where((o) {
        final s = (o['status'] ?? '').toString();
        return s == 'IN_PROGRESS' || s == 'PLANNED';
      }).toList()
        ..sort((a, b) {
          final aScore = a['status'] == 'IN_PROGRESS' ? 0 : 1;
          final bScore = b['status'] == 'IN_PROGRESS' ? 0 : 1;
          return aScore.compareTo(bScore);
        });
      setState(() {
        _inventory         = results[0];
        _intermediateStock = results[1];
        _allStagesStock    = results[2];
        _productionOrders  = filtered;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = e.toString(); });
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  List<dynamic> get _msFlat => _inventory.where((inv) {
    final n = (inv['product']?['name'] ?? '').toString().toLowerCase();
    return n.contains('flat') || n.contains('ms flat');
  }).toList();

  List<dynamic> get _shellPlates => _inventory.where((inv) {
    final n = (inv['product']?['name'] ?? '').toString().toLowerCase();
    return n.contains('sheet');
  }).toList();

  List<dynamic> get _reorderItems {
    final items = _inventory.where((inv) {
      final type = (inv['product']?['itemType'] ?? '').toString();
      final qty  = p.d(inv['quantityOnHand']);
      final rl   = p.d(inv['reorderLevel'] ?? 10);
      return type == 'RAW_MATERIAL' && qty <= rl;
    }).toList();
    items.sort((a, b) {
      final gA = p.d(a['reorderLevel'] ?? 10) - p.d(a['quantityOnHand']);
      final gB = p.d(b['reorderLevel'] ?? 10) - p.d(b['quantityOnHand']);
      return gB.compareTo(gA);
    });
    return items;
  }

  double get _msFlatTotal   => _msFlat.fold(0, (s, i) => s + p.d(i['quantityOnHand']));
  double get _shellTotal    => _shellPlates.fold(0, (s, i) => s + p.d(i['quantityOnHand']));
  int get _grandCuring1      => _intermediateStock.fold(0, (s, r) => s + p.i(r['curing1']));
  int get _grandCuring2      => _intermediateStock.fold(0, (s, r) => s + p.i(r['curing2']));
  int get _grandFinalTesting => _intermediateStock.fold(0, (s, r) => s + p.i(r['finalTesting']));
  int get _grandTotal        => _intermediateStock.fold(0, (s, r) => s + p.i(r['total']));
  int get _allStagesTotal    => _allStagesStock.fold(0, (s, r) => s + p.i(r['total']));
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
    final overlay = Overlay.of(context);
    _dateOverlay = OverlayEntry(
      builder: (_) => GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: _closeDateOverlay,
        child: Stack(children: [
          CompositedTransformFollower(
            link: _layerLink,
            targetAnchor: Alignment.bottomRight,
            followerAnchor: Alignment.topRight,
            offset: const Offset(0, 6),
            child: Material(
              color: Colors.transparent,
              child: BizDateDropdown(
                layerLink: _layerLink,
                filter: _dateFilter,
                onApply: (f) {
                  setState(() => _dateFilter = f);
                  _closeDateOverlay();
                  _load();
                },
                onDismiss: _closeDateOverlay,
              ),
            ),
          ),
        ]),
      ),
    );
    overlay.insert(_dateOverlay!);
  }

  // ── Build ────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_error != null) {
      return Scaffold(
        body: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.error_outline, size: 48, color: Colors.red.shade300),
          const SizedBox(height: 12),
          Text(_error!, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton.icon(onPressed: _load,
              icon: const Icon(Icons.refresh), label: const Text('Retry')),
        ])),
      );
    }

    final roles = ref.watch(authProvider).user?.roles ?? [];
    final isAdmin = roles.contains('SUPER_ADMIN') || roles.contains('ADMIN');

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _buildHero()),
          SliverPadding(
            padding: const EdgeInsets.all(12),
            sliver: SliverList(delegate: SliverChildListDelegate([
              _buildProductionOrders(),
              if (isAdmin) ...[
                const SizedBox(height: 12),
                _buildMsFlat(),
                const SizedBox(height: 12),
                _buildReorder(),
                const SizedBox(height: 12),
                _buildShellPlates(),
                const SizedBox(height: 12),
                _buildIntermediate(),
                const SizedBox(height: 12),
                _buildAllStages(),
              ],
              const SizedBox(height: 20),
            ])),
          ),
        ],
      ),
    );
  }

  // ── Hero ─────────────────────────────────────────────────────────────────────
  Widget _buildHero() {
    final roles   = ref.watch(authProvider).user?.roles ?? [];
    final isAdmin = roles.contains('SUPER_ADMIN') || roles.contains('ADMIN');
    final todayStr = DateFormat('EEEE, d MMMM yyyy').format(DateTime.now());
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [Color(0xFF5B21B6), _violet, _blue],
        ),
        boxShadow: [
          BoxShadow(color: Color(0x55604099), blurRadius: 24, offset: Offset(0, 8)),
        ],
      ),
      child: ClipRect(
        child: CustomPaint(
          painter: _HeroPainter(),
          child: SafeArea(
            child: Column(children: [
              // title row
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 14, 14, 0),
                child: Row(children: [
                  IconButton(
                    icon: const Icon(Icons.menu_outlined, color: Colors.white),
                    onPressed: openAppDrawer,
                    tooltip: 'Open menu',
                  ),
                  Container(
                    width: 50, height: 50,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                    ),
                    child: const Icon(Icons.layers_rounded,
                        color: Color(0xFFFBBF24), size: 24),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('OVERVIEW', style: TextStyle(
                        fontSize: 9, fontWeight: FontWeight.w600,
                        color: Colors.blue.shade200, letterSpacing: 1.2)),
                    const Text('Dashboard', style: TextStyle(
                        fontSize: 20, fontWeight: FontWeight.w800,
                        color: Colors.white, height: 1.2)),
                    Text('Raw material & production stock',
                        style: TextStyle(fontSize: 11, color: Colors.blue.shade200)),
                  ])),
                  // date filter button
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text(todayStr, style: TextStyle(
                        fontSize: 8.5, color: Colors.blue.shade200,
                        fontWeight: FontWeight.w500)),
                    const SizedBox(height: 5),
                    CompositedTransformTarget(
                      link: _layerLink,
                      child: GestureDetector(
                        onTap: _toggleDateOverlay,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 9, vertical: 5),
                          decoration: BoxDecoration(
                            color: _dateFilter.isActive
                                ? Colors.white.withValues(alpha: 0.2)
                                : Colors.white.withValues(alpha: 0.10),
                            borderRadius: BorderRadius.circular(9),
                            border: Border.all(color: _dateFilter.isActive
                                ? Colors.white.withValues(alpha: 0.4)
                                : Colors.white.withValues(alpha: 0.2)),
                          ),
                          child: Row(mainAxisSize: MainAxisSize.min, children: [
                            const Icon(Icons.date_range, color: Colors.white, size: 12),
                            const SizedBox(width: 5),
                            Text(
                              _dateFilter.isActive ? _dateFilter.label : 'Filter',
                              style: const TextStyle(
                                  color: Colors.white, fontSize: 10,
                                  fontWeight: FontWeight.w500),
                            ),
                            if (_dateFilter.isActive) ...[
                              const SizedBox(width: 4),
                              GestureDetector(
                                onTap: () {
                                  _closeDateOverlay();
                                  setState(() => _dateFilter = const BizDateFilter());
                                  _load();
                                },
                                child: const Icon(Icons.close,
                                    color: Colors.white70, size: 11),
                              ),
                            ],
                          ]),
                        ),
                      ),
                    ),
                  ]),
                ]),
              ),
              const SizedBox(height: 14),
              // stat strip
              Container(
                decoration: BoxDecoration(
                  border: Border(
                    top: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
                  ),
                ),
                child: IntrinsicHeight(
                  child: isAdmin ? Row(children: [
                    _StatTile(value: _fmt(_shellTotal),   label: 'Shell Plate Items',
                        sub: 'kg total weight', warn: false),
                    _StatTile(value: _fmt(_msFlatTotal),  label: 'MS Flat Weight',
                        sub: 'kg on hand',      warn: false),
                    _StatTile(value: _grandTotal.toString(), label: 'Pipes in Stages',
                        sub: 'intermediate',    warn: false),
                    _StatTile(value: _reorderItems.length.toString(), label: 'Reorder Alerts',
                        sub: 'materials low', warn: _reorderItems.isNotEmpty, last: true),
                  ]) : Row(children: [
                    _StatTile(
                        value: _productionOrders.where((o) => o['status'] == 'IN_PROGRESS').length.toString(),
                        label: 'Active Orders', sub: 'in progress', warn: false),
                    _StatTile(
                        value: _productionOrders.where((o) => o['status'] == 'PLANNED').length.toString(),
                        label: 'Planned', sub: 'queued orders', warn: false),
                    _StatTile(
                        value: _productionOrders.fold<int>(0, (s, o) => s + p.i(o['plannedQty'])).toString(),
                        label: 'Total Pipes', sub: 'to produce', warn: false),
                    _StatTile(
                        value: _productionOrders.fold<int>(0, (s, o) => s + p.i(o['finishedPipes'])).toString(),
                        label: 'Done', sub: 'at final testing', warn: false, last: true),
                  ]),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  // ── Production Schedule ───────────────────────────────────────────────────────
  Widget _buildProductionOrders() {
    final inProgressCount = _productionOrders.where((o) => o['status'] == 'IN_PROGRESS').length;
    final plannedCount    = _productionOrders.where((o) => o['status'] == 'PLANNED').length;
    return _Card(
      header: _CardHeader(
        icon: Icons.factory_outlined,
        title: 'Production Schedule',
        subtitle: '$inProgressCount in progress · $plannedCount planned',
      ),
      child: Column(children: [
        _tHead([
          ('Pipe Type', TextAlign.left),
          ('Total',     TextAlign.right),
          ('Done',      TextAlign.right),
          ('Left',      TextAlign.right),
          ('Status',    TextAlign.right),
        ]),
        _hdiv(),
        if (_productionOrders.isEmpty)
          _empty('No active production orders')
        else ..._productionOrders.map((order) {
          final diameter = p.i(order['diameterMm']);
          final pressure = (order['pressureClass'] ?? '').toString();
          final name     = diameter > 0
              ? '$diameter mm${pressure.isNotEmpty ? ' · $pressure' : ''}'
              : (order['pipeConfigName'] ?? order['pipeName'] ?? '—').toString();
          final planned  = p.i(order['plannedQty']);
          final done     = p.i(order['finishedPipes']);
          final left     = (planned - done).clamp(0, planned);
          final status   = (order['status'] ?? '').toString();
          final isActive = status == 'IN_PROGRESS';
          return Column(children: [
            _DRow([
              (name,                         TextAlign.left,  null),
              (planned.toString(),           TextAlign.right, null),
              (done.toString(),              TextAlign.right, const Color(0xFF059669)),
              (left.toString(),              TextAlign.right, const Color(0xFFD97706)),
              (isActive ? 'Active' : 'Planned',
                                             TextAlign.right,
                                             isActive ? const Color(0xFF059669) : const Color(0xFF9CA3AF)),
            ]),
            _div(),
          ]);
        }),
      ]),
    );
  }

  // ── MS Flat ───────────────────────────────────────────────────────────────────
  Widget _buildMsFlat() {
    final cols = [
      ('Product', TextAlign.left),
      ('Weight (Kg)', TextAlign.right),
    ];
    return _Card(
      header: _CardHeader(
        icon: Icons.monitor_weight_outlined,
        title: 'MS Flat',
        subtitle: '${_msFlat.length} item${_msFlat.length != 1 ? 's' : ''}',
        trailing: _msFlat.isNotEmpty ? Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('Total Weight',
                style: TextStyle(color: Colors.blue.shade100, fontSize: 9)),
            Text('${_fmt(_msFlatTotal)} kg',
                style: const TextStyle(color: Colors.white,
                    fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ) : null,
      ),
      child: Column(children: [
        _tHead(cols), _hdiv(),
        if (_msFlat.isEmpty) _empty('No MS Flat products found')
        else ...[
          ..._msFlat.map((inv) {
            final name = (inv['product']?['name'] ?? '').toString();
            final sku  = (inv['product']?['sku'] ?? '').toString();
            final wt   = p.d(inv['quantityOnHand']);
            return Column(children: [
              _DRow([
                (sku.isNotEmpty ? '$name ($sku)' : name, TextAlign.left, null),
                ('${_fmt(wt)} kg', TextAlign.right, null),
              ]),
              _div(),
            ]);
          }),
          _DRow([
            ('Total', TextAlign.left, _violet),
            ('${_fmt(_msFlatTotal)} kg', TextAlign.right, null),
          ], footer: true),
        ],
      ]),
    );
  }

  // ── Reorder Alerts ────────────────────────────────────────────────────────────
  Widget _buildReorder() {
    return _Card(
      header: _CardHeader(
        icon: Icons.warning_amber_rounded,
        title: 'Reorder Level Alerts',
        subtitle: '${_reorderItems.length} raw material'
            '${_reorderItems.length != 1 ? 's' : ''} at or below reorder level',
      ),
      child: Column(children: [
        _tHead([
          ('Raw Material', TextAlign.left),
          ('On Hand', TextAlign.right),
          ('Reorder At', TextAlign.right),
        ]),
        _hdiv(),
        if (_reorderItems.isEmpty) _empty('All materials above reorder level')
        else ..._reorderItems.map((inv) {
          final name  = (inv['product']?['name'] ?? '').toString();
          final uom   = (inv['product']?['unitOfMeasure'] ?? '').toString();
          final qty   = p.d(inv['quantityOnHand']);
          final rl    = p.d(inv['reorderLevel'] ?? 10);
          final pct   = rl > 0 ? math.min(1.0, math.max(0.0, qty / rl)) : 0.0;
          final isOut = qty <= 0;
          final barColor = pct < 0.3 ? Colors.red.shade400
              : pct < 0.7 ? Colors.orange.shade400
              : Colors.green.shade400;

          return Column(children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 2),
              child: Row(children: [
                Expanded(child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  child: Text(name, style: const TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600,
                      color: Color(0xFF334155))),
                )),
                Expanded(child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                      if (isOut) Container(
                        width: 5, height: 5,
                        margin: const EdgeInsets.only(right: 4),
                        decoration: const BoxDecoration(
                            color: Colors.red, shape: BoxShape.circle),
                      ),
                      Text(_fmt(qty), style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.bold,
                          color: isOut ? Colors.red.shade700
                              : Colors.orange.shade700)),
                      if (uom.isNotEmpty) ...[
                        const SizedBox(width: 3),
                        Text(uom, style: const TextStyle(
                            fontSize: 10, color: Color(0xFF94A3B8))),
                      ],
                    ]),
                    const SizedBox(height: 3),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: pct,
                        backgroundColor: Colors.grey.shade200,
                        valueColor: AlwaysStoppedAnimation(barColor),
                        minHeight: 4,
                      ),
                    ),
                  ]),
                )),
                Expanded(child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                    Text(_fmt(rl), textAlign: TextAlign.right,
                        style: const TextStyle(fontSize: 12,
                            fontWeight: FontWeight.w600, color: Color(0xFF334155))),
                    if (uom.isNotEmpty) ...[
                      const SizedBox(width: 3),
                      Text(uom, style: const TextStyle(
                          fontSize: 10, color: Color(0xFF94A3B8))),
                    ],
                  ]),
                )),
              ]),
            ),
            _div(),
          ]);
        }),
      ]),
    );
  }

  // ── Shell Plates ──────────────────────────────────────────────────────────────
  Widget _buildShellPlates() {
    return _Card(
      header: _CardHeader(
        icon: Icons.layers_outlined,
        title: '1.6 mm Shell Plates',
        subtitle: '${_shellPlates.length} item${_shellPlates.length != 1 ? 's' : ''}',
        trailing: _shellPlates.isNotEmpty ? Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('Total Weight',
                style: TextStyle(color: Colors.blue.shade100, fontSize: 9)),
            Text('${_fmt(_shellTotal)} kg',
                style: const TextStyle(color: Colors.white,
                    fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ) : null,
      ),
      child: Column(children: [
        _tHead([
          ('Diameter', TextAlign.left),
          ('Quantity', TextAlign.right),
          ('Weight (Kg)', TextAlign.right),
        ]),
        _hdiv(),
        if (_shellPlates.isEmpty) _empty('No shell plate products found')
        else ...[
          ..._shellPlates.map((inv) {
            final name = (inv['product']?['name'] ?? '').toString();
            final qty  = p.d(inv['quantityOnHand']);
            return Column(children: [
              _DRow([
                (_extractDiameter(name), TextAlign.left, null),
                (_fmt(qty), TextAlign.right, null),
                ('${_fmt(qty)} kg', TextAlign.right, null),
              ]),
              _div(),
            ]);
          }),
          _DRow([
            ('Total', TextAlign.left, _violet),
            (_fmt(_shellTotal), TextAlign.right, null),
            ('${_fmt(_shellTotal)} kg', TextAlign.right, null),
          ], footer: true),
        ],
      ]),
    );
  }

  // ── Intermediate Stock ────────────────────────────────────────────────────────
  Widget _buildIntermediate() {
    final subtitle = _dateFilter.isActive ? _dateFilter.label : 'Pipes at key stages';
    return _Card(
      header: _CardHeader(
        icon: Icons.account_tree_outlined,
        title: 'Pipes Intermediate Stock',
        subtitle: subtitle,
        trailing: _intermediateStock.isNotEmpty ? Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('Total in Stage',
                style: TextStyle(color: Colors.blue.shade100, fontSize: 9)),
            Text('$_grandTotal pipes',
                style: const TextStyle(color: Colors.white,
                    fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ) : null,
      ),
      child: LayoutBuilder(builder: (ctx, constraints) {
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: math.max(constraints.maxWidth, 360.0),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            _tHead([
              ('Pipe Name',  TextAlign.left),
              ('Curing 1',   TextAlign.center),
              ('Curing 2',   TextAlign.center),
              ('Final Test', TextAlign.center),
              ('Total',      TextAlign.center),
            ]),
            _hdiv(),
            if (_intermediateStock.isEmpty)
              _empty(_dateFilter.isActive
                  ? 'No pipes in stages for this range'
                  : 'No pipes in intermediate stages yet')
            else ...[
              ..._intermediateStock.map((row) {
                final name = row['pipeName'] ?? 'Config #${row['pipeConfigId']}';
                final c1  = p.i(row['curing1']);
                final c2  = p.i(row['curing2']);
                final ft  = p.i(row['finalTesting']);
                final tot = p.i(row['total']);
                return Column(children: [
                  _DRow([
                    (name.toString(), TextAlign.left, null),
                    (c1 > 0 ? c1.toString() : '—', TextAlign.center,
                        c1 > 0 ? const Color(0xFF0E7490) : Colors.grey.shade300),
                    (c2 > 0 ? c2.toString() : '—', TextAlign.center,
                        c2 > 0 ? const Color(0xFF0369A1) : Colors.grey.shade300),
                    (ft > 0 ? ft.toString() : '—', TextAlign.center,
                        ft > 0 ? const Color(0xFF059669) : Colors.grey.shade300),
                    (tot.toString(), TextAlign.center, const Color(0xFF1E293B)),
                  ]),
                  _div(),
                ]);
              }),
              if (_intermediateStock.length > 1)
                _DRow([
                  ('Total', TextAlign.left, _violet),
                  (_grandCuring1 > 0 ? _grandCuring1.toString() : '—', TextAlign.center, null),
                  (_grandCuring2 > 0 ? _grandCuring2.toString() : '—', TextAlign.center, null),
                  (_grandFinalTesting > 0 ? _grandFinalTesting.toString() : '—', TextAlign.center, null),
                  (_grandTotal.toString(), TextAlign.center, null),
                ], footer: true),
            ],
          ]),
          ),
        );
      }),
    );
  }

  // ── All Stages Stock ──────────────────────────────────────────────────────────
  static const _allStages = [
    ('fabrication',        'Fabr.'),
    ('fabricationTesting', 'F.Test'),
    ('moulding',           'Mould'),
    ('spinning',           'Spin'),
    ('demoulding',         'Demould'),
    ('curing1',            'Cur.1'),
    ('curing2',            'Cur.2'),
    ('winding',            'Wind'),
    ('coating',            'Coat'),
    ('finalTesting',       'Final'),
  ];

  static const _stageCols = [
    Color(0xFF475569), Color(0xFF7C3AED), Color(0xFFDB2777), Color(0xFFE11D48),
    Color(0xFFEA580C), Color(0xFF0891B2), Color(0xFF0284C7), Color(0xFF4338CA),
    Color(0xFF0D9488), Color(0xFF059669),
  ];

  Widget _buildAllStages() {
    final subtitle = _dateFilter.isActive ? _dateFilter.label : 'Cumulative pipes at every stage';
    final stageTotals = List.generate(_allStages.length, (i) =>
        _allStagesStock.fold<int>(0, (s, r) => s + p.i(r[_allStages[i].$1])));
    const colW = 52.0;
    const nameW = 120.0;
    const totW  = 52.0;

    return _Card(
      header: _CardHeader(
        icon: Icons.account_tree_rounded,
        title: 'All Production Stages',
        subtitle: subtitle,
        trailing: _allStagesStock.isNotEmpty ? Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text('Grand Total',
                style: TextStyle(color: Colors.blue.shade100, fontSize: 9)),
            Text('$_allStagesTotal pipes',
                style: const TextStyle(color: Colors.white,
                    fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ) : null,
      ),
      child: LayoutBuilder(builder: (ctx, constraints) {
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: math.max(
              constraints.maxWidth,
              nameW + _allStages.length * colW + totW + 12,
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            // header
            Container(
              color: const Color(0xFFF8FAFC),
              child: Row(children: [
                SizedBox(width: nameW, child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  child: const Text('PIPE NAME', style: TextStyle(
                      fontSize: 9, fontWeight: FontWeight.bold,
                      color: Color(0xFF64748B), letterSpacing: 0.7)),
                )),
                ..._allStages.asMap().entries.map((e) => SizedBox(width: colW, child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 7),
                  child: Text(e.value.$2.toUpperCase(), textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold,
                          color: _stageCols[e.key], letterSpacing: 0.4)),
                ))),
                SizedBox(width: totW, child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 7),
                  child: const Text('TOTAL', textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold,
                          color: Color(0xFF64748B), letterSpacing: 0.7)),
                )),
              ]),
            ),
            _hdiv(),
            if (_allStagesStock.isEmpty)
              _empty(_dateFilter.isActive ? 'No data for this range' : 'No production entries yet')
            else ...[
              ..._allStagesStock.map((row) {
                final name = row['pipeName'] ?? 'Config #${row['pipeConfigId']}';
                final tot  = p.i(row['total']);
                return Column(children: [
                  Row(children: [
                    SizedBox(width: nameW, child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      child: Text(name.toString(),
                          style: const TextStyle(fontSize: 11,
                              fontWeight: FontWeight.w600, color: Color(0xFF1E293B))),
                    )),
                    ..._allStages.asMap().entries.map((e) {
                      final v = p.i(row[e.value.$1]);
                      return SizedBox(width: colW, child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 8),
                        child: Text(v > 0 ? v.toString() : '—',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600,
                                color: v > 0 ? _stageCols[e.key] : Colors.grey.shade300)),
                      ));
                    }),
                    SizedBox(width: totW, child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                      child: Text(tot.toString(), textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 11,
                              fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                    )),
                  ]),
                  _div(),
                ]);
              }),
              if (_allStagesStock.length > 1)
                Container(
                  color: const Color(0xFFF5F3FF),
                  child: Row(children: [
                    SizedBox(width: nameW, child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      child: const Text('TOTAL', style: TextStyle(
                          fontSize: 10, fontWeight: FontWeight.bold,
                          color: _violet, letterSpacing: 0.5)),
                    )),
                    ..._allStages.asMap().entries.map((e) {
                      final s = stageTotals[e.key];
                      return SizedBox(width: colW, child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 8),
                        child: Text(s > 0 ? s.toString() : '—',
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold,
                                color: Color(0xFF1E293B))),
                      ));
                    }),
                    SizedBox(width: totW, child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
                      child: Text(_allStagesTotal.toString(),
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold,
                              color: Color(0xFF0F172A))),
                    )),
                  ]),
                ),
            ],
          ]),
          ),
        );
      }),
    );
  }
}

