import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Send, MessageCircle, Clock, Check, X, ChevronDown, ChevronUp, AlertTriangle, Phone } from 'lucide-react';
import { api } from '../services/api';

const ATTENTION_LABELS: Record<string, string> = {
  urgencia_coordinar: 'Urgencia - Coordinar con cliente',
  cotizacion: 'Cotización',
  visita_tecnica: 'Visita técnica'
};

const ESCALATION_MSG = 'Recordatorio: Por favor confirma recepción del ticket de orden de trabajo.';

function buildWhatsAppWorkOrderMsg(wo: any) {
  return `*Orden de Trabajo - Hidrourgencias SpA*\n\n` +
    `Se ha generado una solicitud de servicio.\n\n` +
    `*Tipo atención:* ${ATTENTION_LABELS[wo.attention_type] || wo.attention_type}\n` +
    `*Servicio:* ${wo.service_type_name || '-'}\n` +
    `*Cliente:* ${wo.client_name}\n` +
    `*Teléfono:* ${wo.client_phone || '-'}\n` +
    `*Dirección:* ${wo.address || '-'}\n` +
    `*Horario:* ${wo.schedule || '-'}\n\n` +
    `Por favor confirma recepción en la app.`;
}

function openWhatsApp(phone: string, text: string) {
  const p = String(phone || '').replace(/\D/g, '');
  const num = p.startsWith('56') ? p : '56' + p;
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank');
}

