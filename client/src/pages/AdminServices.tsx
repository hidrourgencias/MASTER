import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Trash2, Wrench } from 'lucide-react';
import { api } from '../services/api';

export default function AdminServices() {
  const navigate = useNavigate();
  const [services, setServices] = useState<any[]>([]);
  const [newService, setNewService] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadServices(); }, []);

  async function loadServices() {
    try { setServices(await api.getAdminServices()); } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newService.trim()) return;
    try {
      await api.createService(newService.trim());
      setNewService('');
      loadServices();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este servicio?')) return;
    try {
      await api.deleteService(id);
      loadServices();
    } catch { /* ignore */ }
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-corporate-blue">Gestión de Servicios</h1>
      </div>

      <form onSubmit={handleAdd} className="flex gap-2">
        <input value={newService} onChange={e => setNewService(e.target.value)} placeholder="Nuevo servicio..."
          className="flex-1 px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
        <button type="submit" className="bg-corporate-light text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0095cc] transition">
          <Plus size={18} />
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-8 h-8 border-3 border-corporate-light border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-2">
          {services.map(s => (
            <motion.div key={s.id} layout className="bg-white rounded-xl p-3 shadow-sm border border-border-light flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-text-secondary" />
                <span className="text-sm font-medium">{s.name}</span>
              </div>
              <button onClick={() => handleDelete(s.id)} className="p-1 text-text-secondary hover:text-danger transition">
                <Trash2 size={16} />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
