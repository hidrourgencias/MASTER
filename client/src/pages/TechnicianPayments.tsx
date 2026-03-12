import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DollarSign, Check, Camera, ChevronDown, ChevronUp, Download, FileText, X, FileDown } from 'lucide-react';
import { api, getUploadsUrl } from '../services/api';
import { formatCurrency, formatDate, clientTypeLabel } from '../utils/format';

function jobPhotoUrl(path: string) {
  if (!path) return '';
  return getUploadsUrl(path.startsWith('jobs/') ? path : `jobs/${path}`);
}

export default function TechnicianPayments() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const VALID_SCHEDULES = ['inmediato_transferencia', 'inmediato_efectivo', 'pendiente_credito', 'pendiente', 'garantia', '1_dia', '5_dias', '15_dias', '30_dias', '45_dias'];
  const SCHEDULE_LABELS: Record<string, string> = {
    inmediato_transferencia: 'Pago transferencia inmediata',
    inmediato_efectivo: 'Pago en efectivo',
    pendiente_credito: 'Pendiente por trabajo a créditos',
    pendiente: 'Pendiente',
    garantia: 'No pago por garantía',
    '1_dia': '1 día', '5_dias': '5 días', '15_dias': '15 días', '30_dias': '30 días', '45_dias': '45 días'
  };
  const [form, setForm] = useState({ amount: '', technician_payment: '', admin_payment_method: '', admin_payment_schedule: 'pendiente' as string, admin_payment_notes: '' });
  const [filter, setFilter] = useState<'pending' | 'paid' | 'all'>('pending');
  const [exporting, setExporting] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<{ id: number; name: string }[]>([]);
  const [markPaidModal, setMarkPaidModal] = useState<{ jobId: number } | null>(null);
  const [markPaidMethod, setMarkPaidMethod] = useState<'Efectivo' | 'Transferencia'>('Transferencia');
  const [confirmarPagoModal, setConfirmarPagoModal] = useState<{ job: any } | null>(null);
  const [confirmarForm, setConfirmarForm] = useState({ monto_pago_tecnico: '', metodo_pago: 'por_pagar' });
  const [generatingPdf, setGeneratingPdf] = useState<number | null>(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    api.getPaymentMethods().then(setPaymentMethods).catch(() => []);
  }, []);

  async function load() {
    try {
      const [j, s] = await Promise.all([api.getJobs(), api.getJobSummary()]);
      setJobs(j);
      setSummary(s);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleApprove(jobId: number) {
    try {
      const schedule = VALID_SCHEDULES.includes(form.admin_payment_schedule) ? form.admin_payment_schedule : '1_dia';
      await api.approveJob(jobId, {
        amount: form.amount ? parseFloat(form.amount) : undefined,
        technician_payment: form.technician_payment ? parseFloat(form.technician_payment) : undefined,
        admin_payment_method: form.admin_payment_method,
        admin_payment_schedule: schedule,
        admin_payment_notes: form.admin_payment_notes
      });
      setEditing(null);
      setForm({ amount: '', technician_payment: '', admin_payment_method: '', admin_payment_schedule: 'pendiente', admin_payment_notes: '' });
      load();
    } catch (e: any) {
      alert(e.message || 'Error');
    }
  }

  async function handleSetPayment(jobId: number) {
    try {
      const schedule = VALID_SCHEDULES.includes(form.admin_payment_schedule) ? form.admin_payment_schedule : '1_dia';
      await api.setJobPaymentFull(jobId, {
        amount: form.amount ? parseFloat(form.amount) : undefined,
        technician_payment: form.technician_payment ? parseFloat(form.technician_payment) : undefined,
        admin_payment_method: form.admin_payment_method,
        admin_payment_schedule: schedule,
        admin_payment_notes: form.admin_payment_notes
      });
      setEditing(null);
      setForm({ amount: '', technician_payment: '', admin_payment_method: '', admin_payment_schedule: 'pendiente', admin_payment_notes: '' });
      load();
    } catch (e: any) {
      alert(e.message || 'Error');
    }
  }

  async function markPaid(jobId: number, method?: 'Efectivo' | 'Transferencia') {
    try {
      await api.markJobPaid(jobId, method ? { admin_payment_method: method } : undefined);
      setMarkPaidModal(null);
      load();
    } catch (e: any) {
      alert(e.message || 'Error');
    }
  }

  async function handleConfirmarPago() {
    if (!confirmarPagoModal) return;
    try {
      await api.confirmarPago(confirmarPagoModal.job.id, {
        monto_pago_tecnico: parseFloat(confirmarForm.monto_pago_tecnico) || 0,
        metodo_pago: confirmarForm.metodo_pago
      });
      setConfirmarPagoModal(null);
      setConfirmarForm({ monto_pago_tecnico: '', metodo_pago: 'por_pagar' });
      load();
    } catch (e: any) {
      alert(e.message || 'Error');
    }
  }

  async function handleGenerarComprobante(jobId: number) {
    setGeneratingPdf(jobId);
    try {
      await api.generarComprobante(jobId);
      await api.downloadComprobantePdf(jobId);
    } catch (e: any) {
      alert(e.message || 'Error al generar comprobante');
    }
    setGeneratingPdf(null);
  }

  async function exportPayments() {
    setExporting(true);
    try {
      await api.exportPaymentsExcel({});
    } catch (e: any) {
      alert(e.message || 'Error al exportar');
    }
    setExporting(false);
  }

  const filtered = jobs.filter(j => {
    if (filter === 'pending') return j.ticket_status === 'pendiente' || (j.technician_paid !== 1 && j.photos?.length > 0);
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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-corporate-blue">Pagos a Técnicos</h1>
        <div className="flex gap-2">
          <Link to="/admin/auditoria-pagos" className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
            <FileText size={16} /> Auditoría
          </Link>
          <button onClick={exportPayments} disabled={exporting}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 disabled:opacity-50">
            <Download size={16} /> Pagos
          </button>
          <button onClick={async () => { setExporting(true); try { await api.exportContableExcel({}); } catch (e: any) { alert(e.message || 'Error'); } setExporting(false); }} disabled={exporting}
            className="flex items-center gap-1 px-3 py-1.5 bg-corporate-blue text-white rounded-lg text-sm hover:bg-[#002244] disabled:opacity-50">
            <FileText size={16} /> Planilla Contable
          </button>
        </div>
      </div>

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
            <p className="text-xs text-text-secondary">Pend. aprobación</p>
            <p className="font-bold text-corporate-blue">{summary.pendingApproval || 0}</p>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(['pending', 'paid', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filter === f ? 'bg-corporate-blue text-white' : 'bg-gray-100 text-text-secondary hover:bg-gray-200'
            }`}>
            {f === 'pending' ? 'Pendientes' : f === 'paid' ? 'Pagados' : 'Todos'}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {Object.entries(byTechnician).map(([techName, techJobs]) => {
          const totalPending = techJobs.filter(j => j.technician_paid !== 1).reduce((s, j) => s + Number(j.technician_payment || 0), 0);
          const totalPaid = techJobs.filter(j => j.technician_paid === 1).reduce((s, j) => s + Number(j.technician_payment || 0), 0);

          return (
            <motion.div key={techName} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl shadow-sm border border-border-light overflow-hidden">
              <button onClick={() => setExpanded(expanded === techJobs[0]?.technician_id ? null : techJobs[0]?.technician_id)}
                className="w-full p-4 flex items-center justify-between text-left">
                <div>
                  <p className="font-semibold">{techName}</p>
                  <p className="text-xs text-text-secondary">
                    {techJobs.length} ticket(s) · Pendiente: {formatCurrency(totalPending)} · Pagado: {formatCurrency(totalPaid)}
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
                          <img src={jobPhotoUrl(job.photos[0].image_path)} alt="" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />
                        ) : (
                          <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Camera size={24} className="text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{job.client_name}</p>
                          <p className="text-xs text-text-secondary">{job.job_service_name} · {formatDate(job.date)}</p>
                          <p className="text-xs text-text-secondary">{clientTypeLabel(job.client_type)}
                            {job.is_garantia === 1 && <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px]">Garantía</span>}
                            {job.client_status === 'pagado' && <span className="ml-1 px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px]">Cliente pagó</span>}
                            {job.client_status === 'pendiente_pago' && <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px]">Pend. pago cliente</span>}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {(editing === job.id || confirmarPagoModal?.job?.id === job.id) ? (
                            confirmarPagoModal?.job?.id === job.id ? (
                              <div className="space-y-2 text-right bg-blue-50 -m-2 p-3 rounded-lg border border-blue-200">
                                <p className="text-xs font-semibold text-corporate-blue">Asignación de Pago al Técnico</p>
                                <input type="number" placeholder="Monto pago técnico" value={confirmarForm.monto_pago_tecnico} onChange={e => setConfirmarForm(p => ({ ...p, monto_pago_tecnico: e.target.value }))}
                                  className="w-32 px-2 py-1 rounded border text-sm" />
                                <select value={confirmarForm.metodo_pago} onChange={e => setConfirmarForm(p => ({ ...p, metodo_pago: e.target.value }))}
                                  className="w-36 px-2 py-1 rounded border text-sm">
                                  <option value="efectivo">Efectivo</option>
                                  <option value="transferencia">Transferencia</option>
                                  <option value="contado">Contado</option>
                                  <option value="pagado">Pagado</option>
                                  <option value="por_pagar">Por pagar</option>
                                </select>
                                <div className="flex gap-1 justify-end pt-1">
                                  <button onClick={() => { setConfirmarPagoModal(null); setConfirmarForm({ monto_pago_tecnico: '', metodo_pago: 'por_pagar' }); }} className="text-xs bg-gray-400 text-white px-2 py-1 rounded">Cancelar</button>
                                  <button onClick={handleConfirmarPago} className="text-xs bg-green-600 text-white px-2 py-1 rounded font-semibold">Confirmar Pago</button>
                                </div>
                              </div>
                            ) : (
                            <div className="space-y-2 text-right">
                              <input type="number" placeholder="Cobro cliente" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                                className="w-28 px-2 py-1 rounded border text-sm" />
                              <input type="number" placeholder="Pago técnico" value={form.technician_payment} onChange={e => setForm(p => ({ ...p, technician_payment: e.target.value }))}
                                className="w-28 px-2 py-1 rounded border text-sm" />
                              <select value={form.admin_payment_method} onChange={e => setForm(p => ({ ...p, admin_payment_method: e.target.value }))}
                                className="w-28 px-2 py-1 rounded border text-sm">
                                <option value="">Método pago</option>
                                {paymentMethods.map(pm => (
                                  <option key={pm.id} value={pm.name}>{pm.name}</option>
                                ))}
                              </select>
                              <select value={form.admin_payment_schedule} onChange={e => setForm(p => ({ ...p, admin_payment_schedule: e.target.value }))}
                                className="w-48 px-2 py-1 rounded border text-sm">
                                <option value="inmediato_transferencia">Pago transferencia inmediata</option>
                                <option value="inmediato_efectivo">Pago en efectivo</option>
                                <option value="pendiente_credito">Pendiente por trabajo a créditos</option>
                                <option value="pendiente">Pendiente</option>
                                <option value="garantia">No pago por garantía</option>
                                <option value="1_dia">1 día</option>
                                <option value="5_dias">5 días</option>
                                <option value="15_dias">15 días</option>
                                <option value="30_dias">30 días</option>
                                <option value="45_dias">45 días</option>
                              </select>
                              <input type="text" placeholder="Observaciones pago" value={form.admin_payment_notes} onChange={e => setForm(p => ({ ...p, admin_payment_notes: e.target.value }))}
                                className="w-28 px-2 py-1 rounded border text-sm" />
                              <div className="flex gap-1 justify-end">
                                {job.ticket_status === 'pendiente' ? (
                                  <button onClick={() => handleApprove(job.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded">Aprobar</button>
                                ) : (
                                  <button onClick={() => handleSetPayment(job.id)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Guardar</button>
                                )}
                                <button onClick={() => { setEditing(null); setForm({ amount: '', technician_payment: '', admin_payment_method: '', admin_payment_schedule: 'pendiente', admin_payment_notes: '' }); }}
                                  type="button" className="text-xs bg-gray-400 text-white px-2 py-1 rounded hover:bg-gray-500">Cancelar</button>
                              </div>
                            </div>
                            )
                          ) : (
                            <>
                              {job.is_garantia === 1 ? (
                                <span className="text-xs font-medium px-2 py-1 rounded bg-gray-200 text-gray-600">Garantía (sin pago)</span>
                              ) : (
                                <>
                                  <p className="font-bold text-corporate-blue">{formatCurrency(Number(job.technician_payment || 0))}</p>
                                  {job.admin_payment_notes && <p className="text-xs text-text-secondary max-w-[120px] truncate" title={job.admin_payment_notes}>{job.admin_payment_notes}</p>}
                                  {!job.technician_paid ? (
                                    <div className="flex gap-1 flex-wrap">
                                      <button onClick={() => { setEditing(job.id); const s = job.admin_payment_schedule; setForm({
                                        amount: String(job.amount || ''),
                                        technician_payment: String(job.technician_payment || ''),
                                        admin_payment_method: job.admin_payment_method || '',
                                        admin_payment_schedule: VALID_SCHEDULES.includes(s) ? s : 'pendiente',
                                        admin_payment_notes: job.admin_payment_notes || ''
                                      }); }}
                                        className="text-xs text-corporate-blue hover:underline flex items-center gap-0.5">
                                        <DollarSign size={12} /> Asignar
                                      </button>
                                      {Number(job.technician_payment || 0) > 0 && (
                                        <button onClick={() => { setMarkPaidModal({ jobId: job.id }); setMarkPaidMethod('Transferencia'); }} className="text-xs text-green-600 hover:underline flex items-center gap-0.5">
                                          <Check size={12} /> Pagar
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-green-600 font-medium">Pagado {job.admin_payment_method ? `(${job.admin_payment_method})` : ''}</span>
                                  )}
                                  {['pago_registrado', 'aprobado'].includes(job.ticket_status) && Number(job.technician_payment || 0) > 0 && (
                                    <button onClick={() => handleGenerarComprobante(job.id)} disabled={generatingPdf === job.id}
                                      className="mt-1 w-full flex items-center justify-center gap-1 text-xs bg-corporate-blue text-white px-2 py-1 rounded hover:bg-[#002244] disabled:opacity-50">
                                      <FileDown size={12} /> {generatingPdf === job.id ? 'Generando...' : 'Comprobante PDF'}
                                    </button>
                                  )}
                                </>
                              )}
                              {job.ticket_status === 'pendiente' && !job.is_garantia && (
                                <button onClick={() => { setConfirmarPagoModal({ job }); setConfirmarForm({ monto_pago_tecnico: String(job.technician_payment || ''), metodo_pago: (job.admin_payment_method || 'por_pagar').toLowerCase() }); }}
                                  className="text-xs text-corporate-blue hover:underline flex items-center gap-0.5 mt-1">
                                  Asignar Pago
                                </button>
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
          <p>No hay tickets {filter === 'pending' ? 'pendientes' : filter === 'paid' ? 'pagados' : ''}</p>
        </div>
      )}

      {/* Modal: Pagar técnico - efectivo o transferencia */}
      {markPaidModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg">Registrar pago al técnico</h3>
              <button onClick={() => setMarkPaidModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-text-secondary mb-4">¿Cómo se realizó el pago al técnico?</p>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setMarkPaidMethod('Efectivo')}
                className={`flex-1 py-3 rounded-xl font-medium text-sm transition ${
                  markPaidMethod === 'Efectivo' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Efectivo
              </button>
              <button
                onClick={() => setMarkPaidMethod('Transferencia')}
                className={`flex-1 py-3 rounded-xl font-medium text-sm transition ${
                  markPaidMethod === 'Transferencia' ? 'bg-corporate-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Transferencia
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setMarkPaidModal(null)} className="flex-1 py-2.5 border rounded-xl font-medium">
                Cancelar
              </button>
              <button onClick={() => markPaid(markPaidModal.jobId, markPaidMethod)}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700">
                Confirmar pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
