import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class _BizCard {
  final String key;
  final String label;
  final String subtitle;
  final String category;
  final IconData icon;
  final Color color;
  const _BizCard(this.key, this.label, this.subtitle, this.category, this.icon, this.color);
}

class _PccpStage {
  final String stageType;
  final String label;
  final IconData icon;
  final Color color;
  const _PccpStage(this.stageType, this.label, this.icon, this.color);
}

const _pccpStages = [
  _PccpStage('FABRICATION',         'Fabrication',   Icons.hardware_outlined,             Color(0xFF7C3AED)),
  _PccpStage('FABRICATION_TESTING', 'Fab Testing',   Icons.science_outlined,              Color(0xFF6D28D9)),
  _PccpStage('MOULDING',            'Moulding',      Icons.view_in_ar_outlined,           Color(0xFF5B21B6)),
  _PccpStage('SPINNING',            'Spinning',      Icons.rotate_right_outlined,         Color(0xFF4F46E5)),
  _PccpStage('DEMOULDING',          'Demoulding',    Icons.open_in_new_outlined,          Color(0xFF4338CA)),
  _PccpStage('CURING_1',            'Curing 1',      Icons.water_drop_outlined,           Color(0xFF2563EB)),
  _PccpStage('WINDING',             'Winding',       Icons.loop_outlined,                 Color(0xFF1D4ED8)),
  _PccpStage('COATING',             'Coating',       Icons.format_paint_outlined,         Color(0xFF1E40AF)),
  _PccpStage('CURING_2',            'Curing 2',      Icons.water_outlined,                Color(0xFF3730A3)),
  _PccpStage('FINAL_TESTING',       'Final Testing', Icons.check_circle_outline,          Color(0xFF8B5CF6)),
  _PccpStage('PDI',                 'PDI',           Icons.assignment_turned_in_outlined, Color(0xFF9333EA)),
];

const _cards = [
  _BizCard('pccp',               'PCCP',               'Pre-stressed concrete pipes',  'Production', Icons.layers_outlined,               Color(0xFF7C3AED)),
  _BizCard('psc',                'PSC',                'Pre-stressed concrete spun',    'Production', Icons.inventory_2_outlined,          Color(0xFF6D28D9)),
  _BizCard('testing-lab',        'Testing Lab',        'QC & test results log',         'Quality',    Icons.science_outlined,              Color(0xFF4F46E5)),
  _BizCard('pdi',                'PDI',                'Pre-dispatch inspection',       'Quality',    Icons.assignment_turned_in_outlined, Color(0xFF9333EA)),
  _BizCard('maintenance',        'Maintenance',        'Equipment & plant upkeep',      'Operations', Icons.build_outlined,                Color(0xFF7C3AED)),
  _BizCard('vehicles',           'Vehicles',           'Diesel & mileage tracking',     'Logistics',  Icons.local_shipping_outlined,       Color(0xFF4338CA)),
  _BizCard('silo',               'Silo',               'Silo fill & level records',     'Operations', Icons.storage_outlined,              Color(0xFF4F46E5)),
  _BizCard('silo-extraction',    'Silo Extraction',    'Material drawn from silos',     'Operations', Icons.download_outlined,             Color(0xFF2563EB)),
  _BizCard('discard',            'Discard',            'Scrapped or rejected items',    'Quality',    Icons.delete_outline,                Color(0xFF5B21B6)),
  _BizCard('extra-fab',          'Extra Fab',          'Additional fabrication work',   'Production', Icons.hardware_outlined,             Color(0xFF6D28D9)),
  _BizCard('labour',             'Labour',             'Daily attendance & wages',      'HR',         Icons.people_outline,                Color(0xFF4F46E5)),
  _BizCard('cement-bags',        'Used Cement Bags',   'Daily bag consumption log',     'Materials',  Icons.all_inbox_outlined,            Color(0xFF3730A3)),
  _BizCard('store-material',     'Store Material',     'Store room stock entries',      'Materials',  Icons.archive_outlined,              Color(0xFF7C3AED)),
  _BizCard('diesel-maintenance', 'Diesel Maintenance', 'Fuel usage & maintenance',      'Logistics',  Icons.local_gas_station_outlined,    Color(0xFF1D4ED8)),
  _BizCard('extra-vehicles',     'Extra Vehicles',     'Hired & additional vehicles',   'Logistics',  Icons.directions_car_outlined,       Color(0xFF8B5CF6)),
  _BizCard('cutting',            'Cutting',            'Pipe cutting records',          'Production', Icons.content_cut_outlined,          Color(0xFF6D28D9)),
  _BizCard('conversion',         'Conversion',         'Unit or spec conversions',      'Production', Icons.sync_outlined,                 Color(0xFF9333EA)),
  _BizCard('loading',            'Loading',            'Pipe loading & dispatch',       'Logistics',  Icons.move_to_inbox_outlined,        Color(0xFF1E40AF)),
  _BizCard('loaded-pipes',       'Loaded Pipes',       'Dispatched pipe records',       'Logistics',  Icons.assignment_outlined,           Color(0xFF4338CA)),
  _BizCard('loading-invoice',    'Loading + Invoice',  'Convert loaded pipes to invoices', 'Logistics', Icons.receipt_outlined,              Color(0xFF2563EB)),
  _BizCard('transport-report',   'Transport Report',   'Vehicle trip summary',          'Logistics',  Icons.bar_chart_outlined,            Color(0xFF2563EB)),
];

