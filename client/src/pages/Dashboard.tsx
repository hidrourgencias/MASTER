import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Receipt, DollarSign, Clock, CheckCircle, TrendingUp, Send, Briefcase } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [s, e] = await Promise.all([api.getExpenseSummary(), api.getExpenses()]);
      setSummary(s);
      setExpenses(e);
    } catch { /* ignore */ }
    setLoading(false);
  }

  const todayExpenses = expenses.filter(e => e.date === new Date().toISOString().split('T')[0]);

  function sendWhatsApp() {
    const today = new Date().toLocaleDateString('es-CL');
    let text = `*Rendición de Gastos - ${user?.display_name}*\nFecha: ${today}\n\n`;

    if (todayExpenses.length === 0) {
      text += 'Sin gastos registrados hoy.\n';
    } else {
      todayExpenses.forEach((e, i) => {
        text += `${i + 1}. ${e.provider || 'Sin proveedor'} - ${formatCurrency(e.amount)} (${e.service || 'Sin servicio'})\n`;
      });
      const total = todayExpenses.reduce((s: number, e: any) => s + e.amount, 0);
      text += `\n*Total del día: ${formatCurrency(total)}*`;
    }

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/56940918672?text=${encoded}`, '_blank');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-corporate-light border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-xl font-bold text-corporate-blue">Hola, {user?.display_name}</h1>
        <p className="text-sm text-text-secondary">
          {isAdmin ? 'Panel de Administración' : 'Panel de Control'}
        </p>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard icon={DollarSign} label="Total Gastos" value={formatCurrency(summary?.total || 0)} color="bg-corporate-blue" />
        <SummaryCard icon={CheckCircle} label="Pagados" value={formatCurrency(summary?.paid || 0)} color="bg-success" />
        <SummaryCard icon={Clock} label="Por Pagar" value={formatCurrency(summary?.pending || 0)} color="bg-warning" />
        <SummaryCard icon={TrendingUp} label="Pendientes" value={String(summary?.pendingApproval || 0)} color="bg-corporate-light" />
      </div>

      {/* Quick Actions */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Acciones Rápidas</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/gastos/nuevo" className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-border-light hover:shadow-md transition">
            <div className="w-10 h-10 bg-corporate-light/10 rounded-xl flex items-center justify-center">
              <Camera size={20} className="text-corporate-light" />
            </div>
            <div>
              <p className="font-semibold text-sm">Escanear</p>
              <p className="text-xs text-text-secondary">Boleta / Factura</p>
            </div>
          </Link>
          <Link to="/gastos/nuevo?manual=true" className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-border-light hover:shadow-md transition">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Receipt size={20} className="text-success" />
            </div>
            <div>
              <p className="font-semibold text-sm">Registro</p>
              <p className="text-xs text-text-secondary">Manual</p>
            </div>
          </Link>
          <Link to="/servicios/nuevo" className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-border-light hover:shadow-md transition">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Briefcase size={20} className="text-amber-600" />
            </div>
            <div>
              <p className="font-semibold text-sm">Servicio</p>
              <p className="text-xs text-text-secondary">Registrar cobro</p>
            </div>
          </Link>
        </div>
      </div>

      {/* WhatsApp Report */}
      <motion.button whileTap={{ scale: 0.98 }}
        onClick={sendWhatsApp}
        className="w-full flex items-center gap-3 bg-[#25D366] text-white p-4 rounded-xl shadow-sm hover:bg-[#20BD5A] transition">
        <Send size={20} />
        <div className="text-left">
          <p className="font-semibold text-sm">Enviar Reporte por WhatsApp</p>
          <p className="text-xs opacity-80">{todayExpenses.length} gastos hoy</p>
        </div>
      </motion.button>

      {/* Recent Expenses */}
      <div>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-2">Últimos Gastos</h2>
        {expenses.length === 0 ? (
          <div className="bg-white rounded-xl p-6 text-center text-text-secondary shadow-sm">
            <Receipt size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay gastos registrados</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expenses.slice(0, 5).map(exp => (
              <motion.div key={exp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white rounded-xl p-3 shadow-sm border border-border-light flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{exp.provider || 'Sin proveedor'}</p>
                  <p className="text-xs text-text-secondary">{exp.service || 'Sin servicio'} · {exp.date}</p>
                </div>
                <div className="text-right ml-3">
                  <p className="font-bold text-sm">{formatCurrency(exp.amount)}</p>
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    exp.status === 'aprobado' ? 'bg-green-100 text-green-700' :
                    exp.status === 'rechazado' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {exp.paid ? 'Pagado' : exp.status === 'aprobado' ? 'Aprobado' : exp.status === 'rechazado' ? 'Rechazado' : 'Pendiente'}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl p-4 shadow-sm border border-border-light">
      <div className={`w-9 h-9 ${color} rounded-lg flex items-center justify-center mb-2`}>
        <Icon size={18} className="text-white" />
      </div>
      <p className="text-lg font-bold text-text-primary">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </motion.div>
  );
}
