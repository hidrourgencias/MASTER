import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Receipt, DollarSign, Clock, CheckCircle, Send, Briefcase, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [jobSummary, setJobSummary] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [s, wo, dash] = await Promise.all([
        api.getJobSummary().catch(() => null),
        api.getWorkOrders ? api.getWorkOrders().catch(() => []) : Promise.resolve([]),
        (isAdmin || (user?.role === 'supervisor')) && api.getAdminDashboard ? api.getAdminDashboard().catch(() => null) : Promise.resolve(null)
      ]);
      setJobSummary(s);
      setWorkOrders(wo || []);
      setDashboard(dash);
    } catch { /* ignore */ }
    setLoading(false);
  }

  const pendingOrders = workOrders.filter((wo: any) =>
    wo.assignments?.some((a: any) => a.technician_id === user?.id && !a.read_at)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-corporate-light border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const chartData = dashboard ? [
    { name: 'Ingresos', value: dashboard.mes?.ingresos ?? 0, fill: '#10b981' },
    { name: 'Egresos', value: dashboard.mes?.egresos ?? 0, fill: '#ef4444' },
    { name: 'Utilidad', value: dashboard.mes?.utilidad ?? 0, fill: '#3b82f6' }
  ] : [];

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-corporate-blue">Hidrourgencias ERP</h1>
      <p className="text-sm text-text-secondary">Hola, {user?.display_name}</p>

      {/* Dashboard Financiero Admin / Supervisor */}
      {(isAdmin || user?.role === 'supervisor') && dashboard && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary uppercase">Indicadores del día</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white rounded-xl p-3 shadow-sm border">
              <p className="text-xs text-text-secondary">Servicios hoy</p>
              <p className="font-bold text-corporate-blue">{dashboard.hoy?.servicios ?? 0}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border">
              <p className="text-xs text-text-secondary">Ingresos hoy</p>
              <p className="font-bold text-green-600">{formatCurrency(dashboard.hoy?.ingresos ?? 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border">
              <p className="text-xs text-text-secondary">Gastos hoy</p>
              <p className="font-bold text-red-600">{formatCurrency(dashboard.hoy?.egresos ?? 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border">
              <p className="text-xs text-text-secondary">Utilidad hoy</p>
              <p className={`font-bold ${(dashboard.hoy?.utilidad ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(dashboard.hoy?.utilidad ?? 0)}
              </p>
            </div>
          </div>
          <h2 className="text-sm font-semibold text-text-secondary uppercase">Resumen mensual</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white rounded-xl p-3 shadow-sm border">
              <p className="text-xs text-text-secondary">Servicios mes</p>
              <p className="font-bold">{dashboard.mes?.servicios ?? 0}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border">
              <p className="text-xs text-text-secondary">Ingresos mes</p>
              <p className="font-bold text-green-600">{formatCurrency(dashboard.mes?.ingresos ?? 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border">
              <p className="text-xs text-text-secondary">Egresos mes</p>
              <p className="font-bold text-red-600">{formatCurrency(dashboard.mes?.egresos ?? 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-3 shadow-sm border">
              <p className="text-xs text-text-secondary">Utilidad mes</p>
              <p className={`font-bold flex items-center gap-1 ${(dashboard.mes?.utilidad ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(dashboard.mes?.utilidad ?? 0)}
                {(dashboard.crecimientoMensual ?? 0) !== 0 && (
                  <span className={`text-xs ${dashboard.crecimientoMensual >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {dashboard.crecimientoMensual >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    {dashboard.crecimientoMensual > 0 ? '+' : ''}{dashboard.crecimientoMensual}%
                  </span>
                )}
              </p>
            </div>
          </div>
          {chartData.some(d => d.value > 0) && (
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <p className="text-xs font-medium text-text-secondary mb-2">Ingresos vs Egresos vs Utilidad (mes)</p>
              <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 1000 ? `${v/1000}k` : v} />
                    <Bar dataKey="value" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Job Summary */}
      {jobSummary && (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm border">
            <p className="text-xs text-text-secondary">Mis tickets</p>
            <p className="font-bold text-corporate-blue">{jobSummary.myTicketsCount ?? jobSummary.count ?? 0}</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border">
            <p className="text-xs text-text-secondary">En revisión</p>
            <p className="font-bold text-amber-600">{jobSummary.pendingApprovalCount ?? jobSummary.pendingApproval ?? 0}</p>
          </div>
          {isAdmin && (
            <>
              <div className="bg-white rounded-xl p-3 shadow-sm border">
                <p className="text-xs text-text-secondary">Pendiente pago</p>
                <p className="font-bold text-corporate-blue">{formatCurrency(Number(jobSummary.pending || 0))}</p>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border">
                <p className="text-xs text-text-secondary">Pagado</p>
                <p className="font-bold text-green-600">{formatCurrency(Number(jobSummary.paid || 0))}</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Pending Work Orders - Technician */}
      {!isAdmin && pendingOrders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="font-semibold text-amber-800 text-sm mb-2">Órdenes pendientes de recepción</p>
          <Link to="/perfil" className="text-sm text-amber-700 font-medium underline">Ir a Perfil para confirmar</Link>
        </div>
      )}

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-text-secondary uppercase mb-2">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/servicios/nuevo" className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition">
            <div className="w-10 h-10 bg-corporate-light/20 rounded-xl flex items-center justify-center">
              <Plus size={22} className="text-corporate-light" />
            </div>
            <div>
              <p className="font-semibold text-sm">Nuevo Servicio</p>
              <p className="text-xs text-text-secondary">Registrar ticket</p>
            </div>
          </Link>
          <Link to="/servicios" className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Briefcase size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">Mis Servicios</p>
              <p className="text-xs text-text-secondary">Ver tickets</p>
            </div>
          </Link>
          {isAdmin && (
            <Link to="/admin/ordenes-trabajo" className="col-span-2 flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border hover:shadow-md transition">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Send size={20} className="text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Órdenes de Trabajo</p>
                <p className="text-xs text-text-secondary">Crear y despachar</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Gastos shortcut */}
      <Link to="/gastos" className="block p-3 bg-gray-50 rounded-xl border border-gray-200 text-sm text-text-secondary hover:bg-gray-100">
        Ir a Control de Gastos →
      </Link>
    </div>
  );
}
