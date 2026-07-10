// =============================================
// POS Mobile - All Models
// Safe numeric parsing: backend may return numbers as strings.
// =============================================

import '../utils/parse.dart' as p;

class CardPermissions {
  final List<String> business;
  final List<String> pccp;

  const CardPermissions({required this.business, required this.pccp});

  factory CardPermissions.fromJson(Map<String, dynamic> json) => CardPermissions(
        business: List<String>.from(json['business'] ?? []),
        pccp: List<String>.from(json['pccp'] ?? []),
      );
}

class AuthResponse {
  final String accessToken;
  final String refreshToken;
  final int userId;
  final String name;
  final String email;
  final List<String> roles;
  final List<String> permissions;
  final int? outletId;
  final String? outletName;
  final CardPermissions? cardPermissions; // null = SUPER_ADMIN, show all

  const AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.name,
    required this.email,
    required this.roles,
    this.permissions = const [],
    this.outletId,
    this.outletName,
    this.cardPermissions,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) => AuthResponse(
        accessToken: json['accessToken'] ?? '',
        refreshToken: json['refreshToken'] ?? '',
        userId: p.i(json['userId']),
        name: json['name'] ?? '',
        email: json['email'] ?? '',
        roles: List<String>.from(json['roles'] ?? []),
        permissions: List<String>.from(json['permissions'] ?? []),
        outletId: p.iOrNull(json['outletId']),
        outletName: json['outletName'],
        cardPermissions: json['cardPermissions'] != null
            ? CardPermissions.fromJson(json['cardPermissions'])
            : null,
      );
}

class Product {
  final int id;
  final String name;
  final String? description;
  final String? sku;
  final String? barcode;
  final double sellingPrice;
  final double? costPrice;
  final double? mrp;
  final String unitOfMeasure;
  final String? imageUrl;
  final bool active;
  final bool featured;
  final Category? category;
  final TaxGroup? taxGroup;
  final int reorderLevel;
  final bool trackInventory;
  final List<ProductVariant> variants;

  const Product({
    required this.id,
    required this.name,
    this.description,
    this.sku,
    this.barcode,
    required this.sellingPrice,
    this.costPrice,
    this.mrp,
    required this.unitOfMeasure,
    this.imageUrl,
    required this.active,
    required this.featured,
    this.category,
    this.taxGroup,
    required this.reorderLevel,
    required this.trackInventory,
    this.variants = const [],
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: p.i(json['id']),
        name: json['name'] ?? '',
        description: json['description'],
        sku: json['sku'],
        barcode: json['barcode'],
        sellingPrice: p.d(json['sellingPrice']),
        costPrice: p.dOrNull(json['costPrice']),
        mrp: p.dOrNull(json['mrp']),
        unitOfMeasure: json['unitOfMeasure'] ?? 'pcs',
        imageUrl: json['imageUrl'],
        active: json['active'] ?? true,
        featured: json['featured'] ?? false,
        category: json['category'] != null ? Category.fromJson(json['category']) : null,
        taxGroup: json['taxGroup'] != null ? TaxGroup.fromJson(json['taxGroup']) : null,
        reorderLevel: p.i(json['reorderLevel']),
        trackInventory: json['trackInventory'] ?? true,
        variants: (json['variants'] as List?)
                ?.map((e) => ProductVariant.fromJson(e))
                .toList() ??
            [],
      );
}

class Category {
  final int id;
  final String name;
  final String? imageUrl;

  const Category({required this.id, required this.name, this.imageUrl});
  factory Category.fromJson(Map<String, dynamic> json) =>
      Category(id: p.i(json['id']), name: json['name'] ?? '', imageUrl: json['imageUrl']);
}

class ProductVariant {
  final int id;
  final String name;
  final double price;
  final String? sku;
  final String? barcode;

  const ProductVariant({
    required this.id,
    required this.name,
    required this.price,
    this.sku,
    this.barcode,
  });

  factory ProductVariant.fromJson(Map<String, dynamic> json) => ProductVariant(
        id: p.i(json['id']),
        name: json['name'] ?? '',
        price: p.d(json['price']),
        sku: json['sku'],
        barcode: json['barcode'],
      );
}

class TaxGroup {
  final int id;
  final String name;
  final double totalRate;
  final bool inclusive;

