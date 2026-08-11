import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AdminConfig } from '../types';
import { RefreshCw, Plus, Edit, Trash2, X, Save } from 'lucide-react';

export function AdminAccountsTab({ useToast }: { useToast: any }) {
  const [accounts, setAccounts] = useState<AdminConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ admin_id: '', password: '', role: 'ADMIN' });
  
  const [editingAdmin, setEditingAdmin] = useState<Partial<AdminConfig> | null>(null);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAdminAccounts();
      if (Array.isArray(res)) setAccounts(res);
    } catch (e) {
      useToast.showToast('Gagal memuat data akun admin', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleAdd = async () => {
    if (!newAdmin.admin_id || !newAdmin.password || !newAdmin.role) {
      useToast.showToast('Mohon lengkapi semua data', 'error');
      return;
    }
    setIsSaving(true);
    try {
      const res = await api.addAdminAccount(newAdmin as AdminConfig);
      if (res.success) {
        useToast.showToast('Admin berhasil ditambahkan', 'success');
        setIsAddModalOpen(false);
        setNewAdmin({ admin_id: '', password: '', role: 'ADMIN' });
        loadAccounts();
      } else {
        useToast.showToast(res.message || 'Gagal menambahkan admin', 'error');
      }
    } catch (e) {
      useToast.showToast('Terjadi kesalahan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingAdmin || !editingAdmin.id) return;
    setIsSaving(true);
    try {
      const res = await api.updateAdminAccount(editingAdmin.id, { role: editingAdmin.role, is_active: editingAdmin.is_active });
      if (res.success) {
        useToast.showToast('Data admin berhasil diperbarui', 'success');
        setEditingAdmin(null);
        loadAccounts();
      } else {
        useToast.showToast(res.message || 'Gagal memperbarui admin', 'error');
      }
    } catch (e) {
      useToast.showToast('Terjadi kesalahan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number, username: string) => {
    useToast.showConfirm(`Hapus akun admin "${username}"?`, async () => {
      try {
        const res = await api.deleteAdminAccount(id);
        if (res.success) {
          useToast.showToast('Akun berhasil dihapus', 'success');
          loadAccounts();
        } else {
          useToast.showToast(res.message || 'Gagal menghapus admin', 'error');
        }
      } catch (e) {
        useToast.showToast('Terjadi kesalahan', 'error');
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Kelola Akun Admin</h2>
        <div className="flex gap-2">
          <button onClick={loadAccounts} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200">
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button onClick={() => setIsAddModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-[#B21B1B] text-white rounded-lg hover:bg-[#8A1515]">
            <Plus size={18} /> Tambah Akun
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-600 text-sm">Username</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Role</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Login Terakhir</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr><td colSpan={5} className="text-center p-8 text-slate-500">Memuat...</td></tr>
              ) : (
                accounts.map(acc => (
                  <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 text-sm font-medium">{acc.admin_id}</td>
                    <td className="p-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${acc.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {acc.role}
                      </span>
                    </td>
                    <td className="p-4 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${acc.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {acc.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      {acc.last_login ? new Date(acc.last_login).toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="p-4 text-sm flex gap-3">
                      <button onClick={() => setEditingAdmin(acc)} className="text-slate-400 hover:text-blue-600" title="Edit Akun"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(acc.id, acc.admin_id)} className="text-slate-400 hover:text-red-600" title="Hapus Akun"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Tambah Akun Admin</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Username (Admin ID)</label>
                <input type="text" value={newAdmin.admin_id} onChange={e => setNewAdmin({...newAdmin, admin_id: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#B21B1B]" placeholder="Masukkan username" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Password</label>
                <input type="password" value={newAdmin.password} onChange={e => setNewAdmin({...newAdmin, password: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#B21B1B]" placeholder="Masukkan password" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Role</label>
                <select value={newAdmin.role} onChange={e => setNewAdmin({...newAdmin, role: e.target.value})} className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#B21B1B]">
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPERADMIN">SUPERADMIN</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Batal</button>
              <button onClick={handleAdd} disabled={isSaving} className="px-4 py-2 text-sm font-bold text-white bg-[#B21B1B] rounded-lg hover:bg-[#901515] flex items-center gap-2">
                {isSaving ? 'Menyimpan...' : <><Save size={16} /> Simpan</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-slate-900/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800">Edit Akun: {editingAdmin.admin_id}</h3>
              <button onClick={() => setEditingAdmin(null)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Role</label>
                <select value={editingAdmin.role || 'ADMIN'} onChange={e => setEditingAdmin({...editingAdmin, role: e.target.value as any})} className="w-full p-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-[#B21B1B]">
                  <option value="ADMIN">ADMIN</option>
                  <option value="SUPERADMIN">SUPERADMIN</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Status Akun</label>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActiveCheck" checked={editingAdmin.is_active || false} onChange={e => setEditingAdmin({...editingAdmin, is_active: e.target.checked})} className="w-4 h-4 accent-[#B21B1B]" />
                  <label htmlFor="isActiveCheck" className="text-sm font-medium text-slate-700">Aktif (Dapat Login)</label>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button onClick={() => setEditingAdmin(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Batal</button>
              <button onClick={handleUpdate} disabled={isSaving} className="px-4 py-2 text-sm font-bold text-white bg-[#B21B1B] rounded-lg hover:bg-[#901515] flex items-center gap-2">
                {isSaving ? 'Menyimpan...' : <><Save size={16} /> Simpan Perubahan</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

