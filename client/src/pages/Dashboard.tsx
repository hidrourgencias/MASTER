import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Receipt, DollarSign, Clock, CheckCircle, Send, Briefcase, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [jobSummary, setJobSummary] = useState<any>(null);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [s, wo] = await Promise.all([
        api.getJobSummary().catch(() => null),
        api.getWorkOrders ? api.getWorkOrders().catch(() => []) : Promise.resolve([])
      ]);
      setJobSummary(s);
      setWorkOrders(wo || []);
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

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-corporate-blue">Órdenes y Servicios</h1>
      <p className="text-sm text-text-secondary">Hola, {user?.display_name}</p>

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
