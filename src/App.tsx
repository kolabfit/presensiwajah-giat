import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, User, ShieldCheck, LogOut, Menu, X, ChevronRight, BarChart3, History, Settings, Download, Eye, EyeOff, Camera, CheckCircle2, AlertCircle, Plus, Upload, Search, Filter, ArrowLeft, MoreHorizontal, Edit2, Trash2, MapPin, Clock as ClockIcon, Database } from 'lucide-react';
import Clock from './components/Clock';
import { Shift, AttendanceData, Employee, AppSettings } from './types';
import { api } from './services/api';
import { format, isAfter, addMinutes, parse, startOfDay, subDays, isWithinInterval } from 'date-fns';
import QrScanner from 'qr-scanner';
import * as XLSX from 'xlsx';

// No hardcoded constants - all data comes from the database via API

// === TOAST & CONFIRM SYSTEM ===
type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }

const ToastContext = createContext<{
  showToast: (message: string, type?: ToastType) => void;
  showConfirm: (message: string, onConfirm: () => void) => void;
}>({ showToast: () => {}, showConfirm: () => {} });

function useToast() { return useContext(ToastContext); }

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);  
  const [confirmState, setConfirmState] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  const showConfirm = useCallback((message: string, onConfirm: () => void) => {
    setConfirmState({ message, onConfirm });
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-[200] space-y-2 max-w-sm">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              className={`px-4 py-3 rounded-xl shadow-lg border flex items-start gap-3 ${
                toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                'bg-white border-slate-200 text-slate-800'
              }`}
            >
              {toast.type === 'success' && <CheckCircle2 size={18} className="text-green-500 mt-0.5 flex-shrink-0" />}
              {toast.type === 'error' && <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0" />}
              {toast.type === 'info' && <AlertCircle size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />}
              <span className="text-sm font-medium">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Confirm dialog */}
      <AnimatePresence>
        {confirmState && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmState(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative z-10 space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle size={20} className="text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Konfirmasi</h3>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">{confirmState.message}</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setConfirmState(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => { confirmState.onConfirm(); setConfirmState(null); }}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-colors"
                >
                  Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export default function App() {
  const [view, setView] = useState<'employee' | 'admin-login' | 'admin-dashboard'>('employee');

  return (
    <ToastProvider>
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-900">
      <AnimatePresence mode="wait">
        {view === 'employee' && (
          <EmployeePage onAdminClick={() => setView('admin-login')} />
        )}
        {view === 'admin-login' && (
          <AdminLogin onLoginSuccess={() => setView('admin-dashboard')} onBack={() => setView('employee')} />
        )}
        {view === 'admin-dashboard' && (
          <AdminDashboard onLogout={() => setView('employee')} />
        )}
      </AnimatePresence>
    </div>
    </ToastProvider>
  );
}

function EmployeePage({ onAdminClick }: { onAdminClick: () => void }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [shift, setShift] = useState<Shift | ''>('');
  const [note, setNote] = useState('');
  const [isLate, setIsLate] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [wrongQrDetected, setWrongQrDetected] = useState(false);
  const scannerRef = useRef<QrScanner | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const wrongQrTimerRef = useRef<number | null>(null);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [presensiType, setPresensiType] = useState<'masuk' | 'pulang'>('masuk');

  // Data dari database (bukan hardcode)
  const [employees, setEmployees] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [shifts, setShifts] = useState<Record<string, { start_time: string; end_time: string; is_overtime: boolean }>>({});
  const [settings, setSettings] = useState<AppSettings>({ barcode_content: '', late_threshold_minutes: '6' });

  const parseDateStr = (dateVal: any): string => {
    if (!dateVal) return '';
    try {
      if (typeof dateVal === 'string') {
        const ymdMatch = dateVal.match(/(\d{4}-\d{2}-\d{2})/);
        if (ymdMatch) return ymdMatch[1];
        const dmyMatch = dateVal.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dmyMatch) {
          const d = dmyMatch[1].padStart(2, '0');
          const m = dmyMatch[2].padStart(2, '0');
          return `${dmyMatch[3]}-${m}-${d}`;
        }
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
      } 
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
    } catch (e) {}
    return String(dateVal);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.getAttendanceHistory();
      setAttendanceData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Fetch master data dari database
    api.getEmployees().then(data => setEmployees(data.filter(e => e.status === 'AKTIF').map(e => e.name)));
    api.getLocations().then(data => setLocations(data));
    api.getShifts().then(data => setShifts(data));
    api.getSettings().then(data => setSettings(data));

    const handleFocus = () => fetchData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    if (name) {
      fetchData();
    }
  }, [name]);

  useEffect(() => {
    if (!name) {
      setHasCheckedIn(false);
      setHasCheckedOut(false);
      setLocation('');
      setShift('');
      setPresensiType('masuk');
      return;
    }

    if (loading && attendanceData.length === 0) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayRecords = attendanceData.filter(d => 
      d.Name === name && 
      parseDateStr(d.Date) === todayStr
    );

    const checkInRecord = todayRecords.find(d => d.TimeIn && !d.TimeOut);
    const completedRecord = todayRecords.find(d => d.TimeIn && d.TimeOut);

    if (completedRecord) {
      setLocation(completedRecord.Location || '');
      setShift(completedRecord.Shift as Shift || '');
      setHasCheckedIn(true);
      setHasCheckedOut(true);
    } else if (checkInRecord) {
      setLocation(checkInRecord.Location || '');
      setShift(checkInRecord.Shift as Shift || '');
      setHasCheckedIn(true);
      setHasCheckedOut(false);
    } else {
      setHasCheckedIn(false);
      setHasCheckedOut(false);
      setLocation('');
      setShift('');
      setPresensiType('masuk');
    }
  }, [name, attendanceData, loading]);

  useEffect(() => {
    if (shift && !hasCheckedIn && presensiType === 'masuk') {
      const shiftData = shifts[shift];
      if (!shiftData?.start_time || shiftData.is_overtime) { setIsLate(false); return; }
      const now = new Date();
      const shiftStartTime = parse(shiftData.start_time, 'HH:mm', now);
      const lateThreshold = addMinutes(shiftStartTime, parseInt(settings.late_threshold_minutes) || 6);
      
      if (isAfter(now, lateThreshold)) {
        setIsLate(true);
      } else {
        setIsLate(false);
        setNote('');
      }
    } else {
      setIsLate(false);
      setNote('');
    }
  }, [shift, hasCheckedIn, presensiType, shifts, settings]);

  const startScanner = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      if (!videoRef.current) {
        setIsScanning(false);
        setScanResult({ success: false, message: 'Video element tidak siap. Coba ulangi.' });
        return;
      }
      try {
        const qrScanner = new QrScanner(
          videoRef.current,
          (result) => {
            // Validasi dulu — kalau bukan QR yang benar, JANGAN stop scanner
            const scanned = result.data.trim().toUpperCase();
            const expected = (settings.barcode_content || 'KOPERASI GIAT').trim().toUpperCase();
            const isValid = scanned === expected ||
                           (scanned.includes("KOPERASI") && scanned.includes("GIAT")) ||
                           scanned.includes("KOPERASIGIAT") ||
                           scanned.startsWith("KOPERASI");

            if (!isValid) {
              // Tampilkan peringatan sementara, scanner tetap jalan
              setWrongQrDetected(true);
              if (wrongQrTimerRef.current) window.clearTimeout(wrongQrTimerRef.current);
              wrongQrTimerRef.current = window.setTimeout(() => {
                setWrongQrDetected(false);
              }, 2000);
              return;
            }

            // QR benar — stop scanner dan proses
            qrScanner.stop();
            qrScanner.destroy();
            scannerRef.current = null;
            setWrongQrDetected(false);
            setIsScanning(false);
            handleScan(result.data);
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: false,
            highlightCodeOutline: false,
            maxScansPerSecond: 30,
            calculateScanRegion: (video) => ({
              x: 0,
              y: 0,
              width: video.videoWidth,
              height: video.videoHeight,
            }),
          }
        );
        scannerRef.current = qrScanner;
        await qrScanner.start();
      } catch (err) {
        console.error("Unable to start scanning", err);
        scannerRef.current = null;
        setIsScanning(false);
        setScanResult({ success: false, message: 'Gagal mengakses kamera. Pastikan izin kamera diberikan dan perangkat memiliki kamera belakang.' });
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      } catch (e) {
        // ignore
      }
      scannerRef.current = null;
    }
    if (wrongQrTimerRef.current) {
      window.clearTimeout(wrongQrTimerRef.current);
      wrongQrTimerRef.current = null;
    }
    setWrongQrDetected(false);
    setIsScanning(false);
  };

  const handleScan = async (content: string) => {
    const scannedContent = content.trim().toUpperCase();
    const expectedContent = (settings.barcode_content || 'KOPERASI GIAT').trim().toUpperCase();
    
    const isMatch = scannedContent === expectedContent || 
                   (scannedContent.includes("KOPERASI") && scannedContent.includes("GIAT")) ||
                   scannedContent.includes("KOPERASIGIAT") || 
                   scannedContent.startsWith("KOPERASI");

    if (!isMatch) {
      setScanResult({ 
        success: false, 
        message: 'Barcode tidak dikenali. Harap scan barcode Koperasi Giat yang resmi.' 
      });
      return;
    }

    // ⚡ Tampilkan loading INSTANT saat QR terdeteksi
    setIsProcessing(true);

    const now = new Date();
    const isCheckIn = presensiType === 'masuk';
    const data: Partial<AttendanceData> = isCheckIn
      ? {
          Date: format(now, 'yyyy-MM-dd'),
          Name: name,
          Location: location,
          Shift: shift as Shift,
          TimeIn: format(now, 'HH.mm'),
          Status: isLate ? 'Terlambat' : 'Tepat Waktu',
          Note: note
        }
      : {
          Date: format(now, 'yyyy-MM-dd'),
          Name: name,
          Shift: shift as Shift,
          TimeOut: format(now, 'HH.mm')
        };

    try {
      const result = await api.saveAttendance(data);
      setIsProcessing(false);
      if (result.success) {
        const successMsg = isCheckIn 
          ? (isLate ? 'Presensi masuk berhasil (Terlambat)' : 'Presensi masuk berhasil') 
          : 'Presensi pulang berhasil';
        setScanResult({ success: true, message: successMsg });
        if (isCheckIn) setHasCheckedIn(true);
        else setHasCheckedOut(true);
        fetchData();
      } else {
        setScanResult({ success: false, message: result.message || 'Gagal menyimpan data' });
      }
    } catch (e) {
      setIsProcessing(false);
      setScanResult({ success: false, message: 'Gagal menghubungi server. Periksa koneksi internet.' });
    }
  };

  const currentRecord = name ? attendanceData.find(d => 
    d.Name === name && 
    parseDateStr(d.Date) === format(new Date(), 'yyyy-MM-dd')
  ) : null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-xl mx-auto p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex justify-between items-center py-2">
        <img src="https://i.ibb.co.com/YBMQyzfN/logo-giat-remove-bg.png" alt="Logo Giat" className="h-10" />
        <button onClick={onAdminClick} className="w-10 h-10 bg-slate-200 text-slate-500 hover:bg-slate-300 rounded-full flex items-center justify-center transition-colors">
          <User size={20} />
        </button>
      </div>

      <Clock />

      {/* Main Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
        {/* Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-xl">
          <button
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all ${
              presensiType === 'masuk' 
                ? 'bg-[#B21B1B] text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setPresensiType('masuk')}
          >
            Presensi Masuk
          </button>
          <button
            className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all disabled:opacity-50 ${
              presensiType === 'pulang' 
                ? 'bg-[#B21B1B] text-white shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed'
            }`}
            onClick={() => setPresensiType('pulang')}
            disabled={!hasCheckedIn}
            title={!hasCheckedIn ? "Anda harus Presensi Masuk terlebih dahulu" : ""}
          >
            Presensi Pulang
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-[#003366] text-[10px] font-bold uppercase tracking-widest py-1 animate-pulse">
            <div className="w-3 h-3 border-2 border-[#003366] border-t-transparent rounded-full animate-spin"></div>
            Menyinkronkan Data...
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Nama Pegawai</label>
            <select 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3.5 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm appearance-none"
            >
              <option value="">Pilih Nama Pegawai</option>
              {employees.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Lokasi Kerja</label>
              <select 
                value={location} 
                onChange={(e) => setLocation(e.target.value)}
                disabled={hasCheckedIn}
                className={`w-full p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm appearance-none ${hasCheckedIn ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
              >
                <option value="">Pilih Lokasi</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Waktu Shift</label>
              <select 
                value={shift} 
                onChange={(e) => setShift(e.target.value as Shift)}
                disabled={hasCheckedIn}
                className={`w-full p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm appearance-none ${hasCheckedIn ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
              >
                <option value="">Pilih Shift</option>
                {Object.entries(shifts).map(([s, t]) => {
                  const times = t as { start_time: string; end_time: string };
                  return <option key={s} value={s}>{s} ({times.start_time} – {times.end_time})</option>;
                })}
              </select>
              {shift && shifts[shift] && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                  <ClockIcon size={12} className="text-[#B21B1B]" />
                  <span className="font-bold text-slate-700">{shifts[shift].start_time}</span>
                  <span className="text-slate-400">–</span>
                  <span className="font-bold text-slate-700">{shifts[shift].end_time}</span>
                </div>
              )}
            </div>
          </div>

          {isLate && presensiType === 'masuk' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <label className="block text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2">Catatan Keterlambatan</label>
              <textarea 
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Berikan alasan keterlambatan..."
                className="w-full p-3.5 rounded-xl border border-red-200 bg-red-50 focus:ring-2 focus:ring-red-500/20 outline-none transition-all min-h-[80px] text-sm"
              />
            </motion.div>
          )}
        </div>

        <div className="pt-2">
          <button
            disabled={!name || !location || !shift || (isLate && presensiType === 'masuk' && !note) || (presensiType === 'masuk' && hasCheckedIn) || (presensiType === 'pulang' && hasCheckedOut)}
            onClick={startScanner}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              !name || !location || !shift || (isLate && presensiType === 'masuk' && !note) || (presensiType === 'masuk' && hasCheckedIn) || (presensiType === 'pulang' && hasCheckedOut)
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#B21B1B] text-white hover:bg-[#901515] shadow-lg shadow-red-900/20 active:scale-95'
            }`}
          >
            <Camera size={20} />
            {presensiType === 'masuk' ? 'SCAN BARCODE MASUK' : 'SCAN BARCODE PULANG'}
          </button>
          <p className="text-center text-[10px] text-slate-400 mt-4">
            Silakan scan kode QR di area presensi untuk {presensiType === 'masuk' ? 'Clock-in' : 'Clock-out'}
          </p>
        </div>
      </div>

      {/* History Section */}
      {name && (
        <div className="space-y-3 pt-4">
          <div className="flex justify-between items-center px-1">
            <div className="flex items-center gap-2 text-[#B21B1B] font-bold text-sm">
              <History size={16} />
              Riwayat Presensi Hari Ini
            </div>
            <button className="text-[10px] text-[#B21B1B] font-bold hover:underline">
              Lihat Semua
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Aktivitas</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium">
                {!hasCheckedIn && !hasCheckedOut && (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-400 italic">Belum ada riwayat presensi.</td>
                  </tr>
                )}

                {hasCheckedIn && (
                  <tr className="bg-white">
                    <td className="px-4 py-4 text-slate-800">
                      {currentRecord?.TimeIn || '--:--'}
                    </td>
                    <td className="px-4 py-4 text-slate-600">Clock-In (Masuk)</td>
                    <td className="px-4 py-4">
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full uppercase tracking-wider ${
                        currentRecord?.Status === 'Terlambat' ? 'text-red-600 bg-red-50' : 'text-green-600 bg-green-50'
                      }`}>
                        {currentRecord?.Status || 'TEPAT WAKTU'}
                      </span>
                    </td>
                  </tr>
                )}

                {(hasCheckedIn || hasCheckedOut) && (
                  <tr className="bg-white">
                    <td className="px-4 py-4 text-slate-400">
                      {hasCheckedOut ? currentRecord?.TimeOut || '--:--' : '--:--'}
                    </td>
                    <td className={`px-4 py-4 ${hasCheckedOut ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                      {hasCheckedOut ? 'Clock-Out (Pulang)' : 'Belum Absen Pulang'}
                    </td>
                    <td className="px-4 py-4">
                      {hasCheckedOut ? (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">
                          SELESAI
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="pt-2 pb-6 space-y-2">
            <p className="text-center text-[10px] text-slate-400 italic">
              *Data diperbarui secara real-time berdasarkan sistem pusat
            </p>
            <div className="flex justify-center items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-[10px] font-bold text-slate-500">Sistem Presensi Aktif & Terkoneksi</span>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Popup */}
      {isScanning && (
        <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm bg-black rounded-2xl overflow-hidden relative aspect-square">
            <video ref={videoRef} className="w-full h-full object-cover" />
            {/* Overlay kotak target */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className={`w-3/4 h-3/4 relative transition-colors ${wrongQrDetected ? 'opacity-80' : ''}`}>
                <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 rounded-tl-lg ${wrongQrDetected ? 'border-red-500' : 'border-white'}`}></div>
                <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 rounded-tr-lg ${wrongQrDetected ? 'border-red-500' : 'border-white'}`}></div>
                <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 rounded-bl-lg ${wrongQrDetected ? 'border-red-500' : 'border-white'}`}></div>
                <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 rounded-br-lg ${wrongQrDetected ? 'border-red-500' : 'border-white'}`}></div>
              </div>
            </div>
            {/* Banner peringatan kalau QR salah */}
            {wrongQrDetected && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute top-3 left-3 right-3 bg-red-500/95 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium"
              >
                <AlertCircle size={16} />
                QR code tidak valid
              </motion.div>
            )}
          </div>
          <p className="text-white/80 text-sm font-medium mt-4 text-center">
            {wrongQrDetected ? 'Coba scan QR Koperasi Giat yang resmi' : 'Arahkan kamera ke QR code'}
          </p>
          <button 
            onClick={stopScanner}
            className="mt-6 px-8 py-3 bg-white text-slate-900 rounded-full font-bold shadow-lg active:scale-95 transition-transform"
          >
            BATAL
          </button>
        </div>
      )}

      {/* Processing Popup */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-6 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
          >
            <div className="h-2 bg-[#B21B1B]" />
            <div className="p-8 text-center space-y-5">
              <div className="w-20 h-20 mx-auto rounded-full bg-slate-50 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#B21B1B] border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-800">Memproses...</h3>
                <p className="text-sm text-slate-500 mt-2">QR code terdeteksi. Menyimpan data presensi.</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Result Popup */}
      {scanResult && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-6 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
          >
            {/* Header colored bar */}
            <div className={`h-2 ${scanResult.success ? 'bg-green-500' : 'bg-red-500'}`} />
            
            <div className="p-8 text-center space-y-5">
              {/* Icon */}
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${scanResult.success ? 'bg-green-50' : 'bg-red-50'}`}>
                {scanResult.success ? (
                  <CheckCircle2 size={40} className="text-green-500" />
                ) : (
                  <X size={40} className="text-red-500" />
                )}
              </div>

              {/* Title */}
              <div>
                <h3 className={`text-lg font-extrabold ${scanResult.success ? 'text-green-700' : 'text-red-700'}`}>
                  {scanResult.success ? 'Berhasil!' : 'Gagal'}
                </h3>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                  {scanResult.message}
                </p>
              </div>

              {/* Button */}
              <button 
                onClick={() => setScanResult(null)}
                className={`w-full py-3.5 rounded-xl font-bold text-white transition-all active:scale-95 ${
                  scanResult.success 
                    ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20' 
                    : 'bg-slate-800 hover:bg-slate-900 shadow-lg shadow-slate-800/20'
                }`}
              >
                OK
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function AdminLogin({ onLoginSuccess, onBack }: { onLoginSuccess: () => void; onBack: () => void }) {
  const [idInput, setIdInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await api.login(idInput, password);
      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.message || 'ID atau Password salah');
      }
    } catch (e) {
      setError('Gagal menghubungkan ke server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen flex items-center justify-center p-6 bg-slate-50"
    >
      <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-100 space-y-8">
        <div className="text-center mb-8">
          <img src="https://i.ibb.co.com/YBMQyzfN/logo-giat-remove-bg.png" alt="Logo" className="h-16 mx-auto mb-4" />
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Admin Login</h2>
          <p className="text-slate-500 text-sm">Akses monitoring Koperasi Giat</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Admin ID</label>
            <input 
              type="text"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              placeholder="Masukkan ID"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input 
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Masukkan Password"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}

          <div className="pt-4 space-y-4">
            <button 
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#B21B1B] text-white rounded-xl font-bold shadow-lg shadow-red-900/20 hover:bg-[#901515] transition-all active:scale-95 disabled:opacity-50"
            >
              {loading ? 'MENGHUBUNGKAN...' : 'LOGIN'}
            </button>
            <button 
              type="button"
              onClick={onBack}
              className="w-full py-4 text-slate-500 font-semibold hover:text-slate-800 transition-all"
            >
              Kembali ke Halaman Pegawai
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}

function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'employees' | 'master-data' | 'settings'>('dashboard');
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPresentPopup, setShowPresentPopup] = useState(false);
  const [showLatePopup, setShowLatePopup] = useState(false);

  // History Filters
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 5), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  // Settings
  const [newId, setNewId] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleLogout = async () => {
    await api.logout();
    onLogout();
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Parallel fetch could be faster if we had multiple endpoints, 
      // but for now we just ensure we show a nice loading state
      const data = await api.getAttendanceHistory();
      setAttendanceData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const parseDateStr = (dateVal: any): string => {
    if (!dateVal) return '';
    
    try {
      // If it's already a string
      if (typeof dateVal === 'string') {
        // 1. Try YYYY-MM-DD (ISO or simple)
        const ymdMatch = dateVal.match(/(\d{4}-\d{2}-\d{2})/);
        if (ymdMatch) return ymdMatch[1];
        
        // 2. Try DD/MM/YYYY
        const dmyMatch = dateVal.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (dmyMatch) {
          const d = dmyMatch[1].padStart(2, '0');
          const m = dmyMatch[2].padStart(2, '0');
          return `${dmyMatch[3]}-${m}-${d}`;
        }

        // 3. Fallback to native Date
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
      } 
      
      // If it's a Date object or number
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) return format(d, 'yyyy-MM-dd');
    } catch (e) {
      console.error("Date parsing error:", e, dateVal);
    }
    
    return String(dateVal);
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  
  // Dashboard Utama should focus on TODAY
  const displayDate = todayStr;

  const todayData = attendanceData.filter(d => parseDateStr(d.Date) === displayDate)
    .sort((a, b) => String(b.TimeIn || '').localeCompare(String(a.TimeIn || '')));
  const presentOnTime = todayData.filter(d => d.Status === 'Tepat Waktu');
  const lateEmployees = todayData.filter(d => d.Status === 'Terlambat');

  const filteredHistory = attendanceData.filter(d => {
    const dDateStr = parseDateStr(d.Date);
    return dDateStr >= startDate && dDateStr <= endDate;
  }).sort((a, b) => {
    const aDate = parseDateStr(a.Date);
    const bDate = parseDateStr(b.Date);
    const aTime = String(a.TimeIn || '');
    const bTime = String(b.TimeIn || '');
    return bDate.localeCompare(aDate) || bTime.localeCompare(aTime);
  });

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredHistory);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presensi");
    XLSX.writeFile(wb, `Presensi_Koperasi_Giat_${startDate}_to_${endDate}.xlsx`);
  };

  const handleUpdateAdmin = async () => {
    if (!newId || !newPassword) { showToast('ID dan Password tidak boleh kosong', 'error'); return; }
    const result = await api.updateAdminConfig({ id: newId, password: newPassword });
    if (result.success) {
      showToast('Kredensial admin berhasil diubah. Silakan login ulang.', 'success');
      setTimeout(() => handleLogout(), 1500);
    } else {
      showToast(result.message || 'Gagal mengubah kredensial', 'error');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA]">
      {/* Desktop Sidebar */}
      <motion.div 
        animate={{ width: isDesktopCollapsed ? 88 : 288 }}
        className="hidden lg:flex flex-col bg-white text-slate-800 p-6 shadow-xl z-20 sticky top-0 h-screen transition-all overflow-hidden relative border-r border-slate-200"
      >
        <div className={`flex ${isDesktopCollapsed ? 'flex-col gap-4 items-center' : 'items-center justify-center'} mb-10 pb-6 border-b border-slate-100 mt-2 min-h-[48px] relative`}>
          {isDesktopCollapsed ? (
            <>
              <img src="https://i.ibb.co.com/YBMQyzfN/logo-giat-remove-bg.png" alt="Logo" className="w-10 h-10 object-contain mx-auto" />
              <button 
                onClick={() => setIsDesktopCollapsed(false)} 
                className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
            </>
          ) : (
            <>
              <img src="https://i.ibb.co.com/YBMQyzfN/logo-giat-remove-bg.png" alt="Logo" className="h-12 object-contain drop-shadow-sm" />
              <button 
                onClick={() => setIsDesktopCollapsed(true)} 
                className="absolute right-4 top-2 p-1.5 text-slate-400 hover:bg-slate-100 rounded-md transition-colors"
              >
                <X size={20} />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 space-y-3">
          <SidebarItem collapsed={isDesktopCollapsed} icon={<BarChart3 size={22} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <SidebarItem collapsed={isDesktopCollapsed} icon={<History size={22} />} label="Riwayat Presensi" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <SidebarItem collapsed={isDesktopCollapsed} icon={<User size={22} />} label="Data Pegawai" active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} />
          <SidebarItem collapsed={isDesktopCollapsed} icon={<Database size={22} />} label="Master Data" active={activeTab === 'master-data'} onClick={() => setActiveTab('master-data')} />
          <SidebarItem collapsed={isDesktopCollapsed} icon={<Settings size={22} />} label="Pengaturan" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>

        <button 
          onClick={handleLogout}
          className={`mt-auto flex items-center gap-3 p-4 bg-transparent text-red-500 hover:bg-red-50 rounded-xl transition-all font-bold ${isDesktopCollapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={20} className="min-w-[20px]" />
          {!isDesktopCollapsed && <span>LOGOUT</span>}
        </button>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <img src="https://i.ibb.co.com/YBMQyzfN/logo-giat-remove-bg.png" alt="Logo" className="h-8 lg:hidden" />
            <span className="font-extrabold text-[#B21B1B] lg:hidden text-sm">Koperasi GIAT</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="lg:hidden p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Logout">
              <LogOut size={20} />
            </button>
            <div className="flex items-center gap-3 pl-4">
               <div className="text-right hidden sm:block">
                 <div className="text-sm font-bold text-slate-800">Admin Koperasi</div>
                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Administrator</div>
               </div>
               <div className="w-10 h-10 bg-slate-200 rounded-full overflow-hidden border-2 border-white shadow-sm flex items-center justify-center">
                 <User className="text-slate-500 w-6 h-6" />
               </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto pb-24 lg:pb-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <div className="w-12 h-12 border-4 border-[#B21B1B] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[#B21B1B] font-bold tracking-widest animate-pulse text-sm">MEMUAT DATA...</p>
            </div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                    <SummaryCard 
                      label="Hadir Tepat Waktu" 
                      count={presentOnTime.length} 
                      color="green" 
                      onClick={() => setShowPresentPopup(true)} 
                    />
                    <SummaryCard 
                      label="Hadir Terlambat" 
                      count={lateEmployees.length} 
                      color="red" 
                      onClick={() => setShowLatePopup(true)} 
                    />
                  </div>

                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                      <h3 className="font-extrabold text-slate-800 text-lg">
                        Presensi Hari Ini <span className="text-[#B21B1B]">({format(new Date(), 'dd/MM/yyyy')})</span>
                      </h3>
                      <button onClick={fetchData} className="text-xs font-bold text-[#B21B1B] hover:text-red-800 hover:underline px-4 py-2 bg-red-50 rounded-lg transition-colors">
                        Refresh Data
                      </button>
                    </div>
                    <div className="overflow-x-auto scrollbar-hide">
                      <table className="w-full text-left min-w-[700px]">
                        <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                          <tr>
                            <th className="px-6 py-4">Nama Pegawai</th>
                            <th className="px-6 py-4">Lokasi Kerja</th>
                            <th className="px-6 py-4">Shift</th>
                            <th className="px-6 py-4">Jam Datang</th>
                            <th className="px-6 py-4">Jam Pulang</th>
                            <th className="px-6 py-4">Status / Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {todayData.length === 0 ? (
                            <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">Belum ada data presensi hari ini.</td></tr>
                          ) : (
                            todayData.map((d, i) => (
                              <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-6 py-4 font-bold text-slate-800">{d.Name}</td>
                                <td className="px-6 py-4 text-slate-500 text-sm font-medium">{d.Location}</td>
                                <td className="px-6 py-4 text-slate-500 text-sm">{d.Shift}</td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-700">{d.TimeIn}</td>
                                <td className="px-6 py-4 text-slate-400 text-sm font-medium">{d.TimeOut || '--:--'}</td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                      d.Status === 'Terlambat' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                                    }`}>
                                      {d.Status}
                                    </span>
                                    {d.Note && <span className="text-[10px] text-red-500 italic font-medium">{d.Note}</span>}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-2 w-full">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dari Tanggal</label>
                      <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setHistoryPage(1); }} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all" />
                    </div>
                    <div className="flex-1 space-y-2 w-full">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sampai Tanggal</label>
                      <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setHistoryPage(1); }} className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all" />
                    </div>
                    <button 
                      onClick={exportToExcel}
                      className="bg-green-600 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-all text-sm shadow-lg shadow-green-600/20 active:scale-95 w-full md:w-auto whitespace-nowrap"
                    >
                      <Download size={18} />
                      Export Excel
                    </button>
                  </div>

                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left min-w-[800px]">
                        <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                          <tr>
                            <th className="px-6 py-4">Tanggal</th>
                            <th className="px-6 py-4">Nama</th>
                            <th className="px-6 py-4">Lokasi</th>
                            <th className="px-6 py-4">Shift</th>
                            <th className="px-6 py-4">Datang</th>
                            <th className="px-6 py-4">Pulang</th>
                            <th className="px-6 py-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredHistory.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE).map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors text-sm group">
                              <td className="px-6 py-4 text-slate-500 font-medium">{d.Date}</td>
                              <td className="px-6 py-4 font-bold text-slate-800">{d.Name}</td>
                              <td className="px-6 py-4 text-slate-500">{d.Location}</td>
                              <td className="px-6 py-4 text-slate-500">{d.Shift}</td>
                              <td className="px-6 py-4 text-slate-700 font-bold">{d.TimeIn}</td>
                              <td className="px-6 py-4 text-slate-400 font-medium">{d.TimeOut || '--:--'}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${d.Status === 'Terlambat' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                  {d.Status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {filteredHistory.length === 0 && (
                            <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">Tidak ada data untuk periode ini.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {filteredHistory.length > 0 && (
                      <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-white">
                        <div className="text-sm font-medium text-slate-500">
                          Menampilkan {((historyPage - 1) * HISTORY_PAGE_SIZE) + 1}-{Math.min(historyPage * HISTORY_PAGE_SIZE, filteredHistory.length)} dari {filteredHistory.length} entri
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            disabled={historyPage === 1}
                            onClick={() => setHistoryPage(p => p - 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <ChevronRight size={16} className="rotate-180" />
                          </button>
                          {Array.from({ length: Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE) }).map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setHistoryPage(i + 1)}
                              className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold ${
                                historyPage === i + 1 ? 'bg-[#B21B1B] text-white' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {i + 1}
                            </button>
                          ))}
                          <button 
                            disabled={historyPage === Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE)}
                            onClick={() => setHistoryPage(p => p + 1)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-50"
                          >
                            <ChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'employees' && (
                <EmployeeStatsView attendanceData={attendanceData} />
              )}

              {activeTab === 'master-data' && (
                <MasterDataView />
              )}

              {activeTab === 'settings' && (
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="mb-8">
                    <h2 className="text-2xl font-black text-slate-800">Pengaturan Admin</h2>
                    <p className="text-slate-500 text-sm mt-1">Kelola kredensial akses dashboard admin dan preferensi sistem.</p>
                  </div>
                  
                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-[#B21B1B]">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-lg">Keamanan Akun</h3>
                        <p className="text-xs font-medium text-slate-500">Perbarui ID dan Password untuk login admin</p>
                      </div>
                    </div>
                    
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Admin ID Baru</label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="text" 
                            value={newId} 
                            onChange={e => setNewId(e.target.value)}
                            placeholder="Masukkan ID baru" 
                            className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all" 
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Password Baru</label>
                        <div className="relative">
                          <Settings className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input 
                            type="password" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)}
                            placeholder="Masukkan password baru" 
                            className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all" 
                          />
                        </div>
                      </div>
                      
                      <button 
                        onClick={handleUpdateAdmin}
                        className="w-full bg-[#B21B1B] text-white py-4 rounded-xl font-bold shadow-lg shadow-red-900/20 hover:bg-[#901515] transition-all active:scale-[0.98] mt-4"
                      >
                        SIMPAN PERUBAHAN
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
        <nav className="flex items-center justify-around px-2 py-2">
          <BottomNavItem icon={<BarChart3 size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <BottomNavItem icon={<History size={20} />} label="Riwayat" active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
          <BottomNavItem icon={<User size={20} />} label="Pegawai" active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} />
          <BottomNavItem icon={<Database size={20} />} label="Master" active={activeTab === 'master-data'} onClick={() => setActiveTab('master-data')} />
          <BottomNavItem icon={<Settings size={20} />} label="Setting" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
      </div>

      {/* Popups */}
      <AnimatePresence>
        {showPresentPopup && (
          <Modal title="Pegawai Hadir Tepat Waktu" onClose={() => setShowPresentPopup(false)}>
            <div className="space-y-3">
              {presentOnTime.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-4 bg-green-50 rounded-2xl border border-green-100 transition-colors hover:bg-green-100/50">
                  <span className="font-bold text-green-800">{p.Name}</span>
                  <span className="text-sm font-bold text-green-600 bg-white px-3 py-1 rounded-lg shadow-sm">{p.TimeIn}</span>
                </div>
              ))}
              {presentOnTime.length === 0 && <p className="text-center text-slate-400 font-medium py-8">Belum ada data kehadiran tepat waktu hari ini.</p>}
            </div>
          </Modal>
        )}
        {showLatePopup && (
          <Modal title="Pegawai Terlambat" onClose={() => setShowLatePopup(false)}>
            <div className="space-y-3">
              {lateEmployees.map((p, i) => (
                <div key={i} className="p-4 bg-red-50 rounded-2xl border border-red-100 space-y-2 transition-colors hover:bg-red-100/50">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-red-800">{p.Name}</span>
                    <span className="text-sm font-bold text-red-600 bg-white px-3 py-1 rounded-lg shadow-sm">{p.TimeIn}</span>
                  </div>
                  {p.Note && <p className="text-xs text-red-600/80 font-medium bg-red-100/50 p-2 rounded-lg">Catatan: {p.Note}</p>}
                </div>
              ))}
              {lateEmployees.length === 0 && <p className="text-center text-slate-400 font-medium py-8">Tidak ada pegawai terlambat hari ini.</p>}
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick, collapsed = false }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; collapsed?: boolean }) {
  return (
    <button 
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all font-bold ${
        active 
          ? 'bg-[#B21B1B] text-white shadow-md shadow-red-900/20' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      } ${collapsed ? 'justify-center px-0' : ''}`}
    >
      <div className="min-w-[24px] flex items-center justify-center">
        {icon}
      </div>
      {!collapsed && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}

function BottomNavItem({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[56px] ${
        active 
          ? 'text-[#B21B1B]' 
          : 'text-slate-400'
      }`}
    >
      <div className={`p-1.5 rounded-lg transition-all ${active ? 'bg-red-50' : ''}`}>
        {icon}
      </div>
      <span className={`text-[9px] font-bold ${active ? 'text-[#B21B1B]' : 'text-slate-400'}`}>{label}</span>
    </button>
  );
}

