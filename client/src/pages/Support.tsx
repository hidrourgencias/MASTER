import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, Mail, MessageCircle, Droplets } from 'lucide-react';

export default function Support() {
  const navigate = useNavigate();

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-xl transition"><ArrowLeft size={20} /></button>
        <h1 className="text-xl font-bold text-corporate-blue">Soporte</h1>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-border-light text-center">
        <div className="w-16 h-16 bg-corporate-light/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Droplets size={32} className="text-corporate-light" />
        </div>
        <h2 className="font-bold text-lg">Hidrourgencias SpA</h2>
        <p className="text-sm text-text-secondary mt-1">Sistema de Rendición de Gastos v1.0</p>
      </div>

      <div className="space-y-2">
        <a href="tel:+56940918672" className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-border-light hover:bg-gray-50 transition">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center"><Phone size={20} className="text-success" /></div>
          <div><p className="font-semibold text-sm">Teléfono</p><p className="text-xs text-text-secondary">+56 9 4091 8672</p></div>
        </a>
        <a href="https://wa.me/56940918672" target="_blank" className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-border-light hover:bg-gray-50 transition">
          <div className="w-10 h-10 bg-[#25D366]/10 rounded-xl flex items-center justify-center"><MessageCircle size={20} className="text-[#25D366]" /></div>
          <div><p className="font-semibold text-sm">WhatsApp</p><p className="text-xs text-text-secondary">Enviar mensaje directo</p></div>
        </a>
        <a href="mailto:contacto@hidrourgencias.cl" className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-border-light hover:bg-gray-50 transition">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><Mail size={20} className="text-corporate-blue" /></div>
          <div><p className="font-semibold text-sm">Email</p><p className="text-xs text-text-secondary">contacto@hidrourgencias.cl</p></div>
        </a>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm border border-border-light">
        <h3 className="font-semibold text-sm mb-3 text-corporate-blue">Manual de Uso</h3>
        <div className="space-y-2 text-sm text-text-secondary">
          <p><strong className="text-text-primary">1.</strong> Inicie sesión con sus credenciales asignadas.</p>
          <p><strong className="text-text-primary">2.</strong> En la primera entrada, cambie su contraseña.</p>
          <p><strong className="text-text-primary">3.</strong> Para registrar un gasto, use el botón "Escanear" o "Registro Manual".</p>
          <p><strong className="text-text-primary">4.</strong> La IA extraerá automáticamente los datos de la boleta.</p>
          <p><strong className="text-text-primary">5.</strong> Verifique y complete los datos antes de guardar.</p>
          <p><strong className="text-text-primary">6.</strong> Complete sus datos bancarios en "Perfil" para recibir reembolsos.</p>
          <p><strong className="text-text-primary">7.</strong> Use el botón de WhatsApp para enviar el reporte diario.</p>
        </div>
      </div>
    </div>
  );
}
