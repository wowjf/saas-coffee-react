// C6: arkadaşlık + hediye arayüzü — müşteri profilinden erişilir.
// Arkadaş ekleme e-posta ile; hediyeler bakiye tipinde gönderilir/claim
// edilir (ürün hediyesi backend'de kayıt düzeyinde desteklenir, bu arayüz
// MVP'de bakiye hediyesine odaklanır).
import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { UserPlus, Users, Gift, Check, X, Trash2, Send } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useApp } from '../AppContext';
import { cn } from '../lib/utils';

type Friend = {
  id: string;
  name: string;
  surname: string;
  avatar: string;
  email: string;
};

type FriendRequest = {
  id: string;
  userId: string;
  name: string;
  surname: string;
  email: string;
  requestedAt: string;
};

type GiftItem = {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientName: string;
  type: 'balance' | 'product';
  amount: number;
  productName: string;
  message: string;
  status: 'pending' | 'claimed' | 'expired';
  sentAt: string;
  expiresAt: string;
};

type Tab = 'friends' | 'gifts';

export const FriendsGiftsPanel: React.FC = () => {
  const { syncAfterMutation } = useApp();
  const [tab, setTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<GiftItem[]>([]);
  const [sentGifts, setSentGifts] = useState<GiftItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [friendEmail, setFriendEmail] = useState('');
  const [isAddingFriend, setIsAddingFriend] = useState(false);
  const [giftForm, setGiftForm] = useState({ email: '', amount: 10, message: '' });
  const [isSendingGift, setIsSendingGift] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [friendsData, requestsData, received, sent] = await Promise.all([
        apiRequest<Friend[]>('/api/friends'),
        apiRequest<FriendRequest[]>('/api/friends/requests'),
        apiRequest<GiftItem[]>('/api/gifts/received'),
        apiRequest<GiftItem[]>('/api/gifts/sent'),
      ]);
      setFriends(Array.isArray(friendsData) ? friendsData : []);
      setRequests(Array.isArray(requestsData) ? requestsData : []);
      setReceivedGifts(Array.isArray(received) ? received : []);
      setSentGifts(Array.isArray(sent) ? sent : []);
    } catch {
      setFeedback({ message: 'Veriler yüklenemedi.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddFriend = async () => {
    const email = friendEmail.trim();
    if (!email) return;
    setIsAddingFriend(true);
    setFeedback(null);
    try {
      await apiRequest('/api/friends/request', {
        method: 'POST',
        body: JSON.stringify({ friendEmail: email }),
      });
      setFeedback({ message: 'Arkadaşlık isteği gönderildi.', type: 'success' });
      setFriendEmail('');
    } catch (err: any) {
      setFeedback({ message: err.message || 'İstek gönderilemedi.', type: 'error' });
    } finally {
      setIsAddingFriend(false);
    }
  };

  const handleRespond = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      await apiRequest('/api/friends/respond', {
        method: 'POST',
        body: JSON.stringify({ requestId, action }),
      });
      await fetchData();
    } catch (err: any) {
      setFeedback({ message: err.message || 'İşlem başarısız.', type: 'error' });
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!window.confirm('Bu arkadaşınızı listeden çıkarmak istediğinize emin misiniz?')) return;
    try {
      await apiRequest(`/api/friends/${friendId}`, { method: 'DELETE' });
      await fetchData();
    } catch (err: any) {
      setFeedback({ message: err.message || 'Arkadaş silinemedi.', type: 'error' });
    }
  };

  const handleSendGift = async () => {
    const email = giftForm.email.trim();
    if (!email || giftForm.amount < 1) {
      setFeedback({ message: 'Arkadaş e-postası ve en az ₺1 tutar gerekli.', type: 'error' });
      return;
    }
    setIsSendingGift(true);
    setFeedback(null);
    try {
      await apiRequest('/api/gifts/send', {
        method: 'POST',
        body: JSON.stringify({
          recipientEmail: email,
          type: 'balance',
          amount: giftForm.amount,
          message: giftForm.message.trim(),
        }),
      });
      setFeedback({ message: 'Hediye gönderildi — arkadaşınız kabul ettiğinde bakiyesine eklenir.', type: 'success' });
      setGiftForm({ email: '', amount: 10, message: '' });
      await fetchData();
      await syncAfterMutation();
    } catch (err: any) {
      setFeedback({ message: err.message || 'Hediye gönderilemedi.', type: 'error' });
    } finally {
      setIsSendingGift(false);
    }
  };

  const handleClaimGift = async (giftId: string) => {
    try {
      await apiRequest(`/api/gifts/${giftId}/claim`, { method: 'POST' });
      setFeedback({ message: 'Hediye bakiyenize eklendi.', type: 'success' });
      await fetchData();
      await syncAfterMutation();
    } catch (err: any) {
      setFeedback({ message: err.message || 'Hediye alınamadı.', type: 'error' });
    }
  };

  const pendingReceived = receivedGifts.filter((g) => g.status === 'pending');

  if (isLoading) {
    return <div className="p-6 text-center text-sm text-text-secondary">Yükleniyor…</div>;
  }

  return (
    <div className="space-y-5">
      {feedback && (
        <div className={cn(
          "p-4 rounded-2xl text-xs font-semibold border",
          feedback.type === 'success' ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700",
        )}>
          {feedback.message}
        </div>
      )}

      {/* Sekme seçici */}
      <div className="flex gap-2">
        {([
          { id: 'friends' as Tab, label: 'Arkadaşlar', icon: Users, badge: requests.length },
          { id: 'gifts' as Tab, label: 'Hediyeler', icon: Gift, badge: pendingReceived.length },
        ]).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex-1 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors relative",
              tab === item.id ? "bg-black text-white border-black" : "bg-surface border-border text-text-secondary hover:bg-white",
            )}
          >
            <item.icon size={14} />
            {item.label}
            {item.badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] font-bold w-4.5 h-4.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'friends' ? (
        <div className="space-y-5">
          {/* Arkadaş ekle */}
          <div className="bg-white border border-border rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1.5">
              <UserPlus size={12} /> Arkadaş Ekle
            </h3>
            <div className="flex gap-2">
              <input
                type="email"
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
                placeholder="arkadas@ornek.com"
                className="flex-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
              />
              <button
                onClick={handleAddFriend}
                disabled={isAddingFriend || !friendEmail.trim()}
                className="px-4 rounded-xl bg-black text-white text-xs font-bold active:scale-95 transition-transform disabled:opacity-40"
              >
                Gönder
              </button>
            </div>
          </div>

          {/* Gelen istekler */}
          {requests.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary pl-1">
                Arkadaşlık İstekleri ({requests.length})
              </h3>
              {requests.map((req) => (
                <div key={req.id} className="bg-white border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
                  <div>
                    <span className="text-sm font-bold text-black block">{req.name} {req.surname}</span>
                    <span className="text-xs text-text-secondary">{req.email}</span>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleRespond(req.id, 'accept')}
                      className="w-9 h-9 rounded-xl bg-green-600 text-white flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => handleRespond(req.id, 'reject')}
                      className="w-9 h-9 rounded-xl border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-50"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Arkadaş listesi */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary pl-1">
              Arkadaşlarım ({friends.length})
            </h3>
            {friends.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-secondary">Henüz arkadaşınız yok — yukarıdan e-posta ile ekleyin.</div>
            ) : (
              friends.map((friend) => (
                <div key={friend.id} className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-text-secondary shrink-0 overflow-hidden">
                      {friend.avatar ? (
                        <img src={friend.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold">{friend.name?.[0]}{friend.surname?.[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-black block truncate">{friend.name} {friend.surname}</span>
                      <span className="text-xs text-text-secondary truncate block">{friend.email}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setTab('gifts');
                        setGiftForm((prev) => ({ ...prev, email: friend.email }));
                      }}
                      className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center active:scale-95 transition-transform"
                      title="Hediye gönder"
                    >
                      <Gift size={15} />
                    </button>
                    <button
                      onClick={() => handleRemoveFriend(friend.id)}
                      className="w-9 h-9 rounded-xl border border-border text-text-secondary flex items-center justify-center hover:text-red-600 hover:border-red-200"
                      title="Arkadaşı çıkar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Hediye gönder */}
          <div className="bg-white border border-border rounded-2xl p-4 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary flex items-center gap-1.5">
              <Send size={12} /> Bakiye Hediyesi Gönder
            </h3>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <input
                type="email"
                value={giftForm.email}
                onChange={(e) => setGiftForm({ ...giftForm, email: e.target.value })}
                placeholder="arkadas@ornek.com"
                className="px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-secondary">₺</span>
                <input
                  type="number"
                  min="1"
                  value={giftForm.amount}
                  onChange={(e) => setGiftForm({ ...giftForm, amount: Number(e.target.value) })}
                  className="w-24 pl-7 pr-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                />
              </div>
            </div>
            <input
              value={giftForm.message}
              onChange={(e) => setGiftForm({ ...giftForm, message: e.target.value })}
              maxLength={200}
              placeholder="Notunuz (opsiyonel)"
              className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
            />
            <button
              onClick={handleSendGift}
              disabled={isSendingGift || !giftForm.email.trim()}
              className="w-full py-3 rounded-xl bg-black text-white text-sm font-bold active:scale-[0.98] disabled:opacity-40 transition-transform flex items-center justify-center gap-2"
            >
              <Gift size={15} />
              Hediyeyi Gönder
            </button>
            <p className="text-[10px] text-text-secondary">Hediye anında bakiyenizden düşer; arkadaşınız kabul edene kadar bekler (30 gün geçerli).</p>
          </div>

          {/* Gelen hediyeler */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary pl-1">Gelen Hediyeler</h3>
            {receivedGifts.length === 0 ? (
              <div className="py-6 text-center text-sm text-text-secondary">Henüz hediye gelmedi.</div>
            ) : (
              receivedGifts.map((gift) => (
                <div key={gift.id} className={cn(
                  "bg-white border rounded-2xl p-4 shadow-sm",
                  gift.status === 'pending' ? "border-amber-200" : "border-border",
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="text-sm font-bold text-black block">
                        {gift.type === 'balance' ? `₺${gift.amount}` : gift.productName} hediyesi
                      </span>
                      <span className="text-xs text-text-secondary">{gift.senderName} tarafından</span>
                    </div>
                    {gift.status === 'pending' ? (
                      <button
                        onClick={() => handleClaimGift(gift.id)}
                        className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold active:scale-95 transition-transform shrink-0"
                      >
                        Kabul Et
                      </button>
                    ) : (
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider shrink-0",
                        gift.status === 'claimed' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500",
                      )}>
                        {gift.status === 'claimed' ? 'Alındı' : 'Süresi Doldu'}
                      </span>
                    )}
                  </div>
                  {gift.message && <p className="text-xs text-text-secondary mt-2 italic">"{gift.message}"</p>}
                </div>
              ))
            )}
          </div>

          {/* Gönderilen hediyeler */}
          {sentGifts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary pl-1">Gönderdiklerim</h3>
              {sentGifts.map((gift) => (
                <div key={gift.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
                  <div>
                    <span className="text-sm font-bold text-black block">
                      {gift.type === 'balance' ? `₺${gift.amount}` : gift.productName} → {gift.recipientName}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {new Date(gift.sentAt).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider shrink-0",
                    gift.status === 'pending' && "bg-amber-100 text-amber-700",
                    gift.status === 'claimed' && "bg-green-100 text-green-700",
                    gift.status === 'expired' && "bg-gray-100 text-gray-500",
                  )}>
                    {gift.status === 'pending' ? 'Bekliyor' : gift.status === 'claimed' ? 'Alındı' : 'Doldu'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
