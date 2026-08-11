import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { RefreshCw, Search } from 'lucide-react';

export function AuditLogTab({ useToast }: { useToast: any }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAuditLogs();
      if (Array.isArray(res)) setLogs(res);
    } catch (e) {
      useToast.showToast('Gagal memuat audit log', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Audit Logs (Riwayat Aktivitas)</h2>
        <button onClick={loadLogs} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200">
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-600 text-sm">Waktu</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Aktor (Role)</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Aksi</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Modul</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Target</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={5} className="text-center p-8 text-slate-500">Belum ada log</td></tr>
              ) : (
                logs.map(l => (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 text-sm text-slate-500">{new Date(l.created_at).toLocaleString('id-ID')}</td>
                    <td className="p-4 text-sm font-medium">{l.actor || '-'} <span className="text-xs text-slate-400">({l.role})</span></td>
                    <td className="p-4 text-sm">{l.action}</td>
                    <td className="p-4 text-sm"><span className="px-2 py-1 rounded bg-slate-100 text-xs">{l.module}</span></td>
                    <td className="p-4 text-sm text-slate-600">{l.target}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
