import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Plus, Trash2, CheckCircle, XCircle, Send, AlertCircle, Printer } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function QuoteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  
  const [loading, setLoading] = useState(id ? true : false);
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<any>({
    client_type: 'RESIDENCIAL', client_name: '', client_rut: '', client_address: '', client_phone: '', client_email: '',
    services_details: [], subtotal: 0, iva: 0, total: 0, 
    scope_covered: '', technical_scope: '', payment_modalities: '', expiration_days: 15,
    terms_conditions: '', status: 'pendiente_revision'
  });
  
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [selectedTech, setSelectedTech] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    if (id) {
      loadQuote();
    } else {
      // Default terms
      setQuote((prev: any) => ({
        ...prev, 
        terms_conditions: '1. Validez de la cotización: 15 días.\n2. Condiciones de pago: 50% anticipo, 50% contra entrega.\n3. Garantía de servicio: 3 meses.'
      }));
    }
    if (isAdmin) {
      api.getTechnicians().then(setTechnicians).catch(console.error);
    }
  }, [id]);

  // Recalculate totals when services change
  useEffect(() => {
    const subtotal = quote.services_details.reduce((acc: number, item: any) => acc + (Number(item.quantity) * Number(item.unit_price)), 0);
    const iva = Math.round(subtotal * 0.19);
    setQuote((prev: any) => ({ ...prev, subtotal, iva, total: subtotal + iva }));
  }, [quote.services_details]);

  const loadQuote = async () => {
    try {
      const data = await api.getQuote(Number(id));
      let parsedServices = [];
      try { parsedServices = JSON.parse(data.services_details); } catch (e) {}
      setQuote({ ...data, services_details: parsedServices });
      setAdminNotes(data.admin_notes || '');
    } catch (err) {
      console.error(err);
      navigate('/cotizaciones');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!quote.client_name) return alert('El nombre del cliente es obligatorio');
    
    setSaving(true);
    try {
      if (id) {
        await api.updateQuote(Number(id), quote);
      } else {
        await api.createQuote(quote);
      }
      navigate('/cotizaciones');
    } catch (err) {
      alert('Error al guardar la cotización');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!confirm(`¿Estás seguro de marcar como ${status}?`)) return;
    setSaving(true);
    try {
      await api.updateQuoteStatus(Number(id), status, adminNotes);
      loadQuote();
    } catch (err) {
      alert('Error al actualizar estado');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToWO = async () => {
    if (!selectedTech) return alert('Debes seleccionar un técnico');
    if (!confirm('¿Crear Orden de Trabajo?')) return;
    
    setSaving(true);
    try {
      const res = await api.convertQuoteToWO(Number(id), Number(selectedTech));
      alert(`Orden de Trabajo #${res.work_order_id} creada exitosamente.`);
      navigate('/admin/ordenes-trabajo');
    } catch (err: any) {
      alert(err.message || 'Error al convertir');
    } finally {
      setSaving(false);
    }
  };

  const addServiceItem = () => {
    setQuote((prev: any) => ({
      ...prev,
      services_details: [...prev.services_details, { description: '', quantity: 1, unit_price: 0 }]
    }));
  };

  const updateServiceItem = (index: number, field: string, value: any) => {
    const newItems = [...quote.services_details];
    newItems[index] = { ...newItems[index], [field]: value };
    setQuote((prev: any) => ({ ...prev, services_details: newItems }));
  };

  const removeServiceItem = (index: number) => {
    const newItems = [...quote.services_details];
    newItems.splice(index, 1);
    setQuote((prev: any) => ({ ...prev, services_details: newItems }));
  };

  if (loading) return <div className="p-8 text-center">Cargando...</div>;

  const isReadOnly = !!(id && !isAdmin && quote.status === 'aprobada');

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4 pb-24">
      <div className="flex items-center gap-3 print:hidden">
        <button onClick={() => navigate('/cotizaciones')} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-corporate-blue">
          {id ? `Cotización #${quote.folio || id}` : 'Nueva Cotización'}
        </h1>
        {id && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            quote.status === 'aprobada' ? 'bg-green-100 text-green-700' :
            quote.status === 'declinada' ? 'bg-red-100 text-red-700' :
            quote.status === 'correccion' ? 'bg-orange-100 text-orange-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {quote.status.replace('_', ' ').toUpperCase()}
          </span>
        )}
        {id && (
          <button onClick={() => window.print()} className="ml-auto flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl font-medium text-sm transition">
            <Printer size={16} /> Imprimir PDF
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-border-light p-4 space-y-4 shadow-sm print:hidden">
        <h2 className="font-semibold border-b pb-2">Datos del Cliente</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Tipo de Cliente *</label>
            <select value={quote.client_type} onChange={e => setQuote({...quote, client_type: e.target.value})} disabled={isReadOnly || !!id}
              className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition">
              <option value="RESIDENCIAL">Residencial (CR)</option>
              <option value="COMERCIAL">Comercial (CC)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nombre / Razón Social *</label>
            <input type="text" value={quote.client_name} onChange={e => setQuote({...quote, client_name: e.target.value})} disabled={isReadOnly}
              className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">RUT</label>
            <input type="text" value={quote.client_rut} onChange={e => setQuote({...quote, client_rut: e.target.value})} disabled={isReadOnly}
              className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">Dirección</label>
            <input type="text" value={quote.client_address} onChange={e => setQuote({...quote, client_address: e.target.value})} disabled={isReadOnly}
              className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Teléfono</label>
            <input type="text" value={quote.client_phone} onChange={e => setQuote({...quote, client_phone: e.target.value})} disabled={isReadOnly}
              className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition" />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
            <input type="email" value={quote.client_email} onChange={e => setQuote({...quote, client_email: e.target.value})} disabled={isReadOnly}
              className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border-light p-4 space-y-4 shadow-sm print:hidden">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="font-semibold">Detalle de Servicios</h2>
          {!isReadOnly && (
            <button onClick={addServiceItem} className="text-corporate-light flex items-center gap-1 text-sm font-semibold">
              <Plus size={16} /> Agregar Ítem
            </button>
          )}
        </div>
        
        {quote.services_details.map((item: any, i: number) => (
          <div key={i} className="flex flex-col md:flex-row gap-3 items-end border-b pb-3">
            <div className="w-full md:flex-1">
              <label className="block text-xs font-medium text-text-secondary mb-1">Descripción</label>
              <input type="text" value={item.description} onChange={e => updateServiceItem(i, 'description', e.target.value)} disabled={isReadOnly}
                className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition" />
            </div>
            <div className="w-full md:w-24">
              <label className="block text-xs font-medium text-text-secondary mb-1">Cant.</label>
              <input type="number" min="1" value={item.quantity} onChange={e => updateServiceItem(i, 'quantity', e.target.value)} disabled={isReadOnly}
                className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition" />
            </div>
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-text-secondary mb-1">P. Unitario</label>
              <input type="number" min="0" value={item.unit_price} onChange={e => updateServiceItem(i, 'unit_price', e.target.value)} disabled={isReadOnly}
                className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition" />
            </div>
            <div className="w-full md:w-32">
              <label className="block text-xs font-medium text-text-secondary mb-1">Total</label>
              <div className="p-2 border rounded-xl bg-gray-100 font-semibold text-right">
                ${(item.quantity * item.unit_price).toLocaleString('es-CL')}
              </div>
            </div>
            {!isReadOnly && (
              <button onClick={() => removeServiceItem(i)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                <Trash2 size={20} />
              </button>
            )}
          </div>
        ))}

        {quote.services_details.length === 0 && (
          <div className="text-center py-4 text-sm text-gray-400">No hay ítems agregados</div>
        )}

        <div className="flex justify-end pt-4">
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Subtotal NETO:</span>
              <span className="font-semibold">${quote.subtotal.toLocaleString('es-CL')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">IVA (19%):</span>
              <span className="font-semibold">${quote.iva.toLocaleString('es-CL')}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-corporate-blue border-t pt-2">
              <span>TOTAL:</span>
              <span>${quote.total.toLocaleString('es-CL')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border-light p-4 space-y-4 shadow-sm print:hidden">
        <h2 className="font-semibold border-b pb-2">Términos, Alcances y Condiciones</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Lo que abarca el servicio (Scope)</label>
            <textarea 
              value={quote.scope_covered} 
              onChange={e => setQuote({...quote, scope_covered: e.target.value})} 
              disabled={isReadOnly} rows={3} placeholder="Ej. Limpieza de cámara de inspección..."
              className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition text-sm" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Alcances Técnicos</label>
            <textarea 
              value={quote.technical_scope} 
              onChange={e => setQuote({...quote, technical_scope: e.target.value})} 
              disabled={isReadOnly} rows={3} placeholder="Ej. No incluye cambio de tapas o anillos..."
              className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition text-sm" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Modalidades de Pago Acordadas</label>
            <input 
              type="text" value={quote.payment_modalities} 
              onChange={e => setQuote({...quote, payment_modalities: e.target.value})} 
              disabled={isReadOnly} placeholder="Ej. Transferencia 50% anticipo"
              className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition text-sm" 
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Plazo de Caducidad (Días)</label>
            <input 
              type="number" value={quote.expiration_days} 
              onChange={e => setQuote({...quote, expiration_days: parseInt(e.target.value) || 1})} 
              disabled={isReadOnly} min={1}
              className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition text-sm" 
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Términos Adicionales</label>
          <textarea 
            value={quote.terms_conditions} 
            onChange={e => setQuote({...quote, terms_conditions: e.target.value})} 
            disabled={isReadOnly}
            rows={2}
            className="w-full p-2 border rounded-xl bg-gray-50 focus:bg-white transition text-sm" 
          />
        </div>
      </div>

      {isAdmin && id && (
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4 space-y-4 shadow-sm print:hidden">
          <h2 className="font-semibold text-blue-900 border-b border-blue-200 pb-2">Administración (Revisión)</h2>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Notas del Administrador</label>
            <textarea 
              value={adminNotes} 
              onChange={e => setAdminNotes(e.target.value)} 
              rows={2}
              className="w-full p-2 border rounded-xl bg-white focus:bg-white transition text-sm" 
              placeholder="Escribe el motivo de corrección, rechazo o notas internas..."
            />
          </div>
          
          {quote.status !== 'aprobada' && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => handleStatusUpdate('aprobada')} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-green-700">
                <CheckCircle size={16} /> Aprobar
              </button>
              <button onClick={() => handleStatusUpdate('correccion')} disabled={saving} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-orange-600">
                <AlertCircle size={16} /> Solicitar Corrección
              </button>
              <button onClick={() => handleStatusUpdate('declinada')} disabled={saving} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-red-700">
                <XCircle size={16} /> Declinar
              </button>
            </div>
          )}

          {quote.status === 'aprobada' && !quote.work_order_id && (
            <div className="pt-4 border-t border-blue-200">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Convertir a Orden de Trabajo</h3>
              <div className="flex gap-2 items-center">
                <select 
                  value={selectedTech}
                  onChange={e => setSelectedTech(e.target.value)}
                  className="flex-1 p-2 rounded-xl border bg-white text-sm"
                >
                  <option value="">Seleccione Técnico...</option>
                  {technicians.map(t => <option key={t.id} value={t.id}>{t.display_name}</option>)}
                </select>
                <button 
                  onClick={handleConvertToWO}
                  disabled={saving || !selectedTech}
                  className="px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-purple-700 disabled:opacity-50"
                >
                  <Send size={16} /> Crear OT
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="fixed bottom-[80px] left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t flex justify-end gap-3 z-30 print:hidden">
        {!isReadOnly && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-corporate-blue text-white px-6 py-3 rounded-xl font-semibold shadow-md flex items-center gap-2 hover:bg-blue-900 transition disabled:opacity-50"
          >
            <Save size={20} />
            {saving ? 'Guardando...' : 'Guardar Cotización'}
          </button>
        )}
      </div>

      {/* Printable View (Hidden on screen, block on print) */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8 text-black" style={{ fontFamily: 'Arial, sans-serif' }}>
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-corporate-blue pb-4 mb-6">
          <div className="flex items-center gap-4">
            {/* Si tienes un logo, podrías poner una <img src="/logo.png" /> aquí. Por ahora usaremos texto destacado */}
            <div className="w-16 h-16 bg-corporate-blue text-white rounded-2xl flex items-center justify-center text-3xl font-bold">H</div>
            <div>
              <h1 className="text-2xl font-bold text-corporate-blue tracking-wider">HIDROURGENCIAS SpA</h1>
              <p className="text-sm font-semibold text-gray-600">Expertos en soluciones sanitarias</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-800">COTIZACIÓN DE SERVICIOS</h2>
            <p className="text-lg font-semibold text-red-600 mt-1">N° {quote.folio || id}</p>
            <p className="text-sm mt-1">Fecha: {new Date(quote.created_at || Date.now()).toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {/* Client Info */}
        <div className="mb-6 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <p><span className="font-bold">Cliente:</span> {quote.client_name}</p>
          <p><span className="font-bold">R.U.T:</span> {quote.client_rut || '---'}</p>
          <p className="col-span-2"><span className="font-bold">Dirección:</span> {quote.client_address || '---'}</p>
          <p><span className="font-bold">Teléfono:</span> {quote.client_phone || '---'}</p>
          <p><span className="font-bold">Email:</span> {quote.client_email || '---'}</p>
        </div>

        {/* Services Table */}
        <table className="w-full mb-6 border-collapse text-sm">
          <thead>
            <tr className="bg-corporate-blue text-white">
              <th className="py-2 px-3 text-left border border-corporate-blue">Cantidad</th>
              <th className="py-2 px-3 text-left border border-corporate-blue w-1/2">Descripción</th>
              <th className="py-2 px-3 text-right border border-corporate-blue">P. Unitario</th>
              <th className="py-2 px-3 text-right border border-corporate-blue">Total</th>
            </tr>
          </thead>
          <tbody>
            {quote.services_details.map((item: any, idx: number) => (
              <tr key={idx} className="border-b border-gray-300">
                <td className="py-2 px-3 text-center border-x border-gray-300">{item.quantity}</td>
                <td className="py-2 px-3 border-x border-gray-300">{item.description}</td>
                <td className="py-2 px-3 text-right border-x border-gray-300">${Number(item.unit_price).toLocaleString('es-CL')}</td>
                <td className="py-2 px-3 text-right border-x border-gray-300 font-medium">${(Number(item.quantity) * Number(item.unit_price)).toLocaleString('es-CL')}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-64">
            <div className="flex justify-between py-1 border-b">
              <span className="font-semibold text-gray-600">Total Neto:</span>
              <span>${Number(quote.subtotal).toLocaleString('es-CL')}</span>
            </div>
            <div className="flex justify-between py-1 border-b">
              <span className="font-semibold text-gray-600">IVA (19%):</span>
              <span>${Number(quote.iva).toLocaleString('es-CL')}</span>
            </div>
            <div className="flex justify-between py-2 text-lg font-bold text-corporate-blue">
              <span>Total a pagar:</span>
              <span>${Number(quote.total).toLocaleString('es-CL')}</span>
            </div>
          </div>
        </div>

        {/* Conditions */}
        <div className="border border-gray-300 p-4 rounded-xl text-xs space-y-4">
          <h3 className="font-bold text-sm mb-2 uppercase border-b pb-1">Términos y Condiciones del Servicio</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-bold text-corporate-blue mb-1">Lo que abarca el servicio:</p>
              <p className="whitespace-pre-line">{quote.scope_covered || 'Según descripción.'}</p>
            </div>
            <div>
              <p className="font-bold text-corporate-blue mb-1">Alcances Técnicos:</p>
              <p className="whitespace-pre-line">{quote.technical_scope || '---'}</p>
            </div>
            <div>
              <p className="font-bold text-corporate-blue mb-1">Modalidades de pago:</p>
              <p>{quote.payment_modalities || '---'}</p>
            </div>
            <div>
              <p className="font-bold text-corporate-blue mb-1">Caducidad de cotización:</p>
              <p>{quote.expiration_days} días hábiles.</p>
            </div>
          </div>
          
          {quote.terms_conditions && (
            <div className="mt-4 pt-2 border-t border-gray-200">
              <p className="font-bold text-corporate-blue mb-1">Otras condiciones:</p>
              <p className="whitespace-pre-line">{quote.terms_conditions}</p>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-xs text-gray-500 border-t pt-4">
          <p className="font-bold mb-1">Información Comercial - Hidrourgencias SpA (77.908.199-0)</p>
          <p>Email: ventas@hidrourgencias.cl | Banco BCI - Cuenta Corriente N° 95097155</p>
          <p>Giro: Instalaciones de gasfitería, calefacción y aire acondicionado</p>
        </div>
      </div>
    </div>
  );
}