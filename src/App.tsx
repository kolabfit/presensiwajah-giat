import React, { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, User, ShieldCheck, LogOut, Menu, X, ChevronRight, ChevronLeft, BarChart3, History, Settings, Download, Eye, EyeOff, Camera, CheckCircle2, AlertCircle, Plus, Search, Filter, ArrowLeft, MoreHorizontal, Edit2, Trash2, MapPin, Clock as ClockIcon, Database, Image as ImageIcon, UserPlus, RefreshCw } from 'lucide-react';
import Clock from './components/Clock';
import { Shift, AttendanceData, Employee, AppSettings, AttendancePhoto, Location } from './types';
import { api } from './services/api';
import { LocationFormModal, EmployeeLocationModal } from './components/LocationManager';
import { format, isAfter, addMinutes, startOfDay, subDays, isWithinInterval } from 'date-fns';
import * as XLSX from 'xlsx';

// No hardcoded constants - all data comes from the database via API
const GIAT_LOGO_URL = 'https://i.ibb.co.com/YBMQyzfN/logo-giat-remove-bg.png';
const APP_VIEW_STORAGE_KEY = 'presensi:last-view';
const ADMIN_TAB_STORAGE_KEY = 'presensi:last-admin-tab';

// === TOAST & CONFIRM SYSTEM ===
type ToastType = 'success' | 'error' | 'info';
interface ToastItem { id: number; message: string; type: ToastType; }
type AppView = 'employee' | 'face-register' | 'admin-login' | 'admin-dashboard';
type AdminTab = 'dashboard' | 'history' | 'employees' | 'master-data' | 'attendance-photos' | 'settings';
type DetectedFace = { boundingBox: DOMRectReadOnly };
type WakeLockSentinel = {
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
};

declare global {
  interface Window {
    FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
      detect: (source: CanvasImageSource) => Promise<DetectedFace[]>;
    };
  }
}

const ToastContext = createContext<{
  showToast: (message: string, type?: ToastType) => void;
  showConfirm: (message: string, onConfirm: () => void) => void;
}>({ showToast: () => {}, showConfirm: () => {} });

function useToast() { return useContext(ToastContext); }

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function imageFileToCompressedDataUrl(file: File, maxSize = 900, quality = 0.82) {
  if (!file.type.startsWith('image/')) {
    throw new Error('File harus berupa gambar.');
  }

  const rawDataUrl = await fileToDataUrl(file);
  const image = await loadImage(rawDataUrl);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Foto belum bisa diproses. Silakan coba foto lain.');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function requestScreenWakeLock(wakeLockRef: { current: WakeLockSentinel | null }) {
  if (!navigator.wakeLock || wakeLockRef.current) return;
  try {
    wakeLockRef.current = await navigator.wakeLock.request('screen');
    wakeLockRef.current.addEventListener?.('release', () => {
      wakeLockRef.current = null;
    });
  } catch (_error) {
    wakeLockRef.current = null;
  }
}

async function releaseScreenWakeLock(wakeLockRef: { current: WakeLockSentinel | null }) {
  if (!wakeLockRef.current) return;
  try {
    await wakeLockRef.current.release();
  } catch (_error) {
    // Wake Lock may already be released by the browser.
  } finally {
    wakeLockRef.current = null;
  }
}

function EvidencePhoto({ src, alt, className, onClick }: { src?: string; alt: string; className: string; onClick?: () => void }) {
  const [failed, setFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(src));
  const [retryCount, setRetryCount] = useState(0);
  const showReloadLabel = className.includes('max-') || className.includes('w-full') || className.includes('h-full');

  useEffect(() => {
    setFailed(false);
    setIsLoading(Boolean(src));
    setRetryCount(0);
  }, [src]);

  if (!src || failed) {
    const canReload = Boolean(src);
    return (
      <div className={`${className} bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300`}>
        {canReload ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setFailed(false);
              setIsLoading(true);
              setRetryCount(count => count + 1);
            }}
            className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-[#B21B1B] hover:bg-red-50 transition-colors"
            title="Muat ulang gambar"
            aria-label="Muat ulang gambar"
          >
            <RefreshCw size={16} />
            {showReloadLabel && <span className="text-xs font-bold">Muat ulang</span>}
          </button>
        ) : (
          <ImageIcon size={16} />
        )}
      </div>
    );
  }

  const retrySrc = retryCount > 0 && src
    ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryCount}`
    : src;

  const handleImageError = () => {
    if (retryCount < 2) {
      window.setTimeout(() => {
        setIsLoading(true);
        setRetryCount(count => count + 1);
      }, 450 * (retryCount + 1));
      return;
    }
    setIsLoading(false);
    setFailed(true);
  };

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className} ${onClick ? 'cursor-zoom-in' : ''}`} onClick={onClick}>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
          <div className="relative w-5 h-5 border-2 border-slate-300 border-t-[#B21B1B] rounded-full animate-spin" />
        </div>
      )}
      <img
        src={retrySrc}
        alt={alt}
        onLoad={() => setIsLoading(false)}
        onError={handleImageError}
        className={`w-full h-full ${className.includes('object-contain') ? 'object-contain' : 'object-cover'} ${onClick ? 'hover:opacity-90 transition-opacity' : ''} ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
}

function ProfilePhoto({ src, alt, className, iconSize = 18 }: { src?: string | null; alt: string; className: string; iconSize?: number }) {
  const [failed, setFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(src));
  const [retryCount, setRetryCount] = useState(0);
  const showReloadLabel = className.includes('w-16') || className.includes('w-20') || className.includes('w-24');

  useEffect(() => {
    setFailed(false);
    setIsLoading(Boolean(src));
    setRetryCount(0);
  }, [src]);

  if (!src || failed) {
    return (
      <div className={`${className} bg-slate-100 flex items-center justify-center text-slate-400`}>
        {src ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setFailed(false);
              setIsLoading(true);
              setRetryCount(count => count + 1);
            }}
            className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-[#B21B1B] hover:bg-red-50 transition-colors"
            title="Muat ulang foto"
            aria-label="Muat ulang foto"
          >
            <RefreshCw size={Math.max(14, Math.min(iconSize, 22))} />
            {showReloadLabel && <span className="text-[10px] font-bold">Muat ulang</span>}
          </button>
        ) : (
          <User size={iconSize} />
        )}
      </div>
    );
  }

  const retrySrc = retryCount > 0 && src
    ? `${src}${src.includes('?') ? '&' : '?'}retry=${retryCount}`
    : src;

  const handleProfileImageError = () => {
    if (retryCount < 2) {
      window.setTimeout(() => {
        setIsLoading(true);
        setRetryCount(count => count + 1);
      }, 450 * (retryCount + 1));
      return;
    }
    setIsLoading(false);
    setFailed(true);
  };

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100" />
          <div className="relative w-4 h-4 border-2 border-slate-300 border-t-[#B21B1B] rounded-full animate-spin" />
        </div>
      )}
      <img
        src={retrySrc}
        alt={alt}
        onLoad={() => setIsLoading(false)}
        onError={handleProfileImageError}
        className={`w-full h-full object-cover transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
}

function readStoredAppView(): AppView {
  try {
    const hashView = readHashAppView();
    if (hashView) return hashView;

    const stored = localStorage.getItem(APP_VIEW_STORAGE_KEY);
    if (stored === 'employee' || stored === 'face-register' || stored === 'admin-login' || stored === 'admin-dashboard') {
      return stored;
    }
  } catch (_error) {}
  return 'employee';
}

function readStoredAdminTab(): AdminTab {
  try {
    const hashTab = readHashAdminTab();
    if (hashTab) return hashTab;

    const stored = localStorage.getItem(ADMIN_TAB_STORAGE_KEY);
    if (stored === 'dashboard' || stored === 'history' || stored === 'employees' || stored === 'master-data' || stored === 'attendance-photos' || stored === 'settings') {
      return stored;
    }
  } catch (_error) {}
  return 'dashboard';
}

function readHashAppView(): AppView | null {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('admin/')) return 'admin-dashboard';
  if (hash === 'admin-login') return 'admin-login';
  if (hash === 'face-register') return 'face-register';
  if (hash === 'employee' || hash === '') return null;
  return null;
}

function readHashAdminTab(): AdminTab | null {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const tab = hash.startsWith('admin/') ? hash.replace('admin/', '') : '';
  if (tab === 'dashboard' || tab === 'history' || tab === 'employees' || tab === 'master-data' || tab === 'attendance-photos' || tab === 'settings') {
    return tab;
  }
  return null;
}

function updateAppHash(view: AppView, adminTab?: AdminTab) {
  const nextHash = view === 'employee'
    ? '#/employee'
    : view === 'face-register'
      ? '#/face-register'
      : view === 'admin-login'
        ? '#/admin-login'
        : `#/admin/${adminTab || readStoredAdminTab()}`;

  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, '', nextHash);
  }
}

