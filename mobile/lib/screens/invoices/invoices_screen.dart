import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';

class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  static const _color     = Color(0xFF4F46E5);
  static const _colorDark = Color(0xFF3730A3);

  final List<Invoice> _invoices = [];
  bool _loading = false;
  bool _hasMore = true;
  int  _page    = 0;
  final _scroll = ScrollController();

  String _activeTab  = 'all';
  bool   _showSearch = false;
  String _search     = '';
  final _searchCtrl  = TextEditingController();

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
    _searchCtrl.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    if (reset) {
      _invoices.clear();
      _page    = 0;
      _hasMore = true;
    }
    setState(() => _loading = true);
    try {
      final raw   = await ApiService().getInvoices(page: _page, size: 20);
      final items = raw.map((e) => Invoice.fromJson(e)).toList();
      setState(() {
        _invoices.addAll(items);
        _page++;
        _hasMore = items.length == 20;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  bool _isPaid(Invoice inv) => inv.status == 'PAID' || inv.balanceDue <= 0;

  List<Invoice> get _filtered {
    var list = _invoices;
    switch (_activeTab) {
      case 'paid':
        list = list.where(_isPaid).toList();
      case 'unpaid':
        list = list.where((inv) => !_isPaid(inv)).toList();
    }
    if (_search.trim().isNotEmpty) {
      final q = _search.toLowerCase();
      list = list.where((inv) =>
        inv.invoiceNumber.toLowerCase().contains(q) ||
        (inv.customerName?.toLowerCase().contains(q) ?? false),
      ).toList();
    }
    return list;
  }

  int get _paidCount   => _invoices.where(_isPaid).length;
  int get _unpaidCount => _invoices.where((inv) => !_isPaid(inv)).length;

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final totalAmt = _invoices.fold<double>(0, (s, inv) => s + inv.totalAmount);

    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: _loading && _invoices.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
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
                            right: -24, top: -24,
                            child: Container(
                              width: 110, height: 110,
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
                                _hStat('${_invoices.length}', 'Invoices'),
                                _hStat('$_paidCount',         'Paid'),
                                _hStat('$_unpaidCount',       'Unpaid'),
                                _hStat(fmt.format(totalAmt),  'Value'),
                              ]),
                            ),
                          ),
                        ]),
                      ),
                    ),
                    title: const Text('Invoices',
                        style: TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                            color: Colors.white)),
                    actions: [
                      GestureDetector(
                        onTap: () => _load(reset: true),
                        child: Container(
                          margin: const EdgeInsets.only(right: 12),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                          ),
                          child: const Icon(Icons.refresh, size: 16, color: Colors.white),
                        ),
                      ),
                    ],
                  ),

                  if (filtered.isEmpty && !_loading)
                    SliverFillRemaining(
                      child: Center(
                        child: Column(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.description_outlined, size: 48, color: Colors.grey.shade300),
                          const SizedBox(height: 12),
                          Text('No invoices found',
                              style: TextStyle(
                                  color: Colors.grey.shade500,
                                  fontWeight: FontWeight.w600)),
                        ]),
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
                            final inv     = filtered[i];
                            final isPaid  = _isPaid(inv);
                            final color   = isPaid
                                ? const Color(0xFF4CAF50)
                                : const Color(0xFFFF9800);
                            final fmt2    = NumberFormat.currency(
                                locale: 'en_IN', symbol: '₹', decimalDigits: 0);

                            return GestureDetector(
                              onTap: () => _showDetail(context, inv),
                              child: Container(
                                margin: const EdgeInsets.only(bottom: 8),
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
                                  padding: const EdgeInsets.all(12),
                                  child: Row(children: [
                                    Container(
                                      width: 40,
                                      height: 40,
                                      decoration: BoxDecoration(
                                        color: color.withValues(alpha: 0.10),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Icon(Icons.description_outlined,
                                          color: color, size: 20),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(inv.invoiceNumber,
                                                style: const TextStyle(
                                                    fontSize: 14,
                                                    fontWeight: FontWeight.bold)),
                                            if (inv.customerName != null)
                                              Text(inv.customerName!,
                                                  style: TextStyle(
                                                      fontSize: 12,
                                                      color: Colors.grey.shade600)),
                                          ]),
                                    ),
                                    Column(
                                        crossAxisAlignment: CrossAxisAlignment.end,
                                        children: [
                                          Text(fmt2.format(inv.totalAmount),
                                              style: const TextStyle(
                                                  fontSize: 14,
                                                  fontWeight: FontWeight.bold)),
                                          const SizedBox(height: 4),
                                          if (!isPaid)
                                            Text('Due: ${fmt2.format(inv.balanceDue)}',
                                                style: const TextStyle(
                                                    fontSize: 11,
                                                    color: Color(0xFFFF9800))),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 8, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: color.withValues(alpha: 0.12),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                                isPaid ? 'PAID' : inv.status,
                                                style: TextStyle(
                                                    fontSize: 10,
                                                    color: color,
                                                    fontWeight: FontWeight.bold)),
                                          ),
                                        ]),
                                  ]),
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

  // ── Detail sheet ─────────────────────────────────────────────────────────────

  void _showDetail(BuildContext context, Invoice inv) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: DraggableScrollableSheet(
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          expand: false,
          builder: (_, ctrl) => Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(inv.invoiceNumber,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.bold)),
                if (inv.customerName != null)
                  Text(inv.customerName!,
                      style: const TextStyle(color: Colors.grey)),
                const Divider(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Total Amount'),
                    Text(fmt.format(inv.totalAmount),
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Paid'),
                    Text(fmt.format(inv.paidAmount),
                        style: const TextStyle(color: Color(0xFF4CAF50))),
                  ],
                ),
                const SizedBox(height: 4),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Balance Due',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    Text(fmt.format(inv.balanceDue),
                        style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Color(0xFFFF9800))),
                  ],
                ),
                const Divider(height: 24),
                if (inv.items.isNotEmpty) ...[
                  const Text('Items',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  Expanded(
                    child: ListView.builder(
                      controller: ctrl,
                      itemCount: inv.items.length,
                      itemBuilder: (_, i) {
                        final item = inv.items[i];
                        return ListTile(
                          dense: true,
                          title: Text(item.productName),
                          subtitle: Text(
                              '${item.quantity} × ${fmt.format(item.unitPrice)}'),
                          trailing: Text(fmt.format(item.total)),
                        );
                      },
                    ),
                  ),
                ] else
                  const Expanded(child: Center(child: Text('No items'))),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // ── Floating nav ─────────────────────────────────────────────────────────────

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
              child: _showSearch ? _buildSearchExpanded() : _buildNavItems(),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSearchExpanded() {
    return Row(
      key: const ValueKey('invsearch'),
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
            onChanged: (v) => setState(() => _search = v),
            decoration: InputDecoration(
              hintText: 'Search invoices…',
              hintStyle:
                  TextStyle(color: Colors.grey.shade400, fontSize: 13),
              border: InputBorder.none,
              isDense: true,
            ),
          ),
        ),
        GestureDetector(
          onTap: () => setState(() {
            _showSearch = false;
            _search     = '';
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
      key: const ValueKey('invnav'),
      children: [
        _navItem(icon: Icons.search,              label: 'Search', tab: 'search'),
        _navItem(icon: Icons.list_outlined,        label: 'All',    tab: 'all'),
        _navItem(icon: Icons.check_circle_outline, label: 'Paid',   tab: 'paid'),
        _navItem(icon: Icons.hourglass_empty,      label: 'Unpaid', tab: 'unpaid'),
      ],
    );
  }

  Widget _navItem({
    required IconData icon,
    required String label,
    required String tab,
  }) {
    final active = (tab == 'search') ? false : _activeTab == tab;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          if (tab == 'search') {
            setState(() => _showSearch = true);
          } else {
            setState(() => _activeTab = tab);
          }
        },
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
              Text(label,
                  style: TextStyle(
                    fontSize: 9.5,
                    fontWeight:
                        active ? FontWeight.w700 : FontWeight.w500,
                    color: active ? Colors.white : const Color(0xFF94A3B8),
                    letterSpacing: 0.2,
                  )),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hStat(String value, String label) => Expanded(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(value,
              style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: Colors.white)),
          Text(label,
              style: const TextStyle(
                  fontSize: 9, color: Colors.white70, letterSpacing: 0.2),
              textAlign: TextAlign.center),
        ]),
      );
}
