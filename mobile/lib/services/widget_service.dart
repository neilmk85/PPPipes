import 'package:home_widget/home_widget.dart';
import 'package:intl/intl.dart';
import '../utils/parse.dart' as p;
import 'api_service.dart';

class WidgetService {
  static const _androidWidgetName = 'PipesWidget';

  final ApiService _api;
  WidgetService(this._api);

  Future<void> refresh({required int outletId}) async {
    try {
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());

      // Fetch all data in parallel
      final results = await Future.wait([
        _api.getInventoryByOutlet(outletId, size: 500),
        _api.getLoadingRecords(date: today, size: 500),
        _api.getSalesSummary(outletId, today, today),
      ]);

      final inventory    = results[0] as List<dynamic>;
      final loadRecs     = results[1] as List<dynamic>;
      final salesSummary = results[2] as Map<String, dynamic>;

      // Total available finished-pipe inventory
      final available = inventory
          .where((i) =>
              (i['product']?['itemType'] ?? '') == 'FINISHED_PIPE' &&
              p.d(i['quantityOnHand']) > 0)
          .fold<int>(0, (sum, i) => sum + p.d(i['quantityOnHand']).toInt());

      // Total pipes loaded today
      final loaded = loadRecs.fold<int>(
          0, (sum, r) => sum + p.d(r['quantity']).toInt());

      // Sales orders placed today
      final ordersToday = (salesSummary['totalOrders'] as num?)?.toInt() ?? 0;

      // Items below reorder level (all item types)
      final lowStock = inventory.where((i) {
        final qty = p.d(i['quantityOnHand']).toDouble();
        final reorder =
            (i['product']?['reorderLevel'] as num?)?.toDouble() ?? 10.0;
        return qty <= reorder;
      }).length;

      final timestamp = DateFormat('d MMM, h:mm a').format(DateTime.now());

      await Future.wait([
        HomeWidget.saveWidgetData<int>('pipes_available', available),
        HomeWidget.saveWidgetData<int>('pipes_loaded_today', loaded),
        HomeWidget.saveWidgetData<int>('widget_orders_today', ordersToday),
        HomeWidget.saveWidgetData<int>('widget_low_stock', lowStock),
        HomeWidget.saveWidgetData<String>('widget_updated_at', timestamp),
      ]);

      await HomeWidget.updateWidget(androidName: _androidWidgetName);
    } catch (e, st) {
      // ignore: avoid_print
      print('WidgetService.refresh error: $e\n$st');
    }
  }
}
