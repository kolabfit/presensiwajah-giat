import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Paperclip, Send, Clock, CheckCircle2, AlertCircle, ImageIcon, Download } from 'lucide-react';
import { api, getImageUrl } from '../services/api';
import { Ticket, TicketMessage, Employee } from '../types';

export function CheckTicket({ onCancel, useToast }: { onCancel: () => void, useToast: any }) {
  const [ticketNumber, setTicketNumber] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  
  const [replyMessage, setReplyMessage] = useState('');
  const [replyAttachment, setReplyAttachment] = useState<string | null>(null);
  const [isReplying, setIsReplying] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

  useEffect(() => {
    api.getEmployees().then(setEmployees);
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketNumber || !reporterName) {
      useToast.showToast('Nomor tiket dan nama pelapor wajib diisi', 'error');
      return;
    }

    setIsSearching(true);
    try {
      const res = await api.getTicketStatus(ticketNumber, reporterName);
      if (res.success) {
        setTicket(res.ticket);
        setMessages(res.messages || []);
      } else {
        useToast.showToast(res.message || 'Tiket tidak ditemukan', 'error');
      }
    } catch (error) {
      useToast.showToast('Gagal terhubung ke server', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage || !ticket) return;

    setIsReplying(true);
    try {
      const res = await api.replyTicketPublic(ticket.ticket_number, {
        reporter_name: reporterName,
        message: replyMessage,
        attachment_data_url: replyAttachment || undefined
      });

      if (res.success) {
        useToast.showToast('Balasan terkirim', 'success');
        setReplyMessage('');
        setReplyAttachment(null);
        // Reload ticket data
        const reloadRes = await api.getTicketStatus(ticket.ticket_number, reporterName);
        if (reloadRes.success) {
          setTicket(reloadRes.ticket);
          setMessages(reloadRes.messages || []);
        }
      } else {
        useToast.showToast(res.message || 'Gagal mengirim balasan', 'error');
      }
    } catch (error) {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">Baru</span>;
      case 'IN_PROGRESS': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700">Diproses</span>;
      case 'WAITING_REPORTER': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Menunggu Balasan</span>;
      case 'RESOLVED': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700">Selesai</span>;
      case 'DUPLICATE': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">Duplikat</span>;
      case 'REJECTED': return <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-700">Ditolak</span>;
      default: return <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  if (ticket) {
    return (
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in w-full max-w-2xl mx-auto flex flex-col h-[85vh]">
        <div className="bg-slate-800 text-white p-5 shrink-0 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">{ticket.ticket_number}</h2>
            <p className="text-slate-300 text-sm">{ticket.title}</p>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(ticket.status)}
            <button onClick={() => setTicket(null)} className="text-slate-400 hover:text-white transition-colors">
              Tutup
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 bg-slate-50 space-y-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Deskripsi Kendala</h3>
            <p className="text-slate-800 whitespace-pre-wrap">{ticket.description}</p>
            {ticket.screenshot_url && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">Bukti Kendala</p>
                <div 
                  onClick={() => setFullscreenImage(getImageUrl(ticket.screenshot_url))}
                  className="inline-block relative rounded-lg overflow-hidden border border-slate-200 w-32 h-32 cursor-pointer hover:opacity-90 group"
                >
                  <img src={getImageUrl(ticket.screenshot_url)} alt="Screenshot" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                    <Search className="text-white opacity-0 group-hover:opacity-100" size={24} />
                  </div>
                </div>
              </div>
            )}
            <div className="mt-4 pt-4 border-t border-slate-100 flex gap-6 text-xs text-slate-500">
              <div className="flex items-center gap-1"><Clock size={14} /> {new Date(ticket.created_at).toLocaleString('id-ID')}</div>
              <div className="flex items-center gap-1">Kategori: <span className="font-medium text-slate-700">{ticket.category}</span></div>
            </div>
          </div>

          {messages.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Percakapan</h3>
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender_type === 'REPORTER' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl p-4 ${msg.sender_type === 'REPORTER' ? 'bg-[#B21B1B] text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 shadow-sm rounded-tl-sm'}`}>
                    <p className="text-xs opacity-75 mb-1">{msg.sender_type === 'REPORTER' ? 'Anda' : 'Admin/Teknisi'} • {new Date(msg.created_at).toLocaleString('id-ID')}</p>
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    {msg.attachment_url && (
                      <div className="mt-2">
                         <div onClick={() => setFullscreenImage(getImageUrl(msg.attachment_url))} className="inline-block relative rounded-lg overflow-hidden border border-slate-200 w-24 h-24 hover:opacity-90 bg-black/10 cursor-pointer group">
                            <img src={getImageUrl(msg.attachment_url)} alt="Attachment" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                              <Search className="text-white opacity-0 group-hover:opacity-100" size={20} />
                            </div>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {ticket.status !== 'RESOLVED' && ticket.status !== 'REJECTED' && ticket.status !== 'DUPLICATE' && (
          <div className="p-4 bg-white border-t border-slate-200 shrink-0">
             <form onSubmit={handleReply} className="flex gap-2 items-end">
               <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-[#B21B1B] focus-within:border-[#B21B1B]">
                  <textarea 
                    value={replyMessage}
                    onChange={e => setReplyMessage(e.target.value)}
                    placeholder="Tulis balasan..."
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
                   disabled={!replyMessage.trim() || isReplying}
                   className="p-3 bg-[#B21B1B] text-white rounded-xl hover:bg-[#8A1515] disabled:opacity-50 transition-colors flex items-center justify-center"
                 >
                    {isReplying ? <RefreshCw size={20} className="animate-spin" /> : <Send size={20} />}
                 </button>
               </div>
             </form>
          </div>
        )}

        {fullscreenImage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in" onClick={() => setFullscreenImage(null)}>
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

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-4 w-full max-w-md mx-auto">
      <div className="bg-slate-800 text-white p-6 relative overflow-hidden">
        <h2 className="text-xl font-bold mb-1 relative z-10">Cek Status Tiket</h2>
        <p className="text-slate-300 text-sm relative z-10">Pantau progres penanganan laporan Anda</p>
      </div>

      <div className="p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nomor Tiket <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={ticketNumber}
              onChange={e => setTicketNumber(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#B21B1B] focus:border-[#B21B1B] transition-all font-mono"
              placeholder="Contoh: GIAT-ERR-20260810-0001"
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Pegawai <span className="text-red-500">*</span></label>
            <input
              type="text"
              required
              value={reporterName}
              onChange={e => {
                setReporterName(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#B21B1B] focus:border-[#B21B1B] transition-all"
              placeholder="Ketik sebagian nama pelapor..."
            />
            {showDropdown && reporterName && employees.filter(e => e.name && e.name.toLowerCase().includes(reporterName.toLowerCase())).length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {employees.filter(e => e.name && e.name.toLowerCase().includes(reporterName.toLowerCase())).map((emp, i) => (
                  <div
                    key={i}
                    className="px-4 py-3 hover:bg-red-50 cursor-pointer text-sm text-slate-700 font-medium border-b border-slate-100 last:border-0"
                    onClick={() => {
                      setReporterName(emp.name);
                      setShowDropdown(false);
                    }}
                  >
                    {emp.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSearching}
              className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl font-medium hover:bg-slate-200 transition-colors"
            >
              Kembali
            </button>
            <button
              type="submit"
              disabled={isSearching}
              className="flex-1 px-4 py-3 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-900 transition-colors shadow-lg flex items-center justify-center disabled:opacity-70 gap-2"
            >
              {isSearching ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
              Cek Tiket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
