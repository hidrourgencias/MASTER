import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { User, CreditCard, Lock, LogOut, Loader2, Save, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function Profile() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    display_name: '', rut: '', bank_name: '', bank_account_type: '', bank_account_number: ''
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        display_name: user.display_name || '',
        rut: user.rut || '',
        bank_name: user.bank_name || '',
        bank_account_type: user.bank_account_type || '',
        bank_account_number: user.bank_account_number || ''
      });
    }
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateProfile(form);
      await refreshUser();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* ignore */ }
    setSaving(false);
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-corporate-blue">Mi Perfil</h1>

      {/* Avatar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-border-light text-center">
        <div className="w-20 h-20 bg-corporate-light/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <User size={36} className="text-corporate-light" />
        </div>
        <h2 className="font-bold text-lg">{user?.display_name}</h2>
        <p className="text-sm text-text-secondary">@{user?.username} · {user?.role === 'admin' ? 'Administrador' : 'Técnico'}</p>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSave} className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-3">
        <h3 className="font-semibold text-sm text-corporate-blue flex items-center gap-2">
          <CreditCard size={16} /> Datos Personales y Bancarios
        </h3>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Nombre</label>
          <input type="text" value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">RUT</label>
          <input type="text" value={form.rut} onChange={e => setForm(p => ({ ...p, rut: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
            placeholder="XX.XXX.XXX-X" />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Banco</label>
          <select value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none">
            <option value="">Seleccionar banco...</option>
            <option value="Banco Estado">Banco Estado</option>
            <option value="Banco Santander">Banco Santander</option>
            <option value="Banco de Chile">Banco de Chile</option>
            <option value="BCI">BCI</option>
            <option value="Scotiabank">Scotiabank</option>
            <option value="Banco Falabella">Banco Falabella</option>
            <option value="Banco Ripley">Banco Ripley</option>
            <option value="BICE">BICE</option>
            <option value="Banco Security">Banco Security</option>
            <option value="Banco Itaú">Banco Itaú</option>
            <option value="Banco Consorcio">Banco Consorcio</option>
            <option value="Mercado Pago">Mercado Pago</option>
            <option value="MACH">MACH</option>
            <option value="Tenpo">Tenpo</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tipo Cuenta</label>
            <select value={form.bank_account_type} onChange={e => setForm(p => ({ ...p, bank_account_type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none">
              <option value="">Tipo...</option>
              <option value="Cuenta Corriente">Cuenta Corriente</option>
              <option value="Cuenta Vista">Cuenta Vista</option>
              <option value="Cuenta RUT">Cuenta RUT</option>
              <option value="Cuenta Ahorro">Cuenta Ahorro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">N° Cuenta</label>
            <input type="text" value={form.bank_account_number} onChange={e => setForm(p => ({ ...p, bank_account_number: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
          </div>
        </div>

        <button type="submit" disabled={saving}
          className="w-full py-3 bg-corporate-blue text-white font-semibold rounded-xl hover:bg-[#002244] transition flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <><Loader2 size={20} className="animate-spin" /> Guardando...</> :
            saved ? <><CheckCircle size={20} /> Guardado</> : <><Save size={20} /> Guardar Cambios</>}
        </button>
      </form>

      {/* Actions */}
      <div className="space-y-2">
        <button onClick={() => navigate('/cambiar-clave')}
          className="w-full flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-border-light hover:bg-gray-50 transition">
          <Lock size={20} className="text-corporate-blue" />
          <span className="font-medium text-sm">Cambiar Contraseña</span>
        </button>
        <button onClick={() => { logout(); navigate('/login'); }}
          className="w-full flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-red-200 hover:bg-red-50 transition text-danger">
          <LogOut size={20} />
          <span className="font-medium text-sm">Cerrar Sesión</span>
        </button>
      </div>
    </div>
  );
}