  const TaxGroup({required this.id, required this.name, required this.totalRate, required this.inclusive});
  factory TaxGroup.fromJson(Map<String, dynamic> json) => TaxGroup(
        id: p.i(json['id']),
        name: json['name'] ?? '',
        totalRate: p.d(json['totalRate']),
        inclusive: json['inclusive'] ?? false,
      );
}

class Customer {
  final int id;
  final String name;
  final String? phone;
  final String? email;
  final String segment;
  final double loyaltyPoints;
  final double totalSpent;
  final double outstandingDue;
  final double discountPercent;
  final bool active;

  const Customer({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    required this.segment,
    required this.loyaltyPoints,
    required this.totalSpent,
    required this.outstandingDue,
    required this.discountPercent,
    required this.active,
  });

  factory Customer.fromJson(Map<String, dynamic> json) => Customer(
        id: p.i(json['id']),
        name: json['name'] ?? '',
        phone: json['phone'],
        email: json['email'],
        segment: json['segment'] ?? 'REGULAR',
        loyaltyPoints: p.d(json['loyaltyPoints']),
        totalSpent: p.d(json['totalSpent']),
        outstandingDue: p.d(json['outstandingDue']),
        discountPercent: p.d(json['discountPercent']),
        active: json['active'] ?? true,
      );
}

class CartItem {
  final int productId;
  final int? variantId;
  final String productName;
  final String? sku;
  int quantity;
  final double unitPrice;
  double discountPercent;
  final double taxRate;
  final String? imageUrl;

  CartItem({
    required this.productId,
    this.variantId,
    required this.productName,
    this.sku,
    required this.quantity,
    required this.unitPrice,
    this.discountPercent = 0,
    this.taxRate = 0,
    this.imageUrl,
  });

  double get lineTotal => unitPrice * quantity;
  double get discountAmount => lineTotal * discountPercent / 100;
  double get taxAmount => (lineTotal - discountAmount) * taxRate / 100;
  double get total => lineTotal - discountAmount + taxAmount;
}

class Order {
  final int id;
  final String orderNumber;
  final String status;
  final double subtotal;
  final double discountAmount;
  final double taxAmount;
  final double totalAmount;
  final double paidAmount;
  final Customer? customer;
  final List<OrderItem> items;
  final List<Payment> payments;
  final String createdAt;

  const Order({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.subtotal,
    required this.discountAmount,
    required this.taxAmount,
    required this.totalAmount,
    required this.paidAmount,
    this.customer,
    required this.items,
    required this.payments,
    required this.createdAt,
  });

  factory Order.fromJson(Map<String, dynamic> json) => Order(
        id: p.i(json['id']),
        orderNumber: json['orderNumber'] ?? '',
        status: json['status'] ?? '',
        subtotal: p.d(json['subtotal']),
        discountAmount: p.d(json['discountAmount']),
        taxAmount: p.d(json['taxAmount']),
        totalAmount: p.d(json['totalAmount']),
        paidAmount: p.d(json['paidAmount']),
        customer: json['customer'] != null ? Customer.fromJson(json['customer']) : null,
        items: (json['items'] as List?)?.map((e) => OrderItem.fromJson(e)).toList() ?? [],
        payments: (json['payments'] as List?)?.map((e) => Payment.fromJson(e)).toList() ?? [],
        createdAt: json['createdAt'] ?? '',
      );
}

class OrderItem {
  final int id;
  final String productName;
  final double quantity;
  final double unitPrice;
  final double lineTotal;

  const OrderItem({
    required this.id,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) => OrderItem(
        id: p.i(json['id']),
        productName: json['productName'] ?? '',
        quantity: p.d(json['quantity']),
        unitPrice: p.d(json['unitPrice']),
        lineTotal: p.d(json['lineTotal']),
      );
}

class Payment {
  final int id;
  final String paymentMethod;
  final double amount;

  const Payment({required this.id, required this.paymentMethod, required this.amount});
  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
        id: p.i(json['id']),
        paymentMethod: json['paymentMethod'] ?? '',
        amount: p.d(json['amount']),
      );
}

class Inventory {
  final int id;
  final Product product;
  final double quantityOnHand;
  final int reorderLevel;

  const Inventory({
    required this.id,
    required this.product,
    required this.quantityOnHand,
    required this.reorderLevel,
  });

  factory Inventory.fromJson(Map<String, dynamic> json) => Inventory(
        id: p.i(json['id']),
        product: Product.fromJson(json['product']),
        quantityOnHand: p.d(json['quantityOnHand']),
        reorderLevel: p.i(json['reorderLevel']),
      );

