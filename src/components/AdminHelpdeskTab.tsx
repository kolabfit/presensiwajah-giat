import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Ticket } from '../types';
import { RefreshCw, Search, CheckCircle, Clock, AlertCircle, Send, ImageIcon, Download, Paperclip } from 'lucide-react';
import { getImageUrl } from '../services/api';

export function AdminHelpdeskTab({ useToast }: { useToast: any }) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [ticketDetail, setTicketDetail] = useState<{ticket: Ticket, messages: any[]} | null>(null);
  
  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachment, setReplyAttachment] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  
  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const res = await api.getAdminTickets();
      if (Array.isArray(res)) setTickets(res);
    } catch (e) {
      useToast.showToast('Gagal memuat tiket', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleOpenTicket = async (id: number) => {
    setSelectedTicketId(id);
    setTicketDetail(null);
    try {
      const res = await api.getAdminTicketDetail(id);
      if (res.success) {
        setTicketDetail({ ticket: res.ticket, messages: res.messages || [] });
      } else {
        useToast.showToast(res.message || 'Gagal memuat detail', 'error');
      }
    } catch (e) {
      useToast.showToast('Terjadi kesalahan', 'error');
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selectedTicketId) return;

    setIsReplying(true);
    try {
      const res = await api.replyAdminTicket(selectedTicketId, {
        message: replyMessage,
        attachment_data_url: replyAttachment || undefined
      });
      if (res.success) {
        setReplyMessage('');
        setReplyAttachment(null);
        useToast.showToast('Balasan terkirim', 'success');
        handleOpenTicket(selectedTicketId); // Reload detail
        loadTickets(); // Reload list to update status if needed
      } else {
        useToast.showToast(res.message || 'Gagal mengirim balasan', 'error');
      }
    } catch (e) {
      useToast.showToast('Terjadi kesalahan', 'error');
    } finally {
      setIsReplying(false);
    }
  };

  const handleAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setReplyAttachment(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedTicketId) return;
    try {
      const res = await api.updateAdminTicketStatus(selectedTicketId, newStatus);
      if (res.success) {
        useToast.showToast('Status berhasil diubah', 'success');
        setTicketDetail(prev => prev ? { ...prev, ticket: { ...prev.ticket, status: newStatus as any } } : prev);
        loadTickets();
      } else {
        useToast.showToast(res.message || 'Gagal mengubah status', 'error');
      }
    } catch (e) {
      useToast.showToast('Terjadi kesalahan saat mengubah status', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Helpdesk (Laporan Kendala)</h2>
        <button onClick={loadTickets} className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-lg hover:bg-slate-200">
          <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-semibold text-slate-600 text-sm">ID Tiket</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Pelapor</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Judul</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Status</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Tanggal</th>
                <th className="p-4 font-semibold text-slate-600 text-sm">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr><td colSpan={6} className="text-center p-8 text-slate-500">Belum ada laporan kendala</td></tr>
              ) : (
                tickets.map(t => (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4 text-sm font-mono text-slate-600">{t.ticket_number}</td>
                    <td className="p-4 text-sm font-medium">{t.reporter_name}</td>
                    <td className="p-4 text-sm">{t.title}</td>
                    <td className="p-4 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-slate-100">{t.status}</span>
                    </td>
                    <td className="p-4 text-sm text-slate-500">{new Date(t.created_at).toLocaleString('id-ID')}</td>
                    <td className="p-4 text-sm">
                      <button onClick={() => handleOpenTicket(t.id!)} className="text-blue-600 hover:underline">Buka</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTicketId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden w-full max-w-2xl flex flex-col max-h-[85vh]">
            <div className="bg-slate-800 text-white p-5 flex items-center justify-between">
              <h2 className="text-lg font-bold">Detail Tiket</h2>
              <button onClick={() => setSelectedTicketId(null)} className="text-slate-400 hover:text-white">Tutup</button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
              {!ticketDetail ? (
                <div className="flex justify-center p-12 text-slate-500"><RefreshCw className="animate-spin" /></div>
              ) : (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800">{ticketDetail.ticket.ticket_number}</h3>
                        <p className="text-sm text-slate-500">Pelapor: <span className="font-medium text-slate-700">{ticketDetail.ticket.reporter_name}</span></p>
                      </div>
                      <select 
                        value={ticketDetail.ticket.status}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="px-3 py-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="NEW">NEW</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="WAITING_REPORTER">WAITING_REPORTER</option>
                        <option value="RESOLVED">RESOLVED</option>
                        <option value="DUPLICATE">DUPLICATE</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </div>
                    
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Judul</h4>
                    <p className="text-slate-800 mb-4">{ticketDetail.ticket.title}</p>
                    
                    <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Deskripsi</h4>
                    <p className="text-slate-800 whitespace-pre-wrap">{ticketDetail.ticket.description}</p>
                    
                    {ticketDetail.ticket.screenshot_url && (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Bukti Kendala</p>
                        <div 
                          onClick={() => setFullscreenImage(getImageUrl(ticketDetail.ticket.screenshot_url))}
                          className="inline-block relative rounded-lg overflow-hidden border border-slate-200 w-32 h-32 cursor-pointer hover:opacity-90 group"
                        >
                          <img src={getImageUrl(ticketDetail.ticket.screenshot_url)} alt="Screenshot" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                            <Search className="text-white opacity-0 group-hover:opacity-100" size={24} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {ticketDetail.messages.length > 0 && (
                    <div className="space-y-4 pb-4">
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Percakapan</h4>
                      {ticketDetail.messages.map(msg => (
                        <div key={msg.id} className={`flex ${msg.sender_type === 'SUPERADMIN' || msg.sender_type === 'ADMIN' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-2xl p-4 ${msg.sender_type === 'SUPERADMIN' || msg.sender_type === 'ADMIN' ? 'bg-[#B21B1B] text-white' : 'bg-white border border-slate-200 shadow-sm'}`}>
                            <p className="text-xs opacity-75 mb-1">{msg.sender_type} • {new Date(msg.created_at).toLocaleString('id-ID')}</p>
                            <p className="whitespace-pre-wrap">{msg.message}</p>
                            {msg.attachment_url && (
                              <img src={getImageUrl(msg.attachment_url)} alt="Attachment" className="mt-2 rounded-lg max-w-full h-auto cursor-pointer" onClick={() => setFullscreenImage(getImageUrl(msg.attachment_url))} />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {ticketDetail.ticket.status !== 'RESOLVED' && ticketDetail.ticket.status !== 'REJECTED' && (
                    <form onSubmit={handleReply} className="mt-6 flex gap-2 items-end bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                      <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#B21B1B] focus-within:border-[#B21B1B]">
                        <textarea
                          value={replyMessage}
                          onChange={e => setReplyMessage(e.target.value)}
                          placeholder="Ketik balasan untuk pegawai..."
                          className="w-full px-4 py-3 bg-transparent resize-none outline-none max-h-32 min-h-[50px]"
                          rows={1}
                        />
                        {replyAttachment && (
                          <div className="px-4 pb-3 flex items-center gap-2">
                             <div className="w-12 h-12 rounded border border-slate-300 overflow-hidden relative">
                               <img src={replyAttachment} className="w-full h-full object-cover" alt="Attachment" />
                               <button type="button" onClick={() => setReplyAttachment(null)} className="absolute top-0 right-0 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center">×</button>
                             </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0">
                        <label className="p-3 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 cursor-pointer flex items-center justify-center transition-colors">
                           <Paperclip size={20} />
                           <input type="file" accept="image/*" className="hidden" onChange={handleAttachment} />
                        </label>
                        <button
                          type="submit"
                          disabled={isReplying || !replyMessage.trim()}
                          className="p-3 bg-[#B21B1B] text-white rounded-xl hover:bg-red-800 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          {isReplying ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fullscreenImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in" onClick={() => setFullscreenImage(null)}>
          <button onClick={() => setFullscreenImage(null)} className="absolute top-4 right-4 text-white hover:text-slate-300">Tutup</button>
          <img src={fullscreenImage} alt="Fullscreen" className="max-w-full max-h-[85vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          <a href={fullscreenImage} download="screenshot.jpg" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-6 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white px-6 py-3 rounded-full flex items-center gap-2 transition-all">
            <Download size={20} /> Download Gambar
          </a>
        </div>
      )}
    </div>
  );
}
