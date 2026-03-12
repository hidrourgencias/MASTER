import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileDown, DollarSign, Clock, CheckCircle, Camera } from 'lucide-react';
import { api, getUploadsUrl } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';

function jobPhotoUrl(path: string) {
  if (!path) return '';
  return getUploadsUrl(path.startsWith('jobs/') ? path : `jobs/${path}`);
}

export default function MisLiquidaciones() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const j = await api.getJobs();
      setJobs(j);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleDownloadComprobante(jobId: number) {
    setDownloading(jobId);
    try {
      await api.downloadComprobantePdf(jobId);
    } catch (e: any) {
      alert(e.message || 'Error al descargar');
    }
    setDownloading(null);
  }

  const pagados = jobs.filter(j => j.technician_paid === 1 || j.ticket_status === 'pago_registrado' || j.ticket_status === 'aprobado');
  const pendientes = jobs.filter(j => j.ticket_status === 'pendiente' || (j.technician_paid !== 1 && j.photos?.length > 0));
  const totalGanado = pagados.reduce((s, j) => s + Number(j.technician_payment || 0), 0);
  const totalPendiente = pendientes.reduce((s, j) => s + Number(j.technician_payment || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-corporate-light border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-corporate-blue">Mis Liquidaciones</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border-light">
          <p className="text-xs text-text-secondary flex items-center gap-1"><CheckCircle size={14} /> Tickets pagados</p>
          <p className="font-bold text-green-600 text-lg">{pagados.length}</p>
          <p className="text-sm font-semibold text-corporate-blue">{formatCurrency(totalGanado)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-border-light">
          <p className="text-xs text-text-secondary flex items-center gap-1"><Clock size={14} /> Tickets pendientes</p>
          <p className="font-bold text-amber-600 text-lg">{pendientes.length}</p>
          <p className="text-sm font-semibold">{formatCurrency(totalPendiente)}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
        <p className="text-sm font-medium text-text-secondary">Total ganado</p>
        <p className="text-2xl font-bold text-green-600">{formatCurrency(totalGanado)}</p>
      </div>

      <div>
        <h2 className="font-semibold text-sm text-corporate-blue mb-2 flex items-center gap-2">
          <FileDown size={16} /> Descargar comprobantes
        </h2>
        <div className="space-y-2">
          {pagados.filter(j => Number(j.technician_payment || 0) > 0).map(job => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-3 rounded-xl border border-border-light bg-white"
            >
              {job.photos?.[0] ? (
                <img src={jobPhotoUrl(job.photos[0].image_path)} alt="" className="w-12 h-12 object-cover rounded-lg" />
              ) : (
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Camera size={20} className="text-gray-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{job.client_name}</p>
                <p className="text-xs text-text-secondary">{job.job_service_name} · {formatDate(job.date)}</p>
                <p className="text-xs font-semibold text-green-600">{formatCurrency(Number(job.technician_payment || 0))}</p>
              </div>
              <button
                onClick={() => handleDownloadComprobante(job.id)}
                disabled={downloading === job.id}
                className="flex items-center gap-1 px-3 py-2 bg-corporate-blue text-white rounded-lg text-sm font-medium hover:bg-[#002244] disabled:opacity-50"
              >
                <FileDown size={16} />
                {downloading === job.id ? '...' : 'PDF'}
              </button>
            </motion.div>
          ))}
          {pagados.filter(j => Number(j.technician_payment || 0) > 0).length === 0 && (
            <p className="text-sm text-text-secondary py-4 text-center">No hay comprobantes disponibles</p>
          )}
        </div>
      </div>
    </div>
  );
}
