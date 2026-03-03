import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, Loader2, Settings, Sparkles } from 'lucide-react';
import { api } from '../services/api';

export default function AdminSettings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateSettings(settings);
      alert('Configuración guardada');
    } catch { /* ignore */ }
    setSaving(false);
  }

  function update(key: string, value: string) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-corporate-light border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-corporate-blue">Configuración</h1>
      </div>

      {/* OCR Settings */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-4">
        <h2 className="font-semibold text-sm text-corporate-blue flex items-center gap-2"><Sparkles size={16} /> Calibración OCR</h2>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Umbral de Confianza ({parseFloat(settings.ocr_confidence_threshold || '0.7') * 100}%)
          </label>
          <input type="range" min="0.3" max="1" step="0.05" value={settings.ocr_confidence_threshold || '0.7'}
            onChange={e => update('ocr_confidence_threshold', e.target.value)}
            className="w-full accent-corporate-light" />
          <div className="flex justify-between text-[10px] text-text-secondary mt-1">
            <span>Más flexible</span><span>Más estricto</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Ajuste de Brillo</label>
          <input type="range" min="-50" max="50" step="5" value={settings.ocr_brightness || '0'}
            onChange={e => update('ocr_brightness', e.target.value)}
            className="w-full accent-corporate-light" />
          <p className="text-xs text-text-secondary mt-1 text-center">{settings.ocr_brightness || '0'}%</p>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm">Brillo Automático</span>
          <button
            onClick={() => update('ocr_auto_brightness', settings.ocr_auto_brightness === '1' ? '0' : '1')}
            className={`w-12 h-6 rounded-full transition relative ${settings.ocr_auto_brightness === '1' ? 'bg-corporate-light' : 'bg-gray-300'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow ${settings.ocr_auto_brightness === '1' ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
      </div>

      {/* General Settings */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light space-y-4">
        <h2 className="font-semibold text-sm text-corporate-blue flex items-center gap-2"><Settings size={16} /> General</h2>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Nombre Empresa</label>
          <input type="text" value={settings.company_name || ''} onChange={e => update('company_name', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">N° WhatsApp para Reportes</label>
          <input type="text" value={settings.whatsapp_number || ''} onChange={e => update('whatsapp_number', e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border-light text-sm focus:ring-2 focus:ring-corporate-light outline-none" />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full py-3 bg-corporate-blue text-white font-semibold rounded-xl hover:bg-[#002244] transition flex items-center justify-center gap-2 disabled:opacity-60">
        {saving ? <><Loader2 size={20} className="animate-spin" /> Guardando...</> : <><Save size={20} /> Guardar Configuración</>}
      </button>
    </div>
  );
}
