import React, { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, CheckCircle2, AlertCircle, RefreshCw, Copy } from 'lucide-react';
import { api } from '../services/api';
import { Employee } from '../types';

export function TicketForm({ onCancel, useToast }: { onCancel: () => void, useToast: any }) {
  const [formData, setFormData] = useState({
    reporter_name: '',
    category: 'Presensi Masuk',
    title: '',
    description: ''
  });
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successTicket, setSuccessTicket] = useState<string | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    api.getEmployees().then(setEmployees);
  }, []);

  const handleCaptureScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setScreenshot(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const getSystemContext = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';

    let os = 'Unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS')) os = 'Mac OS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS')) os = 'iOS';

    return {
      browser,
      operating_system: os,
      device: /Mobi|Android/i.test(ua) ? 'Mobile' : 'Desktop',
      page_url: window.location.href,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.reporter_name || !formData.title || !formData.description) {
      useToast.showToast('Harap lengkapi semua field yang wajib.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const context = getSystemContext();
      const res = await api.createTicket({
        ...formData,
        ...context,
        screenshot_data_url: screenshot || undefined
      });

      if (res.success) {
        setSuccessTicket(res.ticket_number);
        useToast.showToast('Laporan berhasil dikirim.', 'success');
      } else {
        useToast.showToast(res.message || 'Gagal mengirim laporan', 'error');
      }
    } catch (error) {
      useToast.showToast('Terjadi kesalahan koneksi', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successTicket) {
    return (
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in p-8 text-center max-w-md mx-auto w-full">
        <CheckCircle2 size={64} className="mx-auto text-green-500 mb-6" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Laporan Berhasil Dikirim</h2>
        <p className="text-slate-600 mb-6">Terima kasih atas laporan Anda. Kami akan segera menindaklanjutinya.</p>
        
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8">
          <p className="text-sm text-slate-500 mb-1">Nomor Tiket Anda:</p>
          <div className="flex items-center justify-center gap-3">
            <p className="text-2xl font-mono font-bold text-blue-600 tracking-wider">{successTicket}</p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(successTicket);
                useToast.showToast('Nomor tiket disalin!', 'success');
              }}
              className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
              title="Salin Nomor Tiket"
            >
              <Copy size={20} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2">Simpan nomor ini untuk mengecek status laporan.</p>
        </div>

        <button
          onClick={onCancel}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-medium transition-colors"
        >
          Kembali ke Halaman Utama
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 w-full max-w-lg mx-auto flex flex-col max-h-[90vh]">
      <div className="bg-[#B21B1B] text-white p-6 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-16 -translate-y-16" />
        <h2 className="text-xl font-bold mb-1 relative z-10">Laporkan Kendala</h2>
        <p className="text-[#F1C40F] text-sm relative z-10">Sampaikan kendala teknis yang Anda alami</p>
      </div>

      <div className="p-6 overflow-y-auto flex-1">
        <form id="ticket-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Pegawai <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={formData.reporter_name}
              onChange={e => {
                setFormData({ ...formData, reporter_name: e.target.value });
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#B21B1B] focus:border-[#B21B1B] transition-all"
              placeholder="Ketik sebagian nama presensi..."
            />
            {showDropdown && formData.reporter_name && employees.filter(e => e.name && e.name.toLowerCase().includes(formData.reporter_name.toLowerCase())).length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {employees.filter(e => e.name && e.name.toLowerCase().includes(formData.reporter_name.toLowerCase())).map((emp, i) => (
                  <div
                    key={i}
                    className="px-4 py-3 hover:bg-red-50 cursor-pointer text-sm text-slate-700 font-medium border-b border-slate-100 last:border-0"
                    onClick={() => {
                      setFormData({ ...formData, reporter_name: emp.name });
                      setShowDropdown(false);
                    }}
                  >
                    {emp.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kategori <span className="text-red-500">*</span></label>
            <select
              value={formData.category}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#B21B1B] focus:border-[#B21B1B] transition-all"
            >
              <option value="Presensi Masuk">Presensi Masuk</option>
              <option value="Presensi Pulang">Presensi Pulang</option>
              <option value="Face Recognition">Face Recognition</option>
              <option value="GPS / Lokasi">GPS / Lokasi</option>
              <option value="Kamera">Kamera</option>
              <option value="Aplikasi Lambat">Aplikasi Lambat</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Judul Kendala <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#B21B1B] focus:border-[#B21B1B] transition-all"
              placeholder="Contoh: Kamera tidak terbuka"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Deskripsi Detail <span className="text-red-500">*</span></label>
            <textarea
              required
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#B21B1B] focus:border-[#B21B1B] transition-all min-h-[100px]"
              placeholder="Ceritakan detail kendala yang dialami..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Screenshot (Opsional)</label>
            <div className="mt-1 flex items-center gap-4">
              {screenshot && (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                  <img src={screenshot} alt="Screenshot" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setScreenshot(null)}
                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"
                  >
                    ×
                  </button>
                </div>
              )}
              {!screenshot && (
                <label className="cursor-pointer bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-slate-500 hover:border-[#B21B1B] hover:text-[#B21B1B] transition-all flex-1">
                  <ImageIcon size={24} className="mb-2" />
                  <span className="text-sm font-medium">Unggah Foto / Screenshot</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handleCaptureScreenshot} />
                </label>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          Batal
        </button>
        <button
          type="submit"
          form="ticket-form"
          disabled={isSubmitting}
          className="flex-1 px-4 py-3 bg-gradient-to-r from-[#B21B1B] to-[#E74C3C] text-white rounded-xl font-medium hover:from-[#8A1515] hover:to-[#C0392B] transition-colors shadow-lg shadow-red-500/30 flex items-center justify-center disabled:opacity-70"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2"><RefreshCw size={18} className="animate-spin" /> Mengirim...</span>
          ) : (
            'Kirim Laporan'
          )}
        </button>
      </div>
    </div>
  );
}
