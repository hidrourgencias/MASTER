import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, ArrowLeft, X, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { todayISO } from '../utils/format';

export default function NewServiceJob() {
  const navigate = useNavigate();
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
    date: todayISO(),
    notes: ''
  });

  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);
  const [jobServices, setJobServices] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getJobServices().then(setJobServices).catch(() => {});
  }, []);

  function handleAddPhoto(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotos(prev => [...prev, { file, preview: e.target?.result as string }]);
    };
    reader.readAsDataURL(file);
  }

  function removePhoto(index: number) {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (photos.length === 0) {
      setError('La fotografía del servicio es obligatoria. Sin fotos no se genera cobro al administrador.');
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
    if (!form.date) {
      setError('La fecha es requerida');
      return;
    }

    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, String(v ?? '')));
      photos.forEach((p, i) => fd.append('photos', p.file));

      await api.createJob(fd);
      navigate('/servicios');
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    }
    setSaving(false);
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-corporate-blue">Nuevo Servicio</h1>
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
              placeholder="Nombre o razón social"
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
              placeholder="XX.XXX.XXX-X"
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-3">
          <h2 className="font-semibold text-sm text-text-secondary">Dirección / Ubicación</h2>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Calle</label>
            <input
              type="text"
              value={form.address_street}
              onChange={e => setForm(p => ({ ...p, address_street: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
              placeholder="Nombre de la calle"
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
                placeholder="Número municipal"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Comuna</label>
              <input
                type="text"
                value={form.address_comuna}
                onChange={e => setForm(p => ({ ...p, address_comuna: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
                placeholder="Comuna"
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
            <label className="block text-xs font-medium text-text-secondary mb-1">Monto cobrado al cliente (CLP)</label>
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
              placeholder="0"
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
              placeholder="Observaciones..."
            />
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <h2 className="font-semibold text-sm text-amber-800 flex items-center gap-2">
            <Camera size={18} /> Fotografía del servicio *
          </h2>
          <p className="text-xs text-amber-700">
            Obligatoria. Sin fotografías del servicio no se generará cobro al administrador.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2 bg-corporate-light text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0095cc] transition"
            >
              <Camera size={18} /> Cámara
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-corporate-blue text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#002244] transition"
            >
              Subir foto
            </button>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleAddPhoto(e.target.files[0])}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleAddPhoto(e.target.files[0])}
            />
          </div>
          {photos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p.preview} alt="" className="w-full h-24 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-red-500 text-white p-0.5 rounded-full hover:bg-red-600"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {photos.length > 0 && (
            <p className="text-xs text-amber-700">{photos.length} foto(s) agregada(s)</p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-corporate-blue text-white font-semibold rounded-xl hover:bg-[#002244] transition flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 size={20} className="animate-spin" /> Guardando...
            </>
          ) : (
            'Guardar Servicio'
          )}
        </button>
      </form>
    </div>
  );
}
