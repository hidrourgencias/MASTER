import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Check, Camera, ChevronDown, ChevronUp } from 'lucide-react';
import { api, getUploadsUrl } from '../services/api';
import { formatCurrency, formatDate } from '../utils/format';

function jobPhotoUrl(path: string) {
  if (!path) return '';
  return getUploadsUrl(path.startsWith('jobs/') ? path : `jobs/${path}`);
}

export default function TechnicianPayments() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editingPayment, setEditingPayment] = useState<number | null>(null);
  const [paymentValue, setPaymentValue] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid'>('pending');

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

  async function savePayment(jobId: number) {
    const val = parseFloat(paymentValue.replace(/\D/g, ''));
    if (isNaN(val) || val < 0) return;
    try {
      await api.setJobPayment(jobId, val);
      setEditingPayment(null);
      setPaymentValue('');
      load();
    } catch (e: any) {
      alert(e.message || 'Error');
    }
  }

  async function markPaid(jobId: number) {
    try {
      await api.markJobPaid(jobId);
      load();
    } catch (e: any) {
      alert(e.message || 'Error');
    }
  }

  const filtered = jobs.filter(j => {
    if (filter === 'pending') return j.technician_paid !== 1 && j.photos?.length > 0;
    if (filter === 'paid') return j.technician_paid === 1;
    return true;
  });

  const byTechnician = filtered.reduce((acc: Record<string, any[]>, job) => {
    const name = job.technician_name || 'Sin nombre';
    if (!acc[name]) acc[name] = [];
    acc[name].push(job);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 border-corporate-light border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-corporate-blue">Pagos a Técnicos</h1>

      {summary && (
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm border border-border-light">
            <p className="text-xs text-text-secondary">Pendientes</p>
            <p className="font-bold text-amber-600">{formatCurrency(Number(summary.pending || 0))}</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-border-light">
            <p className="text-xs text-text-secondary">Pagados</p>
            <p className="font-bold text-green-600">{formatCurrency(Number(summary.paid || 0))}</p>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm border border-border-light">
            <p className="text-xs text-text-secondary">Total servicios</p>
            <p className="font-bold text-corporate-blue">{summary.count || 0}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(['pending', 'paid', 'all'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === f ? 'bg-corporate-blue text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}
          >
            {f === 'pending' ? 'Pendientes' : f === 'paid' ? 'Pagados' : 'Todos'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {Object.entries(byTechnician).map(([techName, techJobs]) => {
          const totalPending = techJobs.filter(j => j.technician_paid !== 1).reduce((s, j) => s + Number(j.technician_payment || 0), 0);
          const totalPaid = techJobs.filter(j => j.technician_paid === 1).reduce((s, j) => s + Number(j.technician_payment || 0), 0);

          return (
            <motion.div
              key={techName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm border border-border-light overflow-hidden"
            >
              <button
                onClick={() => setExpanded(expanded === techJobs[0]?.technician_id ? null : techJobs[0]?.technician_id)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div>
                  <p className="font-semibold">{techName}</p>
                  <p className="text-xs text-text-secondary">
                    {techJobs.length} servicio(s) · Pendiente: {formatCurrency(totalPending)} · Pagado: {formatCurrency(totalPaid)}
                  </p>
                </div>
                {expanded === techJobs[0]?.technician_id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {expanded === techJobs[0]?.technician_id && (
                <div className="border-t border-border-light divide-y divide-border-light">
                  {techJobs.map(job => (
                    <div key={job.id} className="p-4">
                      <div className="flex gap-3">
                        {job.photos?.[0] ? (
                          <img
                            src={jobPhotoUrl(job.photos[0].image_path)}
                            alt=""
                            className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Camera size={24} className="text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{job.client_name}</p>
                          <p className="text-xs text-text-secondary">
                            {job.job_service_name} · {formatDate(job.date)}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {job.client_type === 'particular' ? 'Particular' : 'Empresa'} · Cobro cliente: {formatCurrency(Number(job.amount || 0))}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {editingPayment === job.id ? (
                            <>
                              <input
                                type="number"
                                value={paymentValue}
                                onChange={e => setPaymentValue(e.target.value)}
                                placeholder="Monto"
                                className="w-24 px-2 py-1 rounded border text-sm"
                                autoFocus
                              />
                              <div className="flex gap-1">
                                <button
                                  onClick={() => savePayment(job.id)}
                                  className="text-xs bg-green-600 text-white px-2 py-1 rounded"
                                >
                                  OK
                                </button>
                                <button
                                  onClick={() => { setEditingPayment(null); setPaymentValue(''); }}
                                  className="text-xs bg-gray-400 text-white px-2 py-1 rounded"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="font-bold text-corporate-blue">
                                {formatCurrency(Number(job.technician_payment || 0))}
                              </p>
                              {!job.technician_paid ? (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => { setEditingPayment(job.id); setPaymentValue(String(job.technician_payment || '')); }}
                                    className="text-xs text-corporate-blue hover:underline flex items-center gap-0.5"
                                  >
                                    <DollarSign size={12} /> Asignar pago
                                  </button>
                                  {Number(job.technician_payment || 0) > 0 && (
                                    <button
                                      onClick={() => markPaid(job.id)}
                                      className="text-xs text-green-600 hover:underline flex items-center gap-0.5"
                                    >
                                      <Check size={12} /> Pagar
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-green-600 font-medium">Pagado</span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center text-text-secondary">
          <DollarSign size={40} className="mx-auto mb-2 opacity-50" />
          <p>No hay servicios {filter === 'pending' ? 'pendientes de pago' : filter === 'paid' ? 'pagados' : ''}</p>
        </div>
      )}
    </div>
  );
}
