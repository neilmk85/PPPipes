import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';

final _productsProvider = FutureProvider<List<Product>>((ref) async {
  return ApiService().getProducts();
});

class ProductsScreen extends ConsumerStatefulWidget {
  const ProductsScreen({super.key});

  @override
  ConsumerState<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends ConsumerState<ProductsScreen> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  bool _showSearch = false;
  String _query = '';
  final _searchCtrl = TextEditingController();

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  List<Product> _filtered(List<Product> products) {
    if (_query.isEmpty) return products;
    final q = _query.toLowerCase();
    return products.where((p) =>
      p.name.toLowerCase().contains(q) ||
      (p.sku?.toLowerCase().contains(q) ?? false) ||
      (p.category?.name.toLowerCase().contains(q) ?? false)
    ).toList();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_productsProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: async.when(
        loading: () => CustomScrollView(slivers: [_buildAppBar(0), const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))]),
        error: (e, _) => CustomScrollView(slivers: [_buildAppBar(0), SliverFillRemaining(child: Center(child: Text('Error: $e')))]),
        data: (products) {
          final filtered = _filtered(products);
          return CustomScrollView(slivers: [
            _buildAppBar(products.length),
            if (filtered.isEmpty)
              SliverFillRemaining(child: Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.inventory_2_outlined, size: 48, color: Colors.grey.shade300),
                const SizedBox(height: 12),
                Text(_query.isNotEmpty ? 'No products match your search' : 'No products found', style: TextStyle(color: Colors.grey.shade500, fontWeight: FontWeight.w600)),
              ])))
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
                sliver: SliverList(delegate: SliverChildBuilderDelegate(
                  (ctx, i) {
                    final p = filtered[i];
                    return GestureDetector(
                      onTap: null,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [
                          BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10, offset: const Offset(0, 2)),
                          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 1)),
                        ]),
                        child: Padding(padding: const EdgeInsets.all(12), child: Row(children: [
                          p.imageUrl != null
                            ? CircleAvatar(radius: 22, backgroundImage: NetworkImage(p.imageUrl!))
                            : Container(width: 44, height: 44, decoration: BoxDecoration(color: _color.withValues(alpha: 0.10), borderRadius: BorderRadius.circular(10)), child: const Icon(Icons.inventory_2_outlined, color: _color, size: 22)),
                          const SizedBox(width: 12),
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(p.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            Text(p.category?.name ?? 'No category', style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                            if (p.sku != null) Text(p.sku!, style: const TextStyle(fontSize: 11, color: Colors.grey)),
                          ])),
                          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                            Text('₹${p.sellingPrice.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: _color)),
                          ]),
                        ])),
                      ),
                    );
                  },
                  childCount: filtered.length,
                )),
              ),
          ]);
        },
      ),
      bottomNavigationBar: _buildFloatingNav(),
    );
  }

  SliverAppBar _buildAppBar(int count) {
    return SliverAppBar(
      pinned: true,
      expandedHeight: 106,
      toolbarHeight: 46,
      backgroundColor: Colors.transparent,
      foregroundColor: Colors.white,
      elevation: 0,
      scrolledUnderElevation: 0,
      leading: context.canPop()
          ? IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => context.pop())
          : const IconButton(icon: Icon(Icons.menu_outlined), onPressed: openAppDrawer, tooltip: 'Open menu'),
      title: const Text('Products', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3, color: Colors.white)),
      actions: [
        IconButton(icon: const Icon(Icons.refresh), onPressed: () => ref.invalidate(_productsProvider), color: Colors.white),
      ],
      flexibleSpace: FlexibleSpaceBar(
        collapseMode: CollapseMode.pin,
        background: Container(
          decoration: const BoxDecoration(gradient: LinearGradient(colors: [_color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight)),
          child: Stack(children: [
            Positioned(right: -24, top: -24, child: Container(width: 110, height: 110, decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.white.withValues(alpha: 0.06)))),
            Align(alignment: Alignment.bottomLeft, child: Padding(padding: const EdgeInsets.fromLTRB(6, 0, 6, 10), child: Row(children: [
              _hStat('$count', 'Products'),
            ]))),
          ]),
        ),
      ),
    );
  }

  Widget _buildFloatingNav() {
    return Container(color: Colors.transparent, child: SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
      Padding(padding: const EdgeInsets.fromLTRB(20, 6, 20, 14), child: Container(
        height: 64,
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32), boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.13), blurRadius: 24, spreadRadius: -2, offset: const Offset(0, 6)),
          BoxShadow(color: _color.withValues(alpha: 0.12), blurRadius: 40, offset: const Offset(0, 10)),
        ]),
        clipBehavior: Clip.hardEdge,
        child: AnimatedSwitcher(duration: const Duration(milliseconds: 260),
          transitionBuilder: (child, anim) => FadeTransition(opacity: anim, child: child),
          child: _showSearch ? _buildSearchExpanded() : _buildNavItems()),
      )),
    ])));
  }

  Widget _buildSearchExpanded() {
    return Row(key: const ValueKey('prodsearch'), children: [
      Container(margin: const EdgeInsets.all(8), width: 48, height: 48,
        decoration: const BoxDecoration(gradient: LinearGradient(colors: [_color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.all(Radius.circular(24))),
        child: const Icon(Icons.search, color: Colors.white, size: 20)),
      Expanded(child: TextField(controller: _searchCtrl, autofocus: true, style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B)),
        onChanged: (v) => setState(() => _query = v),
        decoration: InputDecoration(hintText: 'Search products…', hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13), border: InputBorder.none, isDense: true))),
      GestureDetector(
        onTap: () => setState(() { _showSearch = false; _query = ''; _searchCtrl.clear(); }),
        child: Container(margin: const EdgeInsets.all(10), width: 40, height: 40,
          decoration: BoxDecoration(color: Colors.grey.shade100, borderRadius: BorderRadius.circular(20)),
          child: const Icon(Icons.close, size: 18, color: Color(0xFF64748B)))),
    ]);
  }

  Widget _buildNavItems() {
    return Row(key: const ValueKey('prodnav'), children: [
      _floatItem(icon: Icons.search, label: 'Search', active: false, onTap: () => setState(() => _showSearch = true)),
      _floatItem(icon: Icons.inventory_2_outlined, label: 'All', active: true, onTap: () {}),
    ]);
  }

  Widget _floatItem({required IconData icon, required String label, required bool active, required VoidCallback onTap}) {
    return Expanded(child: GestureDetector(onTap: onTap, behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(duration: const Duration(milliseconds: 220), curve: Curves.easeInOut,
        margin: const EdgeInsets.all(6),
        decoration: active ? const BoxDecoration(gradient: LinearGradient(colors: [_color, _colorDark], begin: Alignment.topLeft, end: Alignment.bottomRight), borderRadius: BorderRadius.all(Radius.circular(26))) : null,
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(icon, size: 22, color: active ? Colors.white : const Color(0xFF94A3B8)),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(fontSize: 9.5, fontWeight: active ? FontWeight.w700 : FontWeight.w500, color: active ? Colors.white : const Color(0xFF94A3B8), letterSpacing: 0.2)),
        ]))));
  }

  Widget _hStat(String value, String label) => Expanded(child: Column(mainAxisSize: MainAxisSize.min, children: [
    Text(value, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white)),
    Text(label, style: const TextStyle(fontSize: 9, color: Colors.white70, letterSpacing: 0.2), textAlign: TextAlign.center),
  ]));
}
