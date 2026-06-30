import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

final _lowStockProvider = FutureProvider<List<Inventory>>((ref) async {
  final outletId = ref.watch(authProvider).user?.outletId;
  if (outletId == null) return [];
  return ApiService().getLowStock(outletId);
});

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  String _tab = 'lowstock';

  @override
  Widget build(BuildContext context) {
    final lowStockAsync = ref.watch(_lowStockProvider);
    final lowStockCount = lowStockAsync.valueOrNull?.length ?? 0;

    String viewLabel;
    switch (_tab) {
      case 'adjust':
        viewLabel = 'Adjust';
        break;
      case 'outlets':
        viewLabel = 'Outlets';
        break;
      default:
        viewLabel = 'Low Stock';
    }

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
            leading: context.canPop()
                ? IconButton(
                    icon: const Icon(Icons.arrow_back),
                    onPressed: () => context.pop(),
                  )
                : IconButton(
                    icon: const Icon(Icons.menu_outlined),
                    onPressed: openAppDrawer,
                    tooltip: 'Open menu',
                  ),
            title: const Text(
              'Inventory',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
                color: Colors.white,
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.refresh),
                onPressed: () => ref.invalidate(_lowStockProvider),
                color: Colors.white,
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
                            _hStat('$lowStockCount', 'Low Stock'),
                            _hStat(viewLabel, 'View'),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          SliverFillRemaining(
            child: _buildTabContent(),
          ),
        ],
      ),
      bottomNavigationBar: _buildFloatingNav(),
    );
  }

  Widget _buildTabContent() {
    switch (_tab) {
      case 'adjust':
        return const _AdjustStockTab();
      case 'outlets':
        return const _CrossOutletTab();
      default:
        return const _LowStockTab();
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
                        icon: Icons.warning_amber_outlined,
                        label: 'Low Stock',
                        tab: 'lowstock'),
                    _navItem(
                        icon: Icons.tune_outlined,
                        label: 'Adjust',
                        tab: 'adjust'),
                    _navItem(
                        icon: Icons.store_outlined,
                        label: 'Outlets',
                        tab: 'outlets'),
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
            Text(
              value,
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Colors.white),
            ),
            Text(
              label,
              style: const TextStyle(
                  fontSize: 9, color: Colors.white70, letterSpacing: 0.2),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
}

// ─── Low Stock Tab ───────────────────────────────────────────────────────────

class _LowStockTab extends ConsumerWidget {
  const _LowStockTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_lowStockProvider);
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (items) => items.isEmpty
          ? const Center(child: Text('No low stock items 🎉'))
          : Padding(
              padding: const EdgeInsets.fromLTRB(12, 4, 12, 0),
              child: ListView.builder(
                itemCount: items.length,
                itemBuilder: (ctx, i) {
                  final inv = items[i];
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
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: Colors.orange.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.warning_amber_outlined,
                                color: Colors.orange, size: 22),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  inv.product.name,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14),
                                ),
                                Text(
                                  '${inv.product.sku ?? ''}  •  Reorder at: ${inv.reorderLevel}',
                                  style: TextStyle(
                                      fontSize: 12,
                                      color: Colors.grey.shade600),
                                ),
                              ],
                            ),
                          ),
                          _StockBadge(
                              qty: inv.quantityOnHand,
                              reorder: inv.reorderLevel.toDouble()),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}

// ─── Adjust Stock Tab ────────────────────────────────────────────────────────

class _AdjustStockTab extends ConsumerStatefulWidget {
  const _AdjustStockTab();

  @override
  ConsumerState<_AdjustStockTab> createState() => _AdjustStockTabState();
}

class _AdjustStockTabState extends ConsumerState<_AdjustStockTab> {
  final _searchCtrl = TextEditingController();
  List<Product> _results = [];
  bool _searching = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    if (q.isEmpty) {
      setState(() => _results = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final r = await ApiService().searchProducts(q);
      setState(() => _results = r);
    } finally {
      setState(() => _searching = false);
    }
  }

