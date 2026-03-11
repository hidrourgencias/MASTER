import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Droplets, Eye, EyeOff, Loader2, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_API = 'https://hidrourgencias.onrender.com';
const isCapacitor = !!(window as any).Capacitor; // APK: no mostrar "Configurar servidor"

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem('server_url') || DEFAULT_API);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username.trim().toLowerCase(), password);
      if (user.must_change_password) {
        navigate('/cambiar-clave');
      } else {
        navigate('/');
      }
    } catch (err: any) {
      const msg = err?.message || '';
      if (/fetch|network|failed to fetch|networkerror/i.test(msg) || msg === '') {
        setError('No se pudo conectar al servidor. Verifique su conexión a internet y que el servidor esté activo.');
      } else {
        setError(msg || 'Error al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveServerUrl = () => {
    const url = serverUrl.trim().replace(/\/api\/?$/, '');
    if (url) {
      localStorage.setItem('server_url', url);
      setError('');
      setShowServerConfig(false);
    }
  };

  return (
    <div className="min-h-[100dvh] min-h-screen bg-gradient-to-br from-corporate-blue to-[#001a33] flex items-center justify-center p-4 overflow-y-auto safe-area-top safe-area-bottom">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm my-4"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ y: -20 }} animate={{ y: 0 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-corporate-light rounded-2xl shadow-xl mb-4"
          >
            <Droplets size={40} className="text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white">Hidrourgencias SpA</h1>
          <p className="text-blue-200 text-sm mt-1">Sistema de Rendición de Gastos</p>
        </div>

        <motion.form
          initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-2xl p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-center text-corporate-blue">Iniciar Sesión</h2>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 text-center">
              {error}
            </motion.div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Usuario</label>
            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border-light focus:ring-2 focus:ring-corporate-light focus:border-corporate-light outline-none transition"
              placeholder="Ingrese su usuario"
              autoComplete="username"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Contraseña</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-border-light focus:ring-2 focus:ring-corporate-light focus:border-corporate-light outline-none transition"
                placeholder="Ingrese su contraseña"
                autoComplete="current-password"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-corporate-blue transition">
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full py-3 bg-corporate-blue text-white font-semibold rounded-xl hover:bg-[#002244] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <><Loader2 size={20} className="animate-spin" /> Ingresando...</> : 'Ingresar'}
          </button>

          <p className="text-xs text-center text-text-secondary mt-2">
            Primer acceso técnicos: contraseña <span className="font-mono font-medium">Hidro2026</span>
          </p>

          {!isCapacitor && (
          <>
          <button
            type="button"
            onClick={() => setShowServerConfig(!showServerConfig)}
            className="flex items-center gap-1 text-xs text-text-secondary hover:text-corporate-blue mx-auto mt-2"
          >
            <Settings size={14} /> Configurar servidor
          </button>
          {showServerConfig && (
            <div className="mt-3 p-3 bg-gray-50 rounded-xl space-y-2 border border-border-light">
              <input
                type="url"
                value={serverUrl}
                onChange={e => setServerUrl(e.target.value)}
                placeholder="https://servidor.ejemplo.com"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border-light"
              />
              <button
                type="button"
                onClick={saveServerUrl}
                className="w-full py-2 text-sm bg-corporate-blue text-white rounded-lg"
              >
                Guardar URL
              </button>
            </div>
          )}
          </>
          )}
        </motion.form>
      </motion.div>
    </div>
  );
}
