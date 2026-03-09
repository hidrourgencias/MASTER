import type { CapacitorConfig } from '@capacitor/cli';

// Servidor estable (sin borrar datos): usar CAPACITOR_SERVER_URL con tu URL.
// Ej. servidor en São Paulo/Brasil: $env:CAPACITOR_SERVER_URL="https://tu-servidor.com"
// Render free hace spin-down tras 15 min de inactividad.
const serverUrl = process.env.CAPACITOR_SERVER_URL || 'https://hidrourgencias.onrender.com';

const config: CapacitorConfig = {
  appId: 'cl.hidrourgencias.rendiciones',
  appName: 'Hidrourgencias',
  webDir: 'dist',
  server: {
    url: serverUrl,
    cleartext: true
  },
  android: {
    allowMixedContent: true
  },
  plugins: {
    Camera: {
      permissions: ['camera']
    }
  }
};

export default config;
