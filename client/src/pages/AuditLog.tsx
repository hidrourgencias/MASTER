import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Shield, LogIn, Edit, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { formatDateTime } from '../utils/format';

const ACTION_ICONS: Record<string, any> = {
  LOGIN: LogIn, CHANGE_PASSWORD: Shield, CREATE_EXPENSE: Edit,
  DELETE_EXPENSE: Trash2, APPROVE_EXPENSE: FileText, PAY_EXPENSE: FileText,
  UPDATE_PROFILE: Edit, RESET_PASSWORD: Shield, UPDATE_USER: Edit
};

export default function AuditLog() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAuditLog().then(setLogs).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-corporate-blue">Historial de Auditoría</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-8 h-8 border-3 border-corporate-light border-t-transparent rounded-full animate-spin" /></div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-text-secondary shadow-sm">Sin registros</div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => {
            const Icon = ACTION_ICONS[log.action] || FileText;
            return (
              <div key={log.id} className="bg-white rounded-xl p-3 shadow-sm border border-border-light flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                  <Icon size={16} className="text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{log.details || log.action}</p>
                  <p className="text-xs text-text-secondary">{log.user_name || 'Sistema'} · {formatDateTime(log.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
