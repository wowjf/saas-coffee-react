import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users } from 'lucide-react';
import { apiRequest } from '../lib/api';

interface FollowUser {
  id: string;
  name: string;
  surname: string;
  username?: string;
  avatar?: string;
  bio?: string;
}

interface FollowListModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  type: 'followers' | 'following';
  title: string;
  onSelectUser: (userId: string) => void;
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
  open,
  onClose,
  userId,
  type,
  title,
  onSelectUser,
}) => {
  const [list, setList] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !userId) return;

    let isMounted = true;
    setLoading(true);
    setError('');

    const fetchList = async () => {
      try {
        const endpoint = type === 'followers' ? `/api/users/${userId}/followers` : `/api/users/${userId}/following`;
        const res = await apiRequest<{ followers?: FollowUser[]; following?: FollowUser[] }>(endpoint);
        if (isMounted) {
          setList(type === 'followers' ? res.followers || [] : res.following || []);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Liste yüklenemedi.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchList();

    return () => {
      isMounted = false;
    };
  }, [open, userId, type]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
          />

          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ duration: 0.15 }}
            className="bg-white rounded-3xl w-full max-w-sm relative z-10 shadow-2xl border border-border overflow-hidden max-h-[75dvh] flex flex-col pointer-events-auto"
          >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-black">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Kapat"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading && (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-xs text-neutral-400">
                  <div className="w-5 h-5 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  <span>Yükleniyor...</span>
                </div>
              )}

              {error && (
                <div className="p-3 rounded-2xl bg-neutral-100 text-xs text-neutral-700 text-center">
                  {error}
                </div>
              )}

              {!loading && list.length === 0 && (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-center text-neutral-400">
                  <Users size={24} className="text-neutral-300" />
                  <p className="text-xs font-medium">Henüz kimse bulunmuyor.</p>
                </div>
              )}

              {!loading &&
                list.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      onSelectUser(u.id);
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-surface hover:bg-neutral-100 border border-border/80 text-left transition-colors cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-200 text-neutral-700 text-xs font-bold flex items-center justify-center shrink-0 border border-neutral-300/60">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        u.name[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-black truncate">
                        {u.name} {u.surname}
                      </p>
                      {u.username && (
                        <p className="text-[11px] text-neutral-500 font-mono truncate">@{u.username}</p>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
export default FollowListModal;
