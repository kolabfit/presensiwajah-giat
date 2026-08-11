import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AppSettings } from '../types';
import { Settings2, ScanLine, MapPin, Clock, Fingerprint, Save } from 'lucide-react';

export function GlobalSettingsTab({ useToast }: { useToast: any }) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Record<string, string>>({});

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
      setFormData({
        barcode_content: data.barcode_content || 'KOPERASI GIAT',
        late_threshold_minutes: data.late_threshold_minutes || '5',
        face_match_threshold: data.face_match_threshold || '0.45',
        face_min_score: data.face_min_score || '0.5',
        face_max_attempts: data.face_max_attempts || '3',
        geofence_max_accuracy: data.geofence_max_accuracy || '100',
        geofence_max_radius: data.geofence_max_radius || '500',
        geofence_min_radius: data.geofence_min_radius || '50',
        geofence_require_gps: data.geofence_require_gps || 'true',
        geofence_require_same_checkout: data.geofence_require_same_checkout || 'false'
      });
    } catch (e) {
      useToast.showToast('Gagal memuat pengaturan global', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateSettings(formData);
      useToast.showToast('Pengaturan global berhasil disimpan', 'success');
      await loadSettings();
    } catch (e) {
      useToast.showToast('Gagal menyimpan pengaturan', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-[#B21B1B] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Parameter Global</h2>
          <p className="text-slate-500 text-sm mt-1">Konfigurasi variabel utama aplikasi absensi Ko+Lab Giat.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-[#B21B1B] text-white rounded-xl font-bold shadow-lg shadow-red-900/20 hover:bg-[#901515] transition-all disabled:opacity-70 disabled:shadow-none"
        >
          {saving ? <div className="w-5 h-5 border-2 border-red-200 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
          {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* KELOMPOK 1: Umum & Waktu */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-700">
              <Clock size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Umum & Waktu</h3>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Batas Waktu Terlambat</label>
            <div className="relative">
              <input
                type="number"
                value={formData.late_threshold_minutes}
                onChange={e => handleChange('late_threshold_minutes', e.target.value)}
                className="w-full pl-4 pr-16 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">menit</span>
            </div>
            <p className="text-[11px] text-slate-500">Toleransi keterlambatan setelah jam masuk shift.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Teks Konten Barcode</label>
            <div className="relative">
              <input
                type="text"
                value={formData.barcode_content}
                onChange={e => handleChange('barcode_content', e.target.value)}
                className="w-full pl-4 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
              />
            </div>
            <p className="text-[11px] text-slate-500">Nilai text yang dihasilkan saat menekan tombol Check-In (Scanner barcode akan dicocokkan dengan ini).</p>
          </div>
        </div>

        {/* KELOMPOK 2: Pengenalan Wajah */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Fingerprint size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Pengenalan Wajah</h3>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Threshold Kemiripan Wajah</label>
            <input
              type="number"
              step="0.01"
              max="1"
              min="0"
              value={formData.face_match_threshold}
              onChange={e => handleChange('face_match_threshold', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
            />
            <p className="text-[11px] text-slate-500">Batas jarak euclidean maksimal (contoh: 0.45). Semakin kecil nilainya, semakin ketat sistem mencocokkan.</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Minimal Skor Deteksi Wajah</label>
            <input
              type="number"
              step="0.01"
              max="1"
              min="0"
              value={formData.face_min_score}
              onChange={e => handleChange('face_min_score', e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
            />
            <p className="text-[11px] text-slate-500">Probabilitas minimal (confidence score) bahwa gambar mengandung sebuah wajah (0.0 - 1.0).</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Batas Maksimal Percobaan</label>
            <div className="relative">
              <input
                type="number"
                value={formData.face_max_attempts}
                onChange={e => handleChange('face_max_attempts', e.target.value)}
                className="w-full pl-4 pr-16 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">kali</span>
            </div>
            <p className="text-[11px] text-slate-500">Maksimal percobaan gagal deteksi/cocok sebelum sistem memunculkan form kendala helpdesk.</p>
          </div>
        </div>

        {/* KELOMPOK 3: Geofencing & GPS */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6 md:col-span-2">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
            <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center text-green-600">
              <MapPin size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">Geofencing & Keamanan Lokasi</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Toleransi Akurasi GPS (Maksimal)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.geofence_max_accuracy}
                    onChange={e => handleChange('geofence_max_accuracy', e.target.value)}
                    className="w-full pl-4 pr-16 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">meter</span>
                </div>
                <p className="text-[11px] text-slate-500">Jika akurasi GPS HP melampaui ini, presensi ditolak (untuk mencegah lokasi palsu/ngaco).</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Radius Terkecil (Default)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.geofence_min_radius}
                    onChange={e => handleChange('geofence_min_radius', e.target.value)}
                    className="w-full pl-4 pr-16 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">meter</span>
                </div>
                <p className="text-[11px] text-slate-500">Batas toleransi radius minimum dari lokasi kantor.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Batas Radius Terbesar</label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.geofence_max_radius}
                    onChange={e => handleChange('geofence_max_radius', e.target.value)}
                    className="w-full pl-4 pr-16 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">meter</span>
                </div>
                <p className="text-[11px] text-slate-500">Sistem akan menolak presensi jika pegawai berada di luar jarak radius maskimal ini dari lokasi kantor.</p>
              </div>
            </div>

            <div className="space-y-6">
              <label className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">Wajibkan GPS (Location Services)</div>
                  <div className="text-xs text-slate-500 mt-1">Jika dimatikan, pegawai bisa absen tanpa verifikasi jarak. (Sangat tidak disarankan)</div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.geofence_require_gps === 'true'}
                  onChange={e => handleChange('geofence_require_gps', e.target.checked ? 'true' : 'false')}
                  className="w-5 h-5 accent-[#B21B1B]"
                />
              </label>

              <label className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer">
                <div>
                  <div className="font-bold text-slate-800">Wajib Pulang di Lokasi yang Sama</div>
                  <div className="text-xs text-slate-500 mt-1">Jika aktif, pegawai harus check-out (pulang) di titik lokasi yang sama dengan saat ia check-in (masuk).</div>
                </div>
                <input
                  type="checkbox"
                  checked={formData.geofence_require_same_checkout === 'true'}
                  onChange={e => handleChange('geofence_require_same_checkout', e.target.checked ? 'true' : 'false')}
                  className="w-5 h-5 accent-[#B21B1B]"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
