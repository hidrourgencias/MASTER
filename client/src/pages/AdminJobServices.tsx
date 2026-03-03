import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Wrench } from 'lucide-react';
import { api } from '../services/api';

export default function AdminJobServices() {
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setServices(await api.getAdminJobServices());
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await api.createJobService(newName.trim());
      setNewName('');
      load();
    } catch (e: any) {
      alert(e.message || 'Error');
    }
    setAdding(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Desactivar este tipo de servicio? No se eliminará, solo se ocultará.')) return;
    try {
      await api.deleteJobService(id);
      load();
    } catch (e: any) {
      alert(e.message || 'Error');
    }
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
      <div className="flex items-center gap-2">
        <Wrench size={24} className="text-corporate-blue" />
        <h1 className="text-xl font-bold text-corporate-blue">Tipos de Servicio (Cobros)</h1>
      </div>
      <p className="text-sm text-text-secondary">
        Estos tipos se usan al registrar servicios ejecutados por los técnicos. El administrador puede añadir o desactivar.
      </p>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Ej: Destape de alcantarillado"
          className="flex-1 px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="flex items-center gap-1 bg-corporate-light text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0095cc] transition disabled:opacity-50"
        >
          <Plus size={18} /> Añadir
        </button>
      </form>

      <div className="bg-white rounded-xl shadow-sm border border-border-light divide-y divide-border-light">
        {services.filter(s => s.active !== 0).length === 0 ? (
          <div className="p-6 text-center text-text-secondary">No hay tipos de servicio</div>
        ) : (
          services.filter(s => s.active !== 0).map(s => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-between p-4"
            >
              <span className="font-medium">{s.name}</span>
              <button
                onClick={() => handleDelete(s.id)}
                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                title="Desactivar"
              >
                <Trash2 size={18} />
              </button>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