  bool get isLowStock => quantityOnHand <= reorderLevel;
}

class CreditNote {
  final int id;
  final String creditNoteNumber;
  final double totalAmount;
  final double remainingAmount;
  final String status;
  final String? expiryDate;
  final String? reason;

  const CreditNote({
    required this.id,
    required this.creditNoteNumber,
    required this.totalAmount,
    required this.remainingAmount,
    required this.status,
    this.expiryDate,
    this.reason,
  });

  factory CreditNote.fromJson(Map<String, dynamic> json) => CreditNote(
        id: p.i(json['id']),
        creditNoteNumber: json['creditNoteNumber'] ?? '',
        totalAmount: p.d(json['totalAmount']),
        remainingAmount: p.d(json['remainingAmount']),
        status: json['status'] ?? '',
        expiryDate: json['expiryDate'],
        reason: json['reason'],
      );
}

// ---- ERP Companion Models ----

class SalesOrderItem {
  final int? id;
  final int productId;
  final String productName;
  final double quantity;
  final double unitPrice;
  final double total;

  const SalesOrderItem({
    this.id,
    required this.productId,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });

  factory SalesOrderItem.fromJson(Map<String, dynamic> json) => SalesOrderItem(
        id: p.iOrNull(json['id']),
        productId: p.i(json['productId']),
        productName: json['productName'] ?? json['product']?['name'] ?? '',
        quantity: p.d(json['quantity']),
        unitPrice: p.d(json['unitPrice']),
        total: p.dOrNull(json['total']) ?? p.d(json['quantity']) * p.d(json['unitPrice']),
      );
}

class SalesOrder {
  final int id;
  final String soNumber;
  final String status;
  final String? customerName;
  final int? customerId;
  final double totalAmount;
  final String createdAt;
  final List<SalesOrderItem> items;

  const SalesOrder({
    required this.id,
    required this.soNumber,
    required this.status,
    this.customerName,
    this.customerId,
    required this.totalAmount,
    required this.createdAt,
    this.items = const [],
  });

  factory SalesOrder.fromJson(Map<String, dynamic> json) => SalesOrder(
        id: p.i(json['id']),
        soNumber: json['soNumber'] ?? '',
        status: json['status'] ?? 'PENDING',
        customerName: json['customer']?['name'] ?? json['customerName'],
        customerId: p.iOrNull(json['customerId'] ?? json['customer']?['id']),
        totalAmount: p.d(json['totalAmount']),
        createdAt: json['createdAt'] ?? '',
        items: (json['items'] as List<dynamic>? ?? [])
            .map((e) => SalesOrderItem.fromJson(e))
            .toList(),
      );
}

class PurchaseOrderItem {
  final int? id;
  final String productName;
  final double quantity;
  final double unitPrice;
  final double total;

  const PurchaseOrderItem({
    this.id,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });

  factory PurchaseOrderItem.fromJson(Map<String, dynamic> json) => PurchaseOrderItem(
        id: p.iOrNull(json['id']),
        productName: json['productName'] ?? json['product']?['name'] ?? '',
        quantity: p.d(json['quantity']),
        unitPrice: p.d(json['unitPrice']),
        total: p.dOrNull(json['total']) ?? p.d(json['quantity']) * p.d(json['unitPrice']),
      );
}

class PurchaseOrder {
  final int id;
  final String poNumber;
  final String status;
  final String? vendorName;
  final int? vendorId;
  final double totalAmount;
  final String createdAt;
  final List<PurchaseOrderItem> items;

  const PurchaseOrder({
    required this.id,
    required this.poNumber,
    required this.status,
    this.vendorName,
    this.vendorId,
    required this.totalAmount,
    required this.createdAt,
    this.items = const [],
  });

  factory PurchaseOrder.fromJson(Map<String, dynamic> json) => PurchaseOrder(
        id: p.i(json['id']),
        poNumber: json['poNumber'] ?? '',
        status: json['status'] ?? 'DRAFT',
        vendorName: json['vendor']?['name'] ?? json['vendorName'],
        vendorId: p.iOrNull(json['vendorId'] ?? json['vendor']?['id']),
        totalAmount: p.d(json['totalAmount']),
        createdAt: json['createdAt'] ?? '',
        items: (json['items'] as List<dynamic>? ?? [])
            .map((e) => PurchaseOrderItem.fromJson(e))
            .toList(),
      );
}

class ExpenseCategory {
  final int id;
  final String name;
  final String? type;

