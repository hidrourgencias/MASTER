import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Filter, Trash2, Eye, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, statusLabel, statusColor } from '../utils/format';

export default function Expenses() {
  const { isAdmin } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => { loadExpenses(); }, []);

  async function loadExpenses() {
    try {
      setExpenses(await api.getExpenses());
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await api.deleteExpense(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch { /* ignore */ }
  }

  const filtered = expenses.filter(e => {
    const matchSearch = !search || e.provider?.toLowerCase().includes(search.toLowerCase()) ||
      e.service?.toLowerCase().includes(search.toLowerCase()) || String(e.amount).includes(search);
    const matchStatus = !filterStatus || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-corporate-light border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-corporate-blue">Gastos</h1>
        <Link to="/gastos/nuevo" className="flex items-center gap-1 bg-corporate-light text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0095cc] transition">
          <Plus size={18} /> Nuevo
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none">
          <option value="">Todos</option>
          <option value="pendiente">Pendiente</option>
          <option value="aprobado">Aprobado</option>
          <option value="rechazado">Rechazado</option>
        </select>
      </div>

      {/* Expense List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-text-secondary shadow-sm">
          <p>No se encontraron gastos</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(exp => (
            <motion.div key={exp.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-white rounded-xl p-3 shadow-sm border border-border-light">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{exp.provider || 'Sin proveedor'}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColor(exp.status)}`}>
                      {statusLabel(exp.status)}
                    </span>
                    {exp.paid === 1 && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Pagado</span>}
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {exp.service || 'Sin servicio'} · {formatDate(exp.date)}
                    {isAdmin && exp.user_name && <> · <span className="font-medium">{exp.user_name}</span></>}
                  </p>
                  {exp.description && <p className="text-xs text-text-secondary mt-0.5 truncate">{exp.description}</p>}
                </div>
                <div className="flex items-center gap-1 ml-2">
                  <p className="font-bold text-sm mr-2">{formatCurrency(exp.amount)}</p>
                  {exp.image_path && (
                    <button onClick={() => setPreview(exp)} className="p-1 text-text-secondary hover:text-corporate-light transition">
                      <Eye size={16} />
                    </button>
                  )}
                  <button onClick={() => handleDelete(exp.id)} className="p-1 text-text-secondary hover:text-danger transition">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
            <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"><X size={24} /></button>
            <img src={`/uploads/${preview.image_path}`} alt="Boleta" className="max-w-full max-h-[80vh] rounded-lg" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
