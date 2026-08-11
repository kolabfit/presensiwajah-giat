import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SystemHealth } from '../types';
import { RefreshCw, Database, Server, HardDrive, DownloadCloud, Cpu, MemoryStick, Clock, ShieldAlert } from 'lucide-react';

export function SystemTab({ useToast }: { useToast: any }) {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  
  const loadHealth = async () => {
    setIsLoading(true);
    try {
      const resHealth = await api.getSystemHealth();
      if (resHealth.success) {
        setHealth(resHealth.data.health);
        setMetrics(resHealth.data.metrics);
      }
      const resSettings = await api.getSettings();
      setMaintenanceMode(resSettings.maintenance_mode === 'true');
    } catch (e) {
      useToast.showToast('Gagal memuat data sistem', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMaintenance = async () => {
    const nextState = !maintenanceMode;
    const msg = nextState 
      ? 'Aktifkan Maintenance Mode? Akses untuk pegawai akan diblokir!'
      : 'Matikan Maintenance Mode? Sistem akan kembali normal.';
    if (!window.confirm(msg)) return;
    
    try {
      await api.updateSettings({ maintenance_mode: nextState.toString() });
      setMaintenanceMode(nextState);
      useToast.showToast(`Maintenance Mode ${nextState ? 'diaktifkan' : 'dimatikan'}`, 'success');
    } catch (error) {
      useToast.showToast('Gagal mengubah pengaturan maintenance', 'error');
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const handleBackup = async () => {
    if (!window.confirm('Mulai backup database sekarang?')) return;
    setIsBackingUp(true);
    try {
      const res = await api.triggerSystemBackup();
      if (res.success) {
        useToast.showToast(`Backup berhasil: ${res.file}`, 'success');
      } else {
        useToast.showToast(res.message || 'Gagal backup', 'error');
      }
    } catch (e) {
      useToast.showToast('Terjadi kesalahan saat backup', 'error');
    } finally {
      setIsBackingUp(false);
    }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    if (status === 'ONLINE' || status === 'OK') return <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />;
    if (status === 'WARNING') return <div className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />;
    return <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Sistem & Keamanan</h2>
        <button onClick={loadHealth} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200">
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg"><Server size={24} /></div>
          <div className="flex-1">
            <p className="text-sm text-slate-500 font-medium">Backend API</p>
            <div className="flex items-center gap-2 mt-1">
              {health ? <StatusIcon status={health.backend} /> : <div className="w-3 h-3 bg-slate-200 rounded-full animate-pulse" />}
              <span className="font-semibold text-slate-700">{health?.backend || 'Memuat...'}</span>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><Database size={24} /></div>
          <div className="flex-1">
            <p className="text-sm text-slate-500 font-medium">MySQL Database</p>
            <div className="flex items-center gap-2 mt-1">
              {health ? <StatusIcon status={health.mysql} /> : <div className="w-3 h-3 bg-slate-200 rounded-full animate-pulse" />}
              <span className="font-semibold text-slate-700">{health?.mysql || 'Memuat...'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg"><DownloadCloud size={24} /></div>
          <div className="flex-1">
            <p className="text-sm text-slate-500 font-medium">CDN Kroombox</p>
            <div className="flex items-center gap-2 mt-1">
              {health ? <StatusIcon status={health.cdn} /> : <div className="w-3 h-3 bg-slate-200 rounded-full animate-pulse" />}
              <span className="font-semibold text-slate-700">{health?.cdn || 'Memuat...'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
          <div className="p-3 bg-slate-100 text-slate-600 rounded-lg"><HardDrive size={24} /></div>
          <div className="flex-1">
            <p className="text-sm text-slate-500 font-medium">Local Storage</p>
            <div className="flex items-center gap-2 mt-1">
              {health ? <StatusIcon status={health.localDisk} /> : <div className="w-3 h-3 bg-slate-200 rounded-full animate-pulse" />}
              <span className="font-semibold text-slate-700">
                {metrics ? `${metrics.uploads_folder_mb} MB` : 'Memuat...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <h3 className="text-xl font-bold text-slate-800 mt-8 mb-4">Statistik Server</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-lg"><Cpu size={24} /></div>
          <div className="flex-1">
            <p className="text-sm text-slate-500 font-medium">CPU Load (1m)</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-semibold text-slate-700">
                {metrics ? `${metrics.cpu_load}` : 'Memuat...'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-lg"><MemoryStick size={24} /></div>
          <div className="flex-1">
            <p className="text-sm text-slate-500 font-medium">RAM Terpakai</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-semibold text-slate-700">
                {metrics ? `${(metrics.memory_total_mb - metrics.memory_free_mb).toFixed(0)} MB / ${metrics.memory_total_mb} MB` : 'Memuat...'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
          <div className="p-3 bg-slate-50 text-slate-600 rounded-lg"><Clock size={24} /></div>
          <div className="flex-1">
            <p className="text-sm text-slate-500 font-medium">Uptime Server</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="font-semibold text-slate-700">
                {metrics ? `${Math.floor(metrics.uptime_seconds / 3600)}j ${(Math.floor(metrics.uptime_seconds / 60) % 60)}m` : 'Memuat...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-8">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
              <ShieldAlert className="text-red-500" size={20} />
              Maintenance Mode
            </h3>
            <p className="text-slate-600 text-sm max-w-2xl">
              Jika diaktifkan, aplikasi akan menampilkan halaman perbaikan untuk pegawai. Gunakan fitur ini saat sedang melakukan update atau maintenance database untuk mencegah error program. Akses Superadmin tetap berjalan normal.
            </p>
          </div>
          <button
            onClick={toggleMaintenance}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${maintenanceMode ? 'bg-red-500' : 'bg-slate-300'}`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${maintenanceMode ? 'translate-x-7' : 'translate-x-1'}`}
            />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mt-8">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Backup Database</h3>
        <p className="text-slate-600 mb-6">Lakukan backup secara berkala untuk mencegah kehilangan data. File backup akan disimpan di server.</p>
        <button 
          onClick={handleBackup}
          disabled={isBackingUp}
          className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 transition-colors disabled:opacity-70"
        >
          {isBackingUp ? <RefreshCw className="animate-spin" size={18} /> : <Database size={18} />}
          {isBackingUp ? 'Proses Backup...' : 'Mulai Backup Sekarang'}
        </button>
      </div>
    </div>
  );
}
