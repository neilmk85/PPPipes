import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/models.dart';

class ApiService {
  static const String baseUrl = 'https://system.pppipeproducts.com/api';
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  late final Dio _dio;
  final _storage = const FlutterSecureStorage();

  ApiService._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    // Attach JWT token
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'accessToken');
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          await _storage.deleteAll();
        }
        handler.next(error);
      },
    ));
  }

  // ---- Auth ----
  Future<AuthResponse> login(String email, String password) async {
    final res = await _dio.post('/auth/login', data: {'email': email, 'password': password});
    final auth = AuthResponse.fromJson(res.data['data']);
    await _storage.write(key: 'accessToken', value: auth.accessToken);
    await _storage.write(key: 'refreshToken', value: auth.refreshToken);
    return auth;
  }

  Future<AuthResponse> getMe() async {
    final res = await _dio.get('/users/me');
    final data = res.data['data'] as Map<String, dynamic>;
    final token = await _storage.read(key: 'accessToken') ?? '';
    final refresh = await _storage.read(key: 'refreshToken') ?? '';
    return AuthResponse(
      accessToken: token,
      refreshToken: refresh,
      userId: data['id'],
      name: data['name'],
      email: data['email'],
      roles: List<String>.from(data['roles'] ?? []),
      outletId: data['outletId'],
      outletName: data['outlet'] != null ? data['outlet']['name'] as String? : null,
    );
  }

  Future<void> logout() async => await _storage.deleteAll();

  // ---- Products ----
  Future<List<Product>> searchProducts(String query) async {
    final res = await _dio.get('/products/search', queryParameters: {'q': query});
    return (res.data['data'] as List).map((e) => Product.fromJson(e)).toList();
  }

  Future<Product?> getProductByBarcode(String barcode) async {
    try {
      final res = await _dio.get('/products/barcode/$barcode');
      return Product.fromJson(res.data['data']);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<List<Product>> getProducts({int page = 0, int size = 50}) async {
    final res = await _dio.get('/products', queryParameters: {'page': page, 'size': size});
    final content = res.data['data']['content'] as List;
    return content.map((e) => Product.fromJson(e)).toList();
  }

  Future<List<Product>> getLowStockProducts(int outletId) async {
    final res = await _dio.get('/products/low-stock', queryParameters: {'outletId': outletId});
    return (res.data['data'] as List).map((e) => Product.fromJson(e)).toList();
  }

  Future<Map<String, dynamic>> getProductsPaged({int page = 0, int size = 30}) async {
    final res = await _dio.get('/products', queryParameters: {'page': page, 'size': size});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> adjustStock(Map<String, dynamic> data) async {
    await _dio.post('/inventory/adjustments', data: data);
  }

  Future<Product> getProductDetail(int productId) async {
    final res = await _dio.get('/products/$productId');
    return Product.fromJson(res.data['data']);
  }

  // ---- Customers ----
  Future<List<dynamic>> getAllCustomers({int size = 500}) async {
    final res = await _dio.get('/customers', queryParameters: {'size': size, 'page': 0});
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<List<Customer>> searchCustomers(String query) async {
    final res = await _dio.get('/customers/search', queryParameters: {'q': query});
    return (res.data['data'] as List).map((e) => Customer.fromJson(e)).toList();
  }

  Future<Customer> getCustomerByPhone(String phone) async {
    final res = await _dio.get('/customers/phone/$phone');
    return Customer.fromJson(res.data['data']);
  }

  Future<Customer> createCustomer(Map<String, dynamic> data) async {
    final res = await _dio.post('/customers', data: data);
    return Customer.fromJson(res.data['data']);
  }

  Future<Customer> getCustomerById(int id) async {
    final res = await _dio.get('/customers/$id');
    return Customer.fromJson(res.data['data']);
  }

  Future<Customer> updateCustomer(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/customers/$id', data: data);
    return Customer.fromJson(res.data['data']);
  }

  Future<List<Order>> getOrdersByCustomer(int customerId, {int page = 0}) async {
    final res = await _dio.get('/orders/customer/$customerId',
        queryParameters: {'page': page, 'size': 20});
    final content = res.data['data']['content'] as List;
    return content.map((e) => Order.fromJson(e)).toList();
  }

  // ---- Orders ----
  Future<Order> checkout(Map<String, dynamic> data) async {
    final res = await _dio.post('/orders/checkout', data: data);
    return Order.fromJson(res.data['data']);
  }

  Future<List<Order>> getOrdersByOutlet(int outletId, {int page = 0}) async {
    final res = await _dio.get('/orders',
        queryParameters: {'outletId': outletId, 'page': page, 'size': 30});
    final data = res.data['data'];
    final content = _extractList(data);
    return content.map((e) => Order.fromJson(e)).toList();
  }

  Future<Order> cancelOrder(int orderId) async {
    final res = await _dio.post('/orders/$orderId/cancel');
    return Order.fromJson(res.data['data']);
  }

  Future<List<Order>> getOrdersByOutletPaged(int outletId, {int page = 0, int size = 20}) async {
    final res = await _dio.get('/orders',
        queryParameters: {'outletId': outletId, 'page': page, 'size': size});
    final data = res.data['data'];
    final content = _extractList(data);
    return content.map((e) => Order.fromJson(e)).toList();
  }

  Future<Map<String, dynamic>> getOrdersMeta(int outletId, {int page = 0, int size = 20}) async {
    final res = await _dio.get('/orders',
        queryParameters: {'outletId': outletId, 'page': page, 'size': size});
    return res.data['data'] as Map<String, dynamic>;
  }

  /// Safely extracts a List from a paginated or plain response.
  List<dynamic> _extractList(dynamic data) {
    if (data == null) return [];
    if (data is List) return data;
    if (data is Map) {
      final content = data['content'] ?? data['items'] ?? data['data'];
      if (content is List) return content;
    }
    return [];
  }

  // ---- Inventory ----
  Future<List<Inventory>> getLowStock(int outletId) async {
    final res = await _dio.get('/inventory/low-stock', queryParameters: {'outletId': outletId});
    return (res.data['data'] as List).map((e) => Inventory.fromJson(e)).toList();
  }

  Future<List<dynamic>> getStockAcrossOutlets(int productId) async {
    final res = await _dio.get('/inventory/product/$productId/all-outlets');
    return res.data['data'] as List;
  }

  // ---- Coupons ----
  Future<Map<String, dynamic>> validateCoupon(String code, double cartTotal) async {
    final res = await _dio.get('/discounts/coupons/validate', queryParameters: {'code': code, 'cartTotal': cartTotal});
    return res.data['data'] as Map<String, dynamic>;
  }

  // ---- Credit Notes ----
  Future<List<CreditNote>> getActiveCreditNotesByCustomer(int customerId) async {
    final res = await _dio.get('/credit-notes/customer/$customerId/active');
    return (res.data['data'] as List).map((e) => CreditNote.fromJson(e)).toList();
  }

  // ---- Reports ----
  Future<Map<String, dynamic>> getSalesSummary(int outletId, String from, String to) async {
    final res = await _dio.get('/reports/sales-summary', queryParameters: {'outletId': outletId, 'from': from, 'to': to});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<dynamic>> getTopProducts(int outletId, String from, String to) async {
    final res = await _dio.get('/reports/top-products', queryParameters: {'outletId': outletId, 'from': from, 'to': to});
    return res.data['data'] as List;
  }

  Future<List<dynamic>> getDailyTrend(int outletId, String from, String to) async {
    final res = await _dio.get('/reports/daily-trend', queryParameters: {'outletId': outletId, 'from': from, 'to': to});
    return res.data['data'] as List;
  }

  // ---- Sales Orders (B2B) ----
  Future<List<dynamic>> getSalesOrders({int page = 0, int size = 20}) async {
    final res = await _dio.get('/sales-orders', queryParameters: {'page': page, 'size': size});
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> getSalesOrderDetail(int id) async {
    final res = await _dio.get('/sales-orders/$id');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> createSalesOrder(Map<String, dynamic> data) async {
    final res = await _dio.post('/sales-orders', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> confirmSalesOrder(int id) async {
    final res = await _dio.patch('/sales-orders/$id/confirm');
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> cancelSalesOrder(int id) async {
    final res = await _dio.patch('/sales-orders/$id/cancel');
    return res.data['data'] as Map<String, dynamic>;
  }

  // ---- Purchase Orders ----
  Future<List<dynamic>> getPurchaseOrders({int page = 0, int size = 20}) async {
    final res = await _dio.get('/purchase-orders', queryParameters: {'page': page, 'size': size});
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createDirectPurchase(Map<String, dynamic> data) async {
    final res = await _dio.post('/purchase-orders/direct', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updatePOStatus(int id, String status) async {
    final res = await _dio.patch('/purchase-orders/$id/status', data: {'status': status});
    return res.data['data'] as Map<String, dynamic>;
  }

  // ---- Expenses ----
  Future<List<dynamic>> getExpenses({int page = 0, int size = 20}) async {
    final res = await _dio.get('/expenses', queryParameters: {'page': page, 'size': size});
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createExpense(Map<String, dynamic> data) async {
    final res = await _dio.post('/expenses', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<dynamic>> getExpenseCategories() async {
    final res = await _dio.get('/expense-categories');
    final data = res.data['data'];
    if (data is List) return data;
    return [];
  }

  // ---- Invoices ----
  Future<List<dynamic>> getInvoices({int page = 0, int size = 20}) async {
    final res = await _dio.get('/invoices', queryParameters: {'page': page, 'size': size});
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> getInvoiceDetail(int id) async {
    final res = await _dio.get('/invoices/$id');
    return res.data['data'] as Map<String, dynamic>;
  }

  // ---- Shifts ----
  Future<Map<String, dynamic>> openShift(Map<String, dynamic> data) async {
    final res = await _dio.post('/shifts/open', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> closeShift(int shiftId, Map<String, dynamic> data) async {
    final res = await _dio.put('/shifts/$shiftId/close', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>?> getCurrentShift(int cashierId) async {
    try {
      final res = await _dio.get('/shifts/current/$cashierId');
      return res.data['data'] as Map<String, dynamic>?;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  // ---- Production ----
  Future<List<dynamic>> getProductionOrders({int page = 0, int size = 20}) async {
    final res = await _dio.get('/production/orders', queryParameters: {'page': page, 'size': size});
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createProductionEntry(Map<String, dynamic> data) async {
    final res = await _dio.post('/production/entries', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<dynamic>> getEntriesByOrder(int orderId) async {
    final res = await _dio.get('/production/entries/by-order/$orderId');
    final data = res.data['data'];
    if (data is List) return data;
    return [];
  }

  // ---- Vendors ----
  Future<List<dynamic>> getVendors({int page = 0, int size = 30}) async {
    final res = await _dio.get('/vendors', queryParameters: {'page': page, 'size': size});
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> getVendorDetail(int id) async {
    final res = await _dio.get('/vendors/$id');
    return res.data['data'] as Map<String, dynamic>;
  }

  // ---- Business Operations ----
  Future<List<dynamic>> getCementBags({String? fromDate, String? toDate}) async {
    final params = <String, dynamic>{};
    if (fromDate != null) params['from'] = fromDate;
    if (toDate != null) params['to'] = toDate;
    final res = await _dio.get('/business/cement-bags', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createCementBag(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/cement-bags', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateCementBag(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/cement-bags/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> deleteCementBag(int id) async {
    await _dio.delete('/business/cement-bags/$id');
  }

  Future<List<dynamic>> getMaintenanceEntries({String? from, String? to}) async {
    final params = <String, dynamic>{};
    if (from != null) params['from'] = from;
    if (to != null) params['to'] = to;
    final res = await _dio.get('/business/maintenance', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createMaintenanceEntry(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/maintenance', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateMaintenanceEntry(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/maintenance/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> deleteMaintenanceEntry(int id) async {
    await _dio.delete('/business/maintenance/$id');
  }

  Future<List<dynamic>> getStoreRoomMaterials({String? from, String? to}) async {
    final params = <String, dynamic>{};
    if (from != null) params['from'] = from;
    if (to != null) params['to'] = to;
    final res = await _dio.get('/business/store-room-materials', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createStoreRoomMaterial(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/store-room-materials', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateStoreRoomMaterial(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/store-room-materials/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> deleteStoreRoomMaterial(int id) async {
    await _dio.delete('/business/store-room-materials/$id');
  }

  Future<List<Map<String, dynamic>>> getProductsRaw({int size = 1000, String? itemType}) async {
    final params = <String, dynamic>{'page': 0, 'size': size};
    if (itemType != null) params['itemType'] = itemType;
    final res = await _dio.get('/products', queryParameters: params);
    final content = res.data['data']['content'] as List;
    return content.cast<Map<String, dynamic>>();
  }

  Future<List<dynamic>> getCuttingEntries({String? from, String? to}) async {
    final params = <String, dynamic>{};
    if (from != null) params['from'] = from;
    if (to != null) params['to'] = to;
    final res = await _dio.get('/business/cuttings', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createCuttingEntry(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/cuttings', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateCuttingEntry(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/cuttings/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> deleteCuttingEntry(int id) async {
    await _dio.delete('/business/cuttings/$id');
  }

  Future<List<dynamic>> getDieselEntries({String? from, String? to}) async {
    final params = <String, dynamic>{};
    if (from != null) params['from'] = from;
    if (to != null) params['to'] = to;
    final res = await _dio.get('/business/diesel-maintenance', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createDieselEntry(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/diesel-maintenance', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateDieselEntry(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/diesel-maintenance/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> deleteDieselEntry(int id) async {
    await _dio.delete('/business/diesel-maintenance/$id');
  }

  Future<List<dynamic>> getVehicleEntries({int page = 0, int size = 20}) async {
    final res = await _dio.get('/business/vehicles', queryParameters: {'page': page, 'size': size});
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createVehicleEntry(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/vehicles', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<dynamic>> getExtraVehicles({int size = 500, String? fromDate, String? toDate}) async {
    final params = <String, dynamic>{'size': size};
    if (fromDate != null) params['fromDate'] = fromDate;
    if (toDate != null) params['toDate'] = toDate;
    final res = await _dio.get('/business/extra-vehicles', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createExtraVehicle(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/extra-vehicles', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateExtraVehicle(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/extra-vehicles/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> deleteExtraVehicle(int id) async {
    await _dio.delete('/business/extra-vehicles/$id');
  }

  // Conversions
  Future<List<dynamic>> getConversions({String? fromDate, String? toDate, int size = 200}) async {
    final params = <String, dynamic>{'size': size};
    if (fromDate != null) params['fromDate'] = fromDate;
    if (toDate != null) params['toDate'] = toDate;
    final res = await _dio.get('/business/conversions', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createConversion(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/conversions', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateConversion(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/conversions/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> deleteConversion(int id) async {
    await _dio.delete('/business/conversions/$id');
  }

  Future<List<dynamic>> getLabourEntries({String? fromDate, String? toDate}) async {
    final params = <String, dynamic>{};
    if (fromDate != null) params['fromDate'] = fromDate;
    if (toDate != null) params['toDate'] = toDate;
    final res = await _dio.get('/business/labour', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createLabourEntry(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/labour', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateLabourEntry(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/labour/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> deleteLabourEntry(int id) async {
    await _dio.delete('/business/labour/$id');
  }

  // Pipe configs (for conversion diameter/kg options)
  Future<List<dynamic>> getPipeConfigs({int size = 500}) async {
    final res = await _dio.get('/production/pipe-configs', queryParameters: {'size': size});
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<List<dynamic>> getSiloEntries({int page = 0, int size = 20}) async {
    final res = await _dio.get('/business/silo-extractions', queryParameters: {'page': page, 'size': size});
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createSiloEntry(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/silo-extractions', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  // ---- PDI ----
  Future<List<dynamic>> getPdiEntries({String? from, String? to, int size = 500}) async {
    final params = <String, dynamic>{'size': size};
    if (from != null) params['from'] = from;
    if (to   != null) params['to']   = to;
    final res = await _dio.get('/business/pdis', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createPdiEntry(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/pdis', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updatePdiEntry(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/pdis/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> deletePdiEntry(int id) async {
    await _dio.delete('/business/pdis/$id');
  }

  Future<List<dynamic>> getLoadingRecords({int page = 0, int size = 200, String? date, String? from, String? to}) async {
    final params = <String, dynamic>{'page': page, 'size': size};
    if (date != null) params['date'] = date;
    if (from != null) params['from'] = from;
    if (to != null) params['to'] = to;
    final res = await _dio.get('/business/loading-records', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<List<dynamic>> getProductionEntries({String? stageType, String? from, String? to, int size = 500}) async {
    final params = <String, dynamic>{'size': size};
    if (stageType != null) params['stageType'] = stageType;
    if (from != null) params['from'] = from;
    if (to != null) params['to'] = to;
    final res = await _dio.get('/production/entries', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createLoadingRecord(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/loading-records', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateLoadingRecord(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/loading-records/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> uploadChallanPhoto(int id, List<int> bytes, String filename) async {
    final formData = FormData.fromMap({
      'file': MultipartFile.fromBytes(bytes, filename: filename),
    });
    await _dio.post('/business/loading-records/$id/challan-photo', data: formData);
  }

  Future<void> deleteChallanPhoto(int id) async {
    await _dio.delete('/business/loading-records/$id/challan-photo');
  }

  Future<List<dynamic>> getDieselMaintenance({String? date}) async {
    final params = <String, dynamic>{'size': 500};
    if (date != null) params['date'] = date;
    final res = await _dio.get('/business/diesel-maintenance', queryParameters: params);
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is List) return data;
    return [];
  }

  // ---- Inventory (dashboard) ----
  Future<List<dynamic>> getInventoryByOutlet(int outletId, {int page = 0, int size = 500}) async {
    final res = await _dio.get('/inventory',
        queryParameters: {'outletId': outletId, 'page': page, 'size': size});
    final data = res.data['data'];
    if (data is Map && data.containsKey('content')) return data['content'] as List;
    if (data is Map && data.containsKey('items')) return data['items'] as List;
    if (data is List) return data;
    return [];
  }

  // ---- Production Stock (dashboard) ----
  Future<List<dynamic>> getIntermediateStock({String? fromDate, String? toDate}) async {
    final params = <String, dynamic>{};
    if (fromDate != null && fromDate.isNotEmpty) params['fromDate'] = fromDate;
    if (toDate != null && toDate.isNotEmpty) params['toDate'] = toDate;
    final res = await _dio.get('/production/intermediate-stock', queryParameters: params);
    final data = res.data['data'];
    if (data is List) return data;
    return [];
  }

  Future<List<dynamic>> getAllStagesStock({String? fromDate, String? toDate}) async {
    final params = <String, dynamic>{};
    if (fromDate != null && fromDate.isNotEmpty) params['fromDate'] = fromDate;
    if (toDate != null && toDate.isNotEmpty) params['toDate'] = toDate;
    final res = await _dio.get('/production/all-stages-stock', queryParameters: params);
    final data = res.data['data'];
    if (data is List) return data;
    return [];
  }

  // ---- Extended Reports ----
  Future<List<dynamic>> getDebtorsLedger(String from, String to) async {
    final res = await _dio.get('/reports/debtors-ledger', queryParameters: {'from': from, 'to': to});
    final data = res.data['data'];
    if (data is List) return data;
    return [];
  }

  Future<List<dynamic>> getCreditorsLedger(String from, String to) async {
    final res = await _dio.get('/reports/creditors-ledger', queryParameters: {'from': from, 'to': to});
    final data = res.data['data'];
    if (data is List) return data;
    return [];
  }

  // ── Discard ──────────────────────────────────────────────────────────────────

  Future<List<dynamic>> getDiscardEntries({String? from, String? to}) async {
    final params = <String, dynamic>{};
    if (from != null) params['from'] = from;
    if (to != null) params['to'] = to;
    final res = await _dio.get('/business/discards', queryParameters: params);
    final data = res.data['data'];
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createDiscardEntry(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/discards', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateDiscardEntry(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/discards/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> deleteDiscardEntry(int id) async {
    await _dio.delete('/business/discards/$id');
  }

  Future<Map<String, dynamic>> getGstr1(String from, String to) async {
    final res = await _dio.get('/gst/gstr1', queryParameters: {'from': from, 'to': to});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> getGstr3b(String from, String to) async {
    final res = await _dio.get('/gst/gstr3b', queryParameters: {'from': from, 'to': to});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<dynamic>> getHsnSummary(String from, String to) async {
    final res = await _dio.get('/gst/hsn-summary', queryParameters: {'from': from, 'to': to});
    final data = res.data['data'];
    if (data is List) return data;
    return [];
  }

  // ── Extra Fabrication Charges ─────────────────────────────────────────────────

  Future<List<dynamic>> getExtraFabEntries({String? from, String? to}) async {
    final params = <String, dynamic>{};
    if (from != null) params['from'] = from;
    if (to != null) params['to'] = to;
    final res = await _dio.get('/business/extra-fab', queryParameters: params);
    final data = res.data['data'];
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> createExtraFabEntry(Map<String, dynamic> data) async {
    final res = await _dio.post('/business/extra-fab', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> updateExtraFabEntry(int id, Map<String, dynamic> data) async {
    final res = await _dio.put('/business/extra-fab/$id', data: data);
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<void> deleteExtraFabEntry(int id) async {
    await _dio.delete('/business/extra-fab/$id');
  }
}
