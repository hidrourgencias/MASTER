import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, ArrowLeft, X, Loader2, AlertCircle, Send } from 'lucide-react';
import { api } from '../services/api';
import { todayISO } from '../utils/format';

const PHOTO_LABELS: Record<string, string> = {
  inicial: '1. Inicial (antes de comenzar)',
  durante: '2. Durante el servicio',
  final: '3. Final (antes de retirarse)'
};

export default function NewServiceJob() {
  const navigate = useNavigate();
  const cameraRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [form, setForm] = useState({
    client_type: 'PARTICULAR',
    client_name: '',
    client_rut: '',
    address_street: '',
    address_number: '',
    address_comuna: '',
    job_service_id: '',
    date: todayISO(),
    notes: '',
    is_garantia: false
  });

  const [photos, setPhotos] = useState<Record<string, { file: File; preview: string }>>({
    inicial: null as any, durante: null as any, final: null as any
  });
  const [equipment, setEquipment] = useState<{ equipment_id: number; quantity: number }[]>([]);
  const [jobServices, setJobServices] = useState<any[]>([]);
  const [equipmentCatalog, setEquipmentCatalog] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getJobServices().then(setJobServices).catch(() => {});
    api.getEquipmentCatalog().then(setEquipmentCatalog).catch(() => {});
  }, []);

  function handlePhoto(type: string, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotos(prev => ({ ...prev, [type]: { file, preview: e.target?.result as string } }));
    };
    reader.readAsDataURL(file);
  }

  function addEquipment() {
    const first = equipmentCatalog?.find((ec: any) => ec.active !== 0) || equipmentCatalog?.[0];
    if (first) setEquipment(prev => [...prev, { equipment_id: first.id, quantity: 1 }]);
  }

  function updateEquipment(i: number, field: string, val: any) {
    setEquipment(prev => prev.map((eq, idx) => idx === i ? { ...eq, [field]: val } : eq));
  }

  function removeEquipment(i: number) {
    setEquipment(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const missing = ['inicial', 'durante', 'final'].filter(t => !photos[t]);
    if (missing.length > 0) {
      setError('Se requieren las 3 fotografías obligatorias en orden: Inicial (antes de comenzar), Durante el servicio, Final (antes de retirarse). Sin ellas no se puede gestionar el ticket.');
      return;
    }

    if (!form.client_name?.trim()) {
      setError('Nombre del cliente es requerido');
      return;
    }
    if (!form.job_service_id) {
      setError('Debe seleccionar el tipo de servicio');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (k === 'is_garantia') fd.append(k, v ? '1' : '0');
        else fd.append(k, String(v ?? ''));
      });
      const photoTypes: string[] = [];
      ['inicial', 'durante', 'final'].forEach(type => {
        if (photos[type]) {
          fd.append('photos', photos[type].file);
          photoTypes.push(type);
        }
      });
      fd.append('photo_types', photoTypes.join(','));
      fd.append('equipment_json', JSON.stringify(equipment.filter(e => e.equipment_id && e.quantity > 0)));

      const job = await api.createJob(fd);
      navigate('/servicios');
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    }
    setSaving(false);
  }

  function sendWhatsAppTicket() {
    const missing = ['inicial', 'durante', 'final'].filter(t => !photos[t]);
    if (missing.length > 0 || !form.client_name || !form.job_service_id) {
      setError('Complete todos los datos y las 3 fotos antes de enviar por WhatsApp');
      return;
    }
    const svc = jobServices.find(s => String(s.id) === form.job_service_id);
    const text = `*Ticket/Orden de Trabajo - Hidrourgencias*\n\n` +
      `Cliente: ${form.client_name}\n` +
      `Tipo: ${form.client_type}\n` +
      `Dirección: ${form.address_street || '-'} ${form.address_number || ''} ${form.address_comuna || ''}\n` +
      `Servicio: ${svc?.name || form.job_service_id}\n` +
      `Fecha: ${form.date}\n` +
      (form.notes ? `Notas: ${form.notes}\n` : '');
    const openWa = (phoneRaw: string | undefined) => {
      const p = String(phoneRaw || '56940918672').replace(/\D/g, '');
      const num = p.startsWith('56') ? p : '56' + p;
      window.open(`https://wa.me/${num}?text=${encodeURIComponent(text)}`, '_blank');
    };
    api.getWhatsappNumber().then((r: any) => openWa(r?.whatsapp_number)).catch(() => openWa(undefined));
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-corporate-blue">Nuevo Ticket / Orden de Trabajo</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-3">
          <h2 className="font-semibold text-sm text-text-secondary">Cliente</h2>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tipo de cliente *</label>
            <select value={form.client_type} onChange={e => setForm(p => ({ ...p, client_type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none">
              <option value="PARTICULAR">Particular</option>
              <option value="COMERCIAL">Comercial</option>
              <option value="CLIENTE">Cliente (Boleta/Factura)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nombre del cliente *</label>
            <input type="text" value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
              placeholder="Nombre o razón social" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">RUT (opcional)</label>
            <input type="text" value={form.client_rut} onChange={e => setForm(p => ({ ...p, client_rut: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
              placeholder="XX.XXX.XXX-X" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-3">
          <h2 className="font-semibold text-sm text-text-secondary">Dirección</h2>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Calle</label>
            <input type="text" value={form.address_street} onChange={e => setForm(p => ({ ...p, address_street: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Número</label>
              <input type="text" value={form.address_number} onChange={e => setForm(p => ({ ...p, address_number: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Comuna</label>
              <input type="text" value={form.address_comuna} onChange={e => setForm(p => ({ ...p, address_comuna: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-3">
          <h2 className="font-semibold text-sm text-text-secondary">Servicio</h2>
          <button
            type="button"
            onClick={() => setForm(p => ({ ...p, is_garantia: !p.is_garantia }))}
            className={`w-full py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition flex items-center justify-center gap-2 ${
              form.is_garantia
                ? 'bg-gray-200 border-gray-400 text-gray-700'
                : 'border-gray-200 bg-white text-text-secondary hover:bg-gray-50'
            }`}
          >
            <span className="inline-block w-4 h-4 border-2 rounded border-current flex items-center justify-center text-xs">
              {form.is_garantia ? '✓' : ''}
            </span>
            Servicio por garantía
          </button>
          <p className="text-xs text-text-secondary">Se asocia a un trabajo previo. Acuda como seguimiento.</p>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tipo de servicio *</label>
            <select value={form.job_service_id} onChange={e => setForm(p => ({ ...p, job_service_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none" required>
              <option value="">Seleccionar...</option>
              {jobServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Fecha *</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Notas</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none resize-none" rows={2} />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-sm text-amber-800 flex items-center gap-2">
            <Camera size={18} /> Fotografías obligatorias *
          </h2>
          <p className="text-xs text-amber-700">Sin las 3 fotos no se puede gestionar el ticket.</p>
          {(['inicial', 'durante', 'final'] as const).map(type => (
            <div key={type} className="space-y-1">
              <label className="block text-xs font-medium text-amber-800">{PHOTO_LABELS[type]}</label>
              {photos[type] ? (
                <div className="relative inline-block">
                  <img src={photos[type].preview} alt="" className="w-32 h-24 object-cover rounded-lg border" />
                  <button type="button" onClick={() => setPhotos(p => ({ ...p, [type]: null }))}
                    className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full"><X size={12} /></button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button type="button" onClick={() => (cameraRefs.current[type] as any)?.click()}
                    className="flex items-center gap-1 bg-corporate-light text-white px-3 py-2 rounded-lg text-sm">
                    <Camera size={16} /> Cámara
                  </button>
                  <input ref={el => cameraRefs.current[type] = el} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => e.target.files?.[0] && handlePhoto(type, e.target.files[0])} />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-3">
          <h2 className="font-semibold text-sm text-text-secondary">Maquinaria / EPP / Materiales</h2>
          <p className="text-xs text-text-secondary">Seleccione equipos utilizados y cantidad</p>
          {equipment.map((eq, i) => (
            <div key={i} className="flex gap-2 items-center">
              <select value={eq.equipment_id} onChange={e => updateEquipment(i, 'equipment_id', Number(e.target.value))}
                className="flex-1 px-3 py-2 rounded-lg border text-sm">
                {equipmentCatalog.filter(ec => ec.active !== 0).map(ec => (
                  <option key={ec.id} value={ec.id}>{ec.name} ({ec.category})</option>
                ))}
              </select>
              <input type="number" min={1} value={eq.quantity} onChange={e => updateEquipment(i, 'quantity', parseInt(e.target.value) || 1)}
                className="w-16 px-2 py-2 rounded-lg border text-sm" />
              <button type="button" onClick={() => removeEquipment(i)} className="p-2 text-red-500"><X size={18} /></button>
            </div>
          ))}
          <button type="button" onClick={addEquipment}
            className="text-sm text-corporate-blue font-medium hover:underline">+ Añadir equipo/material</button>
        </div>

        <button type="button" onClick={sendWhatsAppTicket}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] text-white font-semibold rounded-xl hover:bg-[#20BD5A] transition">
          <Send size={20} /> Enviar Ticket por WhatsApp
        </button>

        <button type="submit" disabled={saving}
          className="w-full py-3 bg-corporate-blue text-white font-semibold rounded-xl hover:bg-[#002244] transition flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <><Loader2 size={20} className="animate-spin" /> Guardando...</> : 'Guardar Ticket'}
        </button>
      </form>
    </div>
  );
}
