import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'cl.hidrourgencias.rendiciones',
  appName: 'Hidrourgencias',
  webDir: 'dist',
  server: {
    url: 'https://hidrourgencias.onrender.com',
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
