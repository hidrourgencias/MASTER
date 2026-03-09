export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pendiente: 'Pendiente',
    aprobado: 'Aprobado',
    rechazado: 'Rechazado',
    inconcluso: 'Inconcluso / Falta más antecedentes'
  };
  return map[status] || status;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-800',
    aprobado: 'bg-green-100 text-green-800',
    rechazado: 'bg-red-100 text-red-800',
    inconcluso: 'bg-amber-100 text-amber-800'
  };
  return map[status] || 'bg-gray-100 text-gray-800';
}

export function paymentScheduleLabel(schedule: string): string {
  const map: Record<string, string> = {
    '1_dia': '1 día',
    '5_dias': '5 días',
    '15_dias': '15 días',
    '30_dias': '30 días',
    '45_dias': '45 días',
    'inmediato_transferencia': 'Pago inmediato (transferencia)',
    'inmediato_efectivo': 'Pago inmediato (efectivo)',
    'garantia': 'No pago por garantía',
    contado: 'Al contado',
    plazo: 'A plazo'
  };
  return map[schedule] || schedule;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function clientTypeLabel(type: string): string {
  const map: Record<string, string> = {
    PARTICULAR: 'Particular',
    COMERCIAL: 'Comercial',
    CLIENTE: 'Cliente',
    particular: 'Particular',
    empresa: 'Empresa'
  };
  return map[type] || type;
}
