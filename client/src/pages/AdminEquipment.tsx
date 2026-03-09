import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Wrench } from 'lucide-react';
import { api } from '../services/api';

const CATEGORIES = [
  { value: 'maquinaria', label: 'Maquinaria' },
  { value: 'epp', label: 'EPP / Implementos seguridad' },
  { value: 'materiales', label: 'Materiales / Insumos' }
];

export default function AdminEquipment() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('maquinaria');
  const [adding, setAdding] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setItems(await api.getAdminEquipment());
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      await api.createEquipment(newName.trim(), newCategory);
      setNewName('');
      load();
    } catch (e: any) {
      alert(e.message || 'Error');
    }
    setAdding(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Desactivar este ítem?')) return;
    try {
      await api.deleteEquipment(id);
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

  const byCategory = items.reduce((acc: Record<string, any[]>, item) => {
    const cat = item.category || 'otro';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <Wrench size={24} className="text-corporate-blue" />
        <h1 className="text-xl font-bold text-corporate-blue">Maquinaria / EPP / Materiales</h1>
      </div>
      <p className="text-sm text-text-secondary">
        Catálogo para que los técnicos indiquen qué equipos utilizaron en cada servicio. Útil para análisis de gastos y desgaste.
      </p>

      <form onSubmit={handleAdd} className="flex gap-2 flex-wrap">
        <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="Ej: Ridgid destapadora" className="flex-1 min-w-[150px] px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
        <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white">
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <button type="submit" disabled={adding || !newName.trim()}
          className="flex items-center gap-1 bg-corporate-light text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0095cc] transition disabled:opacity-50">
          <Plus size={18} /> Añadir
        </button>
      </form>

      <div className="space-y-4">
        {CATEGORIES.map(cat => (
          byCategory[cat.value]?.filter((i: any) => i.active !== 0).length > 0 && (
            <div key={cat.value} className="bg-white rounded-xl shadow-sm border border-border-light overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 font-medium text-sm">{cat.label}</div>
              <div className="divide-y divide-border-light">
                {byCategory[cat.value]?.filter((i: any) => i.active !== 0).map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between p-4">
                    <span>{item.name}</span>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
