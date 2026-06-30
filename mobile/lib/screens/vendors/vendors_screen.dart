import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';

class VendorsScreen extends StatefulWidget {
  const VendorsScreen({super.key});

  @override
  State<VendorsScreen> createState() => _VendorsScreenState();
}

class _VendorsScreenState extends State<VendorsScreen> {
  static const _color = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  final List<Vendor> _vendors = [];
  bool _loading = false;
  bool _hasMore = true;
  int _page = 0;
  final _scroll = ScrollController();
  final _searchCtrl = TextEditingController();
  String _query = '';
  bool _showSearch = false;

  @override
  void initState() {
    super.initState();
    _load();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 200) {
        if (!_loading && _hasMore) _load();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    if (reset) {
      _vendors.clear();
      _page = 0;
      _hasMore = true;
    }
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getVendors(page: _page, size: 30);
      final items = raw.map((e) => Vendor.fromJson(e)).toList();
      setState(() {
        _vendors.addAll(items);
        _page++;
        _hasMore = items.length == 30;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  List<Vendor> get _filtered {
    if (_query.isEmpty) return _vendors;
    final q = _query.toLowerCase();
    return _vendors
        .where((v) =>
            v.name.toLowerCase().contains(q) ||
            (v.phone?.contains(q) ?? false) ||
            (v.email?.toLowerCase().contains(q) ?? false))
        .toList();
  }

  int get _withBalance =>
      _vendors.where((v) => (v.outstandingPayable ?? 0) > 0).length;

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final filtered = _filtered;

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: CustomScrollView(
          controller: _scroll,
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
                  : const IconButton(
                      icon: Icon(Icons.menu_outlined),
                      onPressed: openAppDrawer,
                      tooltip: 'Open menu',
                    ),
              title: const Text(
                'Vendors',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -0.3,
                  color: Colors.white,
                ),
              ),
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
                  child: Stack(children: [
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
                        child: Row(children: [
                          _hStat('${_vendors.length}', 'Vendors'),
                          _hStat('$_withBalance', 'With Balance'),
                        ]),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
            if (filtered.isEmpty && !_loading)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.store_outlined, size: 48, color: Colors.grey.shade300),
                      const SizedBox(height: 12),
                      Text(
                        _query.isNotEmpty ? 'No vendors match your search' : 'No vendors found',
                        style: TextStyle(
                          color: Colors.grey.shade500,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) {
                      if (i >= filtered.length) {
                        return const Center(
                          child: Padding(
                            padding: EdgeInsets.all(16),
                            child: CircularProgressIndicator(),
                          ),
                        );
                      }
                      final vendor = filtered[i];
                      return GestureDetector(
                        onTap: () => _showDetail(context, vendor, fmt),
                        child: Container(
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
                                CircleAvatar(
                                  radius: 20,
                                  backgroundColor: _color.withValues(alpha: 0.12),
                                  child: Text(
                                    vendor.name.isNotEmpty
                                        ? vendor.name[0].toUpperCase()
                                        : 'V',
                                    style: const TextStyle(
                                      color: _color,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        vendor.name,
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 14,
                                        ),
                                      ),
                                      if (vendor.phone != null)
                                        Text(
                                          vendor.phone!,
                                          style: TextStyle(
                                            fontSize: 12,
                                            color: Colors.grey.shade600,
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                if (vendor.outstandingPayable != null &&
                                    vendor.outstandingPayable! > 0)
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        fmt.format(vendor.outstandingPayable!),
                                        style: const TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: Color(0xFFF44336),
                                          fontSize: 12,
                                        ),
                                      ),
                                      Text(
                                        'Payable',
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: Colors.grey.shade600,
                                        ),
                                      ),
                                    ],
                                  ),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                    childCount: filtered.length + (_loading ? 1 : 0),
                  ),
                ),
              ),
          ],
        ),
      ),
      bottomNavigationBar: _buildFloatingNav(),
    );
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
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 260),
                  transitionBuilder: (child, anim) =>
                      FadeTransition(opacity: anim, child: child),
                  child: _showSearch
                      ? _buildSearchExpanded()
                      : _buildNavItems(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchExpanded() {
    return Row(
      key: const ValueKey('vsearch'),
      children: [
        Container(
          margin: const EdgeInsets.all(8),
          width: 48,
          height: 48,
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [_color, _colorDark],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
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
              hintText: 'Search vendors…',
              hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 13),
              border: InputBorder.none,
              isDense: true,
            ),
          ),
        ),
        GestureDetector(
          onTap: () => setState(() {
            _showSearch = false;
            _query = '';
            _searchCtrl.clear();
          }),
          child: Container(
            margin: const EdgeInsets.all(10),
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.grey.shade100,
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(Icons.close, size: 18, color: Color(0xFF64748B)),
          ),
        ),
      ],
    );
  }

  Widget _buildNavItems() {
    return Row(
      key: const ValueKey('vnav'),
      children: [
        _floatItem(
          icon: Icons.search,
          label: 'Search',
          active: false,
          onTap: () => setState(() => _showSearch = true),
        ),
        _floatItem(
          icon: Icons.store_outlined,
          label: 'All',
          active: true,
          onTap: () {},
        ),
      ],
    );
  }

  Widget _floatItem({
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
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.all(Radius.circular(26)),
                )
              : null,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                icon,
                size: 22,
                color: active ? Colors.white : const Color(0xFF94A3B8),
              ),
              const SizedBox(height: 3),
              Text(
                label,
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: active ? FontWeight.w700 : FontWeight.w500,
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
                color: Colors.white,
              ),
            ),
            Text(
              label,
              style: const TextStyle(
                fontSize: 9,
                color: Colors.white70,
                letterSpacing: 0.2,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );

  void _showDetail(BuildContext context, Vendor vendor, NumberFormat fmt) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: _color.withValues(alpha: 0.12),
                  child: Text(
                    vendor.name[0].toUpperCase(),
                    style: const TextStyle(
                        fontSize: 22,
                        color: _color,
                        fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(vendor.name,
                          style: const TextStyle(
                              fontSize: 18, fontWeight: FontWeight.bold)),
                      if (vendor.email != null)
                        Text(vendor.email!,
                            style: const TextStyle(color: Colors.grey)),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (vendor.phone != null)
              _DetailRow(icon: Icons.phone, label: 'Phone', value: vendor.phone!),
            if (vendor.address != null)
              _DetailRow(
                  icon: Icons.location_on,
                  label: 'Address',
                  value: vendor.address!),
            if (vendor.outstandingPayable != null)
              _DetailRow(
                icon: Icons.account_balance_wallet,
                label: 'Outstanding Payable',
                value: fmt.format(vendor.outstandingPayable!),
                valueColor:
                    vendor.outstandingPayable! > 0 ? const Color(0xFFF44336) : null,
              ),
          ],
        ),
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  const _DetailRow(
      {required this.icon,
      required this.label,
      required this.value,
      this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey),
          const SizedBox(width: 10),
          Text('$label: ',
              style: const TextStyle(color: Colors.grey, fontSize: 13)),
          Expanded(
            child: Text(value,
                style: TextStyle(
                    fontWeight: FontWeight.w500,
                    fontSize: 13,
                    color: valueColor)),
          ),
        ],
      ),
    );
  }
}
