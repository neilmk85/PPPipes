import 'package:flutter/material.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';
import '../../utils/confirm_discard.dart';

class CustomerProfileScreen extends StatefulWidget {
  final Customer customer;
  const CustomerProfileScreen({super.key, required this.customer});

  @override
  State<CustomerProfileScreen> createState() => _CustomerProfileScreenState();
}

class _CustomerProfileScreenState extends State<CustomerProfileScreen>
    with SingleTickerProviderStateMixin {
  late Customer _customer;
  late TabController _tabs;
  List<Order> _orders = [];
  bool _loadingOrders = false;
  bool _hasMoreOrders = true;
  int _orderPage = 0;
  final ScrollController _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _customer = widget.customer;
    _tabs = TabController(length: 2, vsync: this);
    _scrollCtrl.addListener(_onScroll);
    _loadOrders();
  }

  @override
  void dispose() {
    _tabs.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
            _scrollCtrl.position.maxScrollExtent - 100 &&
        !_loadingOrders &&
        _hasMoreOrders) {
      _loadOrders();
    }
  }

  Future<void> _loadOrders({bool reset = false}) async {
    if (_loadingOrders) return;
    if (reset) {
      _orders = [];
      _orderPage = 0;
      _hasMoreOrders = true;
    }
    setState(() => _loadingOrders = true);
    try {
      final batch = await ApiService()
          .getOrdersByCustomer(_customer.id, page: _orderPage);
      setState(() {
        _orders.addAll(batch);
        _orderPage++;
        if (batch.length < 20) _hasMoreOrders = false;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      setState(() => _loadingOrders = false);
    }
  }

  Future<void> _editCustomer() async {
    final updated = await showDialog<Customer>(
      context: context,
      builder: (_) => _EditCustomerDialog(customer: _customer),
    );
    if (updated != null) {
      setState(() => _customer = updated);
    }
  }

  Color get _segmentColor {
    switch (_customer.segment) {
      case 'VIP':
        return Colors.purple;
      case 'PREMIUM':
        return Colors.orange;
      case 'GOLD':
        return const Color(0xFFFFD700);
      default:
        return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_customer.name),
        actions: [
          IconButton(icon: const Icon(Icons.edit), onPressed: _editCustomer),
        ],
      ),
      body: Column(
        children: [
          // Profile header
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  _segmentColor.withValues(alpha: 0.8),
                  const Color(0xFF6C63FF),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: Colors.white24,
                  child: Text(
                    _customer.name[0].toUpperCase(),
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(height: 10),
                Text(_customer.name,
                    style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                if (_customer.phone != null)
                  Text(_customer.phone!,
                      style: const TextStyle(
                          color: Colors.white70, fontSize: 13)),
                if (_customer.email != null)
                  Text(_customer.email!,
                      style: const TextStyle(
                          color: Colors.white70, fontSize: 13)),
                const SizedBox(height: 12),
                // Stats row
                Row(
                  children: [
                    _StatChip('Segment', _customer.segment),
                    _StatChip('Spent',
                        '₹${_customer.totalSpent.toStringAsFixed(0)}'),
                    _StatChip('Points',
                        _customer.loyaltyPoints.toStringAsFixed(0)),
                    if (_customer.outstandingDue > 0)
                      _StatChip(
                          'Due',
                          '₹${_customer.outstandingDue.toStringAsFixed(0)}',
                          color: Colors.red.shade300),
                  ],
                ),
                const SizedBox(height: 8),
                TabBar(
                  controller: _tabs,
                  indicatorColor: Colors.white,
                  labelColor: Colors.white,
                  unselectedLabelColor: Colors.white60,
                  tabs: const [Tab(text: 'Overview'), Tab(text: 'Orders')],
                ),
              ],
            ),
          ),
          // Tab content
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                _OverviewTab(customer: _customer),
                _OrdersTab(
                  orders: _orders,
                  loading: _loadingOrders,
                  hasMore: _hasMoreOrders,
                  scrollController: _scrollCtrl,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _StatChip(String label, String value, {Color? color}) => Expanded(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 3),
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white24,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            children: [
              Text(value,
                  style: TextStyle(
                      color: color ?? Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 13)),
              Text(label,
                  style: const TextStyle(
                      color: Colors.white60, fontSize: 10)),
            ],
          ),
        ),
      );
}

class _OverviewTab extends StatelessWidget {
  final Customer customer;
  const _OverviewTab({required this.customer});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _InfoCard(children: [
          _InfoRow(Icons.person, 'Name', customer.name),
          if (customer.phone != null)
            _InfoRow(Icons.phone, 'Phone', customer.phone!),
          if (customer.email != null)
            _InfoRow(Icons.email, 'Email', customer.email!),
          _InfoRow(Icons.star, 'Segment', customer.segment),
          _InfoRow(Icons.circle,
              'Status', customer.active ? 'Active' : 'Inactive'),
        ]),
        const SizedBox(height: 16),
        _InfoCard(title: 'Financial Summary', children: [
          _InfoRow(Icons.shopping_bag, 'Total Spent',
              '₹${customer.totalSpent.toStringAsFixed(2)}'),
          _InfoRow(Icons.loyalty, 'Loyalty Points',
              customer.loyaltyPoints.toStringAsFixed(0)),
          if (customer.discountPercent > 0)
            _InfoRow(Icons.discount, 'Auto Discount',
                '${customer.discountPercent.toStringAsFixed(1)}%'),
          if (customer.outstandingDue > 0)
            _InfoRow(Icons.warning_amber, 'Outstanding Due',
                '₹${customer.outstandingDue.toStringAsFixed(2)}',
                valueColor: Colors.red),
        ]),
      ],
    );
  }
}