const _routed = {'pccp', 'cement-bags', 'vehicles', 'silo', 'silo-extraction', 'pdi', 'loading', 'extra-vehicles', 'conversion', 'loaded-pipes', 'loading-invoice', 'labour', 'store-material', 'maintenance', 'cutting', 'diesel-maintenance', 'transport-report', 'discard', 'extra-fab', 'testing-lab'};

// ── Screen ────────────────────────────────────────────────────────────────────

class BusinessScreen extends ConsumerStatefulWidget {
  const BusinessScreen({super.key});

  @override
  ConsumerState<BusinessScreen> createState() => _BusinessScreenState();
}

class _BusinessScreenState extends ConsumerState<BusinessScreen> {
  double? _totalCementBags;
  double? _totalCementKg;
  double? _dieselToday;
  int?    _pipesToday;
  String? _vehiclesToday;
  String? _extraVehiclesToday;
  String? _siloExtractionToday;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
    await Future.wait([
      _loadCementTotal(),
      _loadDieselToday(today),
      _loadPipesToday(today),
      _loadVehiclesToday(today),
      _loadExtraVehiclesToday(today),
      _loadSiloExtractionToday(today),
    ]);
  }

  Future<void> _loadCementTotal() async {
    try {
      final raw = await ApiService().getCementBags();
      final bags = raw
          .map((e) => CementBag.fromJson(e))
          .fold<double>(0, (sum, b) => sum + b.quantity);
      if (mounted) setState(() {
        _totalCementBags = bags;
        _totalCementKg = bags * 50;
      });
    } catch (_) {}
  }

  Future<void> _loadPipesToday(String today) async {
    try {
      final raw = await ApiService().getLoadingRecords(size: 500);
      final total = raw
          .where((e) => ((e['date'] ?? e['createdAt'] ?? '') as String).startsWith(today))
          .fold<int>(0, (sum, e) => sum + (int.tryParse(e['quantity']?.toString() ?? '0') ?? 0));
      if (mounted) setState(() => _pipesToday = total);
    } catch (_) {}
  }

  Future<void> _loadVehiclesToday(String today) async {
    try {
      final raw = await ApiService().getVehicleEntries(size: 500);
      final todayEntries = raw.where(
        (e) => ((e['date'] ?? e['createdAt'] ?? '') as String).startsWith(today),
      );
      double diesel = 0;
      double hours  = 0;
      for (final e in todayEntries) {
        // web schema (crane/JCB) + mobile schema (dieselUsed) — sum both
        diesel += _pd(e['craneDiesel']) + _pd(e['jcbDiesel']) + _pd(e['dieselUsed']);
        hours  += _pd(e['craneHours'])  + _pd(e['jcbHours']);
      }
      final parts = <String>[];
      if (hours  > 0) parts.add('${hours.toStringAsFixed(1)} hrs');
      if (diesel > 0) parts.add('${diesel.toStringAsFixed(1)} L');
      if (mounted) setState(() => _vehiclesToday = parts.isEmpty ? null : parts.join(' · '));
    } catch (_) {}
  }

  Future<void> _loadExtraVehiclesToday(String today) async {
    try {
      final raw = await ApiService().getExtraVehicles();
      final todayEntries = raw.where(
        (e) => ((e['date'] ?? e['createdAt'] ?? '') as String).startsWith(today),
      );
      double qty = 0;
      for (final e in todayEntries) {
        final vehiclesRaw = e['vehicles'];
        final Map<String, dynamic> vehicles = vehiclesRaw is String
            ? Map<String, dynamic>.from(jsonDecode(vehiclesRaw) as Map)
            : (vehiclesRaw is Map ? Map<String, dynamic>.from(vehiclesRaw) : {});
        for (final v in vehicles.values) {
          if (v is Map && v['enabled'] == true) {
            qty += _pd(v['quantity']);
          }
        }
      }
      if (mounted) setState(() => _extraVehiclesToday = qty > 0 ? '${qty.toStringAsFixed(1)} hrs' : null);
    } catch (_) {}
  }

  Future<void> _loadSiloExtractionToday(String today) async {
    try {
      final raw = await ApiService().getSiloEntries(size: 500);
      final todayEntries = raw.where(
        (e) => ((e['date'] ?? e['createdAt'] ?? '') as String).startsWith(today),
      ).toList();

      double s1 = 0, s2 = 0, s3 = 0;
      for (final e in todayEntries) {
        s1 += _toKg(_pd(e['silo1Value']), e['silo1Unit']?.toString() ?? 'kg');
        s2 += _toKg(_pd(e['silo2Value']), e['silo2Unit']?.toString() ?? 'kg');
        s3 += _toKg(_pd(e['silo3Value']), e['silo3Unit']?.toString() ?? 'kg');
      }

      if (s1 + s2 + s3 == 0) { if (mounted) setState(() => _siloExtractionToday = null); return; }
      final fmt = (double kg) => kg >= 1000
          ? '${(kg / 1000).toStringAsFixed(2)}MT'
          : '${kg.toStringAsFixed(0)}kg';
      if (mounted) setState(() => _siloExtractionToday =
          'S1:${fmt(s1)}  S2:${fmt(s2)}  S3:${fmt(s3)}');
    } catch (_) {}
  }

  static double _toKg(double value, String unit) =>
      unit.toUpperCase() == 'MT' ? value * 1000 : value;

  static double _pd(dynamic v) => double.tryParse(v?.toString() ?? '0') ?? 0;

  Future<void> _loadDieselToday(String today) async {
    try {
      final raw = await ApiService().getDieselMaintenance();
      final todayEntries = raw.where((e) {
        final date = (e['date'] ?? e['createdAt'] ?? '') as String;
        return date.startsWith(today);
      });
      final total = todayEntries.fold<double>(
        0,
        (sum, e) => sum + (double.tryParse(e['quantity']?.toString() ?? '0') ?? 0),
      );
      if (mounted) setState(() => _dieselToday = total);
    } catch (_) {}
  }

  void _onTap(BuildContext context, String key) {
    if (key == 'pccp') {
      context.push('/business/pccp');
    } else if (key == 'cement-bags') {
      context.push('/business/cement-bags');
    } else if (key == 'vehicles') {
      context.push('/business/vehicles');
    } else if (key == 'silo') {
      context.push('/business/silo');
    } else if (key == 'silo-extraction') {
      context.push('/business/silo-extraction');
    } else if (key == 'pdi') {
      context.push('/business/pdi');
    } else if (key == 'loading') {
      context.push('/business/loading');
    } else if (key == 'extra-vehicles') {
      context.push('/business/extra-vehicles');
    } else if (key == 'conversion') {
      context.push('/business/conversion');
    } else if (key == 'labour') {
      context.push('/business/labour');
    } else if (key == 'loaded-pipes') {
      context.push('/business/loaded-pipes');
    } else if (key == 'loading-invoice') {
      context.push('/business/loading-invoice');
    } else if (key == 'store-material') {
      context.push('/business/store-material');
    } else if (key == 'maintenance') {
      context.push('/business/maintenance');
    } else if (key == 'cutting') {
      context.push('/business/cutting');
    } else if (key == 'diesel-maintenance') {
      context.push('/business/diesel-maintenance');
    } else if (key == 'transport-report') {
      context.push('/business/transport-report');
    } else if (key == 'discard') {
      context.push('/business/discard');
    } else if (key == 'extra-fab') {
      context.push('/business/extra-fab');
    } else if (key == 'testing-lab') {
      context.push('/business/testing-lab');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Coming soon'), duration: Duration(seconds: 2)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final perms = ref.watch(authProvider).user?.cardPermissions;
    final visibleCards = perms == null
        ? _cards
        : _cards.where((c) => perms.business.contains(c.key)).toList();

    final visibleStages = perms == null
        ? _pccpStages
        : _pccpStages.where((s) => perms.pccp.contains(s.stageType)).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _buildHeader()),

          // ── PCCP stage cards (shown first) ───────────────────────────────
          if (visibleStages.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
                child: Row(
                  children: [
                    Container(
                      width: 3, height: 16,
                      decoration: BoxDecoration(
                        color: const Color(0xFF7C3AED),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text('PCCP Stages',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                          color: Color(0xFF374151), letterSpacing: 0.3)),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(14, 0, 14, 0),
              sliver: SliverGrid(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) {
                    final stage = visibleStages[i];
                    return _PccpStageTile(
                      stage: stage,
                      onTap: () => ctx.push('/business/pccp/stage', extra: {
                        'stageType': stage.stageType,
                        'name': stage.label,
                        'colorValue': stage.color.value,
                      }),
                    );
                  },
                  childCount: visibleStages.length,
                ),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  mainAxisExtent: 165,
                ),
              ),
            ),
          ],

          // ── Business cards ────────────────────────────────────────────────
          if (visibleCards.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(14, visibleStages.isNotEmpty ? 20 : 14, 14, 8),
                child: Row(
                  children: [
                    Container(
                      width: 3, height: 16,
                      decoration: BoxDecoration(
                        color: const Color(0xFF2563EB),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text('Process Modules',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700,
                          color: Color(0xFF374151), letterSpacing: 0.3)),
                  ],
                ),
              ),
            ),
            SliverPadding(
              padding: EdgeInsets.fromLTRB(14, 0, 14, visibleStages.isEmpty ? 28 : 28),
              sliver: SliverGrid(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) {
                    final card = visibleCards[i];
                    String? stat;
                    if (card.key == 'cement-bags' && _totalCementKg != null) {
                      final bags = _totalCementBags!.toStringAsFixed(0);
                      final kg = _totalCementKg!;
                      stat = '$bags bags · ${kg.toStringAsFixed(0)} kg';
                    } else if (card.key == 'diesel-maintenance' && _dieselToday != null) {
                      stat = '${_dieselToday!.toStringAsFixed(1)} L today';
                    } else if (card.key == 'loaded-pipes' && _pipesToday != null) {
                      stat = '$_pipesToday pipes today';
                    } else if (card.key == 'vehicles' && _vehiclesToday != null) {
                      stat = _vehiclesToday;
                    } else if (card.key == 'extra-vehicles' && _extraVehiclesToday != null) {
                      stat = _extraVehiclesToday;
                    } else if (card.key == 'silo-extraction' && _siloExtractionToday != null) {
                      stat = _siloExtractionToday;
                    }
                    return _CardTile(
                      card: card,
                      stat: stat,
                      onTap: () => _onTap(ctx, card.key),
                    );
                  },
                  childCount: visibleCards.length,
                ),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  mainAxisExtent: 165,
                ),
              ),
            ),
          ],

          if (visibleCards.isEmpty && visibleStages.isEmpty)
            const SliverFillRemaining(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.lock_outline, size: 48, color: Color(0xFFD1D5DB)),
                    SizedBox(height: 12),
                    Text('No modules assigned',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF6B7280))),
                    SizedBox(height: 4),
                    Text('Contact your admin to get access',
                      style: TextStyle(fontSize: 13, color: Color(0xFF9CA3AF))),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF7C3AED), Color(0xFF2563EB)],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.menu_outlined, color: Colors.white),
                    onPressed: openAppDrawer,
                    tooltip: 'Open menu',
                  ),
                  const SizedBox(width: 4),
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.white.withOpacity(0.25)),
                    ),
                    child: const Icon(Icons.business_outlined, color: Color(0xFFFBBF24), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'OPERATIONS',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.65),
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.4,
                          ),
                        ),
                        const Text(
                          'Business',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: Text(
                'Select a module to record or view daily data',
                style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: Colors.white.withOpacity(0.15))),
              ),
              child: Row(
                children: [
                  _statCell('${_cards.length}', 'Modules', 'operational areas'),
                  _divider(),
                  _statCell('2', 'Production', 'PCCP · PSC'),
                  _divider(),
                  _statCell('${_cards.length - 2}', 'Support', 'logistics & admin'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _statCell(String value, String label, String sub) {
    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(value,
                style: const TextStyle(
                    color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
            Text(label,
                style: TextStyle(color: Colors.white.withOpacity(0.75), fontSize: 11)),
            Text(sub,
                style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 10)),
          ],
        ),
      ),
    );
  }

  Widget _divider() =>
      Container(width: 1, height: 48, color: Colors.white.withOpacity(0.15));
}