function parseShiftTimeToToday(timeValue: string, baseDate: Date) {
  const raw = String(timeValue || '').trim();
  const match = raw.match(/^(\d{1,2})(?::|\.)(\d{2})(?:\s*([AP]M))?$/i) || raw.match(/^(\d{1,2})(?:\s*([AP]M))$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2]?.length === 2 ? match[2] : 0);
  const meridiem = (match[3] || match[2] || '').toUpperCase();

  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return null;

  const parsed = new Date(baseDate);
  parsed.setHours(hour, minute, 0, 0);
  return parsed;
}

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
  const [view, setView] = useState<AppView>(() => readStoredAppView());

  useEffect(() => {
    try {
      localStorage.setItem(APP_VIEW_STORAGE_KEY, view);
    } catch (_error) {}
    updateAppHash(view);
  }, [view]);

  return (
    <ToastProvider>
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-900">
      <AnimatePresence mode="wait">
        {view === 'employee' && (
          <EmployeePage onAdminClick={() => setView('admin-login')} onRegisterFaceClick={() => setView('face-register')} />
        )}
        {view === 'face-register' && (
          <FaceRegistrationPage onBack={() => setView('employee')} />
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

function EmployeePage({ onAdminClick, onRegisterFaceClick }: { onAdminClick: () => void; onRegisterFaceClick: () => void }) {
  const { showToast } = useToast();
  const [location, setLocation] = useState('');
  const [shift, setShift] = useState<Shift | ''>('');
  const [note, setNote] = useState('');
  const [isLate, setIsLate] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecognizingFace, setIsRecognizingFace] = useState(false);
  const [recognizedFace, setRecognizedFace] = useState<{ name: string; photoUrl?: string; distance?: number; photoDataUrl: string } | null>(null);
  const selfieVideoRef = useRef<HTMLVideoElement | null>(null);
  const selfieStreamRef = useRef<MediaStream | null>(null);
  const selfieWakeLockRef = useRef<WakeLockSentinel | null>(null);
  const autoSelfieTimerRef = useRef<number | null>(null);
  const faceDetectionIntervalRef = useRef<number | null>(null);
  const faceStableCountRef = useRef(0);
  const unregisteredToastAtRef = useRef(0);
  const faceDetectorRef = useRef<{ detect: (source: CanvasImageSource) => Promise<DetectedFace[]> } | null>(null);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [hasCheckedOut, setHasCheckedOut] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [presensiType, setPresensiType] = useState<'masuk' | 'pulang'>('masuk');
  const [isSelfieOpen, setIsSelfieOpen] = useState(false);
  const [isSelfieReady, setIsSelfieReady] = useState(false);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const [faceDetectionSupported, setFaceDetectionSupported] = useState(true);

  // Data dari database (bukan hardcode)
  const name = '';
  const [locations, setLocations] = useState<string[]>([]);
  const [shifts, setShifts] = useState<Record<string, { start_time: string; end_time: string; is_overtime: boolean }>>({});
  const [settings, setSettings] = useState<AppSettings>({ barcode_content: '', late_threshold_minutes: '5' });

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
      setPresensiType('masuk');
    }
  }, [name, attendanceData, loading]);

  const stopSelfieCamera = () => {
    void releaseScreenWakeLock(selfieWakeLockRef);
    if (autoSelfieTimerRef.current) {
      window.clearTimeout(autoSelfieTimerRef.current);
      autoSelfieTimerRef.current = null;
    }
    if (faceDetectionIntervalRef.current) {
      window.clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }
    faceStableCountRef.current = 0;
    selfieStreamRef.current?.getTracks().forEach(track => track.stop());
    selfieStreamRef.current = null;
    if (selfieVideoRef.current) selfieVideoRef.current.srcObject = null;
    setIsSelfieOpen(false);
    setIsSelfieReady(false);
    setIsFaceDetected(false);
  };

  const closeRecognitionConfirmation = () => {
    setRecognizedFace(null);
    setIsRecognizingFace(false);
    setIsFaceDetected(false);
    faceStableCountRef.current = 0;
  };

  const retryRecognition = () => {
    closeRecognitionConfirmation();
    setTimeout(() => startSelfieCamera(), 120);
  };

  const validateCheckInRequirements = (source: 'camera' | 'scan' | 'save' = 'camera') => {
    if (presensiType !== 'masuk') return true;

    if (!location || !shift) {
      const message = source === 'save'
        ? 'Lokasi kerja dan shift kosong. Silakan pilih ulang lokasi kerja dan shift sebelum menyimpan presensi.'
        : 'Lokasi kerja dan shift belum terisi. Pilih lokasi kerja dan shift terlebih dahulu sebelum membuka kamera.';
      setScanResult({ success: false, message });
      return false;
    }

    if (isLate && !note.trim()) {
      setScanResult({
        success: false,
        message: 'Catatan keterlambatan wajib diisi sebelum membuka kamera.'
      });
      return false;
    }

    return true;
  };

  const startSelfieCamera = async () => {
    if (!validateCheckInRequirements('camera')) return;

    setIsSelfieOpen(true);
    setIsSelfieReady(false);
    setIsFaceDetected(false);
    setFaceDetectionSupported(Boolean(window.FaceDetector));
    try {
      void requestScreenWakeLock(selfieWakeLockRef);
      await new Promise(resolve => setTimeout(resolve, 100));
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Perangkat ini belum bisa membuka kamera. Gunakan perangkat yang memiliki kamera, lalu coba lagi.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      selfieStreamRef.current = stream;
      if (selfieVideoRef.current) {
        selfieVideoRef.current.srcObject = stream;
        await selfieVideoRef.current.play();
        if (selfieVideoRef.current.videoWidth && selfieVideoRef.current.videoHeight) {
          setIsSelfieReady(true);
        }
      }
    } catch (e) {
      setIsSelfieOpen(false);
      setScanResult({
        success: false,
        message: e instanceof Error
          ? e.message
          : 'Kamera belum bisa dibuka. Izinkan akses kamera agar wajah bisa difoto sebagai bukti presensi.'
      });
    }
  };

  const detectSelfieFace = async () => {
    const video = selfieVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || !window.FaceDetector) return false;

    try {
      if (!faceDetectorRef.current) {
        faceDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      }
      const faces = await faceDetectorRef.current.detect(video);
      return faces.length > 0;
    } catch (_error) {
      if (faceDetectionIntervalRef.current) {
        window.clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
      }
      setFaceDetectionSupported(false);
      setIsFaceDetected(false);
      return false;
    }
  };

  const getLocationErrorMessage = (error?: GeolocationPositionError) => {
    if (!navigator.geolocation) {
      return 'Perangkat ini belum bisa membaca lokasi. Gunakan perangkat yang mendukung lokasi, lalu coba lagi.';
    }
    if (error?.code === error.PERMISSION_DENIED) {
      return 'Presensi membutuhkan izin lokasi. Silakan izinkan lokasi di browser, lalu coba presensi lagi.';
    }
    if (error?.code === error.TIMEOUT) {
      return 'Lokasi belum berhasil ditemukan. Pastikan GPS atau layanan lokasi aktif, lalu coba lagi.';
    }
    return 'Lokasi belum bisa dibaca. Pastikan layanan lokasi aktif dan izinnya diberikan, lalu coba lagi.';
  };

  const getRequiredPosition = () => new Promise<GeolocationPosition>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(getLocationErrorMessage()));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (error) => reject(new Error(getLocationErrorMessage(error))), {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });
  });

  const ensureLocationBeforeScan = async () => {
    try {
      await getRequiredPosition();
      return true;
    } catch (error) {
      setScanResult({
        success: false,
        message: error instanceof Error ? error.message : 'Presensi membutuhkan izin lokasi. Silakan izinkan lokasi, lalu coba lagi.'
      });
      return false;
    }
  };

  const captureSelfieDataUrl = () => {
    const video = selfieVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return '';
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.86);
  };

  const waitForSelfieFrame = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const video = selfieVideoRef.current;
      if (video?.videoWidth && video?.videoHeight) return true;
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    return false;
  };

  useEffect(() => {
    if (shift && !hasCheckedIn && presensiType === 'masuk') {
      const shiftData = shifts[shift];
      if (!shiftData?.start_time) { setIsLate(false); return; }
      const now = new Date();
      const shiftStartTime = parseShiftTimeToToday(shiftData.start_time, now);
      if (!shiftStartTime) { setIsLate(false); return; }
      const lateThreshold = addMinutes(shiftStartTime, parseInt(settings.late_threshold_minutes) || 5);
      
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

  const startFaceAttendance = async () => {
    if (!validateCheckInRequirements('scan')) return;

    const locationAllowed = await ensureLocationBeforeScan();
    if (!locationAllowed) return;
    setScanResult(null);
    setTimeout(() => startSelfieCamera(), 150);
  };

  const notifyUnregisteredFace = () => {
    const now = Date.now();
    if (now - unregisteredToastAtRef.current < 4500) return;
    unregisteredToastAtRef.current = now;
    showToast('Wajah tidak terdaftar. Silakan daftar wajah terlebih dahulu.', 'error');
  };

  const recognizeSelfieForConfirmation = async (options: { silent?: boolean } = {}) => {
    if (isProcessing || isRecognizingFace || recognizedFace) return;

    const isCheckIn = presensiType === 'masuk';

    if (isCheckIn && (!location || !shift)) {
      if (!options.silent) {
        setScanResult({
          success: false,
          message: 'Lokasi kerja dan shift belum terisi. Pilih lokasi kerja dan shift, lalu lakukan presensi wajah.'
        });
      }
      return;
    }
    const hasFrame = await waitForSelfieFrame();
    if (!hasFrame) {
      if (!options.silent) setScanResult({ success: false, message: 'Kamera wajah belum siap. Tunggu wajah terlihat jelas lalu coba lagi.' });
      return;
    }
    const photoDataUrl = captureSelfieDataUrl();
    if (!photoDataUrl) {
      if (!options.silent) setScanResult({ success: false, message: 'Foto wajah belum berhasil diambil. Pastikan wajah terlihat jelas lalu coba lagi.' });
      return;
    }

    setIsRecognizingFace(true);
    try {
      const result = await api.recognizeAttendanceFace(photoDataUrl);
      if (result.success && result.employee?.name) {
        setRecognizedFace({
          name: result.employee.name,
          photoUrl: result.employee.photo_url,
          distance: result.face?.distance,
          photoDataUrl
        });
        stopSelfieCamera();
      } else {
        if (options.silent) {
          notifyUnregisteredFace();
        } else {
          setScanResult({ success: false, message: result.message || 'Wajah belum berhasil dikenali.' });
        }
      }
    } catch (_error) {
      if (options.silent) {
        notifyUnregisteredFace();
      } else {
        setScanResult({ success: false, message: 'Wajah belum berhasil dikenali. Silakan coba lagi.' });
      }
    } finally {
      setIsRecognizingFace(false);
    }
  };

  const processAttendance = async () => {
    if (isProcessing || !recognizedFace) return;

    const isCheckIn = presensiType === 'masuk';

    if (isCheckIn && !validateCheckInRequirements('save')) {
      setRecognizedFace(null);
      return;
    }

    setIsProcessing(true);
    let position: GeolocationPosition;
    try {
      position = await getRequiredPosition();
    } catch (error) {
      setIsProcessing(false);
      setScanResult({
        success: false,
        message: error instanceof Error ? error.message : 'Presensi membutuhkan izin lokasi. Silakan izinkan lokasi, lalu coba lagi.'
      });
      return;
    }

    const now = new Date();
    const data: Partial<AttendanceData> = isCheckIn
      ? {
          Date: format(now, 'yyyy-MM-dd'),
          Name: '',
          Location: location,
          Shift: shift as Shift,
          TimeIn: format(now, 'HH.mm'),
          Status: isLate ? 'Terlambat' : 'Tepat Waktu',
          Note: note,
          PhotoDataUrl: recognizedFace.photoDataUrl,
          Latitude: position.coords.latitude,
          Longitude: position.coords.longitude,
          Accuracy: position.coords.accuracy
        }
      : {
          Date: format(now, 'yyyy-MM-dd'),
          Name: '',
          TimeOut: format(now, 'HH.mm'),
          PhotoDataUrl: recognizedFace.photoDataUrl,
          Latitude: position.coords.latitude,
          Longitude: position.coords.longitude,
          Accuracy: position.coords.accuracy
        };

    try {
      const result = await api.saveAttendance(data);
      setIsProcessing(false);
      setRecognizedFace(null);
      if (result.success) {
        const recognizedName = result.employee?.name ? ` atas nama ${result.employee.name}` : '';
        const successMsg = isCheckIn
          ? (isLate ? `Presensi masuk berhasil${recognizedName} (Terlambat)` : `Presensi masuk berhasil${recognizedName}`)
          : `Presensi pulang berhasil${recognizedName}`;
        setScanResult({ success: true, message: successMsg });
        if (isCheckIn) setHasCheckedIn(true);
        else setHasCheckedOut(true);
        fetchData();
      } else {
        const message = result.message || 'Gagal menyimpan data';
        showToast(message, 'error');
        setScanResult({ success: false, message });
      }
    } catch (e) {
      setIsProcessing(false);
      setRecognizedFace(null);
      showToast('Gagal menghubungi server. Periksa koneksi internet.', 'error');
      setScanResult({ success: false, message: 'Gagal menghubungi server. Periksa koneksi internet.' });
    }
  };

  const currentRecord = name ? attendanceData.find(d => 
    d.Name === name && 
    parseDateStr(d.Date) === format(new Date(), 'yyyy-MM-dd')
  ) : null;
  const needsWorkSelection = presensiType === 'masuk';
  const scanDisabled = (needsWorkSelection && (!shift || (isLate && !note.trim()))) ||
    (presensiType === 'masuk' && hasCheckedIn);
  const selfieActionDisabled = !isSelfieReady || isProcessing || isRecognizingFace || Boolean(recognizedFace) || (needsWorkSelection && (!shift));
  const scanHelperText = presensiType === 'pulang'
    ? 'Kamera akan mengenali wajah pegawai dan backend akan memvalidasi geofence otomatis.'
    : (!shift
        ? 'Pilih shift terlebih dahulu sebelum kamera dibuka. Lokasi akan dideteksi otomatis via GPS.'
        : isLate && !note.trim()
          ? 'Isi catatan keterlambatan terlebih dahulu sebelum kamera dibuka.'
          : 'Kamera akan mengenali wajah pegawai terdaftar.');

  useEffect(() => {
    if (!isSelfieOpen || presensiType !== 'masuk') return;
    if (shift && (!isLate || note.trim())) return;

    stopSelfieCamera();
    setScanResult({
      success: false,
      message: !shift
        ? 'Kamera ditutup karena shift belum terisi. Pilih shift, lalu buka kamera lagi.'
        : 'Kamera ditutup karena catatan keterlambatan belum diisi.'
    });
  }, [isSelfieOpen, presensiType, shift, isLate, note]);

  useEffect(() => {
    if (!isSelfieOpen || !isSelfieReady || selfieActionDisabled) return;

    if (autoSelfieTimerRef.current) {
      window.clearTimeout(autoSelfieTimerRef.current);
      autoSelfieTimerRef.current = null;
    }
    if (faceDetectionIntervalRef.current) {
      window.clearInterval(faceDetectionIntervalRef.current);
      faceDetectionIntervalRef.current = null;
    }

    if (!window.FaceDetector) {
      setFaceDetectionSupported(false);
      setIsFaceDetected(false);
      faceDetectionIntervalRef.current = window.setInterval(() => {
        if (!isSelfieOpen || isProcessing || isRecognizingFace || recognizedFace) return;
        recognizeSelfieForConfirmation({ silent: true });
      }, 1600);
      return;
    }

    setFaceDetectionSupported(true);
    setIsFaceDetected(false);
    faceStableCountRef.current = 0;

    faceDetectionIntervalRef.current = window.setInterval(async () => {
      const detected = await detectSelfieFace();
      if (!isSelfieOpen || isProcessing || isRecognizingFace || recognizedFace) return;

      if (detected) {
        faceStableCountRef.current += 1;
        setIsFaceDetected(true);
      } else {
        faceStableCountRef.current = 0;
        setIsFaceDetected(false);
      }

      if (faceStableCountRef.current >= 2) {
        if (faceDetectionIntervalRef.current) {
          window.clearInterval(faceDetectionIntervalRef.current);
          faceDetectionIntervalRef.current = null;
        }
        autoSelfieTimerRef.current = window.setTimeout(() => {
          recognizeSelfieForConfirmation({ silent: true });
        }, 650);
      }
    }, 450);

    return () => {
      if (autoSelfieTimerRef.current) {
        window.clearTimeout(autoSelfieTimerRef.current);
        autoSelfieTimerRef.current = null;
      }
      if (faceDetectionIntervalRef.current) {
        window.clearInterval(faceDetectionIntervalRef.current);
        faceDetectionIntervalRef.current = null;
      }
    };
  }, [isSelfieOpen, isSelfieReady, selfieActionDisabled, presensiType, location, shift, note, isLate, isRecognizingFace, recognizedFace]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-xl mx-auto p-4 space-y-4"
    >
      {/* Header */}
      <div className="flex justify-between items-center py-2">
        <img src={GIAT_LOGO_URL} alt="Logo Giat" className="h-10" />
        <div className="flex items-center gap-2">
          <button
            onClick={onRegisterFaceClick}
            className="h-10 px-3 bg-white border border-slate-200 text-[#B21B1B] hover:bg-red-50 rounded-full flex items-center justify-center gap-2 transition-colors text-xs font-extrabold"
          >
            <UserPlus size={16} />
            Daftar Wajah
          </button>
          <button onClick={onAdminClick} className="w-10 h-10 bg-slate-200 text-slate-500 hover:bg-slate-300 rounded-full flex items-center justify-center transition-colors">
            <User size={20} />
          </button>
        </div>
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
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Verifikasi Wajah</label>
            <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-slate-200 flex items-center justify-center flex-shrink-0">
                <User size={22} className="text-slate-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-800 truncate">Presensi langsung dengan wajah</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
                  Presensi masuk memilih lokasi dan shift, presensi pulang cukup verifikasi wajah
                </div>
              </div>
            </div>
          </div>

          {presensiType === 'masuk' ? (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Lokasi Kerja
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={hasCheckedIn && presensiType === 'masuk'}
                  className={`w-full p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm appearance-none ${hasCheckedIn && presensiType === 'masuk' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                >
                  <option value="">Pilih Lokasi</option>
                  {locations.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Waktu Shift
                </label>
                <select
                  value={shift}
                  onChange={(e) => setShift(e.target.value as Shift)}
                  disabled={hasCheckedIn && presensiType === 'masuk'}
                  className={`w-full p-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm appearance-none ${hasCheckedIn && presensiType === 'masuk' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                >
                  <option value="">Pilih Shift</option>
                  {Object.entries(shifts).map(([s, t]) => {
                    const times = t as { start_time: string; end_time: string };
                    return <option key={s} value={s}>{s} ({times.start_time} - {times.end_time})</option>;
                  })}
                </select>
                {shift && shifts[shift] && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    <ClockIcon size={12} className="text-[#B21B1B]" />
                    <span className="font-bold text-slate-700">{shifts[shift].start_time}</span>
                    <span className="text-slate-400">-</span>
                    <span className="font-bold text-slate-700">{shifts[shift].end_time}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3.5 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                <ClockIcon size={18} />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-blue-900 text-sm">Presensi pulang cukup scan wajah</div>
                <div className="text-xs text-blue-700 mt-1 leading-relaxed">
                  Lokasi kerja dan shift otomatis mengikuti data presensi masuk hari ini.
                </div>
              </div>
            </div>
          )}

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
            disabled={scanDisabled}
            onClick={startFaceAttendance}
            className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
              scanDisabled
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#B21B1B] text-white hover:bg-[#901515] shadow-lg shadow-red-900/20 active:scale-95'
            }`}
          >
            <Camera size={20} />
            {presensiType === 'masuk' ? 'PRESENSI WAJAH MASUK' : 'PRESENSI WAJAH PULANG'}
          </button>
          <p className={`text-center text-[10px] mt-4 ${scanDisabled ? 'text-red-400 font-bold' : 'text-slate-400'}`}>
            {scanHelperText}
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

      {/* Processing Popup */}
      {isProcessing && !recognizedFace && (
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
                <p className="text-sm text-slate-500 mt-2">Mengenali wajah, mengunggah foto ke CDN, dan menyimpan data presensi.</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Selfie Popup */}
      {isSelfieOpen && (
        <div className="fixed inset-0 bg-slate-950/95 z-[55] flex flex-col items-center justify-center overflow-y-auto p-3 sm:p-6 [padding-top:max(0.75rem,env(safe-area-inset-top))] [padding-bottom:max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="w-full max-w-sm sm:max-w-md lg:max-w-xl max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-3rem)] bg-white rounded-[28px] overflow-hidden shadow-2xl border border-white/10 flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-shrink-0">
              <div className="min-w-0">
                <div className="font-extrabold text-slate-800 truncate">Verifikasi wajah pegawai</div>
                <div className="text-xs text-slate-500 truncate">
                  {presensiType === 'masuk'
                    ? `${location || 'Lokasi belum terisi'} - ${shift || 'Shift belum terisi'}`
                    : 'Lokasi dan shift mengikuti presensi masuk'}
                </div>
              </div>
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                !isSelfieReady
                  ? 'bg-slate-100 text-slate-500'
                  : isFaceDetected
                    ? 'bg-green-50 text-green-600'
                    : 'bg-yellow-50 text-yellow-600'
              }`}>
                {!isSelfieReady ? 'Loading' : isFaceDetected ? 'Face Found' : 'Align Face'}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="h-[min(58dvh,560px)] min-h-[280px] bg-black relative overflow-hidden">
                <video
                  ref={selfieVideoRef}
                  playsInline
                  muted
                  onLoadedMetadata={() => setIsSelfieReady(true)}
                  onCanPlay={() => setIsSelfieReady(true)}
                  className="w-full h-full object-cover scale-x-[-1] brightness-[1.18] contrast-[1.08] saturate-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/45 pointer-events-none" />
                <div className={`absolute inset-x-8 sm:inset-x-12 top-12 lg:top-16 bottom-16 lg:bottom-20 rounded-[999px] border shadow-[0_0_0_999px_rgba(0,0,0,0.18)] camera-guide-breathe pointer-events-none ${
                  isFaceDetected ? 'border-green-300/90' : 'border-white/55'
                }`} />
                <div className="absolute left-6 top-6 w-12 h-12 border-l-4 border-t-4 border-white/85 rounded-tl-2xl pointer-events-none" />
                <div className="absolute right-6 top-6 w-12 h-12 border-r-4 border-t-4 border-white/85 rounded-tr-2xl pointer-events-none" />
                <div className="absolute left-6 bottom-6 w-12 h-12 border-l-4 border-b-4 border-white/85 rounded-bl-2xl pointer-events-none" />
                <div className="absolute right-6 bottom-6 w-12 h-12 border-r-4 border-b-4 border-white/85 rounded-br-2xl pointer-events-none" />
                <div className="absolute left-4 right-4 bottom-4 rounded-2xl bg-black/45 backdrop-blur-md border border-white/10 px-4 py-3 text-white">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold truncate">
                        {isRecognizingFace
                          ? 'Mengecek nama pegawai'
                          : !isSelfieReady
                          ? 'Menyiapkan kamera'
                          : isFaceDetected
                            ? 'Wajah terdeteksi'
                            : 'Arahkan wajah ke frame'}
                      </div>
                      <div className="text-[10px] text-white/65 truncate">
                        {isRecognizingFace ? 'Mohon tunggu sebentar' : 'Popup konfirmasi muncul otomatis setelah nama dikenali'}
                      </div>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full ${isFaceDetected ? 'bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.95)]' : 'bg-yellow-300 animate-pulse'}`} />
                  </div>
                </div>
                {!isSelfieReady && (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-sm font-bold backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                      Menyiapkan kamera...
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 pt-4 pb-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-xs text-slate-600 leading-relaxed flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isRecognizingFace ? 'bg-blue-500 animate-pulse' : isFaceDetected ? 'bg-green-500' : 'bg-yellow-400 animate-pulse'}`} />
                  <span>
                    {isRecognizingFace
                      ? 'Sedang mengidentifikasi nama pegawai...'
                      : 'Arahkan wajah ke dalam frame. Sistem akan otomatis menampilkan konfirmasi nama.'}
                  </span>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white border-t border-slate-100 flex-shrink-0 [padding-bottom:max(1rem,env(safe-area-inset-bottom))]">
              <button onClick={stopSelfieCamera} className="w-full py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recognition Confirmation Popup */}
      {recognizedFace && (
        <div className="fixed inset-0 bg-black/55 z-[60] flex items-center justify-center p-6 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 18 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 280 }}
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl"
          >
            <div className="h-2 bg-[#B21B1B]" />
            <div className="p-6 text-center space-y-5">
              <ProfilePhoto
                src={recognizedFace.photoUrl}
                alt={recognizedFace.name}
                className="w-24 h-24 mx-auto rounded-3xl border border-slate-200"
                iconSize={38}
              />
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-2">
                  Wajah dikenali sebagai
                </div>
                <h3 className="text-2xl font-black text-slate-800">{recognizedFace.name}</h3>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-600">
                Apakah nama pegawai ini sudah sesuai?
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  onClick={retryRecognition}
                  disabled={isProcessing}
                  className="py-3 rounded-2xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-60"
                >
                  Tidak Sesuai
                </button>
                <button
                  onClick={processAttendance}
                  disabled={isProcessing}
                  className="py-3 rounded-2xl bg-[#B21B1B] text-white font-bold hover:bg-[#901515] disabled:bg-slate-200 disabled:text-slate-400 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    presensiType === 'masuk' ? 'Ya, Presensi Masuk' : 'Ya, Presensi Pulang'
                  )}
                </button>
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
              {scanResult.success ? (
                <button
                  onClick={() => setScanResult(null)}
                  className="w-full py-3.5 rounded-xl font-bold text-white transition-all active:scale-95 bg-green-600 hover:bg-green-700 shadow-lg shadow-green-600/20"
                >
                  OK
                </button>
              ) : (
                <button
                  onClick={() => setScanResult(null)}
                  className="w-full py-3.5 rounded-xl font-bold text-white transition-all active:scale-95 bg-slate-800 hover:bg-slate-900 shadow-lg shadow-slate-800/20"
                >
                  OK
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}

function FaceRegistrationPage({ onBack }: { onBack: () => void }) {
  const { showToast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedName, setSelectedName] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(true);
  const [isDone, setIsDone] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const registerVideoRef = useRef<HTMLVideoElement | null>(null);
  const registerStreamRef = useRef<MediaStream | null>(null);
  const registerWakeLockRef = useRef<WakeLockSentinel | null>(null);

  const fetchEmployees = async () => {
    setIsEmployeeLoading(true);
    try {
      const data = await api.getEmployees();
      setEmployees(data);
    } finally {
      setIsEmployeeLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
    return () => stopRegisterCamera();
  }, []);

  const stopRegisterCamera = () => {
    void releaseScreenWakeLock(registerWakeLockRef);
    registerStreamRef.current?.getTracks().forEach(track => track.stop());
    registerStreamRef.current = null;
    if (registerVideoRef.current) registerVideoRef.current.srcObject = null;
    setIsCameraOpen(false);
    setIsCameraReady(false);
  };

  const startRegisterCamera = async () => {
    stopRegisterCamera();
    setIsCameraOpen(true);
    setIsCameraReady(false);
    try {
      void requestScreenWakeLock(registerWakeLockRef);
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Perangkat ini belum bisa membuka kamera.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false
      });
      registerStreamRef.current = stream;
      if (registerVideoRef.current) {
        registerVideoRef.current.srcObject = stream;
        await registerVideoRef.current.play();
      }
    } catch (error) {
      setIsCameraOpen(false);
      showToast(error instanceof Error ? error.message : 'Kamera belum bisa dibuka', 'error');
    }
  };

  const handleSelectEmployee = (name: string) => {
    setSelectedName(name);
    setEmployeeSearch(name);
    setIsEmployeeDropdownOpen(false);
    setSnapshots([]);
    setIsDone(false);
    setRegistrationError('');
    if (name) {
      setTimeout(() => startRegisterCamera(), 100);
    } else {
      stopRegisterCamera();
    }
  };

  const handleEmployeeSearchChange = (value: string) => {
    setEmployeeSearch(value);
    setIsEmployeeDropdownOpen(true);
    if (value !== selectedName) {
      setSelectedName('');
      setSnapshots([]);
      setIsDone(false);
      setRegistrationError('');
      stopRegisterCamera();
    }
  };

  const captureRegisterPhoto = () => {
    const video = registerVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || snapshots.length >= 3) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
    setRegistrationError('');
    setSnapshots(prev => [...prev, canvas.toDataURL('image/jpeg', 0.86)]);
  };

  const saveFaceRegistration = async () => {
    if (!selectedName || snapshots.length < 3 || isSaving) return;
    setIsSaving(true);
    try {
      const result = await api.registerFace(selectedName, snapshots);
      if (result.success) {
        showToast(result.message || 'Wajah pegawai berhasil diregistrasi', 'success');
        setIsDone(true);
        setRegistrationError('');
        stopRegisterCamera();
        await fetchEmployees();
      } else {
        const message = result.message || 'Registrasi wajah belum berhasil. Ambil ulang 3 foto wajah.';
        setSnapshots([]);
        setRegistrationError(message);
        showToast(message, 'error');
      }
    } catch (_error) {
      const message = 'Registrasi wajah belum berhasil. Periksa koneksi ke server, lalu ambil ulang foto.';
      setSnapshots([]);
      setRegistrationError(message);
      showToast(message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const resetRegistration = () => {
    setSnapshots([]);
    setIsDone(false);
    setRegistrationError('');
    if (selectedName) {
      setTimeout(() => startRegisterCamera(), 100);
    }
  };

  const step = snapshots.length;
  const stepInfo = [
    {
      title: 'Tahap 1: Hadap Lurus',
      desc: 'Posisikan wajah menghadap lurus ke kamera.',
      className: 'bg-blue-50 border-blue-100 text-blue-800'
    },
    {
      title: 'Tahap 2: Menoleh ke Kanan',
      desc: 'Putar wajah sedikit ke arah kanan.',
      className: 'bg-amber-50 border-amber-100 text-amber-800'
    },
    {
      title: 'Tahap 3: Menoleh ke Kiri',
      desc: 'Putar wajah sedikit ke arah kiri.',
      className: 'bg-purple-50 border-purple-100 text-purple-800'
    },
    {
      title: 'Semua Foto Diambil',
      desc: 'Simpan data wajah agar pegawai bisa presensi.',
      className: 'bg-green-50 border-green-100 text-green-800'
    }
  ][Math.min(step, 3)];

  const selectedEmployee = employees.find(emp => emp.name === selectedName);
  const activeEmployees = employees.filter(emp => emp.status === 'AKTIF');
  const searchValue = employeeSearch.trim().toLowerCase();
  const filteredEmployees = activeEmployees
    .filter(emp => !searchValue || emp.name.toLowerCase().includes(searchValue))
    .slice(0, 8);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-xl mx-auto p-4 space-y-4"
    >
      <div className="flex justify-between items-center py-2">
        <button
          onClick={() => { stopRegisterCamera(); onBack(); }}
          className="h-10 px-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-full flex items-center gap-2 text-xs font-extrabold"
        >
          <ArrowLeft size={16} />
          Kembali
        </button>
        <img src={GIAT_LOGO_URL} alt="Logo Giat" className="h-10" />
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-6">
        <div className="text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-[#B21B1B] flex items-center justify-center mb-3">
            <UserPlus size={26} />
          </div>
          <h2 className="text-2xl font-black text-slate-800">Registrasi Wajah</h2>
          <p className="text-sm text-slate-500 mt-1">Ambil 3 foto wajah untuk membuat data pengenal yang lebih stabil.</p>
        </div>

        {!isDone ? (
          <>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Pilih Pegawai</label>
              <div className="relative">
                <div className="relative">
                  <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={employeeSearch}
                    onFocus={() => setIsEmployeeDropdownOpen(true)}
                    onBlur={() => window.setTimeout(() => setIsEmployeeDropdownOpen(false), 160)}
                    onChange={e => handleEmployeeSearchChange(e.target.value)}
                    placeholder="Ketik nama pegawai..."
                    className="w-full pl-10 pr-3.5 py-3.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500/20 outline-none transition-all text-sm bg-white"
                  />
                </div>
                {isEmployeeDropdownOpen && (
                  <div className="absolute z-30 mt-2 w-full rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
                    {isEmployeeLoading ? (
                      <div className="px-4 py-6 flex flex-col items-center justify-center gap-3 text-sm text-slate-500">
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#B21B1B] rounded-full animate-spin" />
                        <span className="font-bold">Memuat data pegawai...</span>
                      </div>
                    ) : filteredEmployees.length > 0 ? (
                      <div className="max-h-72 overflow-y-auto">
                        {filteredEmployees.map(emp => (
                          <button
                            key={emp.id || emp.name}
                            type="button"
                            onClick={() => handleSelectEmployee(emp.name)}
                            className="w-full px-3 py-3 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
                          >
                            <ProfilePhoto
                              src={emp.photo_url}
                              alt={emp.name}
                              className="w-11 h-11 rounded-xl border border-slate-200 flex-shrink-0"
                              iconSize={18}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="font-extrabold text-sm text-slate-800 truncate">{emp.name}</div>
                              <div className={`text-[10px] font-bold uppercase tracking-wider ${emp.face_registered ? 'text-green-600' : 'text-orange-500'}`}>
                                {emp.face_registered ? 'Wajah terdaftar' : 'Belum daftar wajah'}
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-slate-300 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-5 text-center text-sm text-slate-400">
                        Nama pegawai tidak ditemukan.
                      </div>
                    )}
                  </div>
                )}
              </div>
              {!isEmployeeLoading && activeEmployees.length === 0 && (
                <p className="text-xs text-slate-400 mt-2">Belum ada pegawai aktif. Tambahkan pegawai dari halaman admin terlebih dahulu.</p>
              )}
            </div>

            {selectedName && (
              <div className="space-y-5">
                <div className={`rounded-xl border p-3 text-center ${stepInfo.className}`}>
                  <div className="font-extrabold text-sm">{stepInfo.title}</div>
                  <div className="text-xs mt-1">{stepInfo.desc}</div>
                </div>

                {registrationError && (
                  <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-center">
                    <div className="font-extrabold text-sm text-red-700">Registrasi Gagal</div>
                    <div className="text-xs text-red-600 mt-1 leading-relaxed">{registrationError}</div>
                  </div>
                )}

                <div className="relative w-full max-w-[320px] aspect-square mx-auto rounded-[32px] overflow-hidden bg-black border border-slate-200 shadow-xl">
                  {isCameraOpen ? (
                    <video
                      ref={registerVideoRef}
                      playsInline
                      muted
                      onLoadedMetadata={() => setIsCameraReady(true)}
                      onCanPlay={() => setIsCameraReady(true)}
                      className="w-full h-full object-cover scale-x-[-1] brightness-[1.18] contrast-[1.08] saturate-[1.04]"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 gap-2">
                      <Camera size={34} />
                      <span className="text-xs font-bold">Kamera nonaktif</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/45 pointer-events-none" />
                  <div className="absolute inset-8 rounded-[999px] border border-white/60 shadow-[0_0_0_999px_rgba(0,0,0,0.18)] camera-guide-breathe pointer-events-none" />
                  <div className="absolute left-5 top-5 w-10 h-10 border-l-4 border-t-4 border-white/85 rounded-tl-2xl pointer-events-none" />
                  <div className="absolute right-5 top-5 w-10 h-10 border-r-4 border-t-4 border-white/85 rounded-tr-2xl pointer-events-none" />
                  <div className="absolute left-5 bottom-5 w-10 h-10 border-l-4 border-b-4 border-white/85 rounded-bl-2xl pointer-events-none" />
                  <div className="absolute right-5 bottom-5 w-10 h-10 border-r-4 border-b-4 border-white/85 rounded-br-2xl pointer-events-none" />
                  {!isCameraReady && isCameraOpen && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-bold backdrop-blur-sm">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                        Menyiapkan kamera...
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[0, 1, 2].map(index => (
                    <div key={index} className="aspect-square rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                      {snapshots[index] ? (
                        <img src={snapshots[index]} alt={`Foto wajah ${index + 1}`} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-extrabold text-slate-300">{index + 1}</span>
                      )}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={captureRegisterPhoto}
                    disabled={!isCameraReady || snapshots.length >= 3}
                    className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${
                      !isCameraReady || snapshots.length >= 3
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-slate-900 text-white hover:bg-black'
                    }`}
                  >
                    <Camera size={18} />
                    Ambil Foto ({snapshots.length}/3)
                  </button>
                  <button
                    onClick={saveFaceRegistration}
                    disabled={snapshots.length < 3 || isSaving}
                    className={`py-3 rounded-xl font-bold flex items-center justify-center gap-2 ${
                      snapshots.length < 3 || isSaving
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-[#B21B1B] text-white hover:bg-[#901515]'
                    }`}
                  >
                    Simpan Wajah
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-8 text-center space-y-5">
            <div className="w-20 h-20 mx-auto rounded-full bg-green-50 flex items-center justify-center">
              <CheckCircle2 size={40} className="text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800">Registrasi Berhasil</h3>
              <p className="text-sm text-slate-500 mt-2">
                Wajah {selectedEmployee?.name || selectedName} sudah tersimpan dan siap dipakai untuk presensi.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button onClick={resetRegistration} className="py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 flex items-center justify-center gap-2">
                <UserPlus size={18} />
                Daftar Ulang
              </button>
              <button onClick={() => { setSelectedName(''); setSnapshots([]); setIsDone(false); }} className="py-3 rounded-xl bg-[#B21B1B] text-white font-bold hover:bg-[#901515]">
                Pegawai Lain
              </button>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isSaving && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-5 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 22, stiffness: 280 }}
              className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
              role="status"
              aria-live="polite"
            >
              <div className="h-2 bg-[#B21B1B]" />
              <div className="p-7 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
                  <div className="h-10 w-10 rounded-full border-4 border-[#B21B1B]/20 border-t-[#B21B1B] animate-spin" />
                </div>
                <h3 className="mt-5 text-lg font-black text-slate-800">Menyimpan registrasi wajah</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Foto wajah {selectedName} sedang diproses dan disimpan. Tunggu sampai proses selesai.
                </p>
                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold text-slate-500">
                  Mengunggah 3 foto dan membuat data pengenal wajah...
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
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
          <img src={GIAT_LOGO_URL} alt="Logo" className="h-16 mx-auto mb-4" />
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
  const [activeTab, setActiveTab] = useState<AdminTab>(() => readStoredAdminTab());
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPresentPopup, setShowPresentPopup] = useState(false);
  const [showLatePopup, setShowLatePopup] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string; subtitle: string } | null>(null);

  // History Filters
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 5), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [historyPage, setHistoryPage] = useState(1);
  const HISTORY_PAGE_SIZE = 10;

  // Settings
  const [newId, setNewId] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [cleanupEnabled, setCleanupEnabled] = useState(false);
  const [cleanupDays, setCleanupDays] = useState('90');
  const [savingCleanup, setSavingCleanup] = useState(false);
  const [runningCleanup, setRunningCleanup] = useState(false);

  const handleLogout = async () => {
    await api.logout();
    try {
      localStorage.setItem(APP_VIEW_STORAGE_KEY, 'employee');
      localStorage.setItem(ADMIN_TAB_STORAGE_KEY, 'dashboard');
    } catch (_error) {}
    updateAppHash('employee');
    onLogout();
  };

  useEffect(() => {
    fetchData();
    fetchAdminSettings();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_TAB_STORAGE_KEY, activeTab);
    } catch (_error) {}
    updateAppHash('admin-dashboard', activeTab);
  }, [activeTab]);

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

  const fetchAdminSettings = async () => {
    const settings = await api.getSettings();
    setCleanupEnabled(settings.attendance_cleanup_enabled === 'true');
    setCleanupDays(settings.attendance_cleanup_days || '90');
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

  const normalizedCleanupDays = () => {
    const days = parseInt(cleanupDays, 10);
    if (!Number.isFinite(days) || days < 1) return 90;
    return Math.min(days, 3650);
  };

  const handleSaveCleanupSettings = async () => {
    setSavingCleanup(true);
    try {
      const days = normalizedCleanupDays();
      const result = await api.updateSettings({
        attendance_cleanup_enabled: cleanupEnabled ? 'true' : 'false',
        attendance_cleanup_days: String(days)
      });
      if (result.success) {
        setCleanupDays(String(days));
        showToast('Pengaturan pembersihan berhasil disimpan', 'success');
      } else {
        showToast(result.message || 'Pengaturan belum berhasil disimpan', 'error');
      }
    } finally {
      setSavingCleanup(false);
    }
  };

  const handleRunCleanupNow = async () => {
    setRunningCleanup(true);
    try {
      const days = normalizedCleanupDays();
      const result = await api.runAttendanceCleanup(days);
      if (result.success) {
        showToast(result.message || 'Pembersihan bukti foto lama selesai', 'success');
        await fetchData();
      } else {
        showToast(result.message || 'Bukti foto lama belum berhasil dibersihkan', 'error');
      }
    } finally {
      setRunningCleanup(false);
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
              <img src={GIAT_LOGO_URL} alt="Logo" className="w-10 h-10 object-contain mx-auto" />
              <button 
                onClick={() => setIsDesktopCollapsed(false)} 
                className="p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors"
              >
                <Menu size={24} />
              </button>
            </>
          ) : (
            <>
              <img src={GIAT_LOGO_URL} alt="Logo" className="h-12 object-contain drop-shadow-sm" />
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
          <SidebarItem collapsed={isDesktopCollapsed} icon={<ImageIcon size={22} />} label="Foto Presensi" active={activeTab === 'attendance-photos'} onClick={() => setActiveTab('attendance-photos')} />
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
            <img src={GIAT_LOGO_URL} alt="Logo" className="h-8 lg:hidden" />
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
                            <th className="px-6 py-4">Bukti</th>
                            <th className="px-6 py-4">Status / Catatan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {todayData.length === 0 ? (
                            <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">Belum ada data presensi hari ini.</td></tr>
                          ) : (
                            todayData.map((d, i) => (
                              <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                                <td className="px-6 py-4 font-bold text-slate-800">{d.Name}</td>
                                <td className="px-6 py-4 text-slate-500 text-sm font-medium">{d.Location}</td>
                                <td className="px-6 py-4 text-slate-500 text-sm">{d.Shift}</td>
                                <td className="px-6 py-4 text-sm font-bold text-slate-700">{d.TimeIn}</td>
                                <td className="px-6 py-4 text-slate-400 text-sm font-medium">{d.TimeOut || '--:--'}</td>
                                <td className="px-6 py-4">
                                  <div className="flex gap-2">
                                    {d.CheckInPhotoUrl && <EvidencePhoto src={d.CheckInPhotoUrl} alt="Bukti masuk" className="w-10 h-10 rounded-lg object-cover border border-slate-200" onClick={() => setPreviewImage({ src: d.CheckInPhotoUrl || '', title: d.Name, subtitle: `${d.Date} - Masuk ${d.TimeIn || '--:--'} - ${d.Location}` })} />}
                                    {d.CheckOutPhotoUrl && <EvidencePhoto src={d.CheckOutPhotoUrl} alt="Bukti pulang" className="w-10 h-10 rounded-lg object-cover border border-slate-200" onClick={() => setPreviewImage({ src: d.CheckOutPhotoUrl || '', title: d.Name, subtitle: `${d.Date} - Pulang ${d.TimeOut || '--:--'} - ${d.Location}` })} />}
                                  </div>
                                </td>
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
                      <table className="w-full text-left min-w-[960px]">
                        <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                          <tr>
                            <th className="px-6 py-4">Tanggal</th>
                            <th className="px-6 py-4">Nama</th>
                            <th className="px-6 py-4">Lokasi</th>
                            <th className="px-6 py-4">Shift</th>
                            <th className="px-6 py-4">Datang</th>
                            <th className="px-6 py-4">Pulang</th>
                            <th className="px-6 py-4">Bukti Foto</th>
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
                                <div className="flex gap-2">
                                  {d.CheckInPhotoUrl && <EvidencePhoto src={d.CheckInPhotoUrl} alt="Masuk" className="w-10 h-10 rounded-lg object-cover border border-slate-200" onClick={() => setPreviewImage({ src: d.CheckInPhotoUrl || '', title: d.Name, subtitle: `${d.Date} - Masuk ${d.TimeIn || '--:--'} - ${d.Location}` })} />}
                                  {d.CheckOutPhotoUrl && <EvidencePhoto src={d.CheckOutPhotoUrl} alt="Pulang" className="w-10 h-10 rounded-lg object-cover border border-slate-200" onClick={() => setPreviewImage({ src: d.CheckOutPhotoUrl || '', title: d.Name, subtitle: `${d.Date} - Pulang ${d.TimeOut || '--:--'} - ${d.Location}` })} />}
                                  {!d.CheckInPhotoUrl && !d.CheckOutPhotoUrl && <span className="text-slate-300">-</span>}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${d.Status === 'Terlambat' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                  {d.Status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {filteredHistory.length === 0 && (
                            <tr><td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-medium">Tidak ada data untuk periode ini.</td></tr>
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

              {activeTab === 'attendance-photos' && (
                <AttendancePhotosView onChanged={fetchData} />
              )}

              {activeTab === 'settings' && (
                <div className="max-w-3xl mx-auto space-y-6">
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

                  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                      <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-[#B21B1B]">
                        <Trash2 size={24} />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-slate-800 text-lg">Pembersihan Foto Presensi</h3>
                        <p className="text-xs font-medium text-slate-500">Hapus otomatis bukti foto lama dari penyimpanan. Riwayat presensi tetap tersimpan.</p>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <label className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100 cursor-pointer">
                        <div>
                          <div className="font-bold text-slate-800">Aktifkan pembersihan otomatis</div>
                          <div className="text-xs text-slate-500 mt-1">Sistem akan membersihkan bukti foto lama setiap hari saat server berjalan.</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={cleanupEnabled}
                          onChange={e => setCleanupEnabled(e.target.checked)}
                          className="w-5 h-5 accent-[#B21B1B]"
                        />
                      </label>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Simpan bukti foto selama</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="1"
                            max="3650"
                            value={cleanupDays}
                            onChange={e => setCleanupDays(e.target.value)}
                            className="w-full pr-16 pl-4 py-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium focus:ring-2 focus:ring-[#B21B1B]/20 outline-none transition-all"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">hari</span>
                        </div>
                        <p className="text-xs text-slate-500">Bukti foto yang lebih lama dari jumlah hari ini akan dihapus. Data presensi tetap ada di riwayat.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          onClick={handleSaveCleanupSettings}
                          disabled={savingCleanup}
                          className="w-full bg-[#B21B1B] text-white py-4 rounded-xl font-bold shadow-lg shadow-red-900/20 hover:bg-[#901515] transition-all active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                        >
                          {savingCleanup ? 'MENYIMPAN...' : 'SIMPAN PENGATURAN'}
                        </button>
                        <button
                          onClick={handleRunCleanupNow}
                          disabled={runningCleanup}
                          className="w-full bg-slate-100 text-slate-700 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all active:scale-[0.98] disabled:text-slate-400"
                        >
                          {runningCleanup ? 'MEMBERSIHKAN...' : 'BERSIHKAN SEKARANG'}
                        </button>
                      </div>
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
          <BottomNavItem icon={<ImageIcon size={20} />} label="Foto" active={activeTab === 'attendance-photos'} onClick={() => setActiveTab('attendance-photos')} />
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

      {previewImage && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute inset-0 cursor-zoom-out"
            aria-label="Tutup preview foto"
          />
          <div className="relative z-10 w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-extrabold text-slate-800 truncate">{previewImage.title}</div>
                <div className="text-xs text-slate-500 truncate">{previewImage.subtitle}</div>
              </div>
              <button onClick={() => setPreviewImage(null)} className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X size={18} />
              </button>
            </div>
            <div className="bg-black flex-1 min-h-0 flex items-center justify-center">
              <EvidencePhoto src={previewImage.src} alt={previewImage.title} className="max-w-full max-h-[78vh] object-contain" />
            </div>
          </div>
        </div>
      )}
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

function Pagination({ currentPage, totalPages, onPageChange }: { currentPage: number; totalPages: number; onPageChange: (page: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 sm:px-6 bg-white border-t border-slate-100 rounded-b-2xl">
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-700">
            Menampilkan halaman <span className="font-bold">{currentPage}</span> dari <span className="font-bold">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-slate-300 bg-white text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="sr-only">Next</span>
              <ChevronRight size={16} />
            </button>
          </nav>
        </div>
      </div>
      <div className="flex items-center justify-between w-full sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          Sebelumnya
        </button>
        <span className="text-sm text-slate-600 font-medium">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="relative inline-flex items-center px-4 py-2 border border-slate-300 text-sm font-medium rounded-md text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          Berikutnya
        </button>
      </div>
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

function AttendancePhotosView({ onChanged }: { onChanged: () => void }) {
  const { showToast, showConfirm } = useToast();
  const [photos, setPhotos] = useState<AttendancePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPhoto, setPreviewPhoto] = useState<AttendancePhoto | null>(null);
  const [deletingPhotoKey, setDeletingPhotoKey] = useState<string | null>(null);

  // Pagination for Photos
  const [photoPage, setPhotoPage] = useState(1);
  const photosPerPage = 12;
  const totalPhotoPages = Math.max(1, Math.ceil(photos.length / photosPerPage));
  const paginatedPhotos = photos.slice((photoPage - 1) * photosPerPage, photoPage * photosPerPage);

  const fetchPhotos = async () => {
    setLoading(true);
    const data = await api.getAttendancePhotos();
    setPhotos(data);
    setLoading(false);
  };

  useEffect(() => { fetchPhotos(); }, []);

  const photoKey = (photo: AttendancePhoto) => `${photo.attendanceId}-${photo.type}`;

  const handleDelete = (photo: AttendancePhoto) => {
    showConfirm(`Hapus foto presensi ${photo.type} milik "${photo.name}"?\n\nBukti foto juga akan dihapus dari penyimpanan.`, async () => {
      const key = photoKey(photo);
      setDeletingPhotoKey(key);
      try {
        const result = await api.deleteAttendancePhoto(photo.attendanceId, photo.type);
        if (result.success) {
          showToast('Foto presensi berhasil dihapus', 'success');
          await fetchPhotos();
          onChanged();
        } else {
          showToast(result.message || 'Gagal menghapus foto presensi', 'error');
        }
      } finally {
        setDeletingPhotoKey(null);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-12 h-12 border-4 border-[#B21B1B] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-[#B21B1B] font-bold tracking-widest animate-pulse text-sm">MEMUAT FOTO...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="text-2xl font-black text-slate-800">Foto Presensi</h2>
          <p className="text-slate-500 text-sm mt-1">Kelola bukti foto presensi yang tersimpan di penyimpanan foto.</p>
        </div>
        <button onClick={fetchPhotos} className="px-4 py-2 rounded-xl bg-red-50 text-[#B21B1B] text-xs font-bold hover:bg-red-100">
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {paginatedPhotos.map(photo => {
          const isDeleting = deletingPhotoKey === photoKey(photo);
          return (
          <div key={photoKey(photo)} className={`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-opacity ${isDeleting ? 'opacity-70 pointer-events-none' : ''}`}>
            <div className="block aspect-[4/3] bg-slate-100">
              <EvidencePhoto
                src={photo.url}
                alt={`Foto ${photo.type} ${photo.name}`}
                className="w-full h-full object-cover"
                onClick={() => setPreviewPhoto(photo)}
              />
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="font-extrabold text-slate-800 truncate">{photo.name}</div>
                <div className="text-xs text-slate-500">{photo.date} - {photo.time || '--:--'} - {photo.type.toUpperCase()}</div>
              </div>
              <div className="text-xs text-slate-500 space-y-1">
                <div className="flex items-center gap-1.5"><MapPin size={12} /> {photo.location}</div>
                <div className="flex items-center gap-1.5"><ClockIcon size={12} /> {photo.shift}</div>
                <div className="font-mono text-[10px] text-slate-400">
                  {photo.latitude && photo.longitude ? `${photo.latitude}, ${photo.longitude}` : 'Koordinat tidak tersedia'}
                </div>
              </div>
              <button onClick={() => handleDelete(photo)} className="w-full py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-xs hover:bg-red-100 flex items-center justify-center gap-2">
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Hapus Foto
                  </>
                )}
              </button>
            </div>
          </div>
        );
        })}
        {photos.length === 0 && (
          <div className="col-span-full py-16 text-center text-slate-400 font-medium bg-white rounded-2xl border border-slate-100">
            Belum ada foto presensi yang tersimpan.
          </div>
        )}
      </div>

      {photos.length > 0 && (
        <Pagination 
          currentPage={photoPage}
          totalPages={totalPhotoPages}
          onPageChange={setPhotoPage}
        />
      )}

      {previewPhoto && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <button
            onClick={() => setPreviewPhoto(null)}
            className="absolute inset-0 cursor-zoom-out"
            aria-label="Tutup preview foto"
          />
          <div className="relative z-10 w-full max-w-5xl max-h-[92vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-extrabold text-slate-800 truncate">{previewPhoto.name}</div>
                <div className="text-xs text-slate-500 truncate">
                  {previewPhoto.date} - {previewPhoto.time || '--:--'} - {previewPhoto.type.toUpperCase()} - {previewPhoto.location}
                </div>
              </div>
              <button onClick={() => setPreviewPhoto(null)} className="p-2 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X size={18} />
              </button>
            </div>
            <div className="bg-black flex-1 min-h-0 flex items-center justify-center">
              <EvidencePhoto
                src={previewPhoto.url}
                alt={`Foto ${previewPhoto.type} ${previewPhoto.name}`}
                className="max-w-full max-h-[78vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MasterDataView() {
  const { showToast, showConfirm } = useToast();
  const [subTab, setSubTab] = useState<'employees' | 'locations' | 'shifts'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [shifts, setShifts] = useState<Record<string, { start_time: string; end_time: string; is_overtime: boolean }>>({});
  const [loading, setLoading] = useState(true);

  // Pagination for Employees
  const [empPage, setEmpPage] = useState(1);
  const empPerPage = 10;
  const totalEmpPages = Math.max(1, Math.ceil(employees.length / empPerPage));
  const paginatedEmployees = employees.slice((empPage - 1) * empPerPage, empPage * empPerPage);

  // Modals
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [managingLocationEmployee, setManagingLocationEmployee] = useState<Employee | null>(null);

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
      api.getAdminLocations(),
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
    if (!newEmpName.trim()) {
      showToast('Nama pegawai wajib diisi', 'error');
      return;
    }
    const result = await api.addEmployee({ name: newEmpName.trim(), status: 'AKTIF' });
    if (result.success) {
      setNewEmpName('');
      showToast(result.message || 'Pegawai berhasil ditambahkan', 'success');
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
  const handleDeleteLocation = async (id: number, name: string) => {
    showConfirm(`Hapus lokasi "${name}"?\n\nData absensi yang sudah tercatat TETAP tersimpan di riwayat.`, async () => {
      const result = await api.deleteAdminLocation(id);
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
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-start">
              <div>
                <input
                  type="text"
                  value={newEmpName}
                  onChange={e => setNewEmpName(e.target.value)}
                  placeholder="Nama pegawai"
                  className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:ring-2 focus:ring-[#B21B1B]/20 outline-none"
                />
                <p className="text-xs text-slate-400 mt-2">Foto wajah didaftarkan dari halaman user melalui tombol Daftar Wajah.</p>
              </div>
              <button
                onClick={handleAddEmployee}
                disabled={!newEmpName.trim()}
                className={`px-6 py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap ${
                  !newEmpName.trim()
                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-[#B21B1B] text-white hover:bg-[#901515]'
                }`}
              >
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
              {paginatedEmployees.map((emp, i) => (
                <div key={emp.name} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/50">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-slate-400 text-xs font-medium w-5 flex-shrink-0">{(empPage - 1) * empPerPage + i + 1}</span>
                    <ProfilePhoto
                      src={emp.photo_url}
                      alt={emp.name}
                      className="w-9 h-9 rounded-full border border-slate-200 flex-shrink-0"
                      iconSize={16}
                    />
                    <div className="min-w-0">
                      <span className="font-bold text-slate-800 truncate block">{emp.name}</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wider ${emp.face_registered ? 'text-green-600' : 'text-orange-500'}`}>
                        {emp.face_registered ? 'Wajah terdaftar' : 'Belum daftar wajah'}
                      </span>
                    </div>
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
                    <button onClick={() => setManagingLocationEmployee(emp)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-400" title="Atur Lokasi">
                      <MapPin size={14} />
                    </button>
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
                    <th className="px-6 py-4">Foto</th>
                    <th className="px-6 py-4">Nama</th>
                    <th className="px-6 py-4">Face Recognition</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginatedEmployees.map((emp, i) => (
                    <tr key={emp.name} className="hover:bg-slate-50/50 transition-colors text-sm">
                      <td className="px-6 py-4 text-slate-400">{(empPage - 1) * empPerPage + i + 1}</td>
                      <td className="px-6 py-4">
                        <ProfilePhoto
                          src={emp.photo_url}
                          alt={emp.name}
                          className="w-12 h-12 rounded-xl border border-slate-200"
                          iconSize={18}
                        />
                        <div className="text-[10px] text-slate-400 mt-1 font-medium">
                          Dari foto pertama registrasi wajah
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-800">{emp.name}</td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-2">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${emp.face_registered ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-500'}`}>
                            {emp.face_registered ? <CheckCircle2 size={16} /> : <Camera size={16} />}
                          </span>
                          <div>
                            <div className={`text-xs font-extrabold ${emp.face_registered ? 'text-green-600' : 'text-orange-500'}`}>
                              {emp.face_registered ? 'Terdaftar' : 'Belum terdaftar'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">Registrasi ulang dari halaman user</div>
                          </div>
                        </div>
                      </td>
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
                        <button onClick={() => setManagingLocationEmployee(emp)} className="p-2 hover:bg-blue-50 rounded-lg text-blue-400 hover:text-blue-600 transition-colors" title="Atur Lokasi">
                          <MapPin size={16} />
                        </button>
                        <button onClick={() => handleDeleteEmployee(emp.name)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 hover:text-red-600 transition-colors" title="Hapus">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {employees.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400">Belum ada data pegawai.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <Pagination 
              currentPage={empPage}
              totalPages={totalEmpPages}
              onPageChange={setEmpPage}
            />
          </div>
        </div>
      )}

      {/* === LOKASI === */}
      {subTab === 'locations' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
            <div>
              <h3 className="font-extrabold text-slate-800">Daftar Lokasi Kerja</h3>
              <p className="text-xs text-slate-500 mt-1">Atur area geofence untuk presensi</p>
            </div>
            <button onClick={() => { setEditingLocation(null); setIsLocationModalOpen(true); }} className="w-full sm:w-auto px-6 py-3 bg-[#B21B1B] text-white rounded-xl font-bold hover:bg-[#901515] transition-all active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap">
              <Plus size={16} /> Tambah Lokasi
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="divide-y divide-slate-50">
              {locations.map((loc, i) => (
                <div key={loc.id} className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 hover:bg-slate-50/50 transition-colors gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-slate-400 text-xs font-medium w-5 sm:w-8 flex-shrink-0">{i + 1}</span>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${loc.is_active ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-400'}`}>
                      <MapPin size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate flex items-center gap-2">
                        {loc.name}
                        {!loc.is_active && <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[9px] uppercase tracking-wider rounded-md">Nonaktif</span>}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">{loc.address || 'Tanpa alamat detail'}</div>
                      <div className="text-[10px] font-medium text-slate-400 mt-0.5">Radius: {loc.radius_meter}m • Akurasi max: {loc.max_accuracy_meter}m</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pl-12 sm:pl-0">
                    <button onClick={() => { setEditingLocation(loc); setIsLocationModalOpen(true); }} className="px-4 py-2 hover:bg-slate-100 rounded-xl text-slate-600 text-xs font-bold transition-colors">Edit</button>
                    <button onClick={() => handleDeleteLocation(loc.id, loc.name)} className="p-2 hover:bg-red-50 rounded-xl text-red-400 hover:text-red-600 transition-colors" title="Hapus">
                      <Trash2 size={16} />
                    </button>
                  </div>
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
                  <div className="text-xs text-slate-500">Shift ini tetap dicek keterlambatannya dan dihitung sebagai lembur di statistik</div>
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

      {isLocationModalOpen && (
        <LocationFormModal 
          location={editingLocation}
          onClose={() => { setIsLocationModalOpen(false); setEditingLocation(null); }}
          onSave={() => { setIsLocationModalOpen(false); setEditingLocation(null); fetchAll(); }}
        />
      )}

      {managingLocationEmployee && managingLocationEmployee.id && (
        <EmployeeLocationModal
          employeeId={managingLocationEmployee.id}
          employeeName={managingLocationEmployee.name}
          onClose={() => setManagingLocationEmployee(null)}
        />
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
  const [employeeList, setEmployeeList] = useState<Employee[]>([]);
  const [shiftMap, setShiftMap] = useState<Record<string, { is_overtime: boolean }>>({});
  const [employeeLoading, setEmployeeLoading] = useState(true);

  const fetchEmployeeData = useCallback(async () => {
    setEmployeeLoading(true);
    try {
      const [employees, shifts] = await Promise.all([
        api.getEmployees(),
        api.getShifts()
      ]);
      setEmployeeList(employees);
      setShiftMap(shifts);
    } finally {
      setEmployeeLoading(false);
    }
  }, []);

  // Fetch employees & shifts dari database
  useEffect(() => {
    fetchEmployeeData();
    const handleFocus = () => fetchEmployeeData();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchEmployeeData]);

  const employeeProfileMap = new Map<string, Employee>(
    employeeList.map(emp => [emp.name.trim().toLowerCase(), emp])
  );
  const getEmployeeProfile = (name?: string | null) =>
    name ? employeeProfileMap.get(name.trim().toLowerCase()) || null : null;
  const allEmployees = [...employeeList].sort((a, b) => a.name.localeCompare(b.name));
  const activeEmployees = allEmployees;
  const displayEmployees = activeEmployees
    .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));

  // Pagination for Employee Grid
  const [empPage, setEmpPage] = useState(1);
  const empPerPage = 12;
  const totalEmpPages = Math.max(1, Math.ceil(displayEmployees.length / empPerPage));
  const paginatedDisplayEmployees = displayEmployees.slice((empPage - 1) * empPerPage, empPage * empPerPage);

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
  const selectedEmployeeProfile = getEmployeeProfile(selectedEmployee);

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
            <ProfilePhoto
              src={selectedEmployeeProfile?.photo_url}
              alt={selectedEmployeeProfile?.name || selectedEmployee}
              className="w-16 h-16 rounded-full border-2 border-white shadow-sm flex-shrink-0"
              iconSize={30}
            />
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg leading-tight">{selectedEmployee}</h3>
              <div className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${selectedEmployeeProfile?.face_registered ? 'text-green-600' : 'text-orange-500'}`}>
                {selectedEmployeeProfile?.face_registered ? 'Foto wajah terdaftar' : 'Belum ada foto wajah'}
              </div>
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
        <button
          onClick={fetchEmployeeData}
          disabled={employeeLoading}
          className="px-4 py-2 rounded-xl bg-red-50 text-[#B21B1B] text-xs font-bold hover:bg-red-100 disabled:opacity-60 flex items-center gap-2"
        >
          {employeeLoading ? (
            <div className="w-3.5 h-3.5 border-2 border-[#B21B1B]/30 border-t-[#B21B1B] rounded-full animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Refresh Foto
        </button>
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
        {employeeLoading && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center gap-3 text-[#B21B1B] bg-white rounded-3xl border border-slate-100">
            <div className="w-10 h-10 border-4 border-[#B21B1B] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-black uppercase tracking-widest">Memuat foto pegawai...</span>
          </div>
        )}
        {paginatedDisplayEmployees.map((emp) => {
          return (
          <div key={emp.name} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg transition-all flex flex-col items-center text-center group relative overflow-hidden">

            <div className="relative mb-4">
              <ProfilePhoto
                src={emp.photo_url}
                alt={emp.name}
                className="w-24 h-24 rounded-xl border border-slate-200 shadow-sm"
                iconSize={42}
              />
              <div className={`absolute -right-1 -bottom-1 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center ${emp.face_registered ? 'bg-green-500 text-white' : 'bg-slate-300 text-white'}`}>
                {emp.face_registered ? <CheckCircle2 size={13} /> : <User size={12} />}
              </div>
            </div>
            <h4 className="font-extrabold text-slate-800 text-lg line-clamp-1 w-full px-2" title={emp.name}>{emp.name}</h4>
            <div className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${emp.face_registered ? 'text-green-600' : 'text-orange-500'}`}>
              {emp.face_registered ? 'Foto wajah terdaftar' : 'Belum ada foto wajah'}
            </div>
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
        );
        })}
        {!employeeLoading && displayEmployees.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 font-medium italic">Tidak ada pegawai yang sesuai dengan filter.</div>
        )}
      </div>
      
      {!employeeLoading && displayEmployees.length > 0 && (
        <Pagination 
          currentPage={empPage}
          totalPages={totalEmpPages}
          onPageChange={setEmpPage}
        />
      )}
    </div>
  );
}
