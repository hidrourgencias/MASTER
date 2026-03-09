import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileSignature, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

export default function Quotes() {
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  useEffect(() => {
    loadQuotes();
  }, []);

  const loadQuotes = async () => {
    try {
      const data = await api.getQuotes();
      setQuotes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'aprobada':
        return <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle size={12} /> Aprobada</span>;
      case 'declinada':
        return <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium flex items-center gap-1"><XCircle size={12} /> Declinada</span>;
      case 'correccion':
        return <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium flex items-center gap-1"><AlertCircle size={12} /> Corrección</span>;
      default:
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1"><Clock size={12} /> Pendiente</span>;
    }
  };

  const filteredQuotes = quotes.filter(q => 
    q.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    q.id.toString().includes(searchTerm) ||
    (q.folio && q.folio.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-corporate-blue flex items-center gap-2">
          <FileSignature size={24} /> Cotizaciones
        </h1>
        <button
          onClick={() => navigate('/cotizaciones/nueva')}
          className="bg-corporate-light text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm hover:opacity-90 transition"
        >
          <Plus size={18} /> Nueva
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar por cliente o folio..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-corporate-light bg-white shadow-sm text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center py-8 text-text-secondary">Cargando...</div>
      ) : filteredQuotes.length === 0 ? (
        <div className="text-center py-8 text-text-secondary bg-white rounded-2xl border border-border-light">No hay cotizaciones.</div>
      ) : (
        <div className="space-y-3">
          {filteredQuotes.map((q) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => navigate(`/cotizaciones/editar/${q.id}`)}
              className="bg-white p-4 rounded-2xl border border-border-light shadow-sm hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-corporate-blue">{q.folio ? `N° ${q.folio}` : `#${q.id}`}</span>
                  {getStatusBadge(q.status)}
                  {q.work_order_id && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">OT #{q.work_order_id}</span>}
                </div>
                <h3 className="font-semibold text-text-main">{q.client_name}</h3>
                <p className="text-sm text-text-secondary">{new Date(q.created_at).toLocaleDateString('es-CL')}</p>
                {isAdmin && <p className="text-xs text-gray-400 mt-1">Vendedor: {q.creator_name}</p>}
              </div>
              
              <div className="flex flex-col sm:items-end justify-center">
                <span className="text-lg font-bold text-corporate-blue">${Number(q.total).toLocaleString('es-CL')}</span>
                {q.admin_notes && (
                  <p className="text-xs text-orange-600 mt-1 line-clamp-1 max-w-[200px]">Nota Admin: {q.admin_notes}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}