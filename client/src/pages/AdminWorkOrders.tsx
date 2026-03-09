import { useState, useEffect } from 'react';
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

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function load() {
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
    } catch (e) { console.error(e); }
    setLoading(false);
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

  function sendToTechnicians(wo: any) {
    const text = buildWhatsAppWorkOrderMsg(wo);
    wo.assignments?.forEach((a: any) => {
      const phone = a.whatsapp_phone || '';
      if (phone) openWhatsApp(phone, text);
    });
    api.sendWorkOrder(wo.id).catch(() => {});
  }

  function getElapsedMin(created: string) {
    if (!created) return 0;
    return (Date.now() - new Date(created).getTime()) / 60000;
  }

  function getCountdown(assignment: any) {
    const sent = assignment.sent_at || assignment.created_at;
    const elapsed = getElapsedMin(sent);
    if (assignment.received_at) return null;
    if (elapsed >= 10) return { min: 0, overdue: true };
    return { min: Math.max(0, Math.ceil(10 - elapsed)), overdue: false };
  }

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
      <div className="flex gap-2">
        <input value={newSvcName} onChange={e => setNewSvcName(e.target.value)} placeholder="Nuevo tipo de servicio"
          className="flex-1 px-3 py-2 rounded-xl border text-sm" />
        <button onClick={async () => {
          if (!newSvcName.trim()) return;
          try { await api.createWorkOrderServiceType(newSvcName.trim()); setNewSvcName(''); load(); } catch {}
        }} className="px-3 py-2 bg-gray-200 rounded-xl text-sm font-medium">Añadir</button>
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

      <div className="space-y-3">
        {orders.map(wo => (
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
                <div className="flex gap-2">
                  <button onClick={() => sendToTechnicians(wo)} className="flex items-center gap-1 px-3 py-2 bg-[#25D366] text-white rounded-xl text-sm font-medium">
                    <Send size={16} /> Enviar orden a técnicos (WhatsApp)
                  </button>
                </div>
                <div>
                  <p className="text-xs font-medium text-text-secondary mb-2">Estado de recepción</p>
                  <div className="space-y-2">
                    {wo.assignments?.map((a: any) => {
                      const cd = getCountdown(a);
                      const received = !!a.received_at;
                      return (
                        <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border bg-gray-50">
                          <div className="flex items-center gap-3">
                            {received ? (
                              <span className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white"><Check size={16} /></span>
                            ) : (
                              <span className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center text-white"><X size={16} /></span>
                            )}
                            <div>
                              <p className="font-medium text-sm">{a.technician_name}</p>
                              <p className="text-xs text-text-secondary">{a.whatsapp_phone || 'Sin WhatsApp'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!received && cd && (
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
                              <span className="text-xs text-green-600 font-medium">Recibido</span>
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
    </div>
  );
}