function SummaryCard({ label, count, color, onClick }: { label: string; count: number; color: 'green' | 'red'; onClick: () => void }) {
  const isGreen = color === 'green';
  return (
    <motion.button 
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-white p-6 md:p-8 rounded-3xl text-left shadow-sm border border-slate-100 flex items-center justify-between transition-all hover:shadow-xl group overflow-hidden relative cursor-pointer"
    >
      <div className={`absolute -right-4 -top-4 w-32 h-32 rounded-full -z-10 opacity-20 transition-transform duration-500 group-hover:scale-150 ${isGreen ? 'bg-green-500' : 'bg-red-500'}`} />
      <div className="relative z-10">
        <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</div>
        <div className={`text-4xl md:text-5xl font-black ${isGreen ? 'text-green-500' : 'text-[#B21B1B]'}`}>{count}</div>
      </div>
      <div className={`p-4 rounded-2xl relative z-10 ${isGreen ? 'bg-green-50 text-green-500' : 'bg-red-50 text-[#B21B1B]'}`}>
        {isGreen ? <CheckCircle2 size={36} /> : <AlertCircle size={36} />}
      </div>
    </motion.button>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative z-10 border border-slate-100"
      >
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-extrabold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors bg-white shadow-sm"><X size={18} /></button>
        </div>
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

function TimePicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [hour = '08', minute = '00'] = value.split(':');
  return (
    <div className="flex-1">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">{label}</label>
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <select
            value={hour}
            onChange={e => onChange(`${e.target.value}:${minute}`)}
            className="w-full pl-3 pr-7 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#B21B1B]/20 outline-none appearance-none cursor-pointer"
          >
            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
          <ChevronRight size={14} className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none opacity-50" />
        </div>
        <span className="font-bold text-slate-400">:</span>
        <div className="relative flex-1">
          <select
            value={minute}
            onChange={e => onChange(`${hour}:${e.target.value}`)}
            className="w-full pl-3 pr-7 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#B21B1B]/20 outline-none appearance-none cursor-pointer"
          >
            {['00', '15', '30', '45'].map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <ChevronRight size={14} className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none opacity-50" />
        </div>
      </div>
    </div>
  );
}

function MasterDataView() {
  const { showToast, showConfirm } = useToast();
  const [subTab, setSubTab] = useState<'employees' | 'locations' | 'shifts'>('employees');
  const [employees, setEmployees] = useState<{name: string, status: string}[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [shifts, setShifts] = useState<Record<string, { start_time: string; end_time: string; is_overtime: boolean }>>({});
  const [loading, setLoading] = useState(true);

  // Form states
  const [newEmpName, setNewEmpName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newShiftName, setNewShiftName] = useState('');
  const [newShiftTime, setNewShiftTime] = useState('08:00');
  const [newShiftEndTime, setNewShiftEndTime] = useState('17:00');
  const [newShiftIsOvertime, setNewShiftIsOvertime] = useState(false);

  // Edit shift (hanya jam, tidak mengubah nama)
  const [editingShift, setEditingShift] = useState<string | null>(null);
  const [editShiftStart, setEditShiftStart] = useState('08:00');
  const [editShiftEnd, setEditShiftEnd] = useState('17:00');
  const [editShiftIsOvertime, setEditShiftIsOvertime] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const [empData, locData, shiftData] = await Promise.all([
      api.getEmployees(),
      api.getLocations(),
      api.getShifts()
    ]);
    setEmployees(empData);
    setLocations(locData);
    setShifts(shiftData);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // === EMPLOYEE HANDLERS ===
  const handleAddEmployee = async () => {
    if (!newEmpName.trim()) return;
    const result = await api.addEmployee({ name: newEmpName.trim(), status: 'AKTIF' });
    if (result.success) {
      setNewEmpName('');
      showToast('Pegawai berhasil ditambahkan', 'success');
      fetchAll();
    } else {
      showToast(result.message || 'Gagal menambahkan pegawai', 'error');
    }
  };

  const handleUpdateEmployeeStatus = async (name: string, status: string) => {
    await api.updateEmployee(name, status);
    fetchAll();
  };

  const handleDeleteEmployee = async (name: string) => {
    showConfirm(`Hapus pegawai "${name}"?\n\nData absensi yang sudah tercatat TETAP tersimpan di riwayat.`, async () => {
      const result = await api.deleteEmployee(name);
      if (result.message) showToast(result.message, 'info');
      fetchAll();
    });
  };

  // === LOCATION HANDLERS ===
  const handleAddLocation = async () => {
    if (!newLocation.trim()) return;
    const result = await api.addLocation(newLocation.trim());
    if (result.success) {
      setNewLocation('');
      showToast('Lokasi berhasil ditambahkan', 'success');
      fetchAll();
    } else {
      showToast(result.message || 'Gagal menambahkan lokasi', 'error');
    }
  };

  const handleDeleteLocation = async (name: string) => {
    showConfirm(`Hapus lokasi "${name}"?\n\nData absensi yang sudah tercatat TETAP tersimpan di riwayat.`, async () => {
      const result = await api.deleteLocation(name);
      if (result.message) showToast(result.message, 'info');
      fetchAll();
    });
  };

  // === SHIFT HANDLERS ===
  const handleAddShift = async () => {
    if (!newShiftName.trim() || !newShiftTime || !newShiftEndTime) return;
    const result = await api.addShift(newShiftName.trim(), newShiftTime, newShiftEndTime, newShiftIsOvertime);
    if (result.success) {
      setNewShiftName('');
      setNewShiftTime('08:00');
      setNewShiftEndTime('17:00');
      setNewShiftIsOvertime(false);
      showToast('Shift berhasil ditambahkan', 'success');
      fetchAll();
    } else {
      showToast(result.message || 'Gagal menambahkan shift', 'error');
    }
  };

  const handleStartEditShift = (name: string, startTime: string, endTime: string, isOvertime: boolean) => {
    setEditingShift(name);
    setEditShiftStart(startTime);
    setEditShiftEnd(endTime);
    setEditShiftIsOvertime(isOvertime);
  };

  const handleSaveEditShift = async () => {
    if (!editingShift) return;
    const result = await api.updateShift(editingShift, editShiftStart, editShiftEnd, editShiftIsOvertime);
    if (result.success) {
      showToast('Shift berhasil diperbarui', 'success');
      setEditingShift(null);
      fetchAll();
    } else {
      showToast(result.message || 'Gagal memperbarui shift', 'error');
    }
  };

  const handleDeleteShift = async (name: string) => {
    showConfirm(`Hapus shift "${name}"?\n\nData absensi yang sudah tercatat TETAP tersimpan di riwayat.`, async () => {
      const result = await api.deleteShift(name);
      if (result.message) showToast(result.message, 'info');
      fetchAll();
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-12 h-12 border-4 border-[#B21B1B] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[#B21B1B] font-bold tracking-widest animate-pulse text-sm">MEMUAT DATA...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h2 className="text-2xl font-black text-slate-800">Master Data</h2>
        <p className="text-slate-500 text-sm mt-1">Kelola data pegawai, lokasi kerja, dan waktu shift.</p>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex bg-slate-100 p-1 sm:p-1.5 rounded-xl">
        <button
          className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${subTab === 'employees' ? 'bg-[#B21B1B] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setSubTab('employees')}
        >
          <User size={14} className="sm:w-4 sm:h-4" /> Pegawai
        </button>
        <button
          className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${subTab === 'locations' ? 'bg-[#B21B1B] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setSubTab('locations')}
        >
          <MapPin size={14} className="sm:w-4 sm:h-4" /> Lokasi
        </button>
        <button
          className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 ${subTab === 'shifts' ? 'bg-[#B21B1B] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setSubTab('shifts')}
        >
          <ClockIcon size={14} className="sm:w-4 sm:h-4" /> Shift
        </button>
      </div>

      {/* === PEGAWAI === */}
      {subTab === 'employees' && (
        <div className="space-y-6">
          {/* Form tambah */}
          <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-extrabold text-slate-800 mb-4">Tambah Pegawai Baru</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newEmpName}
                onChange={e => setNewEmpName(e.target.value)}
                placeholder="Nama pegawai"
                className="flex-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
              />
              <button onClick={handleAddEmployee} className="px-6 py-3 bg-[#B21B1B] text-white rounded-xl font-bold hover:bg-[#901515] transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap">
                <Plus size={16} /> Tambah
              </button>
            </div>
          </div>

          {/* Daftar pegawai - desktop table, mobile cards */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800">Daftar Pegawai ({employees.length})</h3>
            </div>

            {/* Mobile card view */}
            <div className="sm:hidden divide-y divide-slate-50">
              {employees.map((emp, i) => (
                <div key={emp.name} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-slate-400 text-xs font-medium w-5 flex-shrink-0">{i + 1}</span>
                    <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <User size={16} className="text-slate-500" />
                    </div>
                    <span className="font-bold text-slate-800 truncate">{emp.name}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <div className="relative">
                      <select
                        value={emp.status}
                        onChange={e => handleUpdateEmployeeStatus(emp.name, e.target.value)}
                        className={`pl-2.5 pr-6 py-1 rounded-lg text-[10px] font-bold border-0 outline-none cursor-pointer appearance-none ${
                          emp.status === 'AKTIF' ? 'bg-green-50 text-green-600' :
                          emp.status === 'CUTI' ? 'bg-yellow-50 text-yellow-600' :
                          'bg-red-50 text-red-600'
                        }`}
                      >
                        <option value="AKTIF">AKTIF</option>
                        <option value="CUTI">CUTI</option>
                        <option value="NONAKTIF">NONAKTIF</option>
                      </select>
                      <ChevronRight size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none opacity-50" />
                    </div>
                    <button onClick={() => handleDeleteEmployee(emp.name)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
              {employees.length === 0 && (
                <div className="px-6 py-12 text-center text-slate-400 text-sm">Belum ada data pegawai.</div>
              )}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                  <tr>
                    <th className="px-6 py-4">#</th>
                    <th className="px-6 py-4">Nama</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {employees.map((emp, i) => (
                    <tr key={emp.name} className="hover:bg-slate-50/50 transition-colors text-sm">
                      <td className="px-6 py-4 text-slate-400">{i + 1}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{emp.name}</td>
                      <td className="px-6 py-4">
                        <div className="relative inline-block">
                          <select
                            value={emp.status}
                            onChange={e => handleUpdateEmployeeStatus(emp.name, e.target.value)}
                            className={`pl-3 pr-7 py-1.5 rounded-lg text-xs font-bold border-0 outline-none cursor-pointer appearance-none ${
                              emp.status === 'AKTIF' ? 'bg-green-50 text-green-600' :
                              emp.status === 'CUTI' ? 'bg-yellow-50 text-yellow-600' :
                              'bg-red-50 text-red-600'
                            }`}
                          >
                            <option value="AKTIF">AKTIF</option>
                            <option value="CUTI">CUTI</option>
                            <option value="NONAKTIF">NONAKTIF</option>
                          </select>
                          <ChevronRight size={12} className="absolute right-2 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none opacity-50" />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => handleDeleteEmployee(emp.name)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors" title="Hapus">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400">Belum ada data pegawai.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* === LOKASI === */}
      {subTab === 'locations' && (
        <div className="space-y-6">
          {/* Form tambah */}
          <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-extrabold text-slate-800 mb-4">Tambah Lokasi Baru</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newLocation}
                onChange={e => setNewLocation(e.target.value)}
                placeholder="Nama lokasi kerja"
                className="flex-1 p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
              />
              <button onClick={handleAddLocation} className="px-6 py-3 bg-[#B21B1B] text-white rounded-xl font-bold hover:bg-[#901515] transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap">
                <Plus size={16} /> Tambah
              </button>
            </div>
          </div>

          {/* List lokasi */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800">Daftar Lokasi ({locations.length})</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {locations.map((loc, i) => (
                <div key={loc} className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-slate-50/50 transition-colors gap-2">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-slate-400 text-xs font-medium w-5 sm:w-8 flex-shrink-0">{i + 1}</span>
                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500 flex-shrink-0">
                      <MapPin size={18} />
                    </div>
                    <span className="font-bold text-slate-800 truncate">{loc}</span>
                  </div>
                  <button onClick={() => handleDeleteLocation(loc)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors flex-shrink-0" title="Hapus">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              {locations.length === 0 && (
                <div className="px-6 py-12 text-center text-slate-400 text-sm">Belum ada data lokasi.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* === SHIFT === */}
      {subTab === 'shifts' && (
        <div className="space-y-6">
          {/* Form tambah */}
          <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="font-extrabold text-slate-800 mb-4">Tambah Shift Baru</h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Nama Shift</label>
                <input
                  type="text"
                  value={newShiftName}
                  onChange={e => setNewShiftName(e.target.value)}
                  placeholder="Contoh: SHIFT PAGI 06.00-14.00"
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <TimePicker label="Jam Mulai" value={newShiftTime} onChange={setNewShiftTime} />
                <TimePicker label="Jam Selesai" value={newShiftEndTime} onChange={setNewShiftEndTime} />
              </div>
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors">
                <input
                  type="checkbox"
                  checked={newShiftIsOvertime}
                  onChange={e => setNewShiftIsOvertime(e.target.checked)}
                  className="w-5 h-5 rounded text-[#B21B1B] focus:ring-[#B21B1B]/20 cursor-pointer"
                />
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-800">Tandai sebagai shift lembur</div>
                  <div className="text-xs text-slate-500">Shift ini tidak akan dicek keterlambatannya & dihitung sebagai lembur di statistik</div>
                </div>
              </label>
              <button onClick={handleAddShift} className="w-full py-3 bg-[#B21B1B] text-white rounded-xl font-bold hover:bg-[#901515] transition-all active:scale-95 flex items-center justify-center gap-2">
                <Plus size={16} /> Tambah Shift
              </button>
            </div>
          </div>

          {/* List shift */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800">Daftar Shift ({Object.keys(shifts).length})</h3>
            </div>
            <div className="divide-y divide-slate-50">
              {(Object.entries(shifts) as [string, { start_time: string; end_time: string; is_overtime: boolean }][]).map(([name, times], i) => (
                <div key={name} className="px-4 sm:px-6 py-4 hover:bg-slate-50/50 transition-colors">
                  {editingShift === name ? (
                    /* === EDIT MODE === */
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 text-sm font-medium w-6 sm:w-8 flex-shrink-0">{i + 1}</span>
                        <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-500 flex-shrink-0">
                          <ClockIcon size={18} />
                        </div>
                        <span className="font-bold text-slate-800 truncate">{name}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:pl-14">
                        <TimePicker label="Jam Mulai" value={editShiftStart} onChange={setEditShiftStart} />
                        <TimePicker label="Jam Selesai" value={editShiftEnd} onChange={setEditShiftEnd} />
                      </div>
                      <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 cursor-pointer sm:ml-14">
                        <input
                          type="checkbox"
                          checked={editShiftIsOvertime}
                          onChange={e => setEditShiftIsOvertime(e.target.checked)}
                          className="w-5 h-5 rounded text-[#B21B1B] focus:ring-[#B21B1B]/20 cursor-pointer"
                        />
                        <span className="text-sm font-medium text-slate-700">Shift lembur</span>
                      </label>
                      <div className="flex gap-2 sm:pl-14">
                        <button onClick={handleSaveEditShift} className="flex-1 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 transition-colors">
                          Simpan
                        </button>
                        <button onClick={() => setEditingShift(null)} className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-colors">
                          Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* === VIEW MODE === */
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="text-slate-400 text-sm font-medium w-6 sm:w-8 flex-shrink-0">{i + 1}</span>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${times.is_overtime ? 'bg-orange-50 text-orange-500' : 'bg-purple-50 text-purple-500'}`}>
                          <ClockIcon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 truncate">{name}</span>
                            {times.is_overtime && (
                              <span className="text-[9px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded uppercase tracking-wider">Lembur</span>
                            )}
                          </div>
                          <span className="text-xs text-slate-400">{times.start_time} – {times.end_time}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => handleStartEditShift(name, times.start_time, times.end_time, times.is_overtime)} className="p-2 hover:bg-blue-50 rounded-lg text-blue-400 hover:text-blue-600 transition-colors" title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteShift(name)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors" title="Hapus">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {Object.keys(shifts).length === 0 && (
                <div className="px-6 py-12 text-center text-slate-400">Belum ada data shift.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmployeeStatsView({ attendanceData }: { attendanceData: AttendanceData[] }) {
  const [viewState, setViewState] = useState<'grid' | 'stats'>('grid');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeList, setEmployeeList] = useState<{name: string, status: string}[]>([]);
  const [shiftMap, setShiftMap] = useState<Record<string, { is_overtime: boolean }>>({});

  // Fetch employees & shifts dari database
  useEffect(() => {
    api.getEmployees().then(data => setEmployeeList(data));
    api.getShifts().then(data => setShiftMap(data));
  }, []);

  const allEmployees = employeeList.sort((a, b) => a.name.localeCompare(b.name));
  const activeEmployees = allEmployees;
  const displayEmployees = activeEmployees
    .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const todayDateStr = format(new Date(), 'yyyy-MM-dd');
  const uniquePresentToday = new Set(attendanceData.filter(d => {
    const dDate = typeof d.Date === 'string' ? d.Date.split('T')[0] : format(new Date(d.Date), 'yyyy-MM-dd');
    return dDate === todayDateStr;
  }).map(d => d.Name));
  const attendancePercentage = activeEmployees.length > 0 ? Math.round((uniquePresentToday.size / activeEmployees.length) * 100) : 0;


  const stats = selectedEmployee ? attendanceData.filter(d => {
    const dDate = typeof d.Date === 'string' ? d.Date.split('T')[0] : format(new Date(d.Date), 'yyyy-MM-dd');
    return d.Name === selectedEmployee && dDate >= startDate && dDate <= endDate;
  }) : [];

  const totalPresent = stats.length;
  const totalLate = stats.filter(d => d.Status === 'Terlambat').length;
  // Lembur dihitung dari shift yang punya flag is_overtime = true
  const overtimeData = stats.filter(d => shiftMap[d.Shift]?.is_overtime === true);


  if (viewState === 'stats') {
    const attendanceRate = totalPresent > 0 ? Math.round(((totalPresent - totalLate) / totalPresent) * 100) : 0;

    return (
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
          <button onClick={() => setViewState('grid')} className="flex items-center gap-2 text-slate-600 font-bold text-lg hover:text-[#B21B1B] transition-colors">
            <ArrowLeft size={20} /> Statistik Pegawai
          </button>
          <div className="flex items-center gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Dari</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#B21B1B]/20" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Sampai</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-[#B21B1B]/20" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-200 overflow-hidden relative border-2 border-white shadow-sm flex-shrink-0">
               <User className="w-full h-full text-slate-400 p-2 bg-slate-100" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{selectedEmployee}</h3>
            </div>
          </div>
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border-t-4 border-t-green-500 shadow-sm flex flex-col justify-center items-center text-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Kehadiran</div>
            <div className="text-4xl font-black text-slate-800">{totalPresent}</div>
            <div className="text-[10px] text-green-500 font-bold mt-1 bg-green-50 px-2 py-0.5 rounded flex items-center gap-1"><CheckCircle2 size={10} /> {attendanceRate}% Tepat Waktu</div>
          </div>
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border-t-4 border-t-[#B21B1B] shadow-sm flex flex-col justify-center items-center text-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Terlambat</div>
            <div className="text-4xl font-black text-slate-800">{totalLate}</div>
            <div className="text-[10px] text-[#B21B1B] font-bold mt-1 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1"><AlertCircle size={10} /> {totalLate}x Tercatat</div>
          </div>
          <div className="md:col-span-1 bg-white p-6 rounded-3xl border-t-4 border-t-blue-500 shadow-sm flex flex-col justify-center items-center text-center">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lembur</div>
            <div className="text-4xl font-black text-slate-800">{overtimeData.length}</div>
            <div className="text-[10px] text-blue-500 font-bold mt-1 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1"><History size={10} /> {overtimeData.length}x Shift</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-white">
            <h3 className="font-extrabold text-slate-800 text-lg">Riwayat Kehadiran</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead className="bg-white text-slate-400 text-[10px] uppercase tracking-widest font-bold border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Tanggal</th>
                  <th className="px-6 py-4">Shift</th>
                  <th className="px-6 py-4">Waktu Masuk</th>
                  <th className="px-6 py-4">Waktu Pulang</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-800">{d.Date}</td>
                    <td className="px-6 py-4 text-sm text-slate-500">{d.Shift}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{d.TimeIn || '-'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{d.TimeOut || '-'}</td>
                    <td className="px-6 py-4">
                       <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider inline-block ${d.Status === 'Terlambat' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                        {d.Status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500 italic">{d.Note || '-'}</td>
                  </tr>
                ))}
                {stats.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium italic">Tidak ada data kehadiran pada periode ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    );
  }

  // viewState === 'grid'
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Data Pegawai</h2>
          <p className="text-slate-500 text-sm mt-1">Tinjau kinerja tim Koperasi GIAT secara mendalam.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex-1 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#B21B1B]"></div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">TOTAL PEGAWAI</div>
          <div className="text-3xl font-black text-slate-800">{activeEmployees.length}</div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex-1 flex flex-col justify-center relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-500"></div>
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">KEHADIRAN HARI INI</div>
          <div className="text-3xl font-black text-slate-800">{attendancePercentage}%</div>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex-[2] flex flex-col justify-center">
          <div className="text-xs font-bold text-slate-800 mb-3">Pencarian Pegawai</div>
          <div className="flex items-center gap-3 text-slate-400 w-full bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
            <Search size={18} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari data pegawai..." 
              className="bg-transparent border-none outline-none text-sm w-full font-medium text-slate-700" 
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {displayEmployees.map((emp) => (
          <div key={emp.name} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-all flex flex-col items-center text-center group relative overflow-hidden">

            <div className="relative mb-4">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border-4 border-white shadow-md">
                <User className="text-slate-400 w-10 h-10" />
              </div>
            </div>
            <h4 className="font-extrabold text-slate-800 text-lg line-clamp-1 w-full px-2" title={emp.name}>{emp.name}</h4>
            <span className={`text-[10px] font-bold uppercase tracking-widest mt-2 mb-6 px-2 py-1 rounded-md ${emp.status === 'AKTIF' ? 'bg-green-50 text-green-500' : emp.status === 'CUTI' ? 'bg-orange-50 text-orange-500' : 'bg-red-50 text-red-500'}`}>
              {emp.status}
            </span>
            
            <div className="w-full flex items-center justify-end pt-4 border-t border-slate-100 mt-auto">
              <button 
                onClick={() => { setSelectedEmployee(emp.name); setViewState('stats'); }}
                className="text-[10px] font-bold text-[#B21B1B] hover:text-red-900 transition-colors flex items-center gap-1 group-hover:underline"
              >
                Lihat Statistik <ChevronRight size={12} />
              </button>
            </div>
          </div>
        ))}
        {displayEmployees.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 font-medium italic">Tidak ada pegawai yang sesuai dengan filter.</div>
        )}
      </div>
      
      <div className="flex justify-center pt-4">
        <button className="flex items-center gap-2 text-xs font-bold text-slate-500 bg-white border border-slate-200 px-6 py-3 rounded-full hover:bg-slate-50 transition-colors">
          Muat Lebih Banyak <ChevronRight size={14} className="rotate-90" />
        </button>
      </div>
    </div>
  );
}
