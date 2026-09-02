import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Lock, 
  Coffee, 
  Calendar, 
  User as UserIcon, 
  Globe, 
  Instagram, 
  Twitter, 
  Linkedin, 
  Github, 
  Youtube, 
  Check, 
  Copy,
  UserPlus,
  UserCheck,
  Edit2
} from 'lucide-react';
import { useApp } from '../AppContext';
import { apiRequest } from '../lib/api';
import { PublicUserProfile } from '../types';
import FollowListModal from './FollowListModal';

interface PublicProfileModalProps {
  userIdOrUsername: string | null;
  open: boolean;
  onClose: () => void;
  onEditProfile?: () => void;
}

export const PublicProfileModal: React.FC<PublicProfileModalProps> = ({
  userIdOrUsername,
  open,
  onClose,
  onEditProfile,
}) => {
  const { user: currentUser } = useApp();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(userIdOrUsername);
  const [loading, setLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Follow list sub-modal state
  const [followModalType, setFollowModalType] = useState<'followers' | 'following' | null>(null);

  useEffect(() => {
    setActiveUserId(userIdOrUsername);
  }, [userIdOrUsername]);

  const loadProfile = useCallback(async (target: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await apiRequest<{ profile: PublicUserProfile }>(`/api/users/profile/${target}`);
      setProfile(res.profile);
    } catch (err: any) {
      setError(err.message || 'Profil bilgileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && activeUserId) {
      void loadProfile(activeUserId);
    }
  }, [open, activeUserId, loadProfile]);

  const handleFollowToggle = async () => {
    if (!profile || followLoading) return;
    setFollowLoading(true);

    const prevFollowing = profile.isFollowing;
    const prevFollowersCount = profile.followersCount;

    // Optimistic update
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            isFollowing: !prevFollowing,
            followersCount: prevFollowing ? Math.max(0, prevFollowersCount - 1) : prevFollowersCount + 1,
          }
        : null
    );

    try {
      const res = await apiRequest<{ isFollowing: boolean; followersCount: number; followingCount: number }>(
        `/api/users/${profile.id}/follow`,
        { method: 'POST' }
      );
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: res.isFollowing,
              followersCount: res.followersCount,
            }
          : null
      );
      void loadProfile(profile.id);
    } catch (err: any) {
      // Revert optimistic update
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: prevFollowing,
              followersCount: prevFollowersCount,
            }
          : null
      );
    } finally {
      setFollowLoading(false);
    }
  };

  const handleCopyUsername = () => {
    if (!profile?.username) return;
    void navigator.clipboard.writeText(`@${profile.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isSelf = currentUser && profile && currentUser.id === profile.id;

  const formatDate = (isoDate?: string | null) => {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate);
      return d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const getSocialUrl = (network: string, handleOrUrl: string) => {
    if (!handleOrUrl) return '';
    if (handleOrUrl.startsWith('http://') || handleOrUrl.startsWith('https://')) {
      return handleOrUrl;
    }
    const clean = handleOrUrl.replace(/^@/, '');
    switch (network) {
      case 'instagram':
        return `https://instagram.com/${clean}`;
      case 'twitter':
        return `https://x.com/${clean}`;
      case 'github':
        return `https://github.com/${clean}`;
      case 'tiktok':
        return `https://tiktok.com/@${clean}`;
      case 'youtube':
        return `https://youtube.com/@${clean}`;
      case 'linkedin':
        return `https://linkedin.com/in/${clean}`;
      default:
        return `https://${clean}`;
    }
  };

  const hasSocials = profile?.socialLinks && Object.values(profile.socialLinks).some(Boolean);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="fixed inset-0 z-[110] bg-white flex flex-col h-[100dvh] w-full overflow-hidden pointer-events-auto"
        >
          {/* Top Header */}
          <header className="border-b border-border bg-white/95 backdrop-blur-md px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
            <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-neutral-100 border border-neutral-200/60 flex items-center justify-center text-black shrink-0">
                  <UserIcon size={18} />
                </div>
                <div>
                  <h1 className="text-base font-bold text-black tracking-tight leading-tight">
                    {profile ? `${profile.name} ${profile.surname}` : 'Kullanıcı Profili'}
                  </h1>
                  <p className="text-[11px] text-neutral-500">
                    {profile?.username ? `@${profile.username}` : 'Bancho Club Üyesi'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isSelf && onEditProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onEditProfile();
                    }}
                    className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-neutral-200/60"
                  >
                    <Edit2 size={13} />
                    <span>Düzenle</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-black flex items-center justify-center transition-colors cursor-pointer border border-neutral-200/60"
                  aria-label="Kapat"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </header>

          {/* Main Full-Screen Body */}
          <main className="flex-1 overflow-y-auto no-scrollbar max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6">
            {loading && (
              <div className="py-24 flex flex-col items-center justify-center gap-3 text-center text-xs text-neutral-400">
                <div className="w-7 h-7 rounded-full border-2 border-black border-t-transparent animate-spin" />
                <span>Profil yükleniyor...</span>
              </div>
            )}

            {error && (
              <div className="p-4 rounded-2xl bg-neutral-100 text-xs text-neutral-700 text-center border border-neutral-200">
                {error}
              </div>
            )}

            {!loading && profile && (
              <>
                {/* Hero Section */}
                <div className="flex flex-col items-center text-center space-y-4 p-6 rounded-3xl bg-neutral-50 border border-border/80">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden bg-neutral-200 text-neutral-800 text-3xl font-bold flex items-center justify-center border-2 border-white shadow-md shrink-0">
                    {profile.avatar ? (
                      <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                    ) : (
                      profile.name[0]?.toUpperCase() || '?'
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <h2 className="text-xl sm:text-2xl font-bold text-black tracking-tight">
                      {profile.name} {profile.surname}
                    </h2>
                    {profile.username ? (
                      <button
                        type="button"
                        onClick={handleCopyUsername}
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-700 hover:text-black bg-white hover:bg-neutral-100 px-3 py-1.5 rounded-xl border border-neutral-200 transition-colors cursor-pointer shadow-xs"
                        title="Kullanıcı adını kopyala"
                      >
                        <span>@{profile.username}</span>
                        {copied ? <Check size={13} className="text-black" /> : <Copy size={13} />}
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-400 font-mono">Kullanıcı adı henüz seçilmedi</span>
                    )}
                  </div>

                  {profile.bio ? (
                    <p className="text-xs sm:text-sm text-neutral-600 max-w-md leading-relaxed px-4">
                      {profile.bio}
                    </p>
                  ) : (
                    isSelf && (
                      <p className="text-xs text-neutral-400 italic">
                        Henüz bir biyografi eklemediniz. Profil ayarlarından ekleyebilirsiniz.
                      </p>
                    )
                  )}

                  {/* Followers & Following Stats */}
                  <div className="flex items-center gap-8 pt-2">
                    <button
                      type="button"
                      onClick={() => setFollowModalType('followers')}
                      className="flex flex-col items-center hover:opacity-75 transition-opacity cursor-pointer"
                    >
                      <span className="text-lg sm:text-xl font-bold font-mono text-black">{profile.followersCount}</span>
                      <span className="text-xs text-neutral-500 font-medium">Takipçi</span>
                    </button>
                    <div className="w-px h-8 bg-neutral-200" />
                    <button
                      type="button"
                      onClick={() => setFollowModalType('following')}
                      className="flex flex-col items-center hover:opacity-75 transition-opacity cursor-pointer"
                    >
                      <span className="text-lg sm:text-xl font-bold font-mono text-black">{profile.followingCount}</span>
                      <span className="text-xs text-neutral-500 font-medium">Takip Edilen</span>
                    </button>
                  </div>

                  {/* Follow / Unfollow Button */}
                  {!isSelf && currentUser && (
                    <div className="w-full max-w-xs pt-2">
                      <button
                        type="button"
                        onClick={handleFollowToggle}
                        disabled={followLoading}
                        className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                          profile.isFollowing
                            ? 'bg-white hover:bg-neutral-100 text-black border border-neutral-300'
                            : 'bg-black hover:bg-neutral-800 text-white'
                        }`}
                      >
                        {profile.isFollowing ? (
                          <>
                            <UserCheck size={16} />
                            <span>Takip Ediliyor</span>
                          </>
                        ) : (
                          <>
                            <UserPlus size={16} />
                            <span>Takip Et</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Private Profile Notice */}
                {profile.isProfilePrivate && !profile.isFollowing && !isSelf && (
                  <div className="p-5 rounded-3xl bg-neutral-50 border border-border flex items-center gap-4 text-xs text-neutral-600">
                    <div className="w-10 h-10 rounded-2xl bg-neutral-200 flex items-center justify-center shrink-0 text-black">
                      <Lock size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-black text-sm">Gizli Profil</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Bu kullanıcının detaylarını ve puanlarını görmek için takip etmelisiniz.</p>
                    </div>
                  </div>
                )}

                {/* Public Stats & Information */}
                {(!profile.isProfilePrivate || profile.isFollowing || isSelf) && (
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
                      Kullanıcı Bilgileri
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* KP Card */}
                      {(profile.points !== null && profile.points !== undefined) && (
                        <div className="p-4 rounded-2xl bg-surface border border-border/80 flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shrink-0 shadow-xs">
                            <Coffee size={18} />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Kahve Puanı</span>
                            <span className="text-base font-mono font-bold text-black">{profile.points} KP</span>
                          </div>
                        </div>
                      )}

                      {/* Join Date Card */}
                      {profile.createdAt && (
                        <div className="p-4 rounded-2xl bg-surface border border-border/80 flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-2xl bg-neutral-100 text-black flex items-center justify-center shrink-0 border border-neutral-200/60">
                            <Calendar size={18} />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Katılma Tarihi</span>
                            <span className="text-xs sm:text-sm font-bold text-black">{formatDate(profile.createdAt)}</span>
                          </div>
                        </div>
                      )}

                      {/* Age Card */}
                      {(profile.age !== null && profile.age !== undefined) && (
                        <div className="p-4 rounded-2xl bg-surface border border-border/80 flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-2xl bg-neutral-100 text-black flex items-center justify-center shrink-0 border border-neutral-200/60">
                            <UserIcon size={18} />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Yaş</span>
                            <span className="text-xs sm:text-sm font-bold text-black">{profile.age} yaşında</span>
                          </div>
                        </div>
                      )}

                      {/* Gender Card */}
                      {profile.gender && (
                        <div className="p-4 rounded-2xl bg-surface border border-border/80 flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-2xl bg-neutral-100 text-black flex items-center justify-center shrink-0 border border-neutral-200/60">
                            <UserIcon size={18} />
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-neutral-400 block tracking-wider">Cinsiyet</span>
                            <span className="text-xs sm:text-sm font-bold text-black">
                              {profile.gender === 'female' ? 'Kadın' : 'Erkek'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Social Media Links Section */}
                    <div className="space-y-3 pt-4 border-t border-border">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-1">
                        Sosyal Medya Hesapları
                      </h3>

                      {hasSocials ? (
                        <div className="flex flex-wrap gap-2.5">
                          {profile.socialLinks?.instagram && (
                            <a
                              href={getSocialUrl('instagram', profile.socialLinks.instagram)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold transition-all border border-neutral-200/60"
                            >
                              <Instagram size={16} />
                              <span>Instagram</span>
                            </a>
                          )}
                          {profile.socialLinks?.twitter && (
                            <a
                              href={getSocialUrl('twitter', profile.socialLinks.twitter)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold transition-all border border-neutral-200/60"
                            >
                              <Twitter size={16} />
                              <span>X (Twitter)</span>
                            </a>
                          )}
                          {profile.socialLinks?.linkedin && (
                            <a
                              href={getSocialUrl('linkedin', profile.socialLinks.linkedin)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold transition-all border border-neutral-200/60"
                            >
                              <Linkedin size={16} />
                              <span>LinkedIn</span>
                            </a>
                          )}
                          {profile.socialLinks?.github && (
                            <a
                              href={getSocialUrl('github', profile.socialLinks.github)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold transition-all border border-neutral-200/60"
                            >
                              <Github size={16} />
                              <span>GitHub</span>
                            </a>
                          )}
                          {profile.socialLinks?.youtube && (
                            <a
                              href={getSocialUrl('youtube', profile.socialLinks.youtube)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold transition-all border border-neutral-200/60"
                            >
                              <Youtube size={16} />
                              <span>YouTube</span>
                            </a>
                          )}
                          {profile.socialLinks?.website && (
                            <a
                              href={getSocialUrl('website', profile.socialLinks.website)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold transition-all border border-neutral-200/60"
                            >
                              <Globe size={16} />
                              <span>Kişisel Site</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-neutral-400 italic px-1">
                          {isSelf
                            ? 'Henüz bir sosyal medya hesabı eklemediniz. Profil ayarlarından kolayca ekleyebilirsiniz.'
                            : 'Bu kullanıcı henüz sosyal medya hesabı eklememiş.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </motion.div>
      )}

      {/* Follow List Sub Modal */}
      {profile && (
        <FollowListModal
          open={Boolean(followModalType)}
          onClose={() => setFollowModalType(null)}
          userId={profile.id}
          type={followModalType || 'followers'}
          title={followModalType === 'followers' ? 'Takipçiler' : 'Takip Edilenler'}
          onSelectUser={(selectedId) => {
            setFollowModalType(null);
            setActiveUserId(selectedId);
          }}
        />
      )}
    </AnimatePresence>
  );
};
export default PublicProfileModal;
