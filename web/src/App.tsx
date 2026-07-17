import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import AppLayout from '@/layouts/AppLayout'
import LoginPage from '@/pages/auth/LoginPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import SalesReportPage from '@/pages/reports/SalesReportPage'
import PurchaseReportPage from '@/pages/reports/PurchaseReportPage'
import InventoryReportPage from '@/pages/reports/InventoryReportPage'
import GstReportPage from '@/pages/reports/GstReportPage'
import DebtorsReportPage from '@/pages/reports/DebtorsReportPage'
import PaymentReportPage from '@/pages/reports/PaymentReportPage'
import CreditorsReportPage from '@/pages/reports/CreditorsReportPage'
import LedgerReportPage from '@/pages/reports/LedgerReportPage'
import TDSReportPage from '@/pages/reports/TDSReportPage'
import DayBookPage from '@/pages/reports/DayBookPage'
import StockStatementPage from '@/pages/reports/StockStatementPage'
import HSNReportPage from '@/pages/reports/HSNReportPage'
import MaintenanceReportPage from '@/pages/reports/MaintenanceReportPage'
import LabourReportPage from '@/pages/reports/LabourReportPage'
import VehiclesReportPage from '@/pages/reports/VehiclesReportPage'
import ScrapReportPage from '@/pages/reports/ScrapReportPage'
import ProductsPage from '@/pages/products/ProductsPage'
import ProductForm from '@/pages/products/ProductForm'
import ProductViewPage from '@/pages/products/ProductViewPage'
import CustomersPage from '@/pages/customers/CustomersPage'
import CustomerFormPage from '@/pages/customers/CustomerFormPage'
import CustomerDetailPage from '@/pages/customers/CustomerDetailPage'
import InventoryPage from '@/pages/inventory/InventoryPage'
import CategoriesPage from '@/pages/inventory/CategoriesPage'
import UomConversionPage from '@/pages/inventory/UomConversionPage'
import BulkPurchasePage from '@/pages/inventory/BulkPurchasePage'
import DirectPurchasePage from '@/pages/purchases/DirectPurchasePage'
import TransfersPage from '@/pages/inventory/TransfersPage'
import OrdersPage from '@/pages/orders/OrdersPage'
import CreateOrderPage from '@/pages/orders/CreateOrderPage'
import SalesOrdersPage from '@/pages/orders/SalesOrdersPage'
import CreateSalesOrderPage from '@/pages/orders/CreateSalesOrderPage'
import SalesOrderDetailPage from '@/pages/orders/SalesOrderDetailPage'
import EditSalesOrderPage from '@/pages/orders/EditSalesOrderPage'
import PaymentsReceivedPage from '@/pages/sales/PaymentsReceivedPage'
import ReturnsPage from '@/pages/sales/ReturnsPage'
import CreditNotesPage from '@/pages/sales/CreditNotesPage'
import DeliveryChallansPage from '@/pages/sales/DeliveryChallansPage'
import QuotationsPage from '@/pages/sales/QuotationsPage'
import InvoicesPage from '@/pages/sales/InvoicesPage'
import SettingsPage from '@/pages/settings/SettingsPage'
import PurchasesPage from '@/pages/purchases/PurchasesPage'
import IncentivesPage from '@/pages/incentives/IncentivesPage'
import StaffPage from '@/pages/staff/StaffPage'
import ProfilePage from '@/pages/profile/ProfilePage'
import ActivityLogsPage from '@/pages/activity/ActivityLogsPage'
import ExpensesPage from '@/pages/expenses/ExpensesPage'
import ExpenseCategoriesPage from '@/pages/expenses/ExpenseCategoriesPage'
import InvoiceViewPage from '@/pages/public/InvoiceViewPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import PipeConfigsPage from '@/pages/production/PipeConfigsPage'
import PipeConfigFormPage from '@/pages/production/PipeConfigFormPage'
import ProductionOrdersPage from '@/pages/production/ProductionOrdersPage'
import CreateProductionOrderPage from '@/pages/production/CreateProductionOrderPage'
import ProductionOrderDetailPage from '@/pages/production/ProductionOrderDetailPage'
import ProductionEntryPage from '@/pages/production/ProductionEntryPage'
import ProductionEntriesPage from '@/pages/production/ProductionEntriesPage'
import MachinesPage from '@/pages/production/MachinesPage'
import OverheadConfigsPage from '@/pages/production/OverheadConfigsPage'
import ProductionReportsPage from '@/pages/production/ProductionReportsPage'
import FabricationReportPage from '@/pages/production/FabricationReportPage'
import CoatingReportPage from '@/pages/production/CoatingReportPage'
import SpinningReportPage from '@/pages/production/SpinningReportPage'
import Winding2ReportPage from '@/pages/production/Winding2ReportPage'
import Coating2ReportPage from '@/pages/production/Coating2ReportPage'
import ProductionEntryDetailPage from '@/pages/production/ProductionEntryDetailPage'
import BusinessPage from '@/pages/business/BusinessPage'
import CementBagsPage from '@/pages/business/CementBagsPage'
import VehiclesPage from '@/pages/business/VehiclesPage'
import MaintenancePage from '@/pages/business/MaintenancePage'
import SiloPage from '@/pages/business/SiloPage'
import DieselMaintenancePage from '@/pages/business/DieselMaintenancePage'
import StoreRoomMaterialPage from '@/pages/business/StoreRoomMaterialPage'
import ExtraVehiclesPage from '@/pages/business/ExtraVehiclesPage'
import SiloExtractionPage from '@/pages/business/SiloExtractionPage'
import TestingLabPage from '@/pages/business/TestingLabPage'
import ConversionPage from '@/pages/business/ConversionPage'
import CuttingPage from '@/pages/business/CuttingPage'
import DiscardPage from '@/pages/business/DiscardPage'
import PDIPage from '@/pages/business/PDIPage'
import LoadingPage from '@/pages/business/LoadingPage'
import LoadingRecordDetailPage from '@/pages/business/LoadingRecordDetailPage'
import DiameterHeatmapPage from '@/pages/business/DiameterHeatmapPage'
import TransportReportPage from '@/pages/business/TransportReportPage'
import LabourPage from '@/pages/business/LabourPage'
import ThirdPartyPipePurchasePage from '@/pages/business/ThirdPartyPipePurchasePage'
import ExtraFabPage from '@/pages/business/ExtraFabPage'
import BusinessSettingsPage from '@/pages/business/BusinessSettingsPage'
import LoadingInvoicePage from '@/pages/business/LoadingInvoicePage'
import PrintInvoicesPage from '@/pages/business/PrintInvoicesPage'
import SitePage from '@/pages/site/SitePage'
import MainContractorPage from '@/pages/site/MainContractorPage'
import SubContractorPage from '@/pages/site/SubContractorPage'
import SitesPage from '@/pages/site/SitesPage'
import ProjectDetailPage from '@/pages/site/ProjectDetailPage'
import ContractorsPage from '@/pages/site/ContractorsPage'
import WorkOrdersPage from '@/pages/site/WorkOrdersPage'
import WorkBillsPage from '@/pages/site/WorkBillsPage'
import NewWorkBillPage from '@/pages/site/NewWorkBillPage'
import WorkBillInvoicePage from '@/pages/site/WorkBillInvoicePage'
import MaterialIssuesPage from '@/pages/site/MaterialIssuesPage'
import ProgressClaimsPage from '@/pages/site/ProgressClaimsPage'
import DailyProgressPage from '@/pages/site/DailyProgressPage'
import MaterialStockPage from '@/pages/site/MaterialStockPage'
import ClientBillsPage from '@/pages/site/ClientBillsPage'
import FinancialSummaryPage from '@/pages/site/reports/FinancialSummaryPage'
import ProgressReportPage from '@/pages/site/reports/ProgressReportPage'
import WorkBillsReportPage from '@/pages/site/reports/WorkBillsReportPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 0 } }
})


