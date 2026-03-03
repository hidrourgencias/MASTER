import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    client_type: 'particular',
    client_name: '',
    client_rut: '',
    address_street: '',
    address_number: '',
    address_comuna: '',
    job_service_id: '',
    payment_type: 'contado',
    payment_method: 'efectivo',
    client_status: 'pendiente_pago',
    amount: '',
    date: '',
    notes: ''
  });

  const [existingPhotos, setExistingPhotos] = useState<any[]>([]);
  const [newPhotos, setNewPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [jobServices, setJobServices] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadingJob, setLoadingJob] = useState(!job && !!id);

  useEffect(() => {
    api.getJobServices().then(setJobServices).catch(() => {});
  }, []);

  useEffect(() => {
    if (job && id) {
      setForm({
        client_type: job.client_type || 'particular',
        client_name: job.client_name || '',
        client_rut: job.client_rut || '',
        address_street: job.address_street || '',
        address_number: job.address_number || '',
        address_comuna: job.address_comuna || '',
        job_service_id: String(job.job_service_id || ''),
        payment_type: job.payment_type || 'contado',
        payment_method: job.payment_method || 'efectivo',
        client_status: job.client_status || 'pendiente_pago',
        amount: String(job.amount || ''),
        date: job.date || '',
        notes: job.notes || ''
      });
      setExistingPhotos(job.photos || []);
      setLoadingJob(false);
    } else if (id && !job) {
      api.getJob(Number(id)).then(j => {
        setForm({
          client_type: j.client_type || 'particular',
          client_name: j.client_name || '',
          client_rut: j.client_rut || '',
          address_street: j.address_street || '',
          address_number: j.address_number || '',
          address_comuna: j.address_comuna || '',
          job_service_id: String(j.job_service_id || ''),
          payment_type: j.payment_type || 'contado',
          payment_method: j.payment_method || 'efectivo',
          client_status: j.client_status || 'pendiente_pago',
          amount: String(j.amount || ''),
          date: j.date || '',
          notes: j.notes || ''
        });
        setExistingPhotos(j.photos || []);
      }).catch(() => navigate('/servicios')).finally(() => setLoadingJob(false));
    }
  }, [job, id, navigate]);

  function handleAddPhoto(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setNewPhotos(prev => [...prev, { file, preview: e.target?.result as string }]);
    };
    reader.readAsDataURL(file);
  }

  function removeNewPhoto(index: number) {
    setNewPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError('');

    if (existingPhotos.length === 0 && newPhotos.length === 0) {
      setError('Debe haber al menos una fotografía del servicio.');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v ?? '')));
      newPhotos.forEach(p => fd.append('photos', p.file));

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
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-corporate-blue">Editar Servicio</h1>
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
            <select
              value={form.client_type}
              onChange={e => setForm(p => ({ ...p, client_type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none"
            >
              <option value="particular">Particular</option>
              <option value="empresa">Empresa</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nombre del cliente *</label>
            <input
              type="text"
              value={form.client_name}
              onChange={e => setForm(p => ({ ...p, client_name: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">RUT (opcional)</label>
            <input
              type="text"
              value={form.client_rut}
              onChange={e => setForm(p => ({ ...p, client_rut: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-3">
          <h2 className="font-semibold text-sm text-text-secondary">Dirección</h2>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Calle</label>
            <input
              type="text"
              value={form.address_street}
              onChange={e => setForm(p => ({ ...p, address_street: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Número</label>
              <input
                type="text"
                value={form.address_number}
                onChange={e => setForm(p => ({ ...p, address_number: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Comuna</label>
              <input
                type="text"
                value={form.address_comuna}
                onChange={e => setForm(p => ({ ...p, address_comuna: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-3">
          <h2 className="font-semibold text-sm text-text-secondary">Servicio y pago</h2>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tipo de servicio *</label>
            <select
              value={form.job_service_id}
              onChange={e => setForm(p => ({ ...p, job_service_id: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none"
              required
            >
              <option value="">Seleccionar...</option>
              {jobServices.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Tipo de pago</label>
              <select
                value={form.payment_type}
                onChange={e => setForm(p => ({ ...p, payment_type: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none"
              >
                <option value="contado">Al contado</option>
                <option value="credito">A crédito</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Método de pago</label>
              <select
                value={form.payment_method}
                onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Estado del cobro al cliente</label>
            <select
              value={form.client_status}
              onChange={e => setForm(p => ({ ...p, client_status: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none"
            >
              <option value="pendiente_pago">Pendiente de pago</option>
              <option value="pagado">Pagado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Monto cobrado (CLP)</label>
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
              min="0"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Fecha del servicio *</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Notas</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-sm text-amber-800 flex items-center gap-2">
            <Camera size={18} /> Fotografías
          </h2>
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
          <p className="text-xs text-amber-700">Agregar más fotos (opcional)</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2 bg-corporate-light text-white px-4 py-2 rounded-xl text-sm font-semibold">
              <Camera size={18} /> Cámara
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-corporate-blue text-white px-4 py-2 rounded-xl text-sm font-semibold">
              Subir foto
            </button>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => e.target.files?.[0] && handleAddPhoto(e.target.files[0])} />
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && handleAddPhoto(e.target.files[0])} />
          </div>
          {newPhotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {newPhotos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.preview} alt="" className="w-full h-24 object-cover rounded-lg border" />
                  <button type="button" onClick={() => removeNewPhoto(i)}
                    className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={saving}
          className="w-full py-3 bg-corporate-blue text-white font-semibold rounded-xl hover:bg-[#002244] transition flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <><Loader2 size={20} className="animate-spin" /> Guardando...</> : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
