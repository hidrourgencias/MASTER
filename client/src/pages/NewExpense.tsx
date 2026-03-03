import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Camera, Upload, Loader2, Sparkles, ArrowLeft, Users, X } from 'lucide-react';
import { api } from '../services/api';
import { todayISO } from '../utils/format';

export default function NewExpense() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isManual = searchParams.get('manual') === 'true';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    date: todayISO(), amount: '', provider: '', provider_rut: '', service: '',
    description: '', document_type: 'boleta', document_number: '', collaborators: [] as number[]
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageFilename, setImageFilename] = useState('');
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrRaw, setOcrRaw] = useState('');
  const [error, setError] = useState('');
  const [services, setServices] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [frequentRuts, setFrequentRuts] = useState<any[]>([]);
  const [showCollabs, setShowCollabs] = useState(false);

  useEffect(() => {
    api.getServices().then(setServices).catch(() => {});
    api.getTechnicians().then(setTechnicians).catch(() => {});
    api.getFrequentRuts().then(setFrequentRuts).catch(() => {});
  }, []);

  function handleImage(file: File) {
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleScan(file: File) {
    handleImage(file);
    setScanning(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const result = await api.scanReceipt(fd);
      if (result.data) {
        setForm(prev => ({
          ...prev,
          date: result.data.date ? convertDateFormat(result.data.date) : prev.date,
          amount: result.data.amount || prev.amount,
          provider: result.data.provider || prev.provider,
          provider_rut: result.data.provider_rut || prev.provider_rut,
          document_type: result.data.document_type || prev.document_type,
          document_number: result.data.document_number || prev.document_number,
        }));
        setOcrRaw(result.raw || '');
        if (result.image_filename) setImageFilename(result.image_filename);
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar OCR');
    }
    setScanning(false);
  }

  function convertDateFormat(dateStr: string): string {
    const parts = dateStr.split('/');
    if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    return dateStr;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date || !form.amount) {
      setError('Fecha y monto son requeridos');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, val]) => {
        if (key === 'collaborators') fd.append(key, JSON.stringify(val));
        else fd.append(key, String(val));
      });
      if (imageFile && !imageFilename) fd.append('receipt', imageFile);
      if (imageFilename) fd.append('image_path', imageFilename);
      if (ocrRaw) fd.append('ocr_raw', ocrRaw);

      await api.createExpense(fd);
      navigate('/gastos');
    } catch (err: any) {
      setError(err.message || 'Error al guardar');
    }
    setSaving(false);
  }

  function selectFrequentRut(rut: any) {
    setForm(prev => ({ ...prev, provider_rut: rut.rut, provider: rut.name }));
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-corporate-blue">Nuevo Gasto</h1>
      </div>

      {/* Scan Area */}
      {!isManual && !imagePreview && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-border-light text-center space-y-3">
          <Sparkles size={32} className="mx-auto text-corporate-light" />
          <h2 className="font-semibold">Escanear con IA</h2>
          <p className="text-sm text-text-secondary">Capture o suba una boleta para extraer datos automáticamente</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => cameraInputRef.current?.click()}
              className="flex items-center gap-2 bg-corporate-light text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#0095cc] transition">
              <Camera size={18} /> Cámara
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 bg-corporate-blue text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#002244] transition">
              <Upload size={18} /> Subir Archivo
            </button>
          </div>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => e.target.files?.[0] && handleScan(e.target.files[0])} />
          <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden"
            onChange={e => e.target.files?.[0] && handleScan(e.target.files[0])} />
        </div>
      )}

      {/* Scanning indicator */}
      {scanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
          <Loader2 size={24} className="animate-spin text-corporate-light" />
          <div>
            <p className="font-semibold text-sm text-corporate-blue">Procesando con IA...</p>
            <p className="text-xs text-text-secondary">Extrayendo datos de la boleta</p>
          </div>
        </motion.div>
      )}

      {/* Image Preview */}
      {imagePreview && (
        <div className="relative">
          <img src={imagePreview} alt="Preview" className="w-full h-48 object-contain bg-white rounded-xl border border-border-light" />
          <button onClick={() => { setImagePreview(''); setImageFile(null); setImageFilename(''); }}
            className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"><X size={16} /></button>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">{error}</div>}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Fecha *</label>
            <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Monto *</label>
            <input type="number" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
              placeholder="0" required />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Proveedor</label>
          <input type="text" value={form.provider} onChange={e => setForm(p => ({ ...p, provider: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
            placeholder="Nombre del proveedor" list="frequent-providers" />
          {frequentRuts.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {frequentRuts.slice(0, 5).map(r => (
                <button key={r.id} type="button" onClick={() => selectFrequentRut(r)}
                  className="text-[10px] bg-blue-50 text-corporate-blue px-2 py-0.5 rounded-full hover:bg-blue-100 transition">
                  {r.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">RUT Proveedor</label>
          <input type="text" value={form.provider_rut} onChange={e => setForm(p => ({ ...p, provider_rut: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none"
            placeholder="XX.XXX.XXX-X" />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Servicio</label>
          <select value={form.service} onChange={e => setForm(p => ({ ...p, service: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none">
            <option value="">Seleccionar servicio...</option>
            {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tipo</label>
            <select value={form.document_type} onChange={e => setForm(p => ({ ...p, document_type: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm bg-white focus:ring-2 focus:ring-corporate-light outline-none">
              <option value="boleta">Boleta</option>
              <option value="factura">Factura</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">N° Documento</label>
            <input type="text" value={form.document_number} onChange={e => setForm(p => ({ ...p, document_number: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Descripción</label>
          <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none resize-none"
            rows={2} placeholder="Detalle del gasto..." />
        </div>

        {/* Collaborators */}
        <div>
          <button type="button" onClick={() => setShowCollabs(!showCollabs)}
            className="flex items-center gap-2 text-sm text-corporate-blue hover:underline">
            <Users size={16} /> Gasto en Dupla
          </button>
          {showCollabs && (
            <div className="mt-2 flex flex-wrap gap-2">
              {technicians.map(t => (
                <label key={t.id} className="flex items-center gap-1.5 text-sm bg-gray-50 px-3 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100">
                  <input type="checkbox" checked={form.collaborators.includes(t.id)}
                    onChange={e => {
                      setForm(p => ({
                        ...p,
                        collaborators: e.target.checked
                          ? [...p.collaborators, t.id]
                          : p.collaborators.filter(id => id !== t.id)
                      }));
                    }}
                    className="rounded text-corporate-light focus:ring-corporate-light" />
                  {t.display_name}
                </label>
              ))}
            </div>
          )}
        </div>

        <button type="submit" disabled={saving}
          className="w-full py-3 bg-corporate-blue text-white font-semibold rounded-xl hover:bg-[#002244] transition flex items-center justify-center gap-2 disabled:opacity-60">
          {saving ? <><Loader2 size={20} className="animate-spin" /> Guardando...</> : 'Guardar Gasto'}
        </button>
      </form>
    </div>
  );
}
