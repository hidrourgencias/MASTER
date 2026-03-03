import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Receipt, BarChart3, Shield, User, Menu, X, LogOut, Settings, FileText, Phone, Wrench, Briefcase, DollarSign, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: Home, label: 'Inicio' },
    { to: '/gastos', icon: Receipt, label: 'Gastos' },
    { to: '/servicios', icon: Briefcase, label: 'Servicios' },
    { to: '/reportes', icon: BarChart3, label: 'Reportes' },
    ...(isAdmin ? [{ to: '/admin', icon: Shield, label: 'Admin' }] : []),
    { to: '/perfil', icon: User, label: 'Perfil' },
  ];

  return (
    <div className="min-h-screen bg-bg-main flex flex-col">
      {/* Header */}
      <header className="bg-corporate-blue text-white px-4 py-3 flex items-center justify-between shadow-lg sticky top-0 z-40">
        <button onClick={() => setDrawerOpen(true)} className="p-1 hover:bg-white/10 rounded-lg transition">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-corporate-light rounded-lg flex items-center justify-center font-bold text-sm">H</div>
          <span className="font-semibold text-sm">Hidrourgencias</span>
        </div>
        <div className="text-xs opacity-80 truncate max-w-[100px]">{user?.display_name}</div>
      </header>

      {/* Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-50" onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="bg-corporate-blue text-white p-5">
                <button onClick={() => setDrawerOpen(false)} className="absolute top-3 right-3 p-1 hover:bg-white/10 rounded">
                  <X size={20} />
                </button>
                <div className="w-12 h-12 bg-corporate-light rounded-xl flex items-center justify-center text-xl font-bold mb-3">H</div>
                <h2 className="font-bold">Hidrourgencias SpA</h2>
                <p className="text-sm opacity-80">Sistema de Rendiciones</p>
              </div>
              <nav className="flex-1 py-2 overflow-y-auto">
                {isAdmin && (
                  <>
                    <DrawerLink to="/admin/pagos-tecnicos" icon={DollarSign} label="Pagos a Técnicos" onClick={() => setDrawerOpen(false)} />
                    <DrawerLink to="/admin/tipos-servicio" icon={Wrench} label="Tipos de Servicio (Cobros)" onClick={() => setDrawerOpen(false)} />
                    <DrawerLink to="/admin/servicios" icon={ClipboardList} label="Gestión de Servicios (Gastos)" onClick={() => setDrawerOpen(false)} />
                    <DrawerLink to="/admin/configuracion" icon={Settings} label="Configuración OCR" onClick={() => setDrawerOpen(false)} />
                    <DrawerLink to="/admin/auditoria" icon={FileText} label="Historial Auditoría" onClick={() => setDrawerOpen(false)} />
                  </>
                )}
                <DrawerLink to="/soporte" icon={Phone} label="Soporte" onClick={() => setDrawerOpen(false)} />
                <div className="border-t my-2" />
                <button onClick={handleLogout} className="flex items-center gap-3 w-full px-5 py-3 text-red-600 hover:bg-red-50 transition">
                  <LogOut size={20} /><span>Cerrar Sesión</span>
                </button>
              </nav>
              <div className="p-4 text-xs text-text-secondary border-t">v1.0.0 - Hidrourgencias SpA</div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Content */}
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-border-light flex justify-around py-2 z-40 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition text-xs ${isActive ? 'text-corporate-light font-semibold' : 'text-text-secondary hover:text-corporate-blue'}`
            }
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function DrawerLink({ to, icon: Icon, label, onClick }: { to: string; icon: any; label: string; onClick: () => void }) {
  return (
    <NavLink to={to} onClick={onClick} className={({ isActive }) =>
      `flex items-center gap-3 px-5 py-3 transition ${isActive ? 'bg-blue-50 text-corporate-blue font-medium' : 'text-text-primary hover:bg-gray-50'}`
    }>
      <Icon size={20} /><span>{label}</span>
    </NavLink>
  );
}
