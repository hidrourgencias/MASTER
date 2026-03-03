import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Users, Building2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatCurrency } from '../utils/format';

const COLORS = ['#003366', '#00AEEF', '#38A169', '#ECC94B', '#E53E3E', '#805AD5', '#DD6B20', '#319795'];

export default function Reports() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'service' | 'provider' | 'user' | 'month'>('service');

  useEffect(() => {
    if (isAdmin) {
      api.getExpenseStats().then(setStats).catch(() => {}).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="p-4 animate-fade-in">
        <h1 className="text-xl font-bold text-corporate-blue mb-4">Reportes</h1>
        <div className="bg-white rounded-xl p-8 text-center text-text-secondary shadow-sm">
          <BarChart3 size={48} className="mx-auto mb-3 opacity-30" />
          <p>Los reportes detallados están disponibles para administradores.</p>
          <p className="text-sm mt-1">Consulte con su administrador para obtener información.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-corporate-light border-t-transparent rounded-full animate-spin" /></div>;
  }

  const tabs = [
    { key: 'service', label: 'Servicios', icon: TrendingUp },
    { key: 'provider', label: 'Proveedores', icon: Building2 },
    { key: 'user', label: 'Técnicos', icon: Users },
    { key: 'month', label: 'Mensual', icon: BarChart3 },
  ] as const;

  const chartData = tab === 'service' ? stats?.byService :
    tab === 'provider' ? stats?.byProvider :
    tab === 'user' ? stats?.byUser :
    stats?.byMonth?.map((m: any) => ({ ...m, name: m.month }));

  const dataKey = tab === 'month' ? 'name' : (tab === 'user' ? 'name' : (tab === 'service' ? 'service' : 'provider'));

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-corporate-blue">Estadísticas</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition ${
              tab === key ? 'bg-white text-corporate-blue shadow-sm' : 'text-text-secondary hover:text-text-primary'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="bg-white rounded-2xl p-4 shadow-sm border border-border-light">
        <h2 className="text-sm font-semibold mb-4">
          {tab === 'service' ? 'Gasto por Servicio' :
           tab === 'provider' ? 'Gasto por Proveedor' :
           tab === 'user' ? 'Gasto por Técnico' : 'Gasto Mensual'}
        </h2>
        {chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} fontSize={11} />
              <YAxis type="category" dataKey={dataKey} width={100} fontSize={11} tick={{ fill: '#718096' }} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} labelStyle={{ fontWeight: 'bold' }} />
              <Bar dataKey="total" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {chartData.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-text-secondary py-8">Sin datos disponibles</p>
        )}
      </motion.div>

      {/* Table summary */}
      {chartData && chartData.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-border-light overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-text-secondary">
                <th className="text-left px-4 py-2 font-medium">Nombre</th>
                <th className="text-right px-4 py-2 font-medium">Cantidad</th>
                <th className="text-right px-4 py-2 font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {chartData.map((item: any, i: number) => (
                <tr key={i} className="border-t border-border-light">
                  <td className="px-4 py-2 font-medium">{item[dataKey]}</td>
                  <td className="px-4 py-2 text-right text-text-secondary">{item.count}</td>
                  <td className="px-4 py-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
