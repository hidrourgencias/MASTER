import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Camera, ArrowLeft, X, Loader2, AlertCircle } from 'lucide-react';
import { api, getUploadsUrl } from '../services/api';

function jobPhotoUrl(path: string) {
  if (!path) return '';
  return getUploadsUrl(path.startsWith('jobs/') ? path : `jobs/${path}`);
}

export default function EditServiceJob() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { state } = useLocation();
  const job = state?.job;

  const cameraRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [form, setForm] = useState({
    client_type: 'PARTICULAR', client_name: '', client_rut: '', client_phone: '',
    address_street: '', address_number: '', address_comuna: '',
    job_service_id: '', payment_type: 'contado', payment_method: '', client_status: 'pendiente_pago', amount: '',
    date: '', notes: '', is_garantia: false
  });

  const [existingPhotos, setExistingPhotos] = useState<any[]>([]);
  const [newPhotos, setNewPhotos] = useState<Record<string, { file: File; preview: string }>>({});
  const [equipment, setEquipment] = useState<{ equipment_id: number; quantity: number }[]>([]);
  const [jobServices, setJobServices] = useState<any[]>([]);
  const [equipmentCatalog, setEquipmentCatalog] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingJob, setLoadingJob] = useState(!job && !!id);

  useEffect(() => {
    api.getJobServices().then(setJobServices).catch(() => {});
    api.getEquipmentCatalog().then(setEquipmentCatalog).catch(() => setEquipmentCatalog([]));
  }, []);

  useEffect(() => {
    const loadJob = (j: any) => {
      setForm({
        client_type: j.client_type || 'PARTICULAR', client_name: j.client_name || '',
        client_rut: j.client_rut || '', client_phone: j.client_phone || '', address_street: j.address_street || '',
        address_number: j.address_number || '', address_comuna: j.address_comuna || '',
        job_service_id: String(j.job_service_id || ''), payment_type: j.payment_type || 'contado',
        payment_method: j.payment_method || '', client_status: j.client_status || 'pendiente_pago', amount: String(j.amount ?? ''),
        date: j.date || '', notes: j.notes || '', is_garantia: !!j.is_garantia
      });
      setExistingPhotos(j.photos || []);
      setEquipment([]);
    };
    if (job && id) {
      loadJob(job);
      setLoadingJob(false);
    } else if (id) {
      api.getJob(Number(id)).then(loadJob).catch(() => navigate('/servicios')).finally(() => setLoadingJob(false));
    }
  }, [job, id, navigate]);

  function handleAddPhoto(type: string, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setNewPhotos(prev => ({ ...prev, [type]: { file, preview: e.target!.result as string } }));
      }
    };
    reader.readAsDataURL(file);
  }

  function addEquipment() {
    const first = equipmentCatalog[0];
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
    if (!id) return;
    setError('');
    if (existingPhotos.length + Object.keys(newPhotos).length < 1) {
      setError('Se requiere al menos 1 fotografía del servicio');
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
      Object.entries(newPhotos).forEach(([type, p]) => {
        if ((p as any)?.file) {
          fd.append('photos', (p as any).file);
          photoTypes.push(type);
        }
      });
      fd.append('photo_types', photoTypes.join(','));
      await api.updateJob(Number(id), fd);
      navigate('/servicios');
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    }
    setSaving(false);
  }

  if ((!job && !id) || loadingJob) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-corporate-light border-t-transparent rounded-full animate-spin" />
          <p className="text-text-secondary">Cargando...</p>
        </div>
        <button onClick={() => navigate('/servicios')} className="mt-2 text-corporate-blue">Volver</button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-corporate-blue">Editar Ticket</h1>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 flex items-start gap-2">
          <AlertCircle size={18} className="flex-shrink-0" /> {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-3">
          <h2 className="font-semibold text-sm text-text-secondary">Cliente</h2>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tipo *</label>
            <select value={form.client_type} onChange={e => setForm(p => ({ ...p, client_type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none">
              <option value="PARTICULAR">Particular</option>
              <option value="COMERCIAL">Comercial</option>
              <option value="EMPRESA">Empresa</option>
              <option value="CLIENTE">Cliente (Boleta/Factura)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nombre *</label>
            <input type="text" value={form.client_name} onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">RUT</label>
            <input type="text" value={form.client_rut} onChange={e => setForm(p => ({ ...p, client_rut: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Fono Contacto / WhatsApp</label>
            <input type="text" value={form.client_phone} onChange={e => setForm(p => ({ ...p, client_phone: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
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
              form.is_garantia ? 'bg-gray-200 border-gray-400 text-gray-700' : 'border-gray-200 bg-white text-text-secondary hover:bg-gray-50'
            }`}
          >
            <span className="inline-block w-4 h-4 border-2 rounded border-current flex items-center justify-center text-xs">{form.is_garantia ? '✓' : ''}</span>
            Servicio por garantía
          </button>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tipo de pago *</label>
            <select value={form.payment_type} onChange={e => setForm(p => ({ ...p, payment_type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none">
              <option value="contado">Al contado</option>
              <option value="plazo">A plazo</option>
            </select>
          </div>
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
          <h2 className="font-semibold text-sm text-amber-800">Fotografías</h2>
          {existingPhotos.length > 0 && (
            <div>
              <p className="text-xs text-amber-700 mb-1">Existentes ({existingPhotos.length})</p>
              <div className="grid grid-cols-3 gap-2">
                {existingPhotos.map((p: any) => (
                  <img key={p.id} src={jobPhotoUrl(p.image_path)} alt="" className="w-full h-20 object-cover rounded-lg" />
                ))}
              </div>
            </div>
          )}
          <p className="text-xs text-amber-700">Agregar más (opcional). Mínimo 3 en total.</p>
          {(['inicial', 'durante', 'final'] as const).map(type => (
            <div key={type}>
              {newPhotos[type] ? (
                <div className="relative inline-block">
                  <img src={newPhotos[type].preview} alt="" className="w-32 h-24 object-cover rounded-lg border" />
                  <button type="button" onClick={() => setNewPhotos(p => { const n = { ...p }; delete n[type]; return n; })}
                    className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full"><X size={12} /></button>
                </div>
              ) : (
                <button type="button" onClick={() => (cameraRefs.current[type] as any)?.click()}
                  className="flex items-center gap-1 bg-corporate-light text-white px-3 py-2 rounded-lg text-sm">
                  <Camera size={16} /> {type}
                </button>
              )}
              <input ref={(el) => { if (el) cameraRefs.current[type] = el; }} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => {
                  if (e.target.files?.[0]) handleAddPhoto(type, e.target.files[0]);
                  e.target.value = '';
                }} />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-3">
          <h2 className="font-semibold text-sm text-text-secondary">Equipos / EPP / Materiales</h2>
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
          <button type="button" onClick={addEquipment} className="text-sm text-corporate-blue font-medium hover:underline">+ Añadir</button>
        </div>
        <button type="submit" disabled={saving}
          className="w-full py-3 bg-corporate-blue text-white font-semibold rounded-xl hover:bg-[#002244] transition flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <><Loader2 size={20} className="animate-spin" /> Guardando...</> : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