  const ExpenseCategory({required this.id, required this.name, this.type});

  factory ExpenseCategory.fromJson(Map<String, dynamic> json) => ExpenseCategory(
        id: p.i(json['id']),
        name: json['name'] ?? '',
        type: json['type'],
      );
}

class Expense {
  final int id;
  final String? categoryName;
  final int? categoryId;
  final double amount;
  final String? description;
  final String date;
  final String status;
  final String? createdBy;

  const Expense({
    required this.id,
    this.categoryName,
    this.categoryId,
    required this.amount,
    this.description,
    required this.date,
    required this.status,
    this.createdBy,
  });

  factory Expense.fromJson(Map<String, dynamic> json) => Expense(
        id: p.i(json['id']),
        categoryName: json['category']?['name'] ?? json['categoryName'],
        categoryId: p.iOrNull(json['categoryId'] ?? json['category']?['id']),
        amount: p.d(json['amount']),
        description: json['description'],
        date: json['date'] ?? json['createdAt'] ?? '',
        status: json['status'] ?? 'PENDING',
        createdBy: json['createdBy']?['name'] ?? json['createdByName'],
      );
}

class InvoiceItem {
  final int? id;
  final String productName;
  final double quantity;
  final double unitPrice;
  final double total;

  const InvoiceItem({
    this.id,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.total,
  });

  factory InvoiceItem.fromJson(Map<String, dynamic> json) => InvoiceItem(
        id: p.iOrNull(json['id']),
        productName: json['productName'] ?? json['product']?['name'] ?? '',
        quantity: p.d(json['quantity']),
        unitPrice: p.d(json['unitPrice']),
        total: p.d(json['total']),
      );
}

class Invoice {
  final int id;
  final String invoiceNumber;
  final String status;
  final String? customerName;
  final double totalAmount;
  final double paidAmount;
  final String createdAt;
  final List<InvoiceItem> items;

  const Invoice({
    required this.id,
    required this.invoiceNumber,
    required this.status,
    this.customerName,
    required this.totalAmount,
    required this.paidAmount,
    required this.createdAt,
    this.items = const [],
  });

  factory Invoice.fromJson(Map<String, dynamic> json) => Invoice(
        id: p.i(json['id']),
        invoiceNumber: json['invoiceNumber'] ?? '',
        status: json['status'] ?? 'UNPAID',
        customerName: json['customer']?['name'] ?? json['customerName'],
        totalAmount: p.d(json['totalAmount']),
        paidAmount: p.d(json['paidAmount']),
        createdAt: json['createdAt'] ?? '',
        items: (json['items'] as List<dynamic>? ?? [])
            .map((e) => InvoiceItem.fromJson(e))
            .toList(),
      );

  double get balanceDue => totalAmount - paidAmount;
}

class Shift {
  final int id;
  final String status;
  final String? openedAt;
  final String? closedAt;
  final double openingBalance;
  final double? totalSales;
  final String? cashierName;
  final int? cashierId;

  const Shift({
    required this.id,
    required this.status,
    this.openedAt,
    this.closedAt,
    required this.openingBalance,
    this.totalSales,
    this.cashierName,
    this.cashierId,
  });

  factory Shift.fromJson(Map<String, dynamic> json) => Shift(
        id: p.i(json['id']),
        status: json['status'] ?? 'OPEN',
        openedAt: json['openedAt'] ?? json['createdAt'],
        closedAt: json['closedAt'],
        openingBalance: p.d(json['openingBalance']),
        totalSales: p.dOrNull(json['totalSales']),
        cashierName: json['cashier']?['name'] ?? json['cashierName'],
        cashierId: p.iOrNull(json['cashierId'] ?? json['cashier']?['id']),
      );
}

class ProductionOrder {
  final int id;
  final String poNumber;
  final String status;
  final String? pipeConfig;
  final double targetQuantity;
  final double completedQuantity;
  final String? createdAt;

  const ProductionOrder({
    required this.id,
    required this.poNumber,
    required this.status,
    this.pipeConfig,
    required this.targetQuantity,
    required this.completedQuantity,
    this.createdAt,
  });

