import { AttendanceData, AdminConfig, Employee, AppSettings, AttendancePhoto, Location, EmployeeLocation, Ticket, TicketMessage, AuditLog, SystemHealth } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5045/api';
const API_RETRY_ATTEMPTS = 3;
const API_RETRY_DELAY_MS = 400;

// Token management
let authToken: string | null = localStorage.getItem('admin_token');

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetryResponse(status: number) {
  if (status === 503) return false;
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, attempts = API_RETRY_ATTEMPTS) {
  let lastError: unknown = null;

  const modifiedInit = init ? { ...init } : {};
  if (authToken) {
    const headers = new Headers(modifiedInit.headers);
    headers.set('Authorization', `Bearer ${authToken}`);
    modifiedInit.headers = headers;
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await window.fetch(input, modifiedInit);
      
      if (response.status === 503) {
        const clone = response.clone();
        try {
          const data = await clone.json();
          if (data.isMaintenance) {
            window.dispatchEvent(new Event('maintenance-mode'));
            throw new Error(data.message || 'Sistem sedang dalam perbaikan rutin (Maintenance Mode).');
          }
        } catch (e) {
          if (e instanceof Error && e.message.includes('Maintenance Mode')) throw e;
        }
      }

      if (!shouldRetryResponse(response.status) || attempt === attempts) {
        return response;
      }
      lastError = new Error(`API returned ${response.status}`);
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        throw error;
      }
    }

    await sleep(API_RETRY_DELAY_MS * attempt);
  }

  throw lastError instanceof Error ? lastError : new Error('Gagal menghubungkan ke server');
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

export const getImageUrl = (url?: string | null) => {
  if (!url) return '';
  if (url.startsWith('/')) {
    return `${API_URL.replace('/api', '')}${url}`;
  }
  return url;
};