export default function AdminWorkOrders() {
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [attentionTypes, setAttentionTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newSvcName, setNewSvcName] = useState('');
  const [form, setForm] = useState({
    attention_type: 'urgencia_coordinar',
    service_type_id: '',
    client_name: '',
    client_phone: '',
    address: '',
    schedule: '',
    technician_ids: [] as number[]
  });
  const [saving, setSaving] = useState(false);
  const [sendModal, setSendModal] = useState<{ wo: any; selected: number[] } | null>(null);
  const [reasignModal, setReasignModal] = useState<{ wo: any; assignment: any } | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>(''); // '' = todas, pendiente_confirmacion, confirmada, rechazada, escalada

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function load(): Promise<any[]> {
    try {
      const [o, st, tech, at] = await Promise.all([
        api.getWorkOrders(),
        api.getWorkOrderServiceTypes(),
        api.getTechnicians(),
        api.getWorkOrderAttentionTypes()
      ]);
      setOrders(o);
      setServiceTypes(st);
      setTechnicians(tech);
      setAttentionTypes(at);
      const state = location.state as any;
      const expandWoId = state?.expandWoId;
      const prefillQuote = state?.prefillFromQuote;
      if (expandWoId && o.some((wo: any) => wo.id === expandWoId)) {
        setExpanded(expandWoId);
        navigate(location.pathname, { replace: true, state: {} });
      } else if (prefillQuote) {
        setForm(p => ({
          ...p,
          attention_type: 'cotizacion',
          client_name: prefillQuote.client_name || '',
          client_phone: prefillQuote.client_phone || '',
          address: prefillQuote.client_address || '',
          schedule: ''
        }));
        setShowForm(true);
        navigate(location.pathname, { replace: true, state: {} });
      }
      return o || [];
    } catch (e) { console.error(e); }
    setLoading(false);
    return [];
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_name?.trim()) return alert('Nombre del cliente requerido');
    setSaving(true);
    try {
      const wo = await api.createWorkOrder({
        ...form,
        technician_ids: form.technician_ids
      });
      setForm({ attention_type: 'urgencia_coordinar', service_type_id: '', client_name: '', client_phone: '', address: '', schedule: '', technician_ids: [] });
      setShowForm(false);
      load();
    } catch (err: any) {
      alert(err.message || 'Error al crear');
    }
    setSaving(false);
  }

  function toggleTech(id: number) {
    setForm(p => ({
      ...p,
      technician_ids: p.technician_ids.includes(id) ? p.technician_ids.filter(x => x !== id) : [...p.technician_ids, id]
    }));
  }

  function sendToClient(wo: any) {
    const text = `Se ha generado una solicitud de servicio.\nCliente: ${wo.client_name}\nDirección: ${wo.address || '-'}\nHorario: ${wo.schedule || '-'}`;
    const phone = wo.client_phone || '';
    if (phone) openWhatsApp(phone, text);
    else alert('Agregue teléfono del cliente para enviar WhatsApp');
  }

  function openSendModal(wo: any) {
    const ids = (wo.assignments || []).filter((a: any) => a.whatsapp_phone).map((a: any) => a.technician_id);
    setSendModal({ wo, selected: ids });
  }

  function toggleSendTech(techId: number) {
    if (!sendModal) return;
    const has = sendModal.selected.includes(techId);
    setSendModal({
      ...sendModal,
      selected: has ? sendModal.selected.filter(x => x !== techId) : [...sendModal.selected, techId]
    });
  }

  async function confirmSendToTechnicians() {
    if (!sendModal) return;
    try {
      const { links } = await api.getWorkOrderWhatsAppLinks(sendModal.wo.id);
      const toSend = (sendModal.wo.assignments || []).filter((a: any) => sendModal.selected.includes(a.technician_id));
      for (const a of toSend) {
        const linkData = links.find((l: any) => l.technician_id === a.technician_id);
        if (linkData?.wa_url) window.open(linkData.wa_url, '_blank');
        else if (a.whatsapp_phone) openWhatsApp(a.whatsapp_phone, buildWhatsAppWorkOrderMsg(sendModal.wo));
      }
      await api.sendWorkOrder(sendModal.wo.id);
      load();
    } catch (e: any) {
      alert(e.message || 'Error al enviar');
    }
    setSendModal(null);
  }

  function getElapsedMin(created: string) {
    if (!created) return 0;
    return (Date.now() - new Date(created).getTime()) / 60000;
  }

  const [escalamientoMin, setEscalamientoMin] = useState(10);
  const [recordatorioMin, setRecordatorioMin] = useState(5);

  useEffect(() => {
    api.getSettings().then((s: any) => {
      const r = parseInt(s?.tiempo_recordatorio_minutos, 10);
      const e = parseInt(s?.tiempo_escalamiento_minutos, 10);
      if (!isNaN(r)) setRecordatorioMin(r);
      if (!isNaN(e)) setEscalamientoMin(e);
    }).catch(() => {});
  }, []);

  function getCountdown(assignment: any) {
    const status = assignment.assignment_status || 'pendiente_confirmacion';
    if (['confirmada', 'rechazada', 'escalada'].includes(status)) return null;
    const sent = assignment.sent_at || assignment.created_at;
    const elapsed = getElapsedMin(sent);
    if (assignment.read_at) return null;
    if (elapsed >= escalamientoMin) return { min: 0, overdue: true };
    return { min: Math.max(0, Math.ceil(escalamientoMin - elapsed)), overdue: false };
  }

  const STATUS_LABELS: Record<string, string> = {
    pendiente_confirmacion: 'Pendiente',
    confirmada: 'Confirmada',
    rechazada: 'Rechazada',
    escalada: 'Escalada'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-corporate-light border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-corporate-blue">Órdenes de Trabajo</h1>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1 bg-corporate-light text-white px-4 py-2 rounded-xl text-sm font-semibold">
          <Plus size={18} /> Nueva orden
        </button>
      </div>

      {/* Add service type */}
      <div className="flex flex-wrap gap-2">
        <input value={newSvcName} onChange={e => setNewSvcName(e.target.value)} placeholder="Nuevo tipo de servicio (destape alcantarillado, WC, etc.)"
          className="flex-1 min-w-[180px] px-3 py-2 rounded-xl border text-sm" />
        <button onClick={async () => {
          if (!newSvcName.trim()) return;
          try { await api.createWorkOrderServiceType(newSvcName.trim()); setNewSvcName(''); load(); } catch (e: any) { alert(e.message || 'Error'); }
        }} className="px-3 py-2 bg-gray-200 rounded-xl text-sm font-medium">Añadir</button>
        <button onClick={async () => {
          try { const r = await api.syncWorkOrderServiceTypes(); alert((r as any)?.message || 'Listo'); load(); } catch (e: any) { alert(e.message || 'Error'); }
        }} className="px-3 py-2 bg-blue-100 text-blue-800 rounded-xl text-sm font-medium">Cargar desde catálogo</button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.form onSubmit={handleCreate} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-xl p-4 shadow-sm border space-y-3 overflow-hidden">
            <h2 className="font-semibold text-corporate-blue">Crear orden de trabajo</h2>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Tipo de atención *</label>
              <select value={form.attention_type} onChange={e => setForm(p => ({ ...p, attention_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border text-sm">
                {attentionTypes.map((a: any) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Servicio a ejecutar</label>
              <select value={form.service_type_id} onChange={e => setForm(p => ({ ...p, service_type_id: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border text-sm">
                <option value="">Seleccionar...</option>
                {serviceTypes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Cliente *</label>
              <input value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border text-sm" placeholder="Nombre" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Teléfono contacto</label>
              <input value={form.client_phone} onChange={e => setForm(p => ({ ...p, client_phone: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border text-sm" placeholder="+56 9 1234 5678" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Dirección</label>
              <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border text-sm" placeholder="Dirección" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Horario</label>
              <input value={form.schedule} onChange={e => setForm(p => ({ ...p, schedule: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border text-sm" placeholder="Ej: 9:00 - 13:00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Técnicos (selección múltiple)</label>
              <div className="flex flex-wrap gap-2">
                {technicians.map(t => (
                  <button key={t.id} type="button" onClick={() => toggleTech(t.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm border ${form.technician_ids.includes(t.id) ? 'bg-corporate-light text-white border-corporate-light' : 'bg-white border-gray-200'}`}>
                    {t.display_name} {t.whatsapp_phone && `(${t.whatsapp_phone})`}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-corporate-blue text-white rounded-xl font-medium">
                {saving ? 'Guardando...' : 'Crear orden'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 border rounded-xl">Cancelar</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Filtro por estado */}
      <div className="flex flex-wrap gap-2">
        {[
          { value: '', label: 'Todas' },
          { value: 'pendiente_confirmacion', label: 'Pendientes' },
          { value: 'confirmada', label: 'Confirmadas' },
          { value: 'rechazada', label: 'Rechazadas' },
          { value: 'escalada', label: 'Escaladas' }
        ].map(({ value, label }) => (
          <button
            key={value || 'all'}
            onClick={() => setFilterStatus(value)}
            className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${
              filterStatus === value ? 'bg-corporate-blue text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {orders
          .filter(wo => {
            if (!filterStatus) return true;
            return (wo.assignments || []).some((a: any) => (a.assignment_status || 'pendiente_confirmacion') === filterStatus);
          })
          .map(wo => (
          <motion.div key={wo.id} layout className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <button onClick={() => setExpanded(expanded === wo.id ? null : wo.id)} className="w-full p-4 flex items-start justify-between text-left">
              <div>
                <p className="font-semibold">{wo.client_name}</p>
                <p className="text-xs text-text-secondary">{ATTENTION_LABELS[wo.attention_type]} · {wo.service_type_name || '-'}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); sendToClient(wo); }} className="p-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366]" title="WhatsApp al cliente">
                  <MessageCircle size={18} />
                </button>
                {expanded === wo.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
            </button>

            {expanded === wo.id && (
              <div className="border-t p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><span className="text-text-secondary">Teléfono:</span> {wo.client_phone || '-'}</p>
                  <p><span className="text-text-secondary">Horario:</span> {wo.schedule || '-'}</p>
                  <p className="col-span-2"><span className="text-text-secondary">Dirección:</span> {wo.address || '-'}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openSendModal(wo)} className="flex items-center gap-1 px-4 py-2.5 bg-[#25D366] text-white rounded-xl text-sm font-semibold shadow-sm hover:bg-[#20BD5A]">
                    <Send size={18} /> Enviar orden por WhatsApp
                  </button>
                  {wo.client_phone && (
                    <button onClick={() => sendToClient(wo)} className="flex items-center gap-1 px-3 py-2 border border-[#25D366] text-[#25D366] rounded-xl text-sm font-medium hover:bg-[#25D366]/5">
                      <MessageCircle size={16} /> Enviar al cliente
                    </button>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-text-secondary mb-2">Estado de recepción</p>
                  <div className="space-y-2">
                    {wo.assignments?.map((a: any) => {
                      const cd = getCountdown(a);
                      const status = a.assignment_status || 'pendiente_confirmacion';
                      const received = ['confirmada'].includes(status) || !!a.read_at;
                      const rejected = status === 'rechazada';
                      const escalated = status === 'escalada';
                      return (
                        <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                          <div className="flex items-center gap-3">
                            {received ? (
                              <span className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white"><Check size={16} /></span>
                            ) : rejected ? (
                              <span className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white"><X size={16} /></span>
                            ) : escalated ? (
                              <span className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white" title="Escalada"><AlertTriangle size={16} /></span>
                            ) : (
                              <span className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-white"><Clock size={16} /></span>
                            )}
                            <div>
                              <p className="font-medium text-sm">{a.technician_name}</p>
                              <p className="text-xs text-text-secondary">{a.whatsapp_phone || 'Sin WhatsApp'} · {STATUS_LABELS[status] || status}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!received && !rejected && !escalated && cd && (
                              <>
                                {cd.overdue ? (
                                  <span className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={14} /> Escalar</span>
                                ) : (
                                  <span className="text-xs text-text-secondary flex items-center gap-1"><Clock size={14} /> {cd.min} min</span>
                                )}
                                <button onClick={async () => {
                                  try {
                                    await api.escalateWorkOrderAssignment(a.id);
                                    const phone = (a.whatsapp_phone || '').replace(/\D/g, '');
                                    const num = phone.startsWith('56') ? phone : '56' + phone;
                                    if (num) window.open(`https://wa.me/${num}?text=${encodeURIComponent(ESCALATION_MSG)}`, '_blank');
                                    load();
                                  } catch {}
                                }} className="p-2 rounded-lg bg-amber-100 text-amber-700" title="Escalar y enviar recordatorio WhatsApp">
                                  <Phone size={16} />
                                </button>
                              </>
                            )}
                            {received && (
                              <>
                                <span className="text-xs text-green-600 font-medium">Confirmada</span>
                                {a.admin_approved_at ? (
                                  <span className="text-xs text-text-secondary">· Aprobada</span>
                                ) : (
                                  <div className="flex gap-1">
                                    <button onClick={async () => { try { await api.adminApproveWorkOrderAssignment(a.id, true); load(); } catch {} }} className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs">Aprobar</button>
                                    <button onClick={async () => { try { await api.adminApproveWorkOrderAssignment(a.id, false); load(); } catch {} }} className="px-2 py-1 rounded bg-red-100 text-red-700 text-xs">Desaprobar</button>
                                  </div>
                                )}
                              </>
                            )}
                            {rejected && (
                              <span className="text-xs text-red-600 font-medium">Rechazada</span>
                            )}
                            {escalated && (
                              <>
                                <span className="text-xs text-amber-600 font-medium">Escalada</span>
                                <button
                                  onClick={() => setReasignModal({ wo, assignment: a })}
                                  className="px-2 py-1 rounded-lg bg-corporate-blue text-white text-xs font-medium"
                                >
                                  Reasignar
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {orders.length === 0 && (
        <div className="bg-white rounded-xl p-8 text-center text-text-secondary">
          <Send size={40} className="mx-auto mb-2 opacity-50" />
          <p>No hay órdenes de trabajo</p>
          <button onClick={() => setShowForm(true)} className="mt-2 text-corporate-blue font-medium">Crear primera orden</button>
        </div>
      )}

      {/* Modal: Lista de contactos WhatsApp para enviar orden */}
      {sendModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">Enviar orden por WhatsApp</h3>
              <button onClick={() => setSendModal(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <p className="px-4 pt-2 text-sm text-text-secondary">Selecciona a quiénes enviar la orden</p>
            <div className="px-4 pb-2">
              <button
                type="button"
                onClick={() => {
                  const withWa = (sendModal.wo.assignments || []).filter((a: any) => a.whatsapp_phone).map((a: any) => a.technician_id);
                  setSendModal({ ...sendModal, selected: withWa });
                }}
                className="text-xs font-medium text-corporate-blue hover:underline"
              >
                Seleccionar todos los técnicos con WhatsApp
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sendModal.wo.assignments?.map((a: any) => {
                const hasWa = !!a.whatsapp_phone;
                const selected = sendModal.selected.includes(a.technician_id);
                return (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      hasWa ? (selected ? 'border-[#25D366] bg-[#25D366]/5' : 'border-gray-200 hover:bg-gray-50') : 'border-amber-200 bg-amber-50/50 opacity-80'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm">{a.technician_name}</p>
                      <p className={`text-xs ${hasWa ? 'text-green-700' : 'text-amber-700'}`}>
                        {hasWa ? a.whatsapp_phone : 'Sin WhatsApp configurado'}
                      </p>
                    </div>
                    {hasWa ? (
                      <button
                        type="button"
                        onClick={() => toggleSendTech(a.technician_id)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium ${
                          selected ? 'bg-[#25D366] text-white' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {selected ? 'Enviar' : 'No enviar'}
                      </button>
                    ) : (
                      <span className="text-xs text-amber-600">Configurar en Admin</span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t flex gap-2">
              <button
                onClick={() => setSendModal(null)}
                className="flex-1 py-2.5 border rounded-xl font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmSendToTechnicians}
                disabled={sendModal.selected.length === 0}
                className="flex-1 py-2.5 bg-[#25D366] text-white rounded-xl font-medium disabled:opacity-50"
              >
                Enviar a {sendModal.selected.length} contacto(s)
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal: Reasignar técnico (órdenes escaladas) */}
      {reasignModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-lg">Reasignar técnico</h3>
              <button onClick={() => setReasignModal(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <p className="px-4 pt-2 text-sm text-text-secondary">
              Orden #{reasignModal.wo.id} · {reasignModal.assignment.technician_name} no respondió
            </p>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {technicians
                .filter((t: any) => t.id !== reasignModal.assignment.technician_id)
                .map((t: any) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={async () => {
                      try {
                        await api.assignWorkOrderTechnician(reasignModal.wo.id, t.id);
                        setReasignModal(null);
                        const updatedOrders = await load();
                        const updated = updatedOrders.find((o: any) => o.id === reasignModal.wo.id) || reasignModal.wo;
                        setExpanded(reasignModal.wo.id);
                        setSendModal({ wo: updated, selected: [t.id] });
                      } catch (e: any) {
                        alert(e.message || 'Error al reasignar');
                      }
                    }}
                    className="w-full p-3 rounded-xl border border-gray-200 hover:bg-corporate-light/10 hover:border-corporate-light text-left"
                  >
                    <p className="font-medium text-sm">{t.display_name}</p>
                    <p className="text-xs text-text-secondary">{t.whatsapp_phone || 'Sin WhatsApp'}</p>
                  </button>
                ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