  factory ProductionOrder.fromJson(Map<String, dynamic> json) => ProductionOrder(
        id: p.i(json['id']),
        poNumber: json['poNumber'] ?? '',
        status: json['status'] ?? 'PENDING',
        pipeConfig: json['pipeConfig']?['name'] ?? json['pipeConfigName'] ??
            (json['pipeConfig'] is String ? json['pipeConfig'] : null),
        targetQuantity: p.d(json['targetQuantity']),
        completedQuantity: p.d(json['completedQuantity']),
        createdAt: json['createdAt'],
      );

  double get progressPercent =>
      targetQuantity > 0 ? (completedQuantity / targetQuantity).clamp(0.0, 1.0) : 0;
}

class ProductionEntry {
  final int id;
  final int orderId;
  final String? stage;
  final double quantityProduced;
  final String? machine;
  final String? createdAt;
  final String? notes;

  const ProductionEntry({
    required this.id,
    required this.orderId,
    this.stage,
    required this.quantityProduced,
    this.machine,
    this.createdAt,
    this.notes,
  });

  factory ProductionEntry.fromJson(Map<String, dynamic> json) => ProductionEntry(
        id: p.i(json['id']),
        orderId: p.i(json['productionOrderId'] ?? json['orderId']),
        stage: json['stage'],
        quantityProduced: p.d(json['quantityProduced']),
        machine: json['machine']?['name'] ?? json['machineName'] ??
            (json['machine'] is String ? json['machine'] : null),
        createdAt: json['createdAt'],
        notes: json['notes'],
      );
}

class Vendor {
  final int id;
  final String name;
  final String? phone;
  final String? email;
  final String? address;
  final double? outstandingPayable;

  const Vendor({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    this.address,
    this.outstandingPayable,
  });

  factory Vendor.fromJson(Map<String, dynamic> json) => Vendor(
        id: p.i(json['id']),
        name: json['name'] ?? '',
        phone: json['phone'],
        email: json['email'],
        address: json['address'],
        outstandingPayable: p.dOrNull(json['outstandingPayable']),
      );
}

class CementBag {
  final int id;
  final String date;
  final double quantity;
  final String? notes;
  final int? outletId;

  const CementBag({
    required this.id,
    required this.date,
    required this.quantity,
    this.notes,
    this.outletId,
  });

  factory CementBag.fromJson(Map<String, dynamic> json) => CementBag(
        id: p.i(json['id']),
        date: json['date'] ?? json['createdAt'] ?? '',
        quantity: p.d(json['quantity']),
        notes: json['notes'],
        outletId: p.iOrNull(json['outletId']),
      );
}

class VehicleEntry {
  final int id;
  final String date;
  final bool craneEnabled;
  final double? craneDiesel;
  final double? craneHours;
  final bool jcbEnabled;
  final double? jcbDiesel;
  final double? jcbHours;
  final String? notes;

  const VehicleEntry({
    required this.id,
    required this.date,
    this.craneEnabled = false,
    this.craneDiesel,
    this.craneHours,
    this.jcbEnabled = false,
    this.jcbDiesel,
    this.jcbHours,
    this.notes,
  });

  factory VehicleEntry.fromJson(Map<String, dynamic> json) => VehicleEntry(
        id: p.i(json['id']),
        date: json['date'] ?? json['createdAt'] ?? '',
        craneEnabled: json['craneEnabled'] == true,
        craneDiesel: p.dOrNull(json['craneDiesel']),
        craneHours: p.dOrNull(json['craneHours']),
        jcbEnabled: json['jcbEnabled'] == true,
        jcbDiesel: p.dOrNull(json['jcbDiesel']),
        jcbHours: p.dOrNull(json['jcbHours']),
        notes: json['notes'],
      );
}

class SiloEntry {
  final int id;
  final String date;
  final String? siloName;
  final double? currentLevel;
  final double? extracted;
  final String? notes;

  const SiloEntry({
    required this.id,
    required this.date,
    this.siloName,
    this.currentLevel,
    this.extracted,
    this.notes,
  });

  factory SiloEntry.fromJson(Map<String, dynamic> json) => SiloEntry(
        id: p.i(json['id']),
        date: json['date'] ?? json['createdAt'] ?? '',
        siloName: json['siloName'] ?? json['silo']?['name'],
        currentLevel: p.dOrNull(json['currentLevel']),
        extracted: p.dOrNull(json['extractedAmount'] ?? json['extracted']),
        notes: json['notes'],
      );
}
