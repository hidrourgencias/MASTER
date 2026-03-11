import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Edit2, X, Phone, CreditCard, MapPin, Heart, AlertCircle, Save, RotateCcw } from 'lucide-react';
import { api } from '../services/api';

const BANKS = ['Banco Estado', 'Banco Santander', 'Banco de Chile', 'BCI', 'Scotiabank', 'Banco Falabella', 'Banco Ripley', 'BICE', 'Banco Security', 'Banco Itaú', 'Banco Consorcio', 'Mercado Pago', 'MACH', 'Tenpo'];
const ACCOUNT_TYPES = ['Cuenta Corriente', 'Cuenta Vista', 'Cuenta RUT', 'Cuenta Ahorro'];
const HEALTH_OPTIONS = [
  { value: '', label: '--' },
  { value: 'fonasa', label: 'Fonasa' },
  { value: 'isapre', label: 'Isapre' }
];

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    display_name: '', role: '', active: 1, rut: '', bank_name: '', bank_account_type: '', bank_account_number: '',
    whatsapp_phone: '', address: '', afp: '', health_system: '', health_organization: '', emergency_contact_phone: ''
  });

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const u = await api.getUsers();
      setUsers(u);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  function openEdit(u: any) {
    setEditing(u);
    setForm({
      display_name: u.display_name || '',
      role: u.role || 'tecnico',
      active: u.active ?? 1,
      rut: u.rut || '',
      bank_name: u.bank_name || '',
      bank_account_type: u.bank_account_type || '',
      bank_account_number: u.bank_account_number || '',
      whatsapp_phone: u.whatsapp_phone || '',
      address: u.address || '',
      afp: u.afp || '',
      health_system: u.health_system || '',
      health_organization: u.health_organization || '',
      emergency_contact_phone: u.emergency_contact_phone || ''
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    try {
      await api.updateUser(editing.id, form);
      setEditing(null);
      load();
    } catch (err: any) {
      alert(err.message || 'Error al guardar');
    }
  }

  async function handleResetPassword(id: number, name: string) {
    if (!confirm(`¿Resetear contraseña de ${name} a Hidro2026?`)) return;
    try {
      await api.resetPassword(id);
      alert('Contraseña reseteada');
      load();
    } catch (err: any) {
      alert(err.message || 'Error');
    }
  }

  const filtered = users.filter(u =>
    u.role !== 'admin' &&
    (!search || u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()))
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
      <h1 className="text-xl font-bold text-corporate-blue flex items-center gap-2">
        <Users size={24} /> Gestión de Personal
      </h1>
      <p className="text-sm text-text-secondary">Ver y modificar datos de cada usuario: WhatsApp, dirección, AFP, salud, emergencia y preferencias de pago.</p>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o usuario..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
      </div>

      <div className="space-y-3">
        {filtered.map(u => (
          <motion.div key={u.id} layout className="bg-white rounded-xl p-4 shadow-sm border border-border-light">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">{u.display_name}</p>
                <p className="text-xs text-text-secondary">@{u.username} · {u.role === 'tecnico' ? 'Técnico' : u.role === 'ventas' ? 'Ventas' : u.role}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {u.whatsapp_phone && <span className="flex items-center gap-0.5 text-green-700"><Phone size={12} /> {u.whatsapp_phone}</span>}
                  {u.rut && <span>RUT: {u.rut}</span>}
                  {u.bank_name && <span className="text-blue-700">{u.bank_name}</span>}
                  {!u.whatsapp_phone && <span className="text-amber-600">Sin WhatsApp</span>}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => openEdit(u)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-corporate-blue text-white rounded-lg text-xs font-medium hover:bg-[#002244]">
                  <Edit2 size={14} /> Editar
                </button>
                <button onClick={() => handleResetPassword(u.id, u.display_name)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium hover:bg-amber-200">
                  <RotateCcw size={14} /> Reset clave
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center text-text-secondary">
          <Users size={40} className="mx-auto mb-2 opacity-50" />
          <p>No hay usuarios que coincidan con la búsqueda</p>
        </div>
      )}

      {/* Modal edición */}
      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
                <h3 className="font-bold text-lg">Editar: {editing.display_name}</h3>
                <button onClick={() => setEditing(null)} className="p-2 rounded-lg hover:bg-gray-100">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Nombre</label>
                  <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Rol</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white">
                    <option value="tecnico">Técnico</option>
                    <option value="ventas">Ventas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1"><Phone size={14} /> WhatsApp</label>
                  <input value={form.whatsapp_phone} onChange={e => setForm(p => ({ ...p, whatsapp_phone: e.target.value }))}
                    placeholder="+56 9 1234 5678" className="w-full px-3 py-2.5 rounded-xl border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1"><MapPin size={14} /> Dirección</label>
                  <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="Dirección" className="w-full px-3 py-2.5 rounded-xl border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">RUT</label>
                  <input value={form.rut} onChange={e => setForm(p => ({ ...p, rut: e.target.value }))}
                    placeholder="XX.XXX.XXX-X" className="w-full px-3 py-2.5 rounded-xl border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">AFP</label>
                  <input value={form.afp} onChange={e => setForm(p => ({ ...p, afp: e.target.value }))}
                    placeholder="Ej: Habitat, Capital, Modelo" className="w-full px-3 py-2.5 rounded-xl border text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1"><Heart size={14} /> Sistema de salud</label>
                  <select value={form.health_system} onChange={e => setForm(p => ({ ...p, health_system: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border text-sm bg-white">
                    {HEALTH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {form.health_system === 'isapre' && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Isapre</label>
                    <input value={form.health_organization} onChange={e => setForm(p => ({ ...p, health_organization: e.target.value }))}
                      placeholder="Nombre Isapre" className="w-full px-3 py-2.5 rounded-xl border text-sm" />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1 flex items-center gap-1"><AlertCircle size={14} /> Contacto emergencia</label>
                  <input value={form.emergency_contact_phone} onChange={e => setForm(p => ({ ...p, emergency_contact_phone: e.target.value }))}
                    placeholder="+56 9 1234 5678" className="w-full px-3 py-2.5 rounded-xl border text-sm" />
                </div>
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-sm text-corporate-blue flex items-center gap-1 mb-2"><CreditCard size={14} /> Preferencias de pago</h4>
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs text-text-secondary mb-0.5">Banco</label>
                      <select value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border text-sm bg-white">
                        <option value="">Seleccionar...</option>
                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-0.5">Tipo cuenta</label>
                      <select value={form.bank_account_type} onChange={e => setForm(p => ({ ...p, bank_account_type: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border text-sm bg-white">
                        <option value="">Seleccionar...</option>
                        {ACCOUNT_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-text-secondary mb-0.5">N° Cuenta</label>
                      <input value={form.bank_account_number} onChange={e => setForm(p => ({ ...p, bank_account_number: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border text-sm" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setEditing(null)} className="flex-1 py-2.5 border rounded-xl font-medium">
                    Cancelar
                  </button>
                  <button type="submit" className="flex-1 py-2.5 bg-corporate-blue text-white rounded-xl font-medium flex items-center justify-center gap-2">
                    <Save size={18} /> Guardar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
