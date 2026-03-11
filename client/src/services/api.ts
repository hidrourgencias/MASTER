const isCapacitor = !!(window as any).Capacitor;

// URL del servidor backend (Render). En Capacitor la app va empaquetada; la API está en la nube.
const DEFAULT_API_BASE = 'https://hidrourgencias.onrender.com/api';

const DEFAULT_SERVER = 'https://hidrourgencias.onrender.com';

function getBaseUrl(): string {
  const stored = localStorage.getItem('server_url');
  if (stored) return stored.replace(/\/$/, '') + '/api';
  if (isCapacitor) return DEFAULT_API_BASE;
  return '/api';
}

function getServerOrigin(): string {
  const stored = localStorage.getItem('server_url');
  if (stored) return stored.replace(/\/$/, '');
  if (isCapacitor) return DEFAULT_SERVER;
  return '';
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${getBaseUrl()}${endpoint}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // HashRouter: hash sin # extra para evitar ##/login
    window.location.hash = '/login';
    throw new Error('No autorizado');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Error de servidor' }));
    throw new Error(error.error || 'Error de servidor');
  }

  if (res.headers.get('content-type')?.includes('application/json')) {
    return res.json();
  }
  return res as unknown as T;
}

export function getUploadsUrl(filename: string): string {
  const stored = localStorage.getItem('server_url');
  if (stored) return stored.replace(/\/$/, '') + '/uploads/' + filename;
  if (isCapacitor) return 'https://hidrourgencias.onrender.com/uploads/' + filename;
  return '/uploads/' + filename;
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password })
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request('/auth/change-password', {
      method: 'POST', body: JSON.stringify({ currentPassword, newPassword })
    }),

  getMe: () => request<any>('/auth/me'),

  getExpenses: () => request<any[]>('/expenses'),
  getExpenseSummary: () => request<any>('/expenses/summary'),
  getExpenseStats: () => request<any>('/expenses/stats'),
  createExpense: (formData: FormData) =>
    request<any>('/expenses', { method: 'POST', body: formData }),
  approveExpense: (id: number, status: string) =>
    request<any>(`/expenses/${id}/approve`, {
      method: 'PUT', body: JSON.stringify({ status })
    }),
  payExpense: (id: number) =>
    request<any>(`/expenses/${id}/pay`, { method: 'PUT', body: JSON.stringify({}) }),
  deleteExpense: (id: number) =>
    request<any>(`/expenses/${id}`, { method: 'DELETE' }),

  getUsers: () => request<any[]>('/users'),
  getTechnicians: () => request<any[]>('/users/technicians'),
  updateProfile: (data: any) =>
    request<any>('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),
  resetPassword: (id: number) =>
    request<any>(`/users/${id}/reset-password`, { method: 'PUT', body: JSON.stringify({}) }),
  updateUser: (id: number, data: any) =>
    request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  scanReceipt: (formData: FormData) =>
    request<any>('/ocr/scan', { method: 'POST', body: formData }),
  getFrequentRuts: () => request<any[]>('/ocr/frequent-ruts'),

  getServices: () => request<any[]>('/services'),
  getAdminServices: () => request<any[]>('/admin/services'),
  createService: (name: string) =>
    request<any>('/admin/services', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteService: (id: number) =>
    request<any>(`/admin/services/${id}`, { method: 'DELETE' }),

  getAuditLog: () => request<any[]>('/admin/audit-log'),
  getSettings: () => request<any>('/admin/settings'),
  updateSettings: (data: any) =>
    request<any>('/admin/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getPaymentMethods: () => request<any[]>('/admin/payment-methods'),
  createPaymentMethod: (name: string) => request<any>('/admin/payment-methods', { method: 'POST', body: JSON.stringify({ name }) }),
  deletePaymentMethod: (id: number) => request<any>(`/admin/payment-methods/${id}`, { method: 'DELETE' }),

  getJobServices: () => request<any[]>('/jobs/job-services'),
  getJobs: () => request<any[]>('/jobs'),
  getJob: (id: number) => request<any>(`/jobs/${id}`),
  getJobSummary: () => request<any>('/jobs/summary'),
  createJob: (formData: FormData) =>
    request<any>('/jobs', { method: 'POST', body: formData }),
  updateJob: (id: number, formData: FormData) =>
    request<any>(`/jobs/${id}`, { method: 'PUT', body: formData }),
  setJobPayment: (id: number, technician_payment: number) =>
    request<any>(`/jobs/${id}/set-payment`, {
      method: 'PUT', body: JSON.stringify({ technician_payment })
    }),
  approveJob: (id: number, data: { amount?: number; technician_payment?: number; admin_payment_method?: string; admin_payment_schedule?: string; admin_payment_notes?: string }) =>
    request<any>(`/jobs/${id}/approve`, {
      method: 'PUT', body: JSON.stringify(data)
    }),
  setJobPaymentFull: (id: number, data: { amount?: number; technician_payment?: number; admin_payment_method?: string; admin_payment_schedule?: string; admin_payment_notes?: string }) =>
    request<any>(`/jobs/${id}/set-payment`, {
      method: 'PUT', body: JSON.stringify(data)
    }),
  markJobPaid: (id: number) =>
    request<any>(`/jobs/${id}/mark-paid`, { method: 'PUT', body: JSON.stringify({}) }),
  deleteJob: (id: number) =>
    request<any>(`/jobs/${id}`, { method: 'DELETE' }),

  getAdminJobServices: () => request<any[]>('/jobs/admin/job-services'),
  createJobService: (name: string) =>
    request<any>('/jobs/admin/job-services', { method: 'POST', body: JSON.stringify({ name }) }),
  deleteJobService: (id: number) =>
    request<any>(`/jobs/admin/job-services/${id}`, { method: 'DELETE' }),

  getWorkOrders: () => request<any[]>('/work-orders'),
  createWorkOrder: (data: any) => request<any>('/work-orders', { method: 'POST', body: JSON.stringify(data) }),
  sendWorkOrder: (id: number) => request<any>(`/work-orders/${id}/send`, { method: 'PUT' }),
  getWorkOrderServiceTypes: () => request<any[]>('/work-orders/service-types'),
  createWorkOrderServiceType: (name: string) => request<any>('/work-orders/service-types', { method: 'POST', body: JSON.stringify({ name }) }),
  getWorkOrderAttentionTypes: () => request<any[]>('/work-orders/attention-types'),
  getNotifications: () => request<any[]>('/work-orders/notifications'),
  receiveWorkOrderAssignment: (assignmentId: number) =>
    request<any>(`/work-orders/assignments/${assignmentId}/receive`, { method: 'PUT' }),
  escalateWorkOrderAssignment: (assignmentId: number) =>
    request<any>(`/work-orders/assignments/${assignmentId}/escalate`, { method: 'PUT' }),
  getEquipmentCatalog: () => request<any[]>('/admin/equipment'),
  getAdminEquipment: () => request<any[]>('/admin/equipment'),
  createEquipment: (name: string, category: string) =>
    request<any>('/admin/equipment', { method: 'POST', body: JSON.stringify({ name, category }) }),
  deleteEquipment: (id: number) =>
    request<any>(`/admin/equipment/${id}`, { method: 'DELETE' }),
  
  schedulePostventa: (jobId: number) => request<any>(`/jobs/${jobId}/postventa`, { method: 'POST' }),

  getWhatsappNumber: () => request<any>('/admin/settings').then((s: any) => ({ whatsapp_number: s?.whatsapp_number })),
  getPaymentAudit: () => request<any[]>('/admin/payment-audit'),

  exportExcel: async (params: Record<string, string>) => {
    const token = getToken();
    const query = new URLSearchParams(params).toString();
    const baseOrigin = getServerOrigin();
    const res = await fetch(`${baseOrigin}/api/admin/export?${query}`, {
      headers: { Authorization: `Bearer ${token}` } as any
    });
    if (!res.ok) throw new Error('Error al exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rendiciones_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportPaymentsExcel: async (params: Record<string, string> = {}) => {
    const token = getToken();
    const query = new URLSearchParams(params).toString();
    const baseOrigin = getServerOrigin();
    const res = await fetch(`${baseOrigin}/api/admin/export-payments?${query}`, {
      headers: { Authorization: `Bearer ${token}` } as any
    });
    if (!res.ok) throw new Error('Error al exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pagos_tecnicos_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },

  exportContableExcel: async (params: Record<string, string> = {}) => {
    const token = getToken();
    const query = new URLSearchParams(params).toString();
    const baseOrigin = getServerOrigin();
    const res = await fetch(`${baseOrigin}/api/admin/export-contable?${query}`, {
      headers: { Authorization: `Bearer ${token}` } as any
    });
    if (!res.ok) throw new Error('Error al exportar');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planilla_contable_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },

  // Quotes API
  getQuotes: () => request<any[]>('/quotes'),
  getQuote: (id: number) => request<any>(`/quotes/${id}`),
  createQuote: (data: any) => request<any>('/quotes', { method: 'POST', body: JSON.stringify(data) }),
  updateQuote: (id: number, data: any) => request<any>(`/quotes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  updateQuoteStatus: (id: number, status: string, admin_notes: string) => 
    request<any>(`/quotes/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, admin_notes }) }),
  convertQuoteToWO: (id: number, technician_id: number) => 
    request<any>(`/quotes/${id}/convert-work-order`, { method: 'POST', body: JSON.stringify({ technician_id }) }),
};
