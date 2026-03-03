import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function ChangePassword() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isForced = user?.must_change_password === 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      await refreshUser();
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-corporate-blue to-[#001a33] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-500 rounded-2xl mb-3">
            <Lock size={32} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">
            {isForced ? 'Cambio Obligatorio de Contraseña' : 'Cambiar Contraseña'}
          </h1>
          {isForced && <p className="text-blue-200 text-sm mt-1">Debe establecer una nueva contraseña para continuar</p>}
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3 text-center">{error}</div>
          )}

          {!isForced && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Contraseña actual</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-border-light focus:ring-2 focus:ring-corporate-light outline-none" required />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Nueva contraseña</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 pr-12 rounded-xl border border-border-light focus:ring-2 focus:ring-corporate-light outline-none"
                placeholder="Mínimo 6 caracteres" required />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary">
                {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Confirmar nueva contraseña</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-border-light focus:ring-2 focus:ring-corporate-light outline-none" required />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-corporate-blue text-white font-semibold rounded-xl hover:bg-[#002244] transition flex items-center justify-center gap-2 disabled:opacity-60">
            {loading ? <><Loader2 size={20} className="animate-spin" /> Guardando...</> : 'Guardar Contraseña'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
