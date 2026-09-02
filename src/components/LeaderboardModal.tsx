import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, Trophy } from 'lucide-react';
import { useApp } from '../AppContext';
import { apiRequest, ApiRequestError } from '../lib/api';
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

const PERIOD_TABS: { key: PeriodKey; label: string }[] = [
  { key: 'daily', label: 'Günlük' },
  { key: 'weekly', label: 'Haftalık' },
  { key: 'monthly', label: 'Aylık' },
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

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

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

            {/* Current User Rank Card */}
            {!loading && data?.currentUser && (
              <div className="bg-neutral-950 text-white p-4 rounded-2xl flex items-center justify-between text-xs mb-4 shadow-sm shrink-0">
                <span className="text-neutral-400 font-medium">Sıralamadaki Yerin</span>
                <div className="flex items-center gap-2 font-bold">
                  <span className="bg-neutral-800 px-2.5 py-1 rounded-lg text-white font-mono">#{data.currentUser.rank}</span>
                  <span className="text-neutral-500">•</span>
                  <span className="font-mono text-sm">{data.currentUser.kp} KP</span>
                </div>
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
                </div>
              )}

              {!loading && data && data.entries.map((entry) => {
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
                    <div className={`w-8 h-8 rounded-xl text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                      entry.rank === 1
                        ? 'bg-black text-white'
                        : entry.rank === 2
                        ? 'bg-neutral-200 text-black'
                        : entry.rank === 3
                        ? 'bg-neutral-150 text-black'
                        : 'bg-neutral-100 text-neutral-600'
                    }`}>
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