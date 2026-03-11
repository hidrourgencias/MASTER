import type { CapacitorConfig } from '@capacitor/cli';

// La APK usa la app empaquetada localmente (dist). Solo server.url se usa
// para desarrollo en vivo; en producción la app va incluida en la APK.
const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'cl.hidrourgencias.rendiciones',
  appName: 'Hidrourgencias',
  webDir: 'dist',
  // Solo cargar desde URL remota si se define (para desarrollo). En producción usa dist empaquetado.
  ...(serverUrl ? { server: { url: serverUrl, cleartext: true } } : {}),
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