class _OrdersTab extends StatelessWidget {
  final List<Order> orders;
  final bool loading;
  final bool hasMore;
  final ScrollController scrollController;

  const _OrdersTab({
    required this.orders,
    required this.loading,
    required this.hasMore,
    required this.scrollController,
  });

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty && loading) {
      return const Center(child: CircularProgressIndicator());
    }
    if (orders.isEmpty) {
      return const Center(
          child: Text('No orders found', style: TextStyle(color: Colors.grey)));
    }
    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.all(12),
      itemCount: orders.length + (hasMore ? 1 : 0),
      itemBuilder: (ctx, i) {
        if (i == orders.length) {
          return const Center(
              child: Padding(
            padding: EdgeInsets.all(16),
            child: CircularProgressIndicator(),
          ));
        }
        final o = orders[i];
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            title: Text(o.orderNumber,
                style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${o.items.length} items  •  ${_fmtDate(o.createdAt)}'),
            trailing: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text('₹${o.totalAmount.toStringAsFixed(2)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF6C63FF))),
                _StatusChip(o.status),
              ],
            ),
          ),
        );
      },
    );
  }

  String _fmtDate(String iso) {
    if (iso.isEmpty) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return iso;
    }
  }
}

Widget _StatusChip(String status) {
  final color = switch (status) {
    'COMPLETED' => Colors.green,
    'CANCELLED' => Colors.red,
    'REFUNDED' => Colors.orange,
    _ => Colors.grey,
  };
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
    decoration: BoxDecoration(
      color: color.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(status, style: TextStyle(color: color, fontSize: 10)),
  );
}

class _InfoCard extends StatelessWidget {
  final String? title;
  final List<Widget> children;
  const _InfoCard({this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (title != null) ...[
              Text(title!,
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, fontSize: 14)),
              const SizedBox(height: 12),
            ],
            ...children,
          ],
        ),
      ),
    );
  }
}

Widget _InfoRow(IconData icon, String label, String value,
    {Color? valueColor}) =>
    Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: Colors.grey),
          const SizedBox(width: 12),
          Expanded(
              child: Text(label,
                  style: const TextStyle(color: Colors.grey, fontSize: 13))),
          Text(value,
              style: TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: valueColor)),
        ],
      ),
    );

// ─── Edit Customer Dialog ────────────────────────────────────────────────────

class _EditCustomerDialog extends StatefulWidget {
  final Customer customer;
  const _EditCustomerDialog({required this.customer});

  @override
  State<_EditCustomerDialog> createState() => _EditCustomerDialogState();
}

class _EditCustomerDialogState extends State<_EditCustomerDialog> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _emailCtrl;
  late TextEditingController _discountCtrl;
  late String _segment;
  bool _saving = false;
  bool _isDirty = false;

  final _segments = ['REGULAR', 'GOLD', 'PREMIUM', 'VIP'];

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.customer.name);
    _phoneCtrl = TextEditingController(text: widget.customer.phone ?? '');
    _emailCtrl = TextEditingController(text: widget.customer.email ?? '');
    _discountCtrl = TextEditingController(
        text: widget.customer.discountPercent.toStringAsFixed(1));
    _segment = widget.customer.segment;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    _discountCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final phone = _phoneCtrl.text.trim();
    if (phone.isNotEmpty && !RegExp(r'^\d{10}$').hasMatch(phone)) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid 10-digit phone number')));
      return;
    }
    final email = _emailCtrl.text.trim();
    if (email.isNotEmpty && !(email.contains('@') && email.contains('.'))) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid email address')));
      return;
    }
    setState(() => _saving = true);
    try {
      final updated = await ApiService().updateCustomer(widget.customer.id, {
        'name': _nameCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim().isEmpty ? null : _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
        'segment': _segment,
        'discountPercent': double.tryParse(_discountCtrl.text) ?? 0,
      });
      if (mounted) Navigator.pop(context, updated);
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
    return PopScope(
      canPop: !_isDirty,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final discard = await confirmDiscard(context);
        if (discard && context.mounted) Navigator.of(context).pop();
      },
      child: AlertDialog(
      title: const Text('Edit Customer'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _nameCtrl,
                decoration: const InputDecoration(labelText: 'Name *'),
                validator: (v) =>
                    v == null || v.isEmpty ? 'Required' : null,
                onChanged: (_) => setState(() => _isDirty = true),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _phoneCtrl,
                decoration: const InputDecoration(labelText: 'Phone'),
                keyboardType: TextInputType.phone,
                onChanged: (_) => setState(() => _isDirty = true),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _emailCtrl,
                decoration: const InputDecoration(labelText: 'Email'),
                keyboardType: TextInputType.emailAddress,
                onChanged: (_) => setState(() => _isDirty = true),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _segment,
                decoration: const InputDecoration(labelText: 'Segment'),
                items: _segments
                    .map((s) =>
                        DropdownMenuItem(value: s, child: Text(s)))
                    .toList(),
                onChanged: (v) => setState(() { _segment = v ?? _segment; _isDirty = true; }),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _discountCtrl,
                decoration: const InputDecoration(
                    labelText: 'Auto Discount %', suffixText: '%'),
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                onChanged: (_) => setState(() => _isDirty = true),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () async {
              if (!_isDirty || await confirmDiscard(context)) {
                if (context.mounted) Navigator.pop(context);
              }
            },
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save'),
        ),
      ],
      ),
    );
  }
}
