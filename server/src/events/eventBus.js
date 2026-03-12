/**
 * Event bus ligero para automatización ERP.
 * Emite eventos cuando ocurren acciones clave en tickets, pagos, gastos.
 */
const handlers = {};

export function on(event, handler) {
  if (!handlers[event]) handlers[event] = [];
  handlers[event].push(handler);
}

export async function emit(event, payload) {
  const list = handlers[event] || [];
  for (const h of list) {
    try {
      await h(payload);
    } catch (err) {
      console.error(`[EventBus] Error en handler ${event}:`, err);
    }
  }
}