function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <AppLayout>{children}</AppLayout> : <Navigate to="/login" />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/invoice/:invoiceNumber" element={<InvoiceViewPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/business" element={<ProtectedRoute><BusinessPage /></ProtectedRoute>} />
          <Route path="/business/cement-bags" element={<ProtectedRoute><CementBagsPage /></ProtectedRoute>} />
          <Route path="/business/vehicles" element={<ProtectedRoute><VehiclesPage /></ProtectedRoute>} />
          <Route path="/business/maintenance" element={<ProtectedRoute><MaintenancePage /></ProtectedRoute>} />
          <Route path="/business/silo" element={<ProtectedRoute><SiloPage /></ProtectedRoute>} />
          <Route path="/business/diesel-maintenance" element={<ProtectedRoute><DieselMaintenancePage /></ProtectedRoute>} />
          <Route path="/business/store-material" element={<ProtectedRoute><StoreRoomMaterialPage /></ProtectedRoute>} />
          <Route path="/business/extra-vehicles" element={<ProtectedRoute><ExtraVehiclesPage /></ProtectedRoute>} />
          <Route path="/business/silo-extraction" element={<ProtectedRoute><SiloExtractionPage /></ProtectedRoute>} />
          <Route path="/business/testing-lab" element={<ProtectedRoute><TestingLabPage /></ProtectedRoute>} />
          <Route path="/business/conversion" element={<ProtectedRoute><ConversionPage /></ProtectedRoute>} />
          <Route path="/business/cutting" element={<ProtectedRoute><CuttingPage /></ProtectedRoute>} />
          <Route path="/business/discard" element={<ProtectedRoute><DiscardPage /></ProtectedRoute>} />
          <Route path="/business/extra-fab" element={<ProtectedRoute><ExtraFabPage /></ProtectedRoute>} />
          <Route path="/business/pdi" element={<ProtectedRoute><PDIPage /></ProtectedRoute>} />
          <Route path="/business/loading" element={<ProtectedRoute><LoadingPage /></ProtectedRoute>} />
          <Route path="/business/loading/diameter-view" element={<ProtectedRoute><DiameterHeatmapPage /></ProtectedRoute>} />
          <Route path="/business/loading/:id" element={<ProtectedRoute><LoadingRecordDetailPage /></ProtectedRoute>} />
          <Route path="/business/transport-report" element={<ProtectedRoute><TransportReportPage /></ProtectedRoute>} />
          <Route path="/business/labour" element={<ProtectedRoute><LabourPage /></ProtectedRoute>} />
          <Route path="/business/pipe-purchases" element={<ProtectedRoute><ThirdPartyPipePurchasePage /></ProtectedRoute>} />
          <Route path="/business/settings" element={<ProtectedRoute><BusinessSettingsPage /></ProtectedRoute>} />
          <Route path="/business/loading-invoice" element={<ProtectedRoute><LoadingInvoicePage /></ProtectedRoute>} />
          <Route path="/business/print-invoices" element={<ProtectedRoute><PrintInvoicesPage /></ProtectedRoute>} />
          <Route path="/business/pccp" element={<Navigate to="/production/entry" replace />} />
          <Route path="/business/:section" element={<ProtectedRoute><BusinessPage /></ProtectedRoute>} />
          <Route path="/products" element={<ProtectedRoute><ProductsPage /></ProtectedRoute>} />
          <Route path="/products/new" element={<ProtectedRoute><ProductForm /></ProtectedRoute>} />
          <Route path="/products/:id" element={<ProtectedRoute><ProductViewPage /></ProtectedRoute>} />
          <Route path="/products/:id/edit" element={<ProtectedRoute><ProductForm /></ProtectedRoute>} />
          <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
          <Route path="/inventory/categories" element={<ProtectedRoute><CategoriesPage /></ProtectedRoute>} />
          <Route path="/inventory/uom" element={<ProtectedRoute><UomConversionPage /></ProtectedRoute>} />
          <Route path="/inventory/bulk-purchase" element={<ProtectedRoute><BulkPurchasePage /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><CustomersPage /></ProtectedRoute>} />
          <Route path="/customers/new" element={<ProtectedRoute><CustomerFormPage /></ProtectedRoute>} />
          <Route path="/customers/:id/edit" element={<ProtectedRoute><CustomerFormPage /></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetailPage /></ProtectedRoute>} />
          <Route path="/pos" element={<ProtectedRoute><CreateOrderPage /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
          <Route path="/orders/new" element={<ProtectedRoute><CreateOrderPage /></ProtectedRoute>} />
          <Route path="/sales-orders" element={<ProtectedRoute><SalesOrdersPage /></ProtectedRoute>} />
          <Route path="/sales-orders/new" element={<ProtectedRoute><CreateSalesOrderPage /></ProtectedRoute>} />
          <Route path="/sales-orders/:id" element={<ProtectedRoute><SalesOrderDetailPage /></ProtectedRoute>} />
          <Route path="/sales-orders/:id/edit" element={<ProtectedRoute><EditSalesOrderPage /></ProtectedRoute>} />
          <Route path="/sales/payments-received" element={<ProtectedRoute><PaymentsReceivedPage /></ProtectedRoute>} />
          <Route path="/sales/returns" element={<ProtectedRoute><ReturnsPage /></ProtectedRoute>} />
          <Route path="/sales/credit-notes" element={<ProtectedRoute><CreditNotesPage /></ProtectedRoute>} />
          <Route path="/sales/invoices" element={<ProtectedRoute><InvoicesPage /></ProtectedRoute>} />
          <Route path="/sales/quotations" element={<ProtectedRoute><QuotationsPage /></ProtectedRoute>} />
          <Route path="/sales/delivery-challans" element={<ProtectedRoute><DeliveryChallansPage /></ProtectedRoute>} />
          <Route path="/transfers/*" element={<ProtectedRoute><TransfersPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/reports/sales" element={<ProtectedRoute><SalesReportPage /></ProtectedRoute>} />
          <Route path="/reports/purchases" element={<ProtectedRoute><PurchaseReportPage /></ProtectedRoute>} />
          <Route path="/reports/inventory" element={<ProtectedRoute><InventoryReportPage /></ProtectedRoute>} />
          <Route path="/reports/gst" element={<ProtectedRoute><GstReportPage /></ProtectedRoute>} />
          <Route path="/reports/payments" element={<ProtectedRoute><PaymentReportPage /></ProtectedRoute>} />
          <Route path="/reports/debtors" element={<ProtectedRoute><DebtorsReportPage /></ProtectedRoute>} />
          <Route path="/reports/creditors" element={<ProtectedRoute><CreditorsReportPage /></ProtectedRoute>} />
          <Route path="/reports/ledger" element={<ProtectedRoute><LedgerReportPage /></ProtectedRoute>} />
          <Route path="/reports/tds" element={<ProtectedRoute><TDSReportPage /></ProtectedRoute>} />
          <Route path="/reports/daybook" element={<ProtectedRoute><DayBookPage /></ProtectedRoute>} />
          <Route path="/reports/stock-statement" element={<ProtectedRoute><StockStatementPage /></ProtectedRoute>} />
          <Route path="/reports/hsn" element={<ProtectedRoute><HSNReportPage /></ProtectedRoute>} />
          <Route path="/reports/maintenance" element={<ProtectedRoute><MaintenanceReportPage /></ProtectedRoute>} />
          <Route path="/reports/labour" element={<ProtectedRoute><LabourReportPage /></ProtectedRoute>} />
          <Route path="/reports/vehicles" element={<ProtectedRoute><VehiclesReportPage /></ProtectedRoute>} />
          <Route path="/reports/scrap" element={<ProtectedRoute><ScrapReportPage /></ProtectedRoute>} />
          <Route path="/reports/transport" element={<ProtectedRoute><TransportReportPage /></ProtectedRoute>} />
          <Route path="/settings/*" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/purchases/direct" element={<ProtectedRoute><DirectPurchasePage /></ProtectedRoute>} />
          <Route path="/purchases/*" element={<ProtectedRoute><PurchasesPage /></ProtectedRoute>} />
          <Route path="/incentives" element={<ProtectedRoute><IncentivesPage /></ProtectedRoute>} />
          <Route path="/staff" element={<ProtectedRoute><StaffPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/activity-logs" element={<ProtectedRoute><ActivityLogsPage /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><ExpensesPage /></ProtectedRoute>} />
          <Route path="/expenses/categories" element={<ProtectedRoute><ExpenseCategoriesPage /></ProtectedRoute>} />
          <Route path="/production/pipe-configs" element={<ProtectedRoute><PipeConfigsPage /></ProtectedRoute>} />
          <Route path="/production/pipe-configs/new" element={<ProtectedRoute><PipeConfigFormPage /></ProtectedRoute>} />
          <Route path="/production/pipe-configs/:id/edit" element={<ProtectedRoute><PipeConfigFormPage /></ProtectedRoute>} />
          <Route path="/production/orders" element={<ProtectedRoute><ProductionOrdersPage /></ProtectedRoute>} />
          <Route path="/production/orders/new" element={<ProtectedRoute><CreateProductionOrderPage /></ProtectedRoute>} />
          <Route path="/production/orders/:id" element={<ProtectedRoute><ProductionOrderDetailPage /></ProtectedRoute>} />
          <Route path="/production/entry" element={<ProtectedRoute><ProductionEntryPage /></ProtectedRoute>} />
          <Route path="/production/entries" element={<ProtectedRoute><ProductionEntriesPage /></ProtectedRoute>} />
          <Route path="/production/entries/:id" element={<ProtectedRoute><ProductionEntryDetailPage /></ProtectedRoute>} />
          <Route path="/production/machines" element={<ProtectedRoute><MachinesPage /></ProtectedRoute>} />
          <Route path="/production/overhead-configs" element={<ProtectedRoute><OverheadConfigsPage /></ProtectedRoute>} />
          <Route path="/production/reports" element={<ProtectedRoute><ProductionReportsPage /></ProtectedRoute>} />
          <Route path="/production/reports/fabrication" element={<ProtectedRoute><FabricationReportPage /></ProtectedRoute>} />
          <Route path="/production/reports/coating" element={<ProtectedRoute><CoatingReportPage /></ProtectedRoute>} />
          <Route path="/production/reports/spinning" element={<ProtectedRoute><SpinningReportPage /></ProtectedRoute>} />
          <Route path="/production/reports/winding2" element={<ProtectedRoute><Winding2ReportPage /></ProtectedRoute>} />
          <Route path="/production/reports/coating2" element={<ProtectedRoute><Coating2ReportPage /></ProtectedRoute>} />
          <Route path="/site" element={<ProtectedRoute><SitePage /></ProtectedRoute>} />
          <Route path="/site/main-contractor" element={<ProtectedRoute><MainContractorPage /></ProtectedRoute>} />
          <Route path="/site/sub-contractor" element={<ProtectedRoute><SubContractorPage /></ProtectedRoute>} />
          <Route path="/site/projects" element={<ProtectedRoute><SitesPage /></ProtectedRoute>} />
          <Route path="/site/projects/:id" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
          <Route path="/site/contractors" element={<ProtectedRoute><ContractorsPage /></ProtectedRoute>} />
          <Route path="/site/work-orders" element={<ProtectedRoute><WorkOrdersPage /></ProtectedRoute>} />
          <Route path="/site/work-bills" element={<ProtectedRoute><WorkBillsPage /></ProtectedRoute>} />
          <Route path="/site/work-bills/new" element={<ProtectedRoute><NewWorkBillPage /></ProtectedRoute>} />
          <Route path="/site/work-bills/:id/invoice" element={<ProtectedRoute><WorkBillInvoicePage /></ProtectedRoute>} />
          <Route path="/site/material-issues" element={<ProtectedRoute><MaterialIssuesPage /></ProtectedRoute>} />
          <Route path="/site/progress-claims" element={<ProtectedRoute><ProgressClaimsPage /></ProtectedRoute>} />
          <Route path="/site/daily-progress" element={<ProtectedRoute><DailyProgressPage /></ProtectedRoute>} />
          <Route path="/site/material-stock" element={<ProtectedRoute><MaterialStockPage /></ProtectedRoute>} />
          <Route path="/site/client-bills" element={<ProtectedRoute><ClientBillsPage /></ProtectedRoute>} />
          <Route path="/site/reports/financial-summary" element={<ProtectedRoute><FinancialSummaryPage /></ProtectedRoute>} />
          <Route path="/site/reports/progress-report" element={<ProtectedRoute><ProgressReportPage /></ProtectedRoute>} />
          <Route path="/site/reports/work-bills-by-contractor" element={<ProtectedRoute><WorkBillsReportPage /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
