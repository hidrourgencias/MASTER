import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import NewExpense from './pages/NewExpense';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import AdminServices from './pages/AdminServices';
import AdminSettings from './pages/AdminSettings';
import AdminJobServices from './pages/AdminJobServices';
import AuditLog from './pages/AuditLog';
import Support from './pages/Support';
import ServiceJobs from './pages/ServiceJobs';
import NewServiceJob from './pages/NewServiceJob';
import EditServiceJob from './pages/EditServiceJob';
import TechnicianPayments from './pages/TechnicianPayments';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.must_change_password) return <Navigate to="/cambiar-clave" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  const { token, user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={token && !user?.must_change_password ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/cambiar-clave" element={token ? <ChangePassword /> : <Navigate to="/login" replace />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="gastos" element={<Expenses />} />
        <Route path="gastos/nuevo" element={<NewExpense />} />
        <Route path="servicios" element={<ServiceJobs />} />
        <Route path="servicios/nuevo" element={<NewServiceJob />} />
        <Route path="servicios/editar/:id" element={<EditServiceJob />} />
        <Route path="reportes" element={<Reports />} />
        <Route path="admin" element={<AdminRoute><Admin /></AdminRoute>} />
        <Route path="admin/pagos-tecnicos" element={<AdminRoute><TechnicianPayments /></AdminRoute>} />
        <Route path="admin/tipos-servicio" element={<AdminRoute><AdminJobServices /></AdminRoute>} />
        <Route path="admin/servicios" element={<AdminRoute><AdminServices /></AdminRoute>} />
        <Route path="admin/configuracion" element={<AdminRoute><AdminSettings /></AdminRoute>} />
        <Route path="admin/auditoria" element={<AdminRoute><AuditLog /></AdminRoute>} />
        <Route path="perfil" element={<Profile />} />
        <Route path="soporte" element={<Support />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
