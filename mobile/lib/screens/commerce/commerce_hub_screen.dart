import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:pos_mobile/main.dart';

class _Card {
  final String path;
  final String label;
  final String subtitle;
  final IconData icon;
  final Color color;
  const _Card(this.path, this.label, this.subtitle, this.icon, this.color);
}

const _cards = [
  _Card('/sales-orders', 'Sales Orders',  'B2B sales & confirmations',    Icons.shopping_bag_outlined,   Color(0xFF059669)),
  _Card('/purchases',    'Purchases',      'Purchase orders & receiving',   Icons.shopping_cart_outlined,   Color(0xFFEA580C)),
  _Card('/invoices',     'Invoices',       'Billing & payment status',      Icons.description_outlined,    Color(0xFF2563EB)),
  _Card('/vendors',      'Vendors',        'Supplier directory',            Icons.store_outlined,           Color(0xFF7C3AED)),
  _Card('/orders',       'Orders',         'POS / retail orders',          Icons.receipt_long_outlined,   Color(0xFF0891B2)),
  _Card('/customers',    'Customers',      'Customer profiles',             Icons.people_outline,          Color(0xFFDB2777)),
];

class CommerceHubScreen extends StatelessWidget {
  const CommerceHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF9FAFB),
      body: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(child: _buildHeader()),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(14, 14, 14, 28),
            sliver: SliverGrid(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) => _CardTile(
                  card: _cards[i],
                  onTap: () => ctx.push(_cards[i].path),
                ),
                childCount: _cards.length,
              ),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                mainAxisExtent: 150,
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
                    child: const Icon(Icons.shopping_bag_outlined, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'TRADE & SALES',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.65),
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 1.4,
                          ),
                        ),
                        const Text(
                          'Commerce',
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
                'Manage sales, purchases, invoices & customers',
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
                  _statCell('${_cards.length}', 'Modules', 'commerce areas'),
                  _divider(),
                  _statCell('3', 'Trade', 'orders · invoices · purchases'),
                  _divider(),
                  _statCell('3', 'Admin', 'vendors · orders · customers'),
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
  final _Card card;
  final VoidCallback onTap;
  const _CardTile({required this.card, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: card.color.withOpacity(0.28)),
          boxShadow: [
            BoxShadow(
              color: card.color.withOpacity(0.10),
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
            // Top accent stripe — green→teal for all cards
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
                  Icon(card.icon, color: card.color, size: 32),
                  const SizedBox(height: 10),
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
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
