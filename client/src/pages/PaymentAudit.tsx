import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';

export default function PaymentAudit() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPaymentAudit().then(setLogs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-corporate-light border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-2">
          <FileText size={24} className="text-corporate-blue" />
          <h1 className="text-xl font-bold text-corporate-blue">Auditoría de Pagos</h1>
        </div>
      </div>
      <p className="text-sm text-text-secondary">Historial independiente de operaciones de control de pago a técnicos.</p>

      <div className="bg-white rounded-xl shadow-sm border border-border-light divide-y divide-border-light max-h-[70vh] overflow-y-auto">
        {logs.length === 0 ? (
          <div className="p-6 text-center text-text-secondary">No hay registros</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium text-sm">{log.action}</p>
                  <p className="text-xs text-text-secondary mt-0.5">{log.details}</p>
                </div>
                <div className="text-right text-xs text-text-secondary">
                  <p>{log.user_name || 'Sistema'}</p>
                  <p>{formatDateTime(log.created_at)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
