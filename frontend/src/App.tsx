import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/Login';
import { DashboardPage } from './pages/Dashboard';
import { CustomersPage } from './pages/Customers';
import { CustomerDetailPage } from './pages/CustomerDetail';
import { ProductsPage } from './pages/Products';
import { OrdersPage } from './pages/Orders';
import { OrderDetailPage } from './pages/OrderDetail';
import { PipelinePage } from './pages/Pipeline';
import { InboxPage } from './pages/Inbox';
import { CampaignsPage } from './pages/Campaigns';
import { AutomationsPage } from './pages/Automations';
import { CargoPage } from './pages/Cargo';
import { ReportsPage } from './pages/Reports';
import { DataPage } from './pages/Data';
import { SettingsPage } from './pages/Settings';
import { NotFoundPage } from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/:id" element={<OrderDetailPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="inbox" element={<InboxPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="automations" element={<AutomationsPage />} />
        <Route path="cargo" element={<CargoPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="data" element={<DataPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