// ── Card tile ─────────────────────────────────────────────────────────────────

class _CardTile extends StatelessWidget {
  final _BizCard card;
  final String? stat;
  final VoidCallback onTap;
  const _CardTile({required this.card, required this.onTap, this.stat});

  @override
  Widget build(BuildContext context) {
    final isActive = _routed.contains(card.key);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isActive
                ? card.color.withOpacity(0.30)
                : const Color(0xFFE5E7EB),
          ),
          boxShadow: [
            BoxShadow(
              color: isActive
                  ? card.color.withOpacity(0.10)
                  : Colors.black.withOpacity(0.04),
              blurRadius: isActive ? 12 : 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.hardEdge,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Top accent stripe — violet→blue for all cards
            Container(
              height: 4,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFF2563EB)],
                ),
              ),
            ),

            Padding(
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Centred icon
                  Icon(card.icon, color: card.color, size: 32),
                  const SizedBox(height: 10),
                  // Title + subtitle centred below
                  Text(
                    card.label,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF111827),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    card.subtitle,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (stat != null) ...[
                    const SizedBox(height: 9),
                    _DetailRow(
                      icon: Icons.bar_chart_outlined,
                      label: 'Stock',
                      value: stat!,
                      color: card.color,
                      gradientPill: true,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── PCCP Stage Tile ───────────────────────────────────────────────────────────

class _PccpStageTile extends StatelessWidget {
  final _PccpStage stage;
  final VoidCallback onTap;
  const _PccpStageTile({required this.stage, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: stage.color.withOpacity(0.30)),
          boxShadow: [
            BoxShadow(
              color: stage.color.withOpacity(0.10),
              blurRadius: 12,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.hardEdge,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Top accent stripe
            Container(
              height: 4,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFF2563EB)],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(stage.icon, color: stage.color, size: 32),
                  const SizedBox(height: 10),
                  Text(
                    stage.label,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF111827)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'PCCP Stage',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)),
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

// ── Detail row ────────────────────────────────────────────────────────────────

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  final bool gradientPill;

  const _DetailRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.color,
    this.gradientPill = false,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 11, color: const Color(0xFF9CA3AF)),
        const SizedBox(width: 5),
        SizedBox(
          width: 36,
          child: Text(
            label,
            style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)),
          ),
        ),
        const SizedBox(width: 4),
        Flexible(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              gradient: gradientPill
                  ? const LinearGradient(
                      colors: [Color(0xFFEDE9FE), Color(0xFFDBEAFE)],
                    )
                  : null,
              color: gradientPill ? null : color.withOpacity(0.10),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              value,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: gradientPill ? const Color(0xFF5B21B6) : color,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
      ],
    );
  }
}
