import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../../models/models.dart';
import '../../providers/cart_provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class CheckoutSheet extends ConsumerStatefulWidget {
  const CheckoutSheet({super.key});

  @override
  ConsumerState<CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends ConsumerState<CheckoutSheet> {
  String _paymentMethod = 'CASH';
  final _amountCtrl = TextEditingController();
  bool _sendEmail = false;
  bool _sendSms = false;
  bool _sendWhatsApp = false;
  bool _processing = false;
  final _couponCtrl = TextEditingController();

  @override
  void dispose() {
    _amountCtrl.dispose();
    _couponCtrl.dispose();
    super.dispose();
  }

  double get _grandTotal => ref.read(cartProvider).grandTotal;

  double get _change {
    final entered = double.tryParse(_amountCtrl.text) ?? 0;
    return entered - _grandTotal;
  }

  Future<void> _placeOrder() async {
    final cart = ref.read(cartProvider);
    if (cart.items.isEmpty) return;
    if (_paymentMethod == 'CASH') {
      final tendered = double.tryParse(_amountCtrl.text) ?? 0;
      if (tendered < _grandTotal) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text(
                'Cash amount must be at least ₹${_grandTotal.toStringAsFixed(2)}')));
        return;
      }
    }
    setState(() => _processing = true);
    try {
      final auth = ref.read(authProvider).user!;
      final orderItems = cart.items
          .map((i) => {
                'productId': i.productId,
                if (i.variantId != null) 'variantId': i.variantId,
                'quantity': i.quantity,
                'unitPrice': i.unitPrice,
                'discountPercent': i.discountPercent,
              })
          .toList();

      final order = await ApiService().checkout({
        'outletId': auth.outletId,
        'customerId': cart.customer?.id,
        'items': orderItems,
        'couponCode': cart.couponCode,
        'loyaltyPointsToRedeem': cart.loyaltyPointsRedeemed,
        'payments': [
          {'paymentMethod': _paymentMethod, 'amount': _grandTotal}
        ],
        'sendEmail': _sendEmail,
        'sendSms': _sendSms,
        'sendWhatsApp': _sendWhatsApp,
      });

      ref.read(cartProvider.notifier).clear();

      if (mounted) {
        Navigator.of(context).pop();
        // Show receipt dialog
        await showDialog(
          context: context,
          builder: (_) => _ReceiptDialog(
            order: order,
            cartItems: cart.items,
            outletName: auth.outletName ?? 'Store',
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _processing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('Checkout',
                    style:
                        TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const Spacer(),
                IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop()),
              ],
            ),
            // Customer
            if (cart.customer != null) ...[
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.person, color: Color(0xFF6C63FF)),
                title: Text(cart.customer!.name),
                subtitle: Text(
                    'Points: ${cart.customer!.loyaltyPoints.toStringAsFixed(0)}'),
                trailing: TextButton(
                  onPressed: () =>
                      ref.read(cartProvider.notifier).setCustomer(null),
                  child: const Text('Remove'),
                ),
              ),
              const Divider(),
            ],
            // Coupon
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _couponCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Coupon Code',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () async {
                    final code = _couponCtrl.text.trim();
                    if (code.isEmpty) return;
                    try {
                      final result = await ApiService()
                          .validateCoupon(code, cart.grandTotal);
                      ref.read(cartProvider.notifier).applyCoupon(
                            code,
                            (result['discountAmount'] as num).toDouble(),
                          );
                      _couponCtrl.clear();
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(e.toString())));
                      }
                    }
                  },
                  child: const Text('Apply'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Payment method
            const Text('Payment Method',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: ['CASH', 'CARD', 'UPI', 'CREDIT_NOTE'].map((m) {
                return ChoiceChip(
                  label: Text(m),
                  selected: _paymentMethod == m,
                  onSelected: (_) => setState(() => _paymentMethod = m),
                  selectedColor: const Color(0xFF6C63FF),
                  labelStyle: TextStyle(
                    color: _paymentMethod == m ? Colors.white : null,
                  ),
                );
              }).toList(),
            ),
            if (_paymentMethod == 'CASH') ...[
              const SizedBox(height: 12),
              TextField(
                controller: _amountCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Amount Tendered (₹)',
                  border: OutlineInputBorder(),
                ),
                onChanged: (_) => setState(() {}),
              ),
              if (_change > 0) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.change_circle, color: Colors.green),
                      const SizedBox(width: 8),
                      Text(
                        'Change: ₹${_change.toStringAsFixed(2)}',
                        style: const TextStyle(
                            color: Colors.green, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ],
            ],
            const SizedBox(height: 16),
            // Receipt options
            const Text('Send Receipt',
                style: TextStyle(fontWeight: FontWeight.w600)),
            Row(
              children: [
                _Toggle('Email', Icons.email, _sendEmail,
                    (v) => setState(() => _sendEmail = v)),
                _Toggle('SMS', Icons.sms, _sendSms,
                    (v) => setState(() => _sendSms = v)),
                _Toggle('WhatsApp', Icons.chat, _sendWhatsApp,
                    (v) => setState(() => _sendWhatsApp = v)),
              ],
            ),
            const Divider(),
            // Totals
            _SummaryRow('Subtotal', cart.subtotal),
            if (cart.couponDiscount > 0)
              _SummaryRow('Coupon Discount', -cart.couponDiscount,
                  color: Colors.green),
            _SummaryRow('Tax', cart.totalTax),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total',
                    style: TextStyle(
                        fontSize: 18, fontWeight: FontWeight.bold)),
                Text('₹${cart.grandTotal.toStringAsFixed(2)}',
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF6C63FF))),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _processing ? null : _placeOrder,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6C63FF),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: _processing
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Text(
                        'Place Order  •  ₹${cart.grandTotal.toStringAsFixed(2)}',
                        style: const TextStyle(
                            fontSize: 16, color: Colors.white),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Receipt Dialog ──────────────────────────────────────────────────────────

class _ReceiptDialog extends StatelessWidget {
  final Order order;
  final List<CartItem> cartItems;
  final String outletName;

  const _ReceiptDialog({
    required this.order,
    required this.cartItems,
    required this.outletName,
  });

  Future<void> _printReceipt(BuildContext context) async {
    final doc = pw.Document();
    doc.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.roll80,
        build: (pw.Context ctx) => pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Center(
              child: pw.Text(outletName,
                  style: pw.TextStyle(
                      fontSize: 16, fontWeight: pw.FontWeight.bold)),
            ),
            pw.SizedBox(height: 4),
            pw.Center(child: pw.Text('ORDER RECEIPT', style: pw.TextStyle(fontSize: 12))),
            pw.Divider(),
            pw.Text('Order: ${order.orderNumber}',
                style: pw.TextStyle(fontSize: 10)),
            if (order.customer != null)
              pw.Text('Customer: ${order.customer!.name}',
                  style: pw.TextStyle(fontSize: 10)),
            pw.Divider(),
            ...order.items.map(
              (item) => pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Expanded(
                    child: pw.Text(
                      '${item.productName} x${item.quantity.toStringAsFixed(0)}',
                      style: pw.TextStyle(fontSize: 10),
                    ),
                  ),
                  pw.Text(
                    '₹${item.lineTotal.toStringAsFixed(2)}',
                    style: pw.TextStyle(fontSize: 10),
                  ),
                ],
              ),
            ),
            pw.Divider(),
            if (order.discountAmount > 0)
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text('Discount', style: pw.TextStyle(fontSize: 10)),
                  pw.Text('-₹${order.discountAmount.toStringAsFixed(2)}',
                      style: pw.TextStyle(fontSize: 10)),
                ],
              ),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('Tax', style: pw.TextStyle(fontSize: 10)),
                pw.Text('₹${order.taxAmount.toStringAsFixed(2)}',
                    style: pw.TextStyle(fontSize: 10)),
              ],
            ),
            pw.Divider(),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('TOTAL',
                    style: pw.TextStyle(
                        fontSize: 13, fontWeight: pw.FontWeight.bold)),
                pw.Text('₹${order.totalAmount.toStringAsFixed(2)}',
                    style: pw.TextStyle(
                        fontSize: 13, fontWeight: pw.FontWeight.bold)),
              ],
            ),
            pw.SizedBox(height: 4),
            ...order.payments.map(
              (p) => pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text('Paid (${p.paymentMethod})',
                      style: pw.TextStyle(fontSize: 10)),
                  pw.Text('₹${p.amount.toStringAsFixed(2)}',
                      style: pw.TextStyle(fontSize: 10)),
                ],
              ),
            ),
            pw.Divider(),
            pw.Center(
              child: pw.Text('Thank you for your purchase!',
                  style: pw.TextStyle(fontSize: 10)),
            ),
          ],
        ),
      ),
    );

    await Printing.layoutPdf(
      onLayout: (_) async => doc.save(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Success header
            Container(
              width: 60,
              height: 60,
              decoration: const BoxDecoration(
                color: Colors.green,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check, color: Colors.white, size: 32),
            ),
            const SizedBox(height: 12),
            const Text('Order Placed!',
                style:
                    TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(
              order.orderNumber,
              style: const TextStyle(color: Colors.grey, fontSize: 13),
            ),
            const SizedBox(height: 16),
            const Divider(),
            // Items summary
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 200),
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    ...order.items.map(
                      (item) => Padding(
                        padding: const EdgeInsets.symmetric(vertical: 3),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                '${item.productName} × ${item.quantity.toStringAsFixed(0)}',
                                style: const TextStyle(fontSize: 13),
                              ),
                            ),
                            Text(
                              '₹${item.lineTotal.toStringAsFixed(2)}',
                              style: const TextStyle(fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const Divider(),
            if (order.discountAmount > 0)
              _Row('Discount', '-₹${order.discountAmount.toStringAsFixed(2)}',
                  color: Colors.green),
            _Row('Tax', '₹${order.taxAmount.toStringAsFixed(2)}'),
            _Row(
              'Total',
              '₹${order.totalAmount.toStringAsFixed(2)}',
              bold: true,
              color: const Color(0xFF6C63FF),
            ),
            const SizedBox(height: 4),
            ...order.payments.map(
              (p) => _Row(
                'Paid (${p.paymentMethod})',
                '₹${p.amount.toStringAsFixed(2)}',
                color: Colors.green,
              ),
            ),
            const SizedBox(height: 16),
            // Actions
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.print_outlined),
                    label: const Text('Print'),
                    onPressed: () => _printReceipt(context),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.pop(context),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6C63FF),
                    ),
                    child: const Text('Done',
                        style: TextStyle(color: Colors.white)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _Row(String label, String value,
      {bool bold = false, Color? color}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: TextStyle(
                    color: color ?? Colors.grey,
                    fontWeight:
                        bold ? FontWeight.bold : FontWeight.normal,
                    fontSize: 13)),
            Text(value,
                style: TextStyle(
                    color: color,
                    fontWeight:
                        bold ? FontWeight.bold : FontWeight.normal,
                    fontSize: 13)),
          ],
        ),
      );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

Widget _Toggle(
    String label, IconData icon, bool value, ValueChanged<bool> onChanged) {
  return Expanded(
    child: InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Checkbox(value: value, onChanged: (v) => onChanged(v ?? false)),
            Icon(icon, size: 16),
            const SizedBox(width: 4),
            Flexible(
                child: Text(label, style: const TextStyle(fontSize: 12))),
          ],
        ),
      ),
    ),
  );
}

Widget _SummaryRow(String label, double amount, {Color? color}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: color ?? Colors.grey)),
          Text('₹${amount.abs().toStringAsFixed(2)}',
              style: TextStyle(color: color)),
        ],
      ),
    );