export const api = {
  // === Admin Auth ===
  async login(id: string, password: string): Promise<{ success: boolean; message?: string; token?: string }> {
    try {
      const res = await fetchWithRetry(`${API_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, password })
      });
      const data = await res.json();
      if (data.success && data.token) {
        authToken = data.token;
        localStorage.setItem('admin_token', data.token);
        if (data.role) localStorage.setItem('admin_role', data.role);
      }
      return data;
    } catch (e) {
      console.error(e);
      return { success: false, message: 'Gagal menghubungkan ke server' };
    }
  },

  async logout() {
    try {
      await fetchWithRetry(`${API_URL}/admin/logout`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch (e) {
      // ignore
    }
    authToken = null;
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_role');
  },

  async verifyToken(): Promise<{ success: boolean; role?: string }> {
    try {
      const res = await fetchWithRetry(`${API_URL}/admin/verify`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        if (data.role) localStorage.setItem('admin_role', data.role);
        return { success: true, role: data.role };
      }
      return { success: false };
    } catch (e) {
      return { success: false };
    }
  },

  async updateAdminConfig(config: AdminConfig) {
    const res = await fetchWithRetry(`${API_URL}/admin/update-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(config)
    });
    return await res.json();
  },

  // === Attendance ===
  async recognizeAttendanceFace(photoDataUrl: string): Promise<{ success?: boolean; message?: string; employee?: { name: string; photo_url?: string }; face?: { distance: number } }> {
    try {
      const res = await fetchWithRetry(`${API_URL}/attendance/recognize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoDataUrl })
      });
      const text = await res.text();
      let payload: { success?: boolean; message?: string; employee?: { name: string; photo_url?: string }; face?: { distance: number } } = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch (e) {
        payload = {};
      }
      if (!res.ok) {
        return { success: false, message: payload.message || 'Wajah belum berhasil dikenali.' };
      }
      return payload;
    } catch (e) {
      console.error(e);
      return { success: false, message: 'Tidak bisa terhubung ke server pengenalan wajah.' };
    }
  },

  async saveAttendance(data: Partial<AttendanceData>) {
    try {
      const res = await fetchWithRetry(`${API_URL}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      const text = await res.text();
      let payload: { success?: boolean; message?: string; employee?: { name: string }; face?: { distance: number } } = {};
      try {
        payload = text ? JSON.parse(text) : {};
      } catch (e) {
        payload = {};
      }

      if (!res.ok) {
        return {
          success: false,
          message: payload.message || 'Presensi belum berhasil disimpan. Silakan coba lagi.'
        };
      }

      return payload;
    } catch (e) {
      console.error(e);
      return {
        success: false,
        message: 'Tidak bisa terhubung ke server presensi. Periksa koneksi lalu coba lagi.'
      };
    }
  },

  async getAttendanceHistory(): Promise<AttendanceData[]> {
    try {
      const res = await fetchWithRetry(`${API_URL}/attendance`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async getAttendancePhotos(): Promise<AttendancePhoto[]> {
    try {
      const res = await fetchWithRetry(`${API_URL}/attendance/photos`, {
        headers: getAuthHeaders()
      });
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async deleteAttendancePhoto(attendanceId: number, type: 'masuk' | 'pulang') {
    const res = await fetchWithRetry(`${API_URL}/attendance/photos/${attendanceId}/${type}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  // === Employees ===
  async getEmployees(): Promise<Employee[]> {
    try {
      const res = await fetchWithRetry(`${API_URL}/employees`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async addEmployee(data: Partial<Employee>) {
    const res = await fetchWithRetry(`${API_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async registerFace(employeeName: string, photos: string[]) {
    const res = await fetchWithRetry(`${API_URL}/face/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeName, photos })
    });
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      return {
        success: false,
        message: res.status === 413
          ? 'Ukuran foto terlalu besar. Silakan ulangi dengan kamera lebih dekat atau kualitas lebih kecil.'
          : 'Registrasi wajah belum berhasil. Silakan coba lagi.'
      };
    }
  },

  async updateEmployee(name: string, status: string, photoDataUrl?: string) {
    const res = await fetchWithRetry(`${API_URL}/employees/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, photoDataUrl })
    });
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      return {
        success: false,
        message: res.status === 413
          ? 'Ukuran foto terlalu besar. Pilih foto yang lebih kecil.'
          : 'Perubahan pegawai belum berhasil disimpan. Silakan coba lagi.'
      };
    }
  },

  async updateEmployeePhoto(name: string, photoDataUrl: string) {
    const res = await fetchWithRetry(`${API_URL}/employees/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoDataUrl })
    });
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      return {
        success: false,
        message: res.status === 413
          ? 'Ukuran foto terlalu besar. Pilih foto yang lebih kecil.'
          : 'Foto pegawai belum berhasil diperbarui. Silakan coba lagi.'
      };
    }
  },

  async deleteEmployee(name: string) {
    const res = await fetchWithRetry(`${API_URL}/employees/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // === Locations ===
  async getLocations(): Promise<string[]> {
    try {
      const res = await fetchWithRetry(`${API_URL}/locations`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async getAdminLocations(): Promise<Location[]> {
    try {
      const res = await fetchWithRetry(`${API_URL}/locations/admin`, {
        headers: getAuthHeaders()
      });
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async addAdminLocation(data: Partial<Location>) {
    const res = await fetchWithRetry(`${API_URL}/locations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async updateAdminLocation(id: number, data: Partial<Location>) {
    const res = await fetchWithRetry(`${API_URL}/locations/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async deleteAdminLocation(id: number) {
    const res = await fetchWithRetry(`${API_URL}/locations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  async resolveLocation(latitude: number, longitude: number, accuracy: number) {
    try {
      const res = await fetchWithRetry(`${API_URL}/locations/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude, accuracy })
      });
      return await res.json();
    } catch (e) {
      console.error(e);
      return { success: false, message: 'Gagal memvalidasi koordinat dengan server.' };
    }
  },

  async getEmployeeLocations(id: number | string): Promise<EmployeeLocation[]> {
    try {
      const res = await fetchWithRetry(`${API_URL}/employees/${id}/locations`, {
        headers: getAuthHeaders()
      });
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async updateEmployeeLocations(id: number | string, locations: EmployeeLocation[]) {
    const res = await fetchWithRetry(`${API_URL}/employees/${id}/locations`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ locations })
    });
    return await res.json();
  },

  // === Shifts ===
  async getShifts(): Promise<Record<string, { start_time: string; end_time: string; is_overtime: boolean }>> {
    try {
      const res = await fetchWithRetry(`${API_URL}/shifts`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return {};
    }
  },

  async addShift(name: string, start_time: string, end_time: string, is_overtime: boolean = false) {
    const res = await fetchWithRetry(`${API_URL}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, start_time, end_time, is_overtime })
    });
    return await res.json();
  },

  async updateShift(name: string, start_time: string, end_time: string, is_overtime: boolean = false) {
    const res = await fetchWithRetry(`${API_URL}/shifts/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time, end_time, is_overtime })
    });
    return await res.json();
  },

  async deleteShift(name: string) {
    const res = await fetchWithRetry(`${API_URL}/shifts/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // === Settings ===
  async getSettings(): Promise<AppSettings> {
    try {
      const res = await fetchWithRetry(`${API_URL}/settings`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return { barcode_content: 'KOPERASI GIAT', late_threshold_minutes: '5' };
    }
  },

  async updateSettings(settings: Partial<AppSettings>) {
    const res = await fetchWithRetry(`${API_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return await res.json();
  },

  async runAttendanceCleanup(retentionDays: number) {
    const res = await fetchWithRetry(`${API_URL}/settings/attendance-cleanup/run`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ retentionDays })
    });
    return await res.json();
  },

  // === Tickets (Public) ===
  async createTicket(data: Partial<Ticket> & { screenshot_data_url?: string }) {
    const res = await fetchWithRetry(`${API_URL}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async getTicketStatus(ticketNumber: string, reporterName: string) {
    const res = await fetchWithRetry(`${API_URL}/tickets/status/${encodeURIComponent(ticketNumber)}?reporter_name=${encodeURIComponent(reporterName)}`);
    return await res.json();
  },

  async replyTicketPublic(ticketNumber: string, data: { reporter_name: string; message: string; attachment_data_url?: string }) {
    const res = await fetchWithRetry(`${API_URL}/tickets/status/${encodeURIComponent(ticketNumber)}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  // === Tickets (Admin) ===
  async getAdminTickets(filters?: { status?: string; priority?: string; search?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.search) params.append('search', filters.search);
    
    const res = await fetchWithRetry(`${API_URL}/tickets/admin?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  async getAdminTicketDetail(id: number) {
    const res = await fetchWithRetry(`${API_URL}/tickets/admin/${id}`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  async updateAdminTicketStatus(id: number, status?: string, priority?: string) {
    const res = await fetchWithRetry(`${API_URL}/tickets/admin/${id}/status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, priority })
    });
    return await res.json();
  },

  async replyAdminTicket(id: number, data: { message: string; attachment_data_url?: string; new_status?: string }) {
    const res = await fetchWithRetry(`${API_URL}/tickets/admin/${id}/reply`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  // === Admin Accounts (Superadmin) ===
  async getAdminAccounts() {
    const res = await fetchWithRetry(`${API_URL}/admin/accounts`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  async addAdminAccount(data: AdminConfig) {
    const res = await fetchWithRetry(`${API_URL}/admin/accounts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async updateAdminAccount(id: number | string, data: Partial<AdminConfig>) {
    const res = await fetchWithRetry(`${API_URL}/admin/accounts/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async resetAdminPassword(id: number | string, password: string) {
    const res = await fetchWithRetry(`${API_URL}/admin/accounts/${id}/reset-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ password })
    });
    return await res.json();
  },

  async deleteAdminAccount(id: number | string) {
    const res = await fetchWithRetry(`${API_URL}/admin/accounts/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  // === Audit & System (Superadmin) ===
  async getAuditLogs(filters?: { module?: string; action?: string; search?: string }) {
    const params = new URLSearchParams();
    if (filters?.module) params.append('module', filters.module);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.search) params.append('search', filters.search);

    const res = await fetchWithRetry(`${API_URL}/audit?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  async getSystemHealth() {
    const res = await fetchWithRetry(`${API_URL}/system/health`, {
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  async triggerSystemBackup() {
    const res = await fetchWithRetry(`${API_URL}/system/backup`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    } else {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const disposition = res.headers.get('content-disposition');
      let filename = 'backup.sql';
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      return { success: true, file: filename };
    }
  }
};
