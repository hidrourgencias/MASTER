import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, DollarSign, Download, Eye, X, CreditCard, Users, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { formatCurrency, formatDate, statusLabel, statusColor, todayISO } from '../utils/format';

export default function Admin() {
  const { isAdmin } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'approval' | 'users' | 'export'>('approval');
  const [preview, setPreview] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [exportFrom, setExportFrom] = useState('');
  const [exportTo, setExportTo] = useState(todayISO());
  const [exportUser, setExportUser] = useState('');
  const [exportStatus, setExportStatus] = useState('');

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  async function loadData() {
    try {
      const [e, u] = await Promise.all([api.getExpenses(), api.getUsers()]);
      setExpenses(e);
      setUsers(u);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleApprove(id: number, status: string) {
    try {
      const updated = await api.approveExpense(id, status);
      setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));
    } catch { /* ignore */ }
  }

  async function handlePay(id: number) {
    try {
      const updated = await api.payExpense(id);
      setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...updated } : e));
    } catch { /* ignore */ }
  }

  async function handleResetPassword(id: number, name: string) {
    if (!confirm(`¿Resetear contraseña de ${name} a Hidro2026?`)) return;
    try {
      await api.resetPassword(id);
      alert('Contraseña reseteada correctamente');
    } catch { /* ignore */ }
  }

  async function handleExport() {
    const params: Record<string, string> = {};
    if (exportFrom) params.from = exportFrom;
    if (exportTo) params.to = exportTo;
    if (exportUser) params.user_id = exportUser;
    if (exportStatus) params.status = exportStatus;
    try {
      await api.exportExcel(params);
    } catch (err: any) {
      alert(err.message);
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-4 animate-fade-in">
        <div className="bg-white rounded-xl p-8 text-center text-text-secondary shadow-sm">
          <p>Acceso restringido a administradores.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-corporate-light border-t-transparent rounded-full animate-spin" /></div>;
  }

  const pendingExpenses = expenses.filter(e =>
    e.status === 'pendiente' && (!search ||
      e.provider?.toLowerCase().includes(search.toLowerCase()) ||
      e.user_name?.toLowerCase().includes(search.toLowerCase()))
  );

  const tabs = [
    { key: 'approval', label: 'Aprobación', icon: CheckCircle },
    { key: 'users', label: 'Personal', icon: Users },
    { key: 'export', label: 'Exportar', icon: Download },
  ] as const;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-corporate-blue">Administración</h1>

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

      {/* Approval Tab */}
      {tab === 'approval' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar rendiciones..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
          </div>

          {pendingExpenses.length === 0 ? (
            <div className="bg-white rounded-xl p-6 text-center text-text-secondary shadow-sm">
              <CheckCircle size={32} className="mx-auto mb-2 text-success opacity-50" />
              <p className="text-sm">No hay rendiciones pendientes</p>
            </div>
          ) : (
            pendingExpenses.map(exp => {
              const expUser = users.find(u => u.id === exp.user_id);
              return (
                <motion.div key={exp.id} layout className="bg-white rounded-xl p-4 shadow-sm border border-border-light space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm">{exp.provider || 'Sin proveedor'}</p>
                      <p className="text-xs text-text-secondary">{exp.user_name} · {formatDate(exp.date)} · {exp.service}</p>
                    </div>
                    <p className="font-bold text-lg text-corporate-blue">{formatCurrency(exp.amount)}</p>
                  </div>

                  {/* Bank info */}
                  {expUser && expUser.bank_account_number && (
                    <div className="bg-blue-50 rounded-lg p-3 text-xs space-y-1">
                      <p className="font-semibold text-corporate-blue flex items-center gap-1"><CreditCard size={14} /> Datos Bancarios</p>
                      <p>RUT: {expUser.rut || 'No registrado'}</p>
                      <p>Banco: {expUser.bank_name || 'No registrado'}</p>
                      <p>Cuenta: {expUser.bank_account_type} {expUser.bank_account_number}</p>
                    </div>
                  )}

                  {exp.image_path && (
                    <button onClick={() => setPreview(exp)} className="flex items-center gap-1 text-xs text-corporate-light hover:underline">
                      <Eye size={14} /> Ver boleta
                    </button>
                  )}

                  <div className="flex gap-2">
                    <button onClick={() => handleApprove(exp.id, 'aprobado')}
                      className="flex-1 flex items-center justify-center gap-1 bg-success text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-600 transition">
                      <CheckCircle size={16} /> Aprobar
                    </button>
                    <button onClick={() => handleApprove(exp.id, 'rechazado')}
                      className="flex-1 flex items-center justify-center gap-1 bg-danger text-white py-2 rounded-xl text-sm font-semibold hover:bg-red-600 transition">
                      <XCircle size={16} /> Rechazar
                    </button>
                    {exp.status === 'aprobado' && !exp.paid && (
                      <button onClick={() => handlePay(exp.id)}
                        className="flex items-center justify-center gap-1 bg-corporate-blue text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#002244] transition">
                        <DollarSign size={16} /> Pagar
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}

          {/* Approved but unpaid */}
          <h3 className="text-sm font-semibold text-text-secondary mt-4">Aprobados - Pendientes de Pago</h3>
          {expenses.filter(e => e.status === 'aprobado' && !e.paid).map(exp => (
            <div key={exp.id} className="bg-white rounded-xl p-3 shadow-sm border border-border-light flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{exp.user_name} - {exp.provider}</p>
                <p className="text-xs text-text-secondary">{formatDate(exp.date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm">{formatCurrency(exp.amount)}</p>
                <button onClick={() => handlePay(exp.id)}
                  className="bg-success text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-600 transition">
                  Pagar
                </button>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
          {users.filter(u => u.role !== 'admin').map(u => (
            <div key={u.id} className="bg-white rounded-xl p-4 shadow-sm border border-border-light">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">{u.display_name}</p>
                  <p className="text-xs text-text-secondary">@{u.username} · {u.active ? 'Activo' : 'Inactivo'}</p>
                  {u.rut && <p className="text-xs text-text-secondary">RUT: {u.rut}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleResetPassword(u.id, u.display_name)}
                    className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-lg hover:bg-yellow-200 transition">
                    <RotateCcw size={12} /> Reset
                  </button>
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Export Tab */}
      {tab === 'export' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-4">
          <h2 className="font-semibold text-sm text-corporate-blue">Exportar a Excel</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Desde</label>
              <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Hasta</label>
              <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Trabajador</label>
            <select value={exportUser} onChange={e => setExportUser(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none">
              <option value="">Todos</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.display_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Estado</label>
            <select value={exportStatus} onChange={e => setExportStatus(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none">
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
          <button onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 py-3 bg-corporate-blue text-white font-semibold rounded-xl hover:bg-[#002244] transition">
            <Download size={18} /> Descargar Excel
          </button>
        </motion.div>
      )}

      {/* Image Preview */}
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
