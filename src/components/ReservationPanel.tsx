// C5: rezervasyon arayüzü — müşteri tarafı (yeni rezervasyon + kendi
// rezervasyonları + iptal). Personel/yönetici status değişimi için
// StaffReservationPanel'i ayrıca mount eder.
import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarDays, Users, Clock, X, CheckCircle2, XCircle } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';
import { t } from '../shared/system-texts';

type Reservation = {
  id: string;
  userId: string;
  userPhone: string;
  tableNumber: string;
  date: string;
  time: string;
  guestCount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'completed';
  note: string;
  userName: string;
  cancelReason?: string;
};

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Onay Bekliyor', className: 'bg-amber-100 text-amber-700' },
  confirmed: { label: 'Onaylandı', className: 'bg-green-100 text-green-700' },
  cancelled: { label: 'İptal', className: 'bg-red-100 text-red-700' },
  no_show: { label: 'Gelmedi', className: 'bg-gray-100 text-gray-600' },
  completed: { label: 'Tamamlandı', className: 'bg-blue-100 text-blue-700' },
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export const ReservationPanel: React.FC = () => {
  const { user } = useApp();
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Array<{ tableNumber: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [form, setForm] = useState({ tableNumber: '', date: todayIso(), time: '18:00', guestCount: 2, note: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [reservations, tableList] = await Promise.all([
        apiRequest<Reservation[]>('/api/reservations/my'),
        apiRequest<Array<{ tableNumber: string }>>('/api/reservations/tables'),
      ]);
      setMyReservations(Array.isArray(reservations) ? reservations : []);
      setTables(Array.isArray(tableList) ? tableList : []);
    } catch {
      setFeedback({ message: 'Rezervasyon bilgileri yüklenemedi.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async () => {
    if (!form.tableNumber || !form.date || !form.time || form.guestCount < 1) {
      setFeedback({ message: 'Masa, tarih, saat ve kişi sayısı zorunludur.', type: 'error' });
      return;
    }
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await apiRequest('/api/reservations', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setFeedback({ message: 'Rezervasyon talebiniz alındı — onay bekliyor.', type: 'success' });
      setForm({ tableNumber: '', date: todayIso(), time: '18:00', guestCount: 2, note: '' });
      await fetchData();
    } catch (err: any) {
      setFeedback({ message: err.message || 'Rezervasyon oluşturulamadı.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!window.confirm('Rezervasyonunuzu iptal etmek istediğinize emin misiniz?')) return;
    try {
      await apiRequest(`/api/reservations/${id}/cancel`, { method: 'POST' });
      await fetchData();
    } catch (err: any) {
      setFeedback({ message: err.message || 'İptal işlemi başarısız.', type: 'error' });
    }
  };

  if (isLoading) {
    return <div className="py-6 text-center text-sm text-text-secondary">Yükleniyor…</div>;
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div className={cn(
          "p-4 rounded-2xl text-xs font-semibold border",
          feedback.type === 'success' ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700",
        )}>
          {feedback.message}
        </div>
      )}

      {/* Yeni Rezervasyon */}
      <div className="bg-white border border-border rounded-[28px] p-5 space-y-4 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Yeni Rezervasyon</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Masa</label>
            <select
              value={form.tableNumber}
              onChange={(e) => setForm({ ...form, tableNumber: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
            >
              <option value="">Masa seçin</option>
              {tables.map((tb) => (
                <option key={tb.tableNumber} value={tb.tableNumber}>Masa {tb.tableNumber}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Kişi</label>
            <input
              type="number"
              min="1"
              max="20"
              value={form.guestCount}
              onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })}
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Tarih</label>
            <input
              type="date"
              min={todayIso()}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Saat</label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Not (opsiyonel)</label>
          <input
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            maxLength={300}
            placeholder="örn. pencere kenarı, doğum günü kutlaması…"
            className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-3.5 rounded-2xl bg-black text-white text-sm font-bold active:scale-[0.98] disabled:opacity-50 transition-transform flex items-center justify-center gap-2"
        >
          {isSubmitting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <CalendarDays size={16} />}
          Rezervasyon Talebi Gönder
        </button>
      </div>

      {/* Rezervasyonlarım */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary pl-1">Rezervasyonlarım</h2>
        {myReservations.length === 0 ? (
          <div className="py-10 text-center text-sm text-text-secondary">Henüz rezervasyonunuz yok.</div>
        ) : (
          <div className="space-y-2">
            {myReservations.map((r) => {
              const meta = STATUS_META[r.status] || STATUS_META.pending;
              const cancellable = ['pending', 'confirmed'].includes(r.status) && r.userId === user?.id;
              return (
                <div key={r.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-black">Masa {r.tableNumber}</span>
                      <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider", meta.className)}>
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Users size={12} />
                      {r.guestCount} kişi
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                    <span className="flex items-center gap-1"><CalendarDays size={12} />{r.date}</span>
                    <span className="flex items-center gap-1"><Clock size={12} />{r.time}</span>
                  </div>
                  {r.note && <p className="text-xs text-text-secondary mt-1.5 italic">"{r.note}"</p>}
                  {r.cancelReason && <p className="text-[11px] text-red-600 mt-1">İptal nedeni: {r.cancelReason}</p>}
                  {cancellable && (
                    <button
                      onClick={() => handleCancel(r.id)}
                      className="mt-3 w-full py-2.5 rounded-xl border border-red-100 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <XCircle size={14} />
                      Rezervasyonu İptal Et
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// C5: personel/yönetici tarafı — tüm rezervasyonlar + durum yönetimi.
export const StaffReservationPanel: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'cancelled' | 'completed'>('all');

  const fetchReservations = useCallback(async () => {
    try {
      const data = await apiRequest<Reservation[]>('/api/reservations');
      setReservations(Array.isArray(data) ? data : []);
    } catch {
      // best-effort
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReservations();
    const interval = setInterval(fetchReservations, 15000);
    return () => clearInterval(interval);
  }, [fetchReservations]);

  const updateStatus = async (id: string, status: string, cancelReason?: string) => {
    try {
      await apiRequest(`/api/reservations/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, cancelReason }),
      });
      await fetchReservations();
    } catch (err: any) {
      alert(err.message || 'Durum güncellenemedi.');
    }
  };

  const filtered = reservations.filter((r) => (filter === 'all' ? true : r.status === filter));

  if (isLoading) {
    return <div className="p-6 pb-32 text-center text-sm text-text-secondary">Yükleniyor…</div>;
  }

  return (
    <div className="p-5 pb-32 space-y-6">
      <div className="space-y-0.5">
        <h1 className="text-2xl font-display font-bold text-text-primary">Rezervasyonlar</h1>
        <p className="text-xs text-text-secondary">Onaylama, iptal ve tamamlama</p>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {([
          { id: 'all', label: 'Tümü' },
          { id: 'pending', label: 'Onay Bekleyen' },
          { id: 'confirmed', label: 'Onaylı' },
          { id: 'completed', label: 'Tamamlanan' },
          { id: 'cancelled', label: 'İptal' },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors border",
              filter === tab.id ? "bg-black border-black text-white" : "bg-surface border-border text-text-secondary hover:bg-white",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-sm text-text-secondary">Bu filtrede rezervasyon yok.</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const meta = STATUS_META[r.status] || STATUS_META.pending;
            return (
              <div key={r.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-black">Masa {r.tableNumber}</span>
                    <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider", meta.className)}>
                      {meta.label}
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-text-secondary"><Users size={12} />{r.guestCount} kişi</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
                  <span className="font-semibold text-black">{r.userName}</span>
                  {r.userPhone && <span>{r.userPhone}</span>}
                  <span className="flex items-center gap-1"><CalendarDays size={12} />{r.date}</span>
                  <span className="flex items-center gap-1"><Clock size={12} />{r.time}</span>
                </div>
                {r.note && <p className="text-xs text-text-secondary italic">"{r.note}"</p>}

                <div className="flex gap-2 flex-wrap">
                  {r.status === 'pending' && (
                    <>
                      <button
                        onClick={() => updateStatus(r.id, 'confirmed')}
                        className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold active:scale-95 transition-transform flex items-center gap-1"
                      >
                        <CheckCircle2 size={13} /> Onayla
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, 'cancelled', 'Personel iptali')}
                        className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
                      >
                        <X size={13} className="inline mr-1" />Reddet
                      </button>
                    </>
                  )}
                  {r.status === 'confirmed' && (
                    <>
                      <button
                        onClick={() => updateStatus(r.id, 'completed')}
                        className="px-3 py-2 rounded-xl bg-black text-white text-xs font-bold active:scale-95 transition-transform"
                      >
                        Tamamlandı
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, 'no_show')}
                        className="px-3 py-2 rounded-xl border border-border text-text-secondary text-xs font-bold hover:text-black"
                      >
                        Gelmedi
                      </button>
                      <button
                        onClick={() => updateStatus(r.id, 'cancelled', 'Personel iptali')}
                        className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50"
                      >
                        İptal Et
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
