import { AttendanceData, AdminConfig, Employee, AppSettings, AttendancePhoto, Location, EmployeeLocation } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5045/api';
const API_RETRY_ATTEMPTS = 3;
const API_RETRY_DELAY_MS = 400;

// Token management
let authToken: string | null = localStorage.getItem('admin_token');

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetryResponse(status: number) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithRetry(input: RequestInfo | URL, init?: RequestInit, attempts = API_RETRY_ATTEMPTS) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await window.fetch(input, init);
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
  },

  async verifyToken(): Promise<boolean> {
    try {
      const res = await fetchWithRetry(`${API_URL}/admin/verify`, {
        headers: getAuthHeaders()
      });
      return res.ok;
    } catch (e) {
      return false;
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
  }
};
