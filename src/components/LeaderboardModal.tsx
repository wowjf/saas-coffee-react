import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Trophy, Crown, Medal, Award, Clock } from 'lucide-react';
import { useApp } from '../AppContext';
import { apiRequest, ApiRequestError } from '../lib/api';
import { formatKpAsTl } from '../lib/loyalty';
import PublicProfileModal from './PublicProfileModal';

type PeriodKey = 'daily' | 'weekly' | 'monthly';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatar: string;
  kp: number;
}

interface LeaderboardResponse {
  period: PeriodKey;
  from: string;
  to: string;
  entries: LeaderboardEntry[];
  currentUser: { rank: number; kp: number } | null;
}

interface LeaderboardStatus {
  optedIn: boolean;
  cooldownRemainingMs: number;
  optedOutAt: string | null;
}

const PERIOD_TABS: { key: PeriodKey; label: string; hint: string }[] = [
  { key: 'daily', label: 'Günlük', hint: 'Bugün' },
  { key: 'weekly', label: 'Haftalık', hint: 'Son 7 gün' },
  { key: 'monthly', label: 'Aylık', hint: 'Son 30 gün' },
];

function formatCountdown(ms: number) {
  const totalMinutes = Math.max(1, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} gün`;
  if (hours > 0) return `${hours} saat`;
  return `${minutes} dk`;
}

function periodRemainingLabel(period: PeriodKey): string {
  const now = new Date();
  const end = new Date(now);
  if (period === 'daily') {
    end.setHours(23, 59, 59, 999);
  } else if (period === 'weekly') {
    end.setDate(now.getDate() + (7 - ((now.getDay() + 6) % 7 || 7)));
    end.setHours(23, 59, 59, 999);
  } else {
    end.setMonth(now.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return 'Yenileniyor…';
  const hours = Math.floor(diff / 3600000);
  if (hours >= 48) return `${Math.floor(hours / 24)} gün kaldı`;
  if (hours >= 1) return `${hours} saat kaldı`;
  return `${Math.max(1, Math.floor(diff / 60000))} dk kaldı`;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const RANK_STYLES: Record<number, { icon: React.ElementType; chip: string; label: string }> = {
  1: { icon: Crown, chip: 'bg-black text-white', label: 'Şampiyon' },
  2: { icon: Medal, chip: 'bg-neutral-800 text-white', label: '2.' },
  3: { icon: Award, chip: 'bg-neutral-200 text-black', label: '3.' },
};

const LeaderboardModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { user } = useApp();
  const [period, setPeriod] = useState<PeriodKey>('daily');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [status, setStatus] = useState<LeaderboardStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const result = await apiRequest<LeaderboardStatus>('/api/leaderboard/status');
      setStatus(result);
    } catch {
      setStatus(null);
    }
  }, []);

  const loadLeaderboard = useCallback(async (targetPeriod: PeriodKey) => {
    setLoading(true);
    setError('');
    try {
      const result = await apiRequest<LeaderboardResponse>(
        `/api/leaderboard?period=${targetPeriod}`,
      );
      setData(result);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Sıralama yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setPeriod('daily');
      void loadStatus();
      void loadLeaderboard('daily');
    }
  }, [open, loadStatus, loadLeaderboard]);

  useEffect(() => {
    if (open && period) {
      void loadLeaderboard(period);
    }
    // period değişiminde yalnızca yeniden çek
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const handleOptOut = async () => {
    if (!window.confirm('Liderlik tablosundan ayrılmak istediğinize emin misiniz?')) {
      return;
    }
    setBusy(true);
    try {
      const result = await apiRequest<LeaderboardStatus>('/api/leaderboard/opt-out', {
        method: 'POST',
      });
      setStatus(result);
      void loadLeaderboard(period);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'İşlem başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const handleOptIn = async () => {
    setBusy(true);
    try {
      const result = await apiRequest<LeaderboardStatus>('/api/leaderboard/opt-in', {
        method: 'POST',
      });
      setStatus(result);
      void loadLeaderboard(period);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'İşlem başarısız.');
    } finally {
      setBusy(false);
    }
  };

  const isCurrentUser = (userId: string) => user?.id === userId;

  const podium = data?.entries.filter((e) => e.rank <= 3) ?? [];
  const restEntries = data?.entries.filter((e) => e.rank > 3) ?? [];
  const topKp = podium[0]?.kp ?? 0;
  const myProgress = topKp > 0 && data?.currentUser ? Math.min(100, Math.round((data.currentUser.kp / topKp) * 100)) : 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-[100] bg-white flex flex-col h-[100dvh] w-full overflow-hidden pointer-events-auto"
        >
          {/* Top Header */}
          <header className="border-b border-border bg-white/95 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
            <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-neutral-100 border border-neutral-200/60 flex items-center justify-center text-black shrink-0">
                  <Trophy size={18} />
                </div>
                <div>
                  <h1 className="text-base font-bold text-black tracking-tight leading-tight">Liderlik Sıralaması</h1>
                  <p className="text-[11px] text-neutral-500">En çok Kahve Puanı (KP) kazananlar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-black flex items-center justify-center transition-colors cursor-pointer border border-neutral-200/60"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full px-4 sm:px-6 pt-4">
            {/* Hero: dönem + ödül değeri */}
            <div className="rounded-[24px] bg-neutral-950 text-white p-5 mb-4 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-neutral-800">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                  {PERIOD_TABS.find((tab) => tab.key === period)?.hint} Sıralaması
                </span>
                <p className="text-sm font-semibold text-white leading-snug">
                  KP kazandıkça yüksel — her KP <span className="font-mono text-white">{formatKpAsTl(1)}</span> değerinde
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 shrink-0 self-start sm:self-auto">
                <Clock size={13} />
                <span className="font-mono">{periodRemainingLabel(period)}</span>
              </div>
            </div>

            {/* Period Switch Tabs */}
            <div className="grid grid-cols-3 gap-1 bg-neutral-100 p-1.5 rounded-2xl border border-border mb-4 shrink-0">
              {PERIOD_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPeriod(tab.key)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    period === tab.key
                      ? 'bg-black text-white shadow-sm'
                      : 'text-neutral-600 hover:text-black'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Current User Rank Card + ilerleme */}
            {!loading && data?.currentUser && (
              <div className="bg-neutral-950 text-white p-4 rounded-2xl mb-4 shadow-sm shrink-0 space-y-3 border border-neutral-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400 font-medium">Sıralamadaki Yerin</span>
                  <div className="flex items-center gap-2 font-bold">
                    <span className="bg-neutral-800 px-2.5 py-1 rounded-lg text-white font-mono">#{data.currentUser.rank}</span>
                    <span className="text-neutral-500">•</span>
                    <span className="font-mono text-sm">{data.currentUser.kp} KP</span>
                    <span className="text-neutral-500">•</span>
                    <span className="font-mono text-sm text-neutral-300">{formatKpAsTl(data.currentUser.kp)}</span>
                  </div>
                </div>
                {topKp > 0 && data.currentUser.rank > 1 && (
                  <div className="space-y-1.5">
                    <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-white transition-all duration-700"
                        style={{ width: `${myProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-neutral-500">
                      Zirveye <span className="font-mono text-neutral-300">%{myProgress}</span> — lider {topKp} KP'de
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Scrollable Entries List */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-6">
              {error && (
                <div className="p-4 rounded-2xl bg-neutral-100 text-xs text-neutral-700 text-center border border-neutral-200">
                  {error}
                </div>
              )}

              {loading && (
                <div className="py-24 flex flex-col items-center justify-center gap-2 text-center text-xs text-neutral-400">
                  <div className="w-6 h-6 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  <span>Sıralama yükleniyor...</span>
                </div>
              )}

              {!loading && data && data.entries.length === 0 && (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-center text-neutral-400">
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400">
                    <Users size={24} />
                  </div>
                  <p className="text-xs font-medium">Bu dönemde henüz sıralama oluşmadı.</p>
                  <p className="text-[11px] text-neutral-400">Sipariş tamamlandıkça KP kazanın ve listeye girin.</p>
                </div>
              )}

              {!loading && podium.length > 0 && (
                <div className="space-y-2 mb-3">
                  {podium.map((entry) => {
                    const mine = isCurrentUser(entry.userId);
                    const style = RANK_STYLES[entry.rank] ?? { icon: Trophy, chip: 'bg-neutral-100 text-neutral-600', label: `${entry.rank}.` };
                    const RankIcon = style.icon;
                    return (
                      <div
                        key={entry.userId}
                        onClick={() => setSelectedProfileUserId(entry.userId)}
                        className={`flex items-center gap-3.5 px-4 py-4 rounded-[22px] border transition-all cursor-pointer ${
                          mine
                            ? 'bg-neutral-100 border-black shadow-xs hover:bg-neutral-200/80'
                            : entry.rank === 1
                              ? 'bg-neutral-950 border-neutral-800 hover:border-neutral-600'
                              : 'bg-white border-border hover:border-black/50 hover:bg-neutral-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${style.chip}`}>
                          <RankIcon size={entry.rank === 1 ? 18 : 16} />
                        </div>

                        <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-200 text-neutral-700 text-xs font-bold flex items-center justify-center shrink-0 border border-neutral-300/60">
                          {entry.avatar ? (
                            <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                          ) : (
                            getInitials(entry.name)
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${entry.rank === 1 && !mine ? 'text-white' : 'text-black'}`}>
                            {entry.name} {mine && <span className="text-xs text-neutral-500 font-normal ml-1">(Sen)</span>}
                          </p>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${entry.rank === 1 && !mine ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            {style.label}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`block text-base font-mono font-bold ${entry.rank === 1 && !mine ? 'text-white' : 'text-black'}`}>
                            {entry.kp} KP
                          </span>
                          <span className={`block text-[10px] font-mono ${entry.rank === 1 && !mine ? 'text-neutral-400' : 'text-neutral-500'}`}>
                            {formatKpAsTl(entry.kp)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {!loading && restEntries.map((entry) => {
                const mine = isCurrentUser(entry.userId);
                return (
                  <div
                    key={entry.userId}
                    onClick={() => setSelectedProfileUserId(entry.userId)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all cursor-pointer ${
                      mine
                        ? 'bg-neutral-100 border-black font-semibold shadow-xs hover:bg-neutral-200/80'
                        : 'bg-surface border-border/80 hover:border-black/50 hover:bg-neutral-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-xl text-xs font-mono font-bold flex items-center justify-center shrink-0 bg-neutral-100 text-neutral-600">
                      #{entry.rank}
                    </div>

                    <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-200 text-neutral-700 text-xs font-bold flex items-center justify-center shrink-0 border border-neutral-300/60">
                      {entry.avatar ? (
                        <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                      ) : (
                        getInitials(entry.name)
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-black truncate">
                        {entry.name} {mine && <span className="text-xs text-neutral-500 font-normal ml-1">(Sen)</span>}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-mono font-bold text-black">{entry.kp} KP</span>
                      <span className="block text-[10px] font-mono text-neutral-500">{formatKpAsTl(entry.kp)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>

          {/* Bottom Footer */}
          <footer className="border-t border-border bg-neutral-50 px-4 sm:px-6 py-3 pb-safe shrink-0">
            <div className="max-w-4xl mx-auto w-full flex items-center justify-between text-xs">
              {status?.optedIn ? (
                <button
                  type="button"
                  onClick={() => void handleOptOut()}
                  disabled={busy}
                  className="text-neutral-400 hover:text-red-600 transition-colors font-medium cursor-pointer"
                >
                  Sıralamadan Ayrıl
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleOptIn()}
                  disabled={busy || (status?.cooldownRemainingMs ?? 0) > 0}
                  className="w-full py-3 rounded-2xl bg-black text-white font-bold text-xs hover:bg-neutral-800 transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {(status?.cooldownRemainingMs ?? 0) > 0
                    ? `Tekrar Katılma (${formatCountdown(status!.cooldownRemainingMs)})`
                    : 'Sıralamaya Katıl'}
                </button>
              )}
              {status?.optedIn && (
                <span className="text-[11px] text-neutral-400">Puanlar otomatik güncellenir</span>
              )}
            </div>
          </footer>

          {/* Public Profile Modal */}
          <PublicProfileModal
            userIdOrUsername={selectedProfileUserId}
            open={Boolean(selectedProfileUserId)}
            onClose={() => setSelectedProfileUserId(null)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LeaderboardModal;
