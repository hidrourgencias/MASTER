/**
 * Handlers de eventos ERP. Se registran al iniciar el servidor.
 */
import { on } from './eventBus.js';

export function registerEventHandlers() {
  on('onServiceCompleted', async (payload) => {
    // Flujo de caja ya se registra en las rutas; aquí se pueden agregar
    // notificaciones, webhooks, etc.
    if (payload?.jobId) {
      console.log(`[ERP] Servicio completado: Ticket #${payload.jobId}`);
    }
  });
}
