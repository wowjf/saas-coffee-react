// C4: canlı destek sohbeti — müşteri ve personel tarafının paylaştığı
// bileşen. Müşteri modu aktif odasını gösterir; oda yoksa boş durum +
// 'Yeni Görüşme Başlat' (POST /api/chat/rooms) akışı sunar. Personel modu
// oda listesinden seçip yanıtlar ve odayı kapatır. Canlılık SSE
// (chat_message → AppContext 'cafe:chat-refresh' window olayı) + SSE
// yokluğunda 8 sn periyodik yenileme ile sağlanır.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, X, Send, CheckCheck, Clock, Headphones, AlertCircle, RefreshCw } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';
import { t } from '../shared/system-texts';

type ChatMessage = {
  senderId: string;
  senderName: string;
  senderRole: string;
  message: string;
  timestamp: string;
};

type ChatRoomData = {
  id: string;
  customerId: string;
  customerName: string;
  status: 'waiting' | 'active' | 'resolved';
  assignedToName?: string;
  messages: ChatMessage[];
  lastMessageAt: string;
};

type SupportChatProps = {
  mode: 'customer' | 'staff';
  onClose: () => void;
};

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Bekliyor',
  active: 'Aktif',
  resolved: 'Kapatıldı',
};

export const SupportChat: React.FC<SupportChatProps> = ({ mode, onClose }) => {
  const { user } = useApp();
  const [rooms, setRooms] = useState<ChatRoomData[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // C4: yüklenme/ gönderme hataları artık yutulmaz — arayüzde gösterilir.
  const [loadError, setLoadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [view, setView] = useState<'list' | 'room'>(mode === 'customer' ? 'room' : 'list');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const fetchRooms = useCallback(async () => {
    try {
      if (mode === 'customer') {
        // GET /chat/my artık yan etkisiz: aktif oda yoksa null döner.
        const room = await apiRequest<ChatRoomData | null>('/api/chat/my');
        setRooms(room ? [room] : []);
        if (room) {
          setSelectedRoomId(room.id);
        } else {
          setSelectedRoomId(null);
        }
      } else {
        const data = await apiRequest<ChatRoomData[]>('/api/chat/rooms');
        setRooms(Array.isArray(data) ? data : []);
      }
      setLoadError('');
    } catch (err: any) {
      // C4: hata state'e taşınır ve arayüzde kırmızı satır olarak görünür.
      setLoadError(err?.message || t("sohbetler-yuklenirken-hata-olustu"));
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  // C4: yeni destek odası açar (ilk mesaj opsiyonel). Aktif oda varsa
  // sunucu mevcut odayı döndürür.
  const startNewRoom = useCallback(async () => {
    setIsStarting(true);
    setSendError('');
    try {
      const room = await apiRequest<ChatRoomData>('/api/chat/rooms', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (room) {
        setRooms([room]);
        setSelectedRoomId(room.id);
        setView('room');
      }
    } catch (err: any) {
      setSendError(err?.message || t("sohbet-yuklenirken-hata-olustu"));
    } finally {
      setIsStarting(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    // C4: SSE chat_message olayı AppContext'te 'cafe:chat-refresh' window
    // olayına çevrilir — personel yanıtı geldiğinde odalar sessizce ve
    // anında tazelenir. SSE yoksa aşağıdaki 8 sn polling yedektir.
    window.addEventListener('cafe:chat-refresh', fetchRooms as EventListener);
    const interval = setInterval(fetchRooms, 8000);
    return () => {
      window.removeEventListener('cafe:chat-refresh', fetchRooms as EventListener);
      clearInterval(interval);
    };
  }, [fetchRooms]);

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) || null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedRoom?.messages?.length, selectedRoomId]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !selectedRoomId || isSending) return;
    setIsSending(true);
    setSendError('');
    try {
      await apiRequest(`/api/chat/${selectedRoomId}/message`, {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });
      setDraft('');
      await fetchRooms();
    } catch (err: any) {
      setSendError(err?.message || t("mesaj-gonderilirken-hata-olustu"));
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseRoom = async () => {
    if (!selectedRoomId) return;
    try {
      await apiRequest(`/api/chat/${selectedRoomId}/close`, { method: 'POST' });
      await fetchRooms();
      setView('list');
      setSelectedRoomId(null);
    } catch (err: any) {
      setSendError(err?.message || t("sohbet-kapatilirken-hata-olustu"));
    }
  };

  const openRooms = rooms.filter((r) => r.status !== 'resolved');
  const pendingCount = rooms.filter((r) => r.status === 'waiting').length;
  // Müşteri görünümünde oda henüz hazır değilse (yok/oluşuyor) gönderme
  // butonu devre dışı kalır ve gövdede 'Görüşme yükleniyor' gösterilir.
  const customerRoomPending = mode === 'customer' && !selectedRoom;

  const showError = sendError || (isLoading ? '' : loadError);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md h-[80dvh] sm:h-[70dvh] bg-white sm:rounded-[32px] rounded-t-[32px] shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            {view === 'room' && mode === 'staff' && (
              <button
                onClick={() => { setView('list'); setSelectedRoomId(null); }}
                className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-secondary text-xs font-bold"
              >
                ‹
              </button>
            )}
            <MessageCircle size={18} />
            <div>
              <h3 className="text-sm font-display font-bold leading-tight">
                {mode === 'customer' ? 'Canlı Destek' : 'Destek Sohbetleri'}
              </h3>
              <p className="text-[10px] text-text-secondary">
                {mode === 'customer'
                  ? selectedRoom?.status === 'resolved'
                    ? 'Görüşme kapatıldı — yeni mesaj yazamazsınız'
                    : 'Genelde birkaç dakika içinde yanıt alınır'
                  : `${openRooms.length} açık${pendingCount > 0 ? ` • ${pendingCount} bekliyor` : ''}`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-secondary">
            <X size={16} />
          </button>
        </div>

        {/* C4: hata satırı — yüklenme veya gönderme hatası kırmızı gösterilir */}
        {showError && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-100 flex items-center gap-2 text-[11px] text-red-700 shrink-0">
            <AlertCircle size={13} className="shrink-0" />
            <span className="flex-1 truncate">{showError}</span>
            <button
              onClick={() => { setSendError(''); void fetchRooms(); }}
              className="p-1 rounded hover:bg-red-100 transition-colors"
              title="Yeniden dene"
            >
              <RefreshCw size={12} />
            </button>
          </div>
        )}

        {/* Body */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-text-secondary">Yükleniyor…</div>
        ) : view === 'list' ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {rooms.length === 0 && (
              <div className="py-12 text-center text-sm text-text-secondary space-y-1">
                <Clock size={24} className="mx-auto opacity-40" />
                <p>Açık destek görüşmesi yok.</p>
              </div>
            )}
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => { setSelectedRoomId(room.id); setView('room'); }}
                className="w-full p-4 rounded-2xl border border-border hover:border-black text-left transition-colors bg-white"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-black">{room.customerName}</span>
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider",
                    room.status === 'waiting' && "bg-amber-100 text-amber-700",
                    room.status === 'active' && "bg-green-100 text-green-700",
                    room.status === 'resolved' && "bg-gray-100 text-gray-500",
                  )}>
                    {STATUS_LABELS[room.status]}
                  </span>
                </div>
                {room.messages?.length > 0 && (
                  <p className="text-xs text-text-secondary mt-1 truncate">
                    {room.messages[room.messages.length - 1].senderName}: {room.messages[room.messages.length - 1].message}
                  </p>
                )}
              </button>
            ))}
          </div>
        ) : selectedRoom ? (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selectedRoom.messages?.length === 0 && (
                <div className="py-8 text-center text-xs text-text-secondary">
                  {mode === 'customer'
                    ? 'Merhaba! Size nasıl yardımcı olabiliriz? Mesajınızı yazın.'
                    : 'Müşteri henüz mesaj yazmadı.'}
                </div>
              )}
              {selectedRoom.messages?.map((msg, idx) => {
                const isOwn = msg.senderId === user?.id;
                const isStaffMsg = msg.senderRole !== 'customer';
                return (
                  <div key={idx} className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[78%] rounded-2xl px-3.5 py-2.5",
                      isOwn ? "bg-black text-white" : isStaffMsg ? "bg-emerald-50 border border-emerald-100 text-black" : "bg-surface text-black",
                    )}>
                      {!isOwn && (
                        <span className="block text-[10px] font-bold opacity-60 mb-0.5">
                          {msg.senderName}{isStaffMsg ? ' • Personel' : ''}
                        </span>
                      )}
                      <p className="text-sm leading-snug break-words">{msg.message}</p>
                      <span className={cn(
                        "block text-[9px] mt-1 text-right",
                        isOwn ? "text-white/50" : "text-text-secondary",
                      )}>
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            {selectedRoom.status !== 'resolved' && (
              <div className="p-3 border-t border-border flex items-center gap-2 shrink-0">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={mode === 'customer' ? 'Mesajınızı yazın…' : 'Yanıt yazın…'}
                  maxLength={1000}
                  className="flex-1 px-4 py-3 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                />
                <button
                  onClick={handleSend}
                  disabled={isSending || !draft.trim()}
                  className="w-11 h-11 rounded-2xl bg-black text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
                >
                  <Send size={16} />
                </button>
              </div>
            )}
            {selectedRoom.status !== 'resolved' && mode === 'staff' && (
              <div className="px-3 pb-3 shrink-0">
                <button
                  onClick={handleCloseRoom}
                  className="w-full py-2.5 rounded-xl border border-border text-xs font-bold text-text-secondary hover:text-black hover:border-black transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCheck size={14} />
                  Görüşmeyi Kapat
                </button>
              </div>
            )}
            {selectedRoom.status === 'resolved' && mode === 'customer' && (
              <div className="px-4 pb-4 shrink-0">
                <button
                  onClick={startNewRoom}
                  disabled={isStarting}
                  className="w-full py-3 rounded-xl bg-black text-white text-xs font-bold active:scale-95 transition-transform disabled:opacity-40"
                >
                  {isStarting ? 'Açılıyor…' : 'Yeni Görüşme Başlat'}
                </button>
              </div>
            )}
          </>
        ) : mode === 'customer' ? (
          /* C4: oda yokken boş durum — açıklayıcı metin + başlat butonu.
             GET artık oda oluşturmadığından müşteri buraya düşebilir. */
          <div className="flex-1 flex flex-col items-center justify-center px-8 py-10 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
              <Headphones size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-display font-bold text-black">Destek ekibine yazın</h4>
              <p className="text-xs text-text-secondary leading-relaxed">
                Sipariş, ödeme veya uygulama ile ilgili aklınıza takılan her konuda
                canlı destek ekibimize mesaj gönderebilirsiniz. Genelde birkaç dakika
                içinde yanıt alınır.
              </p>
            </div>
            <button
              onClick={startNewRoom}
              disabled={isStarting}
              className="w-full max-w-[240px] py-3 rounded-xl bg-black text-white text-xs font-bold active:scale-95 transition-transform disabled:opacity-40"
            >
              {isStarting ? 'Görüşme açılıyor…' : 'Görüşme Başlat'}
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-text-secondary px-6 text-center">
            Bir sohbet seçin.
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};