  Future<void> _adjust(Product product) async {
    final outletId = ref.read(authProvider).user?.outletId;
    if (outletId == null) return;

    await showDialog(
      context: context,
      builder: (_) =>
          _AdjustmentDialog(product: product, outletId: outletId),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: 'Search product to adjust...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : null,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            onChanged: _search,
          ),
        ),
        if (_results.isEmpty && _searchCtrl.text.isEmpty)
          const Expanded(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.tune, size: 48, color: Colors.grey),
                  SizedBox(height: 8),
                  Text('Search a product to adjust stock',
                      style: TextStyle(color: Colors.grey)),
                ],
              ),
            ),
          )
        else
          Expanded(
            child: ListView.builder(
              itemCount: _results.length,
              itemBuilder: (ctx, i) {
                final p = _results[i];
                return ListTile(
                  title: Text(p.name),
                  subtitle: Text(p.sku ?? ''),
                  trailing: ElevatedButton.icon(
                    icon: const Icon(Icons.edit, size: 16),
                    label: const Text('Adjust'),
                    onPressed: () => _adjust(p),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF4F46E5),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _AdjustmentDialog extends StatefulWidget {
  final Product product;
  final int outletId;
  const _AdjustmentDialog(
      {required this.product, required this.outletId});

  @override
  State<_AdjustmentDialog> createState() => _AdjustmentDialogState();
}

class _AdjustmentDialogState extends State<_AdjustmentDialog> {
  final _qtyCtrl = TextEditingController();
  final _reasonCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _saving = false;

  // positive = stock in, negative = stock out
  bool _isAddition = true;

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _reasonCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final qty = double.tryParse(_qtyCtrl.text);
    if (qty == null || qty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid quantity')));
      return;
    }
    if (_reasonCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reason is required')));
      return;
    }

    setState(() => _saving = true);
    try {
      final adjustedQty = _isAddition ? qty : -qty;
      await ApiService().adjustStock({
        'productId': widget.product.id,
        'outletId': widget.outletId,
        'quantity': adjustedQty,
        'reason': _reasonCtrl.text.trim(),
        'notes': _notesCtrl.text.trim().isEmpty
            ? null
            : _notesCtrl.text.trim(),
      });
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Stock ${_isAddition ? 'added' : 'removed'}: $qty ${widget.product.unitOfMeasure}'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Adjust Stock\n${widget.product.name}',
          style: const TextStyle(fontSize: 16)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Add / Remove toggle
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(
                    value: true,
                    label: Text('Add Stock'),
                    icon: Icon(Icons.add)),
                ButtonSegment(
                    value: false,
                    label: Text('Remove Stock'),
                    icon: Icon(Icons.remove)),
              ],
              selected: {_isAddition},
              onSelectionChanged: (s) =>
                  setState(() => _isAddition = s.first),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _qtyCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: 'Quantity *',
                border: const OutlineInputBorder(),
                suffixText: widget.product.unitOfMeasure,
              ),
              autofocus: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _reasonCtrl,
              decoration: const InputDecoration(
                labelText: 'Reason *',
                hintText: 'e.g. Goods received, Damage, Count correction',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _notesCtrl,
              decoration: const InputDecoration(
                labelText: 'Notes (optional)',
                border: OutlineInputBorder(),
              ),
              maxLines: 2,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _saving ? null : _save,
          style: ElevatedButton.styleFrom(
            backgroundColor:
                _isAddition ? Colors.green : Colors.orange,
            foregroundColor: Colors.white,
          ),
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : Text(_isAddition ? 'Add Stock' : 'Remove Stock'),
        ),
      ],
    );
  }
}

// ─── Cross Outlet Tab ────────────────────────────────────────────────────────

class _CrossOutletTab extends StatefulWidget {
  const _CrossOutletTab();

  @override
  State<_CrossOutletTab> createState() => _CrossOutletTabState();
}

class _CrossOutletTabState extends State<_CrossOutletTab> {
  final _searchCtrl = TextEditingController();
  List<Product> _results = [];
  bool _searching = false;
  final Map<int, List<dynamic>> _stockMap = {};

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    if (q.isEmpty) {
      setState(() => _results = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final r = await ApiService().searchProducts(q);
      setState(() => _results = r);
    } finally {
      setState(() => _searching = false);
    }
  }

  Future<void> _loadStock(int productId) async {
    if (_stockMap.containsKey(productId)) {
      setState(() => _stockMap.remove(productId));
      return;
    }
    final data = await ApiService().getStockAcrossOutlets(productId);
    setState(() => _stockMap[productId] = data);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: 'Search product across outlets...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : null,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            onChanged: _search,
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: _results.length,
            itemBuilder: (ctx, i) {
              final p = _results[i];
              final stockData = _stockMap[p.id];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ListTile(
                    title: Text(p.name),
                    subtitle: Text(p.sku ?? ''),
                    trailing: IconButton(
                      icon: Icon(
                        stockData != null
                            ? Icons.expand_less
                            : Icons.store_outlined,
                        color: const Color(0xFF4F46E5),
                      ),
                      onPressed: () => _loadStock(p.id),
                    ),
                  ),
                  if (stockData != null)
                    Padding(
                      padding: const EdgeInsets.only(
                          left: 16, right: 16, bottom: 8),
                      child: Wrap(
                        spacing: 8,
                        children: stockData.map((s) {
                          final qty =
                              (s['quantityOnHand'] as num).toDouble();
                          return Chip(
                            label: Text(
                              '${s['outletName']}: ${qty.toStringAsFixed(0)}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            backgroundColor: qty > 0
                                ? Colors.green.shade100
                                : Colors.red.shade100,
                          );
                        }).toList(),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _StockBadge extends StatelessWidget {
  final double qty;
  final double reorder;
  const _StockBadge({required this.qty, required this.reorder});

  @override
  Widget build(BuildContext context) {
    final isLow = qty <= reorder;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: isLow ? Colors.red.shade100 : Colors.green.shade100,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        qty.toStringAsFixed(0),
        style: TextStyle(
          color: isLow ? Colors.red : Colors.green,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
