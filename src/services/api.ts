import { AttendanceData, AdminConfig, Employee, AppSettings, AttendancePhoto } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Token management
let authToken: string | null = localStorage.getItem('admin_token');

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
      const res = await fetch(`${API_URL}/admin/login`, {
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
      await fetch(`${API_URL}/admin/logout`, {
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
      const res = await fetch(`${API_URL}/admin/verify`, {
        headers: getAuthHeaders()
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  },

  async updateAdminConfig(config: AdminConfig) {
    const res = await fetch(`${API_URL}/admin/update-password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(config)
    });
    return await res.json();
  },

  // === Attendance ===
  async saveAttendance(data: Partial<AttendanceData>) {
    try {
      const res = await fetch(`${API_URL}/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      const text = await res.text();
      let payload: { success?: boolean; message?: string } = {};
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
      const res = await fetch(`${API_URL}/attendance`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async getAttendancePhotos(): Promise<AttendancePhoto[]> {
    try {
      const res = await fetch(`${API_URL}/attendance/photos`, {
        headers: getAuthHeaders()
      });
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async deleteAttendancePhoto(attendanceId: number, type: 'masuk' | 'pulang') {
    const res = await fetch(`${API_URL}/attendance/photos/${attendanceId}/${type}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return await res.json();
  },

  // === Employees ===
  async getEmployees(): Promise<Employee[]> {
    try {
      const res = await fetch(`${API_URL}/employees`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async addEmployee(data: Partial<Employee>) {
    const res = await fetch(`${API_URL}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await res.json();
  },

  async getEmployeeByQr(qrCode: string): Promise<{ success: boolean; message?: string; employee?: Employee }> {
    try {
      const cleanQrCode = qrCode.trim();
      if (!cleanQrCode) {
        return { success: false, message: 'QR tidak terbaca. Arahkan kamera ke QR pegawai sampai terlihat jelas.' };
      }

      const res = await fetch(`${API_URL}/employees/qr/${encodeURIComponent(cleanQrCode)}`);
      const text = await res.text();
      let data: { success?: boolean; message?: string; employee?: Employee } = {};

      try {
        data = text ? JSON.parse(text) : {};
      } catch (e) {
        data = {};
      }

      if (!res.ok) {
        return {
          success: false,
          message: data.message || (res.status === 404
            ? 'QR pegawai tidak ditemukan. Pastikan QR berasal dari daftar pegawai aplikasi ini.'
            : 'QR belum bisa diperiksa. Silakan coba scan ulang.')
        };
      }

      return data as { success: boolean; message?: string; employee?: Employee };
    } catch (e) {
      console.error(e);
      return { success: false, message: 'Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.' };
    }
  },

  async saveEmployeeQrImage(name: string, qrDataUrl: string) {
    const res = await fetch(`${API_URL}/employees/${encodeURIComponent(name)}/qr-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qrDataUrl })
    });
    return await res.json();
  },

  async updateEmployee(name: string, status: string) {
    const res = await fetch(`${API_URL}/employees/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return await res.json();
  },

  async deleteEmployee(name: string) {
    const res = await fetch(`${API_URL}/employees/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // === Locations ===
  async getLocations(): Promise<string[]> {
    try {
      const res = await fetch(`${API_URL}/locations`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  async addLocation(name: string) {
    const res = await fetch(`${API_URL}/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    return await res.json();
  },

  async deleteLocation(name: string) {
    const res = await fetch(`${API_URL}/locations/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // === Shifts ===
  async getShifts(): Promise<Record<string, { start_time: string; end_time: string; is_overtime: boolean }>> {
    try {
      const res = await fetch(`${API_URL}/shifts`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return {};
    }
  },

  async addShift(name: string, start_time: string, end_time: string, is_overtime: boolean = false) {
    const res = await fetch(`${API_URL}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, start_time, end_time, is_overtime })
    });
    return await res.json();
  },

  async updateShift(name: string, start_time: string, end_time: string, is_overtime: boolean = false) {
    const res = await fetch(`${API_URL}/shifts/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time, end_time, is_overtime })
    });
    return await res.json();
  },

  async deleteShift(name: string) {
    const res = await fetch(`${API_URL}/shifts/${encodeURIComponent(name)}`, {
      method: 'DELETE'
    });
    return await res.json();
  },

  // === Settings ===
  async getSettings(): Promise<AppSettings> {
    try {
      const res = await fetch(`${API_URL}/settings`);
      return await res.json();
    } catch (e) {
      console.error(e);
      return { barcode_content: 'KOPERASI GIAT', late_threshold_minutes: '6' };
    }
  },

  async updateSettings(settings: Partial<AppSettings>) {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return await res.json();
  }
};
