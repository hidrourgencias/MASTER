import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Eye, Trash2, Pencil, Camera, Send, Calendar } from 'lucide-react';
import { api, getUploadsUrl } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, clientTypeLabel } from '../utils/format';

function jobPhotoUrl(path: string) {
  if (!path) return '';
  return getUploadsUrl(path.startsWith('jobs/') ? path : `jobs/${path}`);
}

export default function ServiceJobs() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState<any>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const [j, s] = await Promise.all([api.getJobs(), api.getJobSummary()]);
      setJobs(j);
      setSummary(s);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleSchedulePostventa(jobId: number) {
    try {
      const res = await api.schedulePostventa(jobId);
      if (res.googleCalendarUrl) {
        window.open(res.googleCalendarUrl, '_blank');
      }
    } catch (e: any) {
      alert(e.message || 'Error al programar postventa');
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('¿Eliminar este servicio? No se puede deshacer.')) return;
    try {
      await api.deleteJob(id);
      setJobs(prev => prev.filter(j => j.id !== id));
      load();
    } catch (e: any) {
      alert(e.message || 'Error al eliminar');
    }
  }

  const filtered = jobs.filter(j => {
    const q = search.toLowerCase();
    return !search || j.client_name?.toLowerCase().includes(q) ||
      j.job_service_name?.toLowerCase().includes(q) || j.address_comuna?.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-corporate-light border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-corporate-blue">Mis Servicios</h1>
        <Link
          to="/servicios/nuevo"
          className="flex items-center gap-1 bg-corporate-light text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-[#0095cc] transition"
        >
          <Plus size={18} /> Nuevo
        </Link>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-2">
          {isAdmin ? (
            <>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-border-light">
                <p className="text-xs text-text-secondary">Pendiente de cobro</p>
                <p className="font-bold text-corporate-blue">{formatCurrency(Number(summary.pending || 0))}</p>
              </div>
              <div className="bg-white rounded-xl p-3 shadow-sm border border-border-light">
                <p className="text-xs text-text-secondary">Pagado</p>
                <p className="font-bold text-green-600">{formatCurrency(Number(summary.paid || 0))}</p>
              </div>
            </>
            ) : (
            <div className="bg-white rounded-xl p-3 shadow-sm border border-border-light col-span-2">
              <p className="text-xs text-text-secondary">Mis servicios registrados</p>
              <p className="font-bold text-corporate-blue">{summary.myTicketsCount || summary.count || 0}</p>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por cliente, servicio, comuna..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-8 text-center text-text-secondary shadow-sm">
          <Camera size={40} className="mx-auto mb-2 opacity-50" />
          <p className="font-medium">No hay servicios registrados</p>
          <p className="text-sm mt-1">Registra tu primer servicio con fotografía obligatoria</p>
          <Link
            to="/servicios/nuevo"
            className="inline-flex items-center gap-1 mt-3 text-corporate-blue font-semibold hover:underline"
          >
            <Plus size={18} /> Crear servicio
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(job => (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-white rounded-xl p-3 shadow-sm border border-border-light"
            >
              <div className="flex items-start gap-3">
                {job.photos?.length > 0 ? (
                  <img
                    src={jobPhotoUrl(job.photos[0].image_path)}
                    alt="Servicio"
                    className="w-14 h-14 object-cover rounded-lg"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-14 h-14 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Camera size={24} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm truncate">{job.client_name}</p>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {clientTypeLabel(job.client_type)}
                    </span>
                    {job.is_garantia === 1 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                        Garantía
                      </span>
                    )}
                    {isAdmin && job.technician_paid === 1 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        Pagado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    {job.job_service_name || 'Sin tipo'} · {formatDate(job.date)}
                  </p>
                  {job.address_comuna && (
                    <p className="text-xs text-text-secondary truncate">{job.address_comuna}</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="text-right">
                    <p className="font-bold text-sm">{formatCurrency(Number(job.amount || 0))}</p>
                    {Number(job.technician_payment || 0) > 0 && (
                      <p className="text-xs text-corporate-blue font-medium">
                        Pago: {formatCurrency(Number(job.technician_payment))}
                      </p>
                    )}
                  </div>
                )}
                {!isAdmin && (
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      job.is_garantia === 1 ? 'bg-gray-200 text-gray-700' :
                      job.ticket_status === 'aprobado' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {job.is_garantia === 1 ? 'Garantía' :
                       job.ticket_status === 'aprobado' ? 'Completado' : 'En revisión'}
                    </span>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleSchedulePostventa(job.id)}
                    className="p-1.5 text-text-secondary hover:text-green-600 transition rounded-lg hover:bg-green-50"
                    title="Agendar Postventa en Google Calendar"
                  >
                    <Calendar size={18} />
                  </button>
                  <button
                    onClick={() => setPreview(job)}
                    className="p-1.5 text-text-secondary hover:text-corporate-light transition rounded-lg hover:bg-gray-100"
                    title="Ver"
                  >
                    <Eye size={18} />
                  </button>
                  {(isAdmin ? !job.technician_paid : job.ticket_status === 'pendiente') && (
                    <>
                      <button
                        onClick={() => navigate(`/servicios/editar/${job.id}`, { state: { job } })}
                        className="p-1.5 text-text-secondary hover:text-corporate-blue transition rounded-lg hover:bg-blue-50"
                        title="Editar"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(job.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 transition rounded-lg"
                        title="Eliminar"
                      >
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {preview && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50"
              onClick={() => setPreview(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-4 md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-md md:w-full bg-white rounded-2xl shadow-xl z-50 overflow-y-auto"
            >
              <div className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <h2 className="font-bold text-lg">Detalle del servicio</h2>
                  <button onClick={() => setPreview(null)} className="p-1 hover:bg-gray-100 rounded-lg">×</button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><span className="text-text-secondary">Cliente:</span> {preview.client_name}</p>
                  <p><span className="text-text-secondary">Tipo:</span> {clientTypeLabel(preview.client_type)}</p>
                  <p><span className="text-text-secondary">Servicio:</span> {preview.job_service_name}</p>
                  <p><span className="text-text-secondary">Fecha:</span> {formatDate(preview.date)}</p>
                  <p className="col-span-2"><span className="text-text-secondary">Dirección:</span> {[preview.address_street, preview.address_number, preview.address_comuna].filter(Boolean).join(', ') || '-'}</p>
                </div>
                {isAdmin && (
                  <>
                    <p className="font-bold text-corporate-blue">Cobro cliente: {formatCurrency(Number(preview.amount || 0))}</p>
                    {Number(preview.technician_payment || 0) > 0 && (
                      <p className="font-bold text-green-600">Pago técnico: {formatCurrency(Number(preview.technician_payment))}</p>
                    )}
                  </>
                )}
                {preview.photos?.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Fotografías:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {preview.photos.map((p: any) => (
                        <img key={p.id} src={jobPhotoUrl(p.image_path)} alt="" className="w-full h-24 object-cover rounded-lg" />
                      ))}
                    </div>
                  </div>
                )}
                {!isAdmin && (
                  <button onClick={() => {
                    const dir = [preview.address_street, preview.address_number, preview.address_comuna].filter(Boolean).join(', ') || '-';
                    const materialsBlock = preview.materials?.length > 0
                      ? '\n*Materiales usados:*\n' + preview.materials.map((m: any) =>
                          `• ${m.nombre_material} × ${m.cantidad || 1}`
                        ).join('\n')
                      : '';
                    const notesBlock = preview.notes ? `\n*Notas:* ${preview.notes}` : '';
                    const text = [
                      `*INFORME TÉCNICO - Hidrourgencias*`,
                      `Ticket #${preview.id}`,
                      ``,
                      `*Cliente:* ${preview.client_name}`,
                      `*Tipo:* ${clientTypeLabel(preview.client_type)}`,
                      `*RUT:* ${preview.client_rut || '-'}`,
                      `*Servicio:* ${preview.job_service_name || '-'}`,
                      `*Fecha:* ${formatDate(preview.date)}`,
                      `*Dirección:* ${dir}`,
                      materialsBlock,
                      notesBlock
                    ].filter(Boolean).join('\n');
                    const openWa = (phoneRaw: string | undefined) => {
                      const p = String(phoneRaw || '56940918672').replace(/\D/g, '');
                      const num = p.startsWith('56') ? p : '56' + p;
                      window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank');
                    };
                    api.getWhatsappNumber().then((r: any) => openWa(r?.whatsapp_number)).catch(() => openWa(undefined));
                  }} className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white rounded-xl font-semibold">
                    <Send size={18} /> Reporte de informe técnico
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
