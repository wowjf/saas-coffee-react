import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../AppContext';
import { SupportChat } from './SupportChat';
import { ReservationPanel } from './ReservationPanel';
import { FriendsGiftsPanel } from './FriendsGiftsPanel';
import { Address, Campaign, LoyaltyQrPayload, Notification, PaymentMethod } from '../types';
import { 
  Wallet, 
  QrCode, 
  Plus, 
  Minus, 
  ChevronRight, 
  ChevronDown,
  Filter,
  Check,
  Star,
  Search,
  ShoppingBag,
  Bell,
  LogIn,
  LogOut,
  UserPlus,
  User as UserIcon,
  Milk,
  Egg,
  Wheat,
  Droplets,
  Candy,
  Bean,
  X,
  Gift,
  Tag,
  Clock,
  Zap,
  Leaf,
  Flame,
  Apple,
  Citrus,
  Cherry,
  Banana,
  Grape,
  Cookie,
  IceCream,
  Carrot,
  Fish,
  Beef,
  Sandwich,
  Soup,
  Pizza,
  Croissant,
  Salad,
  Vegan,
  Nut,
  GlassWater,
  CupSoda,
  CandyCane,
  WheatOff,
  Drumstick,
  Ham,
  ChefHat,
  Donut,
  Popsicle,
  Coffee,
  Layers,
  Users,
  Moon,
  Heart,
  Cake,
  Shield,
  MapPin,
  CreditCard,
  Settings,
  ArrowLeft,
  Trash2,
  Edit2,
  CheckCircle2,
  Trophy,
  Utensils,
  Globe,
  Lock,
  Copy,
  CalendarDays,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiRequest, uploadImage } from '../lib/api';
import { isCampaignScheduledActive } from '../lib/campaignSchedule';
import { isPointRewardCampaignType } from '../lib/loyalty';
import { cn, getOrderDisplayCode } from '../lib/utils';
import LeaderboardModal from './LeaderboardModal';
import PublicProfileModal from './PublicProfileModal';
import { t } from "../shared/system-texts";
import { subscribeToPush, getNotificationPermission, sendTestNotification, isPushSupported } from '../lib/pushClient';

const OrderNotificationCard: React.FC<{ orderId?: string }> = ({ orderId }) => {
  const [permission, setPermission] = useState<string>(() => getNotificationPermission());
  const [loading, setLoading] = useState(false);
  const [testSent, setTestSent] = useState(false);

  if (!isPushSupported()) return null;

  const handleEnable = async () => {
    setLoading(true);
    const result = await subscribeToPush(orderId);
    setPermission(getNotificationPermission());
    setLoading(false);
    if (result.success) {
      await sendTestNotification(orderId);
      setTestSent(true);
      setTimeout(() => setTestSent(false), 4000);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    await sendTestNotification(orderId);
    setTestSent(true);
    setLoading(false);
    setTimeout(() => setTestSent(false), 4000);
  };

  if (permission === 'granted') {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-black text-white flex items-center justify-center shrink-0">
            <Bell size={14} />
          </div>
          <div>
            <p className="text-xs font-bold text-black">Sesli Bildirimler Aktif</p>
            <p className="text-[10px] text-neutral-500">Ekranınız kapalıyken bile ses/titreşim gelir</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleTest}
          disabled={loading}
          className="text-xs font-bold text-black border border-neutral-300 rounded-lg px-2.5 py-1 hover:bg-white transition-colors cursor-pointer"
        >
          {testSent ? 'Gönderildi!' : 'Test Et'}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-2.5">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center text-black shrink-0">
          <Bell size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-black">Sipariş Bildirimlerini Aç</p>
          <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">
            Siparişiniz hazır olduğunda ekranınız kapalı olsa bile sesli bildirim alın.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleEnable}
        disabled={loading}
        className="w-full py-2.5 bg-black text-white text-xs font-bold rounded-xl hover:bg-neutral-800 transition-colors flex items-center justify-center gap-2 cursor-pointer"
      >
        {loading ? 'İzin İsteniyor...' : 'Bildirimleri Aç'}
      </button>
    </div>
  );
};

// C8: bildirim kartı — her SSE/ poll tazelemesinde listenin baştan
// çizilmesini engellemek için React.memo'lanır (props: notification +
// onRead referansı stabil kalır).
const NotificationItem: React.FC<{
  notification: Notification;
  isSelected: boolean;
  onSelect: (n: Notification) => void;
}> = React.memo(({ notification: n, isSelected, onSelect }) => {
  // C8 (madde 7): bildirim olay türüne göre ikon/renk eşlemesi — sipariş
  // durumu bildirimleri artık türden ayırt edilir.
  const eventMeta = (() => {
    const event = (n as any).event as string | undefined;
    switch (event) {
      case 'order_preparing':
        return { Icon: Clock, cls: 'bg-amber-50/80 text-amber-600 border-amber-100' };
      case 'order_ready':
        return { Icon: CheckCircle2, cls: 'bg-green-50/80 text-green-600 border-green-100' };
      case 'order_cancelled':
        return { Icon: X, cls: 'bg-red-50/80 text-red-600 border-red-100' };
      case 'social_follow':
      case 'social_friend_request':
      case 'social_gift':
        return { Icon: Users, cls: 'bg-violet-50/80 text-violet-600 border-violet-100' };
      default:
        return {
          Icon: Bell,
          cls:
            n.type === 'success'
              ? 'bg-green-50/80 text-green-600 border-green-100'
              : n.type === 'warning'
                ? 'bg-amber-50/80 text-amber-600 border-amber-100'
                : 'bg-blue-50/80 text-blue-600 border-blue-100',
        };
    }
  })();
  const { Icon: EventIcon, cls: iconCls } = eventMeta;

  return (
    <div
      key={n.id}
      onClick={() => onSelect(n)}
      className={cn(
        "bg-white border rounded-2xl p-4 transition-all cursor-pointer hover:border-black/50 relative group flex gap-3",
        isSelected ? "border-black ring-1 ring-black shadow-sm" : "border-border/80",
        !n.read && "bg-blue-50/5 border-blue-100"
      )}
    >
      <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5", iconCls)}>
        <EventIcon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center gap-2 mb-1">
          <h4 className={cn("text-xs font-bold text-black truncate", !n.read && "text-blue-900")}>
            {n.title}
          </h4>
          {/* C8: okunmamış nokta statiktir — sonsuz pulse listeyi titretmez. */}
          {!n.read && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />}
        </div>
        <p className="text-[11px] text-text-secondary truncate leading-normal">
          {n.message}
        </p>
        <div className="flex justify-between items-center mt-2.5 text-[9px] text-text-secondary border-t border-zinc-50 pt-2">
          <span>{new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
    </div>
  );
});
NotificationItem.displayName = 'NotificationItem';

// C8: mobil bildirim kartı — aynı memo yaklaşımı.
const MobileNotificationItem: React.FC<{
  notification: Notification;
  onRead: (id: string) => void;
}> = React.memo(({ notification: n, onRead }) => {
  const eventMeta = (() => {
    const event = (n as any).event as string | undefined;
    switch (event) {
      case 'order_preparing':
        return { Icon: Clock, cls: 'bg-amber-50 text-amber-600' };
      case 'order_ready':
        return { Icon: CheckCircle2, cls: 'bg-green-50 text-green-600' };
      case 'order_cancelled':
        return { Icon: X, cls: 'bg-red-50 text-red-600' };
      case 'social_follow':
      case 'social_friend_request':
      case 'social_gift':
        return { Icon: Users, cls: 'bg-violet-50 text-violet-600' };
      default:
        return {
          Icon: Bell,
          cls:
            n.type === 'success'
              ? 'bg-green-50 text-green-600'
              : n.type === 'warning'
                ? 'bg-amber-50 text-amber-600'
                : 'bg-blue-50 text-blue-600',
        };
    }
  })();
  const { Icon: EventIcon, cls: iconCls } = eventMeta;

  return (
    <div
      className={cn(
        "bg-surface border border-border rounded-2xl p-4 flex gap-4 relative group transition-all",
        !n.read && "border-blue-200 bg-blue-50/10 shadow-sm"
      )}
      onClick={() => !n.read && onRead(n.id)}
    >
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", iconCls, !n.read && "ring-2 ring-blue-100")}>
        <EventIcon size={20} />
      </div>
      <div className="space-y-1 flex-1">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <h3 className={cn("text-sm font-bold", !n.read && "text-blue-900")}>{n.title}</h3>
            {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-secondary">
              {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
        <p className={cn("text-xs leading-relaxed", !n.read ? "text-blue-800/80" : "text-text-secondary")}>
          {n.message}
        </p>
      </div>
    </div>
  );
});
MobileNotificationItem.displayName = 'MobileNotificationItem';

const DynamicIslandHeader: React.FC<{
  activeTab: string;
  profileView?: string;
  onProfileBack?: () => void;
  cartCount: number;
  onOpenCart: () => void;
  onOpenQR: () => void;
  onOpenLeaderboard: () => void;
  activeOrder?: any;
}> = ({
  activeTab,
  profileView,
  onProfileBack,
  cartCount,
  onOpenCart,
  onOpenQR,
  onOpenLeaderboard,
  activeOrder,
}) => {
  let icon = <Coffee size={16} className="text-black" />;
  let label = 'Menü';
  let sublabel = '';

  if (activeTab === 'home') {
    icon = <Coffee size={16} className="text-black" />;
    label = 'Menü';
  } else if (activeTab === 'campaigns') {
    icon = <Gift size={16} className="text-black" />;
    label = 'Fırsatlar & Sadakat';
  } else if (activeTab === 'orders') {
    if (activeOrder && activeOrder.status === 'ready') {
      // C8: ping dalgası duruma özgü anahtarla YALNIZCA BİR kez oynar —
      // her SSE tazelemesinde sonsuz döngüye girmez, canlılık hissi korunur.
      icon = (
        <span key={`ready-${activeOrder.id}`} className="relative flex w-2.5 h-2.5 shrink-0 items-center justify-center">
          <span
            className="absolute inset-0 rounded-full bg-black animate-ping"
            style={{ animationIterationCount: 2 }}
          />
          <span className="relative w-2.5 h-2.5 rounded-full bg-black" />
        </span>
      );
      label = 'Siparişiniz Hazır!';
      sublabel = `#${getOrderDisplayCode(activeOrder.id)}`;
    } else if (activeOrder && activeOrder.status === 'preparing') {
      // C8: sabit dolu nokta — sonsuz pulse yerine statik gösterge.
      icon = <span className="w-2.5 h-2.5 rounded-full bg-black shrink-0" />;
      label = 'Hazırlanıyor';
      sublabel = `#${getOrderDisplayCode(activeOrder.id)}`;
    } else {
      icon = <ShoppingBag size={16} className="text-black" />;
      label = 'Siparişlerim';
    }
  } else if (activeTab === 'notifications') {
    icon = <Bell size={16} className="text-black" />;
    label = 'Bildirimler';
  } else if (activeTab === 'profile') {
    icon = <UserIcon size={16} className="text-black" />;
    if (profileView && profileView !== 'main') {
      const subLabels: Record<string, string> = {
        addresses: 'Adreslerim',
        payments: 'Ödeme Yöntemleri',
        favorites: 'Favorilerim',
        settings: 'Ayarlar',
        'profile-info': 'Profil Bilgileri',
        'change-password': 'Şifre Değiştir',
        policies: 'Politikalar',
        about: 'Hakkımızda',
        'orders-history': 'Geçmiş Siparişler',
        'friends-gifts': 'Arkadaşlar & Hediyeler',
        'reservations': 'Masa Rezervasyonu',
        'topups-history': 'Bakiye Geçmişi',
      };
      label = subLabels[profileView] || 'Profil';
    } else {
      label = 'Profil & Hesap';
    }
  } else if (activeTab === 'table-session') {
    icon = <Utensils size={16} className="text-black" />;
    label = 'Masa Oturumu';
  }

  return (
    <div className="sticky top-3 z-40 w-full max-w-7xl mx-auto px-4 sm:px-6 pointer-events-none mb-4">
      <motion.div
        /* C8: layout prop'u kaldırıldı — her veri tazelemesinde spring
           animasyonunu yeniden oynatıp başlığı titretiyordu. Giriş animasyonu
           yalnızca mount'ta çalışır. */
        initial={{ scale: 0.96, opacity: 0, y: -10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="pointer-events-auto w-full bg-white/95 text-black backdrop-blur-xl rounded-[24px] sm:rounded-[28px] px-4 sm:px-6 py-3 sm:py-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-neutral-200/90 flex items-center justify-between gap-4"
      >
        {/* Left: Back button in profile subview OR Tab Icon + Tab Name */}
        <div className="flex items-center gap-3 min-w-0">
          {activeTab === 'profile' && profileView && profileView !== 'main' && onProfileBack ? (
            <button
              type="button"
              onClick={onProfileBack}
              className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-black transition-colors cursor-pointer shrink-0 border border-neutral-200/60"
              aria-label="Geri"
            >
              <ArrowLeft size={16} />
            </button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-neutral-100 flex items-center justify-center shrink-0 text-black border border-neutral-200/60">
              {icon}
            </div>
          )}

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-bold text-black tracking-tight truncate">
              {label}
            </span>
            {sublabel && (
              <span className="text-xs text-neutral-600 font-mono font-medium truncate bg-neutral-100 px-2 py-0.5 rounded-md border border-neutral-200">
                {sublabel}
              </span>
            )}
          </div>
        </div>

        {/* Right Action Icons: Leaderboard / QR / Cart */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenLeaderboard}
            className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-black transition-colors cursor-pointer border border-neutral-200/60"
            title="Liderlik Tablosu"
          >
            <Trophy size={16} />
          </button>

          <button
            type="button"
            onClick={onOpenQR}
            className="w-9 h-9 rounded-xl bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-black transition-colors cursor-pointer border border-neutral-200/60"
            title="Sadakat QR"
          >
            <QrCode size={16} />
          </button>

          {cartCount > 0 && (
            <button
              type="button"
              onClick={onOpenCart}
              className="h-9 px-3.5 rounded-xl bg-black text-white text-xs font-bold flex items-center gap-1.5 hover:bg-neutral-800 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <ShoppingBag size={14} />
              <span>{cartCount}</span>
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const ICON_MAP: Record<string, any> = {
  Milk, Egg, Wheat, Droplets, Candy, Bean, Zap, Leaf, Flame, Apple, Citrus, Cherry, Banana, Grape, Cookie, IceCream, Carrot, Fish, Beef, Sandwich, Soup, Pizza, Croissant, Salad, Vegan, Nut, GlassWater, CupSoda, CandyCane, WheatOff, Drumstick, Ham, ChefHat, Donut, Popsicle, Coffee, Star, Layers, Cake, Heart, Moon, Users
};
const SUPPORT_PHONE_HREF = 'tel:+905426213186';

function isCampaignCurrentlyActive(campaign: Campaign) {
  return isCampaignScheduledActive(campaign);
}

function isLoyaltyQrPayload(value: unknown): value is LoyaltyQrPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const summary = payload.summary;

  return (
    typeof payload.token === 'string' &&
    typeof payload.expiresAt === 'string' &&
    !!summary &&
    typeof summary === 'object' &&
    typeof (summary as Record<string, unknown>).pointsBalance === 'number' &&
    Array.isArray((summary as Record<string, unknown>).availableRewards)
  );
}

export const CustomerPanel: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { 
    products, 
    user, 
    updateBalance, 
    orders, 
    createOrder,
    notifications, 
    points, 
    logout, 
    campaigns, 
    categories,
    cart,
    setCart,
    deleteNotification,
  markAllNotificationsRead,
    clearNotifications,
    markNotificationRead,
    updateUser,
    isTableMode,
    balanceTopUps,
    setSessionRole
  } = useApp();
  const [showQR, setShowQR] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [category, setCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState<string>('');
  const [showCartModal, setShowCartModal] = useState(false);
  const [orderNote, setOrderNote] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [ordersView, setOrdersView] = useState<'hub' | 'list'>('hub');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
  const [profileView, setProfileView] = useState<'main' | 'addresses' | 'payments' | 'favorites' | 'settings' | 'profile-info' | 'change-password' | 'about' | 'policies' | 'orders-history' | 'topups-history' | 'friends-gifts' | 'reservations'>('main');
  const [menuView, setMenuView] = useState<'categories' | 'products'>('categories');
  const [searchQuery, setSearchQuery] = useState('');
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [loyaltyQr, setLoyaltyQr] = useState<LoyaltyQrPayload | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [qrError, setQrError] = useState('');
  const [customerCampaignTab, setCustomerCampaignTab] = useState<'all' | 'discount' | 'financial' | 'loyalty'>('all');
  const [isCampaignFilterOpen, setIsCampaignFilterOpen] = useState(false);
  const [campaignSelectionError, setCampaignSelectionError] = useState('');
  const [profileDraft, setProfileDraft] = useState({
    name: '',
    surname: '',
    username: '',
    bio: '',
    phone: '',
    email: '',
    birthDate: '',
    gender: '' as 'female' | 'male' | '',
    socialLinks: {
      instagram: '',
      twitter: '',
      linkedin: '',
      github: '',
      website: '',
      tiktok: '',
      youtube: '',
    },
    privacy: {
      isProfilePrivate: false,
      showKp: true,
      showSocials: true,
      showAge: true,
      showGender: true,
      showJoinDate: true,
    },
  });
  const [viewingUserProfileId, setViewingUserProfileId] = useState<string | null>(null);
  const [addressDraft, setAddressDraft] = useState({ id: '', title: '', details: '' });
  const [paymentDraft, setPaymentDraft] = useState({ id: '', brand: '', cardNumber: '' });
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const callSupportLine = () => {
    window.location.href = SUPPORT_PHONE_HREF;
  };

  // C4: canlı destek sohbeti
  const [showSupportChat, setShowSupportChat] = useState(false);

  // C8: canlı sipariş — her render'da orders.find ile yeni nesne üretmek
  // yerine memoize edilir; başlık yalnızca gerçek değişimde güncellenir.
  const activeOrder = useMemo(
    () => orders.find(o => o.userId === user?.id && (o.status === 'ready' || o.status === 'preparing' || o.status === 'pending')),
    [orders, user?.id],
  );

  // C8: bildirim seçimi — memo'lu kart bileşenine stabil referans.
  const handleNotificationSelect = useCallback((n: Notification) => {
    setSelectedNotificationId(n.id);
    if (!n.read) markNotificationRead(n.id);
  }, [markNotificationRead]);

  // C5: rezervasyon görünümü — profil sekmesi altında (profileView: 'reservations')

  useEffect(() => {
    if (activeTab === 'profile') {
      setProfileView(window.innerWidth > 640 ? 'profile-info' : 'main');
    } else {
      setProfileView('main');
    }
    if (activeTab === 'home') {
      setMenuView('categories');
      setCategory('All');
      setSearchQuery('');
    }
  }, [activeTab]);

  useEffect(() => {
    setProfileDraft({
      name: user?.name || '',
      surname: user?.surname || '',
      username: user?.username || '',
      bio: user?.bio || '',
      phone: user?.phone || '',
      email: user?.email || '',
      birthDate: user?.birthDate || '',
      gender: user?.gender || '',
      socialLinks: {
        instagram: user?.socialLinks?.instagram || '',
        twitter: user?.socialLinks?.twitter || '',
        linkedin: user?.socialLinks?.linkedin || '',
        github: user?.socialLinks?.github || '',
        website: user?.socialLinks?.website || '',
        tiktok: user?.socialLinks?.tiktok || '',
        youtube: user?.socialLinks?.youtube || '',
      },
      privacy: {
        isProfilePrivate: user?.privacy?.isProfilePrivate ?? false,
        showKp: user?.privacy?.showKp ?? true,
        showSocials: user?.privacy?.showSocials ?? true,
        showAge: user?.privacy?.showAge ?? true,
        showGender: user?.privacy?.showGender ?? true,
        showJoinDate: user?.privacy?.showJoinDate ?? true,
      },
    });
  }, [user]);

  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
  }, []);

  useEffect(() => {
    if (user) {
      const userOrders = orders.filter(o => o.userId === user.id);
      if (userOrders.length > 0 && !selectedOrderId) {
        setSelectedOrderId(userOrders[0].id);
      }
    }
  }, [orders, user, selectedOrderId]);

  useEffect(() => {
    if (notifications.length > 0 && !selectedNotificationId) {
      setSelectedNotificationId(notifications[0].id);
    }
  }, [notifications, user, selectedNotificationId]);

  const activeCampaigns = campaigns.filter((campaign) => isCampaignCurrentlyActive(campaign));
  const selectedActiveCampaign = activeCampaigns.find((campaign) => campaign.id === user?.selectedCampaign?.campaignId) || null;
  const activeFinancialCampaign =
    selectedActiveCampaign && selectedActiveCampaign.category === 'financial' && (selectedActiveCampaign.type === 'balance_bonus' || selectedActiveCampaign.type === 'fixed_bonus')
      ? selectedActiveCampaign
      : null;
  const pointsBalance = user?.points ?? points;
  const selectCampaign = async (campaignId: string) => {
    setCampaignSelectionError('');

    try {
      await apiRequest(`/api/campaigns/select/${campaignId}`, {
        method: 'POST',
      });
      await updateUser({});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kampanya seçilemedi.';
      setCampaignSelectionError(message);
      await updateUser({});
    }
  };

  const deselectCampaign = async () => {
    setCampaignSelectionError('');

    try {
      await apiRequest('/api/campaigns/deselect', {
        method: 'POST',
      });
      await updateUser({});
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Kampanya seçimi iptal edilemedi.';
      setCampaignSelectionError(message);
      await updateUser({});
    }
  };
  const threshold = activeFinancialCampaign?.minLoadAmount || 0;
  const currentAmount = parseFloat(topUpAmount) || 0;
  const progress = threshold > 0 ? Math.min((currentAmount / threshold) * 100, 100) : 0;

  const getCampaignProductName = (campaign: Campaign) =>
    products.find((product) => product.id === campaign.targetProductId)?.name || 'Seçili Ürün';

  const getCampaignTargetLabel = (campaign: Campaign) => {
    if (campaign.targetProductId) {
      return getCampaignProductName(campaign);
    }

    if (campaign.targetCategory) {
      return `${campaign.targetCategory} Kategorisi`;
    }

    if (campaign.category === 'financial' || campaign.type === 'balance_bonus') {
      return campaign.minLoadAmount ? `Min. ₺${campaign.minLoadAmount} Yükleme` : 'Tüm Yüklemeler';
    }

    return 'Tüm Menüde Geçerli';
  };

  const getCampaignValueLabel = (campaign: Campaign) => {
    if (campaign.type === 'points_free_product') {
      return `${campaign.pointsCost || 0} KP Bedava Ürün`;
    }

    if (campaign.type === 'points_discount_product') {
      return `%${campaign.value || 0} İndirim (${campaign.pointsCost || 0} KP)`;
    }

    if (campaign.category === 'financial' || campaign.type === 'balance_bonus') {
      return `+${campaign.value}% Bonus Bakiye`;
    }

    if (campaign.discountType === 'fixed') {
      return `₺${campaign.value} İndirim`;
    }

    return `%${campaign.value} İndirim`;
  };

  const loadLoyaltyQr = async () => {
    setIsQrLoading(true);
    setQrError('');

    try {
      const payload = await apiRequest<unknown>('/api/loyalty/qr');

      if (!isLoyaltyQrPayload(payload)) {
        throw new Error(t("sadakat-servisi-beklenmeyen-bir-yanit-dondurdu-sunucuyu-yeniden-baslatin"));
      }

      setLoyaltyQr(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("sadakat-qr-kodu-olusturulamadi");
      setQrError(message);
      setLoyaltyQr(null);
    } finally {
      setIsQrLoading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    try {
      const { url } = await uploadImage('avatar', file);
      await updateUser({ avatar: url });
    } catch (error) {
      console.error('Avatar upload failed:', error);
    }
  };

  const toggleFavorite = async (productId: string) => {
    const currentFavorites = user?.favorites || [];
    const nextFavorites = currentFavorites.includes(productId)
      ? currentFavorites.filter((id) => id !== productId)
      : [...currentFavorites, productId];

    await updateUser({ favorites: nextFavorites });
  };

  const resetAddressDraft = () => {
    setAddressDraft({ id: '', title: '', details: '' });
    setIsEditingAddress(false);
  };

  const resetPaymentDraft = () => {
    setPaymentDraft({ id: '', brand: '', cardNumber: '' });
    setIsEditingPayment(false);
  };

  const saveProfileInfo = async () => {
    setIsSavingProfile(true);
    setProfileFeedback(null);
    try {
      await updateUser({
        name: profileDraft.name.trim(),
        surname: profileDraft.surname.trim(),
        username: profileDraft.username.trim(),
        bio: profileDraft.bio.trim(),
        phone: profileDraft.phone.trim(),
        email: profileDraft.email.trim(),
        birthDate: profileDraft.birthDate,
        gender: (profileDraft.gender || undefined) as any,
        socialLinks: profileDraft.socialLinks,
        privacy: profileDraft.privacy,
      });
      setProfileFeedback({ message: 'Profil bilgileriniz başarıyla kaydedildi!', type: 'success' });
      setTimeout(() => {
        setProfileFeedback(null);
        setProfileView('settings');
      }, 1200);
    } catch (err: any) {
      setProfileFeedback({ message: err.message || 'Profil bilgileri kaydedilemedi.', type: 'error' });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const editAddress = (address: Address) => {
    setAddressDraft({
      id: address.id,
      title: address.title,
      details: address.details,
    });
    setIsEditingAddress(true);
  };

  const saveAddress = async () => {
    const title = addressDraft.title.trim();
    const details = addressDraft.details.trim();

    if (!title || !details) {
      return;
    }

    const currentAddresses = user?.addresses || [];
    const nextAddresses = isEditingAddress
      ? currentAddresses.map((address) =>
          address.id === addressDraft.id ? { ...address, title, details } : address,
        )
      : [...currentAddresses, { id: Date.now().toString(), title, details }];

    await updateUser({ addresses: nextAddresses });
    resetAddressDraft();
  };

  const removeAddress = async (addressId: string) => {
    await updateUser({ addresses: (user?.addresses || []).filter((address) => address.id !== addressId) });
    if (addressDraft.id === addressId) {
      resetAddressDraft();
    }
  };

  const editPayment = (paymentMethod: PaymentMethod) => {
    setPaymentDraft({
      id: paymentMethod.id,
      brand: paymentMethod.brand,
      cardNumber: paymentMethod.last4,
    });
    setIsEditingPayment(true);
  };

  const savePayment = async () => {
    const brand = paymentDraft.brand.trim();
    const last4 = paymentDraft.cardNumber.replace(/\D/g, '').slice(-4);

    if (!brand || last4.length !== 4) {
      return;
    }

    const currentPayments = user?.paymentMethods || [];
    const payload = { id: paymentDraft.id || Date.now().toString(), type: 'card' as const, brand, last4 };
    const nextPayments = isEditingPayment
      ? currentPayments.map((paymentMethod) =>
          paymentMethod.id === paymentDraft.id ? payload : paymentMethod,
        )
      : [...currentPayments, payload];

    await updateUser({ paymentMethods: nextPayments });
    resetPaymentDraft();
  };

  const removePayment = async (paymentId: string) => {
    await updateUser({ paymentMethods: (user?.paymentMethods || []).filter((paymentMethod) => paymentMethod.id !== paymentId) });
    if (paymentDraft.id === paymentId) {
      resetPaymentDraft();
    }
  };

  const changePassword = async () => {
    if (!passwordDraft.currentPassword || !passwordDraft.newPassword || !passwordDraft.confirmPassword) {
      setPasswordFeedback('Tum alanlari doldurun.');
      return;
    }

    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordFeedback('Yeni sifreler eslesmiyor.');
      return;
    }

    setIsSavingPassword(true);
    setPasswordFeedback('');

    try {
      await apiRequest('/api/users/me/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordDraft.currentPassword,
          newPassword: passwordDraft.newPassword,
        }),
      });
      setPasswordDraft({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordFeedback('Sifre guncellendi.');
    } catch (error) {
      setPasswordFeedback(error instanceof Error ? error.message : 'Sifre guncellenemedi.');
    } finally {
      setIsSavingPassword(false);
    }
  };

  useEffect(() => {
    if (!showQR || !user) {
      setLoyaltyQr(null);
      setQrError('');
      return;
    }

    void loadLoyaltyQr();
    const intervalId = window.setInterval(() => {
      void loadLoyaltyQr();
    }, 120000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [showQR, user?.id]);

  const INGREDIENT_ICONS: Record<string, any> = {
    'Sut': Milk,
    'Süt': Milk,
    'Yumurta': Egg,
    'Un': Wheat,
    'Laktoz': Droplets,
    'Seker': Candy,
    'Şeker': Candy,
    'Gluten': Wheat,
    'Kuruyemis': Bean,
    'Kuruyemiş': Bean,
    'Kafein': Zap,
    'Nane': Leaf,
    'Aci Biber': Flame,
    'Acı Biber': Flame,
    'Elma': Apple,
    'Limon': Citrus,
    'Visne': Cherry,
    'Vişne': Cherry,
    'Muz': Banana,
    'Uzum': Grape,
    'Üzüm': Grape,
    'Cilek': Cherry,
    'Çilek': Cherry,
    'Kurabiye': Cookie,
    'Dondurma': IceCream,
    'Kahve Cekirdegi': Coffee,
    'Kahve Çekirdeği': Coffee,
    'Bal': Star,
    'Tarcin': Star,
    'Tarçın': Star,
    'Cikolata': Candy,
    'Çikolata': Candy,
    'Vanilya': Star,
    'Karamel': Candy,
    'Findik': Bean,
    'Fındık': Bean,
    'Fistik': Bean,
    'Fıstık': Bean,
    'Ceviz': Bean,
    'Badem': Bean,
    'Hindistan Cevizi': Bean,
    'Yulaf': Wheat,
    'Soya': Droplets,
    'Krema': Droplets,
    'Tereyagi': Droplets,
    'Tereyağı': Droplets,
    'Peynir': Layers,
    'Meyve': Apple,
    'Alkol': Star,
    'Zencefil': Leaf,
    'Zerdecal': Star,
    'Zerdeçal': Star,
    'Karanfil': Star,
    'Kakule': Star,
    'Susam': Star,
    'HasHas': Star,
    'Haşhaş': Star,
    'Portakal': Citrus,
    'Matcha': Leaf,
    'Kakao': Candy,
    'Balkabagi': Carrot,
    'Balik': Fish,
    'Somon': Fish,
    'Ton Baligi': Fish,
    'Tavuk': Drumstick,
    'Et': Beef,
    'Hindi': Ham,
    'Su': GlassWater,
    'Soda': CupSoda,
    'Sandvic Ekmek': Sandwich,
    'Corba Bazi': Soup,
    'Pizza Sosu': Pizza,
    'Kruvasan Hamuru': Croissant,
    'Yesillik': Salad,
    'Vegan Baz': Vegan,
  };

  const addToCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing) {
        return prev.map(item => item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (existing?.quantity === 1) {
        return prev.filter(item => item.productId !== productId);
      }
      return prev.map(item => item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item);
    });
  };

  const cartTotal = cart.reduce((total, item) => {
    const product = products.find(p => p.id === item.productId);
    return total + (product?.price || 0) * item.quantity;
  }, 0);

  const checkout = async () => {
    if (cart.length === 0) return;

    const canCheckout = isTableMode || user.balance >= cartTotal;
    if (!canCheckout) {
      alert(t("yetersiz-bakiye-lutfen-profil-sayfasindan-bakiye-yukleyin"));
      return;
    }

    const orderData = {
      userId: user.id,
      userName: user.name,
      items: cart.map(item => ({
        product: products.find(p => p.id === item.productId)!,
        quantity: item.quantity
      })),
      total: cartTotal,
      status: 'pending' as const,
      timestamp: new Date().toISOString(),
      note: orderNote.trim() || undefined
    };
    await createOrder(orderData, { couponCode: couponCode.trim() || undefined });
    setCart([]);
    setOrderNote('');
    setCouponCode('');
    setShowCartModal(false);
  };

  let content = null;

  if (activeTab === 'home') {
    content = (
      <div className="md:grid md:grid-cols-[1fr_360px] md:gap-8 md:items-start max-w-7xl mx-auto h-full">
        {/* Left Side: Category List & Products Grid */}
        <div className="p-4 sm:p-6 pb-32 md:pb-6 space-y-8 overflow-y-auto no-scrollbar">
        {/* Wallet & Loyalty - Clean Utility */}
        <section className="grid grid-cols-1 gap-4">
          <div className="bg-black text-white rounded-[32px] p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
            
            <div className="flex justify-between items-start relative z-10">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">{t("cuzdan-bakiyesi")}</p>
                <motion.p 
                  key={user?.balance}
                  initial={{ scale: 1.1, color: '#fff' }}
                  animate={{ scale: 1, color: '#fff' }}
                  className="text-4xl font-display font-bold tracking-tighter"
                >
                  ₺{user?.balance.toFixed(2)}
                </motion.p>
              </div>
              <button 
                onClick={() => {
                  setShowTopUpModal(true);
                }}
                className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform cursor-pointer"
              >
                <Plus size={24} />
              </button>
            </div>
          </div>
        </section>
        {/* Menu Section - Dynamic View */}
        <AnimatePresence mode="wait">
          {menuView === 'categories' ? (
            <motion.section 
              key="categories-grid"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setCategory('All');
                  setMenuView('products');
                }}
                className="aspect-square rounded-[40px] bg-surface border border-border flex flex-col items-center justify-center gap-4 group hover:border-black transition-all duration-500 shadow-sm hover:shadow-xl"
              >
                <div className="w-16 h-16 rounded-3xl bg-black/5 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-500">
                  <Layers size={32} strokeWidth={1.5} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.2em]">{t("tumu")}</span>
              </motion.button>

              {categories.map((cat, idx) => {
                const Icon = ICON_MAP[cat.iconName] || Coffee;
                return (
                  <motion.button
                    key={cat.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setCategory(cat.name);
                      setMenuView('products');
                    }}
                    className="aspect-square rounded-[40px] bg-surface border border-border flex flex-col items-center justify-center gap-4 group hover:border-black transition-all duration-500 shadow-sm hover:shadow-xl"
                  >
                    <div className="w-16 h-16 rounded-3xl bg-black/5 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-500">
                      <Icon size={32} strokeWidth={1.5} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-[0.2em]">{cat.name.toUpperCase()}</span>
                  </motion.button>
                );
              })}
            </motion.section>
          ) : (
            <motion.div 
              key="products-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              {/* Back & Search Header */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setMenuView('categories')}
                    className="w-12 h-12 rounded-2xl bg-surface border border-border flex items-center justify-center hover:bg-black hover:text-white transition-all"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div className="flex-1">
                    <h2 className="text-2xl font-display font-bold uppercase tracking-tight">{category === 'All' ? t("tum-urunler") : category}</h2>
                    <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{products.filter(p => (category === 'All' || p.category === category)).length} Ürün Bulundu</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                    <input 
                      type="text"
                      placeholder={t("urun-ara")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                  <button 
                    onClick={() => setShowInStockOnly(!showInStockOnly)}
                    className={cn(
                      "px-6 rounded-2xl border text-[10px] font-bold uppercase tracking-widest transition-all",
                      showInStockOnly ? "bg-black border-black text-white" : "bg-surface border-border text-text-secondary"
                    )}
                  >
                    Stokta
                  </button>
                </div>
              </div>

              {/* Menu Grid - Refined Interactive Cards */}
              <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-10">
                <AnimatePresence mode="popLayout">
                  {products
                    .filter(p => (category === 'All' || p.category === category))
                    .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                    .filter(p => !showInStockOnly || p.inStock)
                    .map(product => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        key={product.id} 
                        onClick={() => setSelectedProduct(product.id)}
                        className="group cursor-pointer flex flex-col gap-4"
                      >
                        <div className="aspect-square rounded-[32px] overflow-hidden bg-surface border border-border relative flex items-center justify-center group-hover:border-black transition-colors duration-500">
                          {product.image ? (
                            <img 
                              src={product.image} 
                              alt={product.name} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-16 h-16 rounded-full bg-black/5 flex items-center justify-center group-hover:scale-110 group-hover:bg-black group-hover:text-white transition-all duration-500">
                              <Coffee size={32} strokeWidth={1.5} />
                            </div>
                          )}

                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/[0.02] transition-colors duration-500" />
                          
                          {!product.inStock && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm">
                              <span className="bg-black text-white text-[9px] font-bold px-4 py-2 rounded-full uppercase tracking-[0.2em] shadow-lg">{t("tukendi")}</span>
                            </div>
                          )}

                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              void toggleFavorite(product.id);
                            }}
                            className="absolute left-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-white/90 text-black shadow-lg transition-colors hover:bg-black hover:text-white"
                          >
                            <Heart
                              size={16}
                              fill={user?.favorites?.includes(product.id) ? 'currentColor' : 'none'}
                            />
                          </button>

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            disabled={!product.inStock}
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product.id);
                            }}
                            className="absolute bottom-4 right-4 w-12 h-12 rounded-2xl bg-white shadow-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500 hover:bg-black hover:text-white disabled:hidden border border-border"
                          >
                            <Plus size={24} />
                          </motion.button>
                        </div>

                        <div className="space-y-1.5 px-2">
                          <div className="flex justify-between items-start">
                            <h3 className="text-[11px] font-black uppercase tracking-wider leading-tight group-hover:translate-x-1 transition-transform duration-300">{product.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13px] font-display font-bold">₺{product.price.toFixed(2)}</span>
                            <div className="h-px flex-1 bg-border/50" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                </AnimatePresence>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
        </div>

        {/* Right Area: Persistent Cart Panel (only visible on desktop) */}
        <div className="hidden md:flex flex-col bg-white rounded-[32px] border border-border p-6 shadow-[0_20px_60px_rgba(15,23,42,0.03)] sticky top-6 h-[calc(100vh-120px)] mt-6 shrink-0 w-[360px]">
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <h3 className="font-display text-base font-bold text-black flex items-center gap-2">
              <ShoppingBag size={18} />
              Sepetim
            </h3>
            {cart.length > 0 && (
              <button 
                onClick={() => setCart([])}
                className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                Temizle
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto no-scrollbar py-4 space-y-3">
            {cart.map(item => {
              const product = products.find(p => p.id === item.productId);
              if (!product) return null;
              return (
                <div key={item.productId} className="flex items-center gap-3 bg-zinc-50/50 p-3 rounded-xl border border-border/60">
                  <div className="w-12 h-12 rounded-lg bg-white border border-border flex items-center justify-center text-black shrink-0 overflow-hidden">
                    {product.image ? (
                      <img src={product.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Coffee size={18} strokeWidth={1.5} className="text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-black truncate">{product.name}</h4>
                    <p className="text-[11px] text-zinc-500 mt-0.5">₺{product.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-border/80 p-0.5 shrink-0">
                    <button 
                      onClick={() => removeFromCart(item.productId)}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-50 transition-colors cursor-pointer"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => addToCart(item.productId)}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-zinc-50 transition-colors cursor-pointer"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              );
            })}

            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-2 text-zinc-400">
                <div className="w-10 h-10 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
                  <ShoppingBag size={20} />
                </div>
                <p className="text-xs font-medium">{t("sepetiniz-bos")}</p>
                <p className="text-[10px] text-zinc-400 max-w-[200px] mx-auto">{t("eklediginiz-lezzetli-urunler-burada-gorunecektir")}</p>
              </div>
            )}
          </div>

          {/* Order Notes & Checkout */}
          {cart.length > 0 && (
            <div className="pt-4 border-t border-border space-y-4 bg-white">
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{t("kupon-kodu")}</label>
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder={t("kupon-kodu-giriniz")}
                  className="w-full p-3 rounded-xl bg-zinc-50 border border-border/80 text-xs focus:outline-none focus:border-black transition-all"
                />
                <p className="text-[10px] text-zinc-400">
                  {t("kupon-onayda-uygulanir")}
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{t("siparis-notu")}</label>
                <textarea 
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder={t("orn-sekersiz-olsun")}
                  className="w-full p-3 rounded-xl bg-zinc-50 border border-border/80 text-xs focus:outline-none focus:border-black transition-all resize-none h-16"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Toplam Tutar</span>
                <span className="text-base font-display font-black text-black">₺{cartTotal.toFixed(2)}</span>
              </div>
              <button 
                onClick={checkout}
                className="w-full py-3.5 rounded-2xl bg-black text-white font-bold text-xs shadow-lg active:scale-95 transition-transform disabled:opacity-50 cursor-pointer text-center"
              >
                {t("siparisi-onayla")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  } else if (activeTab === 'orders') {
    const userOrders = orders.filter(o => o.userId === user?.id);

    const desktopOrdersContent = (
      <div className="max-w-7xl mx-auto h-full p-4 sm:p-6 pb-32 md:pb-6 flex flex-col">
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-8 items-start">
          {/* Left Column: Orders list */}
          <div className="space-y-3 h-[calc(100vh-220px)] overflow-y-auto no-scrollbar pr-2">
            {userOrders.length === 0 ? (
              <div className="text-center py-20 space-y-4 border border-border border-dashed rounded-3xl bg-zinc-50/50">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto text-text-secondary border border-border">
                  <ShoppingBag size={20} />
                </div>
                <p className="text-text-secondary text-xs">{t("henuz-bir-siparisin-yok")}</p>
              </div>
            ) : (
              userOrders.map(order => {
                const isSelected = selectedOrderId === order.id;
                return (
                  <div 
                    key={order.id} 
                    onClick={() => setSelectedOrderId(order.id)}
                    className={cn(
                      "bg-white border rounded-2xl p-4 transition-all cursor-pointer hover:border-black/50",
                      isSelected ? "border-black ring-1 ring-black shadow-sm" : "border-border/80"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                        #{getOrderDisplayCode(order.id)}
                      </span>
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider",
                        order.status === 'pending' && "bg-amber-100 text-amber-700",
                        order.status === 'preparing' && "bg-blue-100 text-blue-700",
                        order.status === 'ready' && "bg-green-100 text-green-700",
                        order.status === 'completed' && "bg-zinc-100 text-zinc-700",
                        order.status === 'rejected' && "bg-red-100 text-red-700",
                      )}>
                        {order.status === 'pending' ? 'Bekliyor' : 
                         order.status === 'preparing' ? 'Mutfakta' : 
                         order.status === 'ready' ? t("hazir") : 
                         order.status === 'rejected' ? t("iptal") : t("tamamlandi")}
                      </span>
                    </div>

                    <p className="text-xs text-text-primary font-medium truncate mb-3">
                      {order.items.map(item => `${item.quantity}x ${item.product.name}`).join(', ')}
                    </p>

                    <div className="flex justify-between items-center text-[10px] text-text-secondary border-t border-zinc-100 pt-2.5">
                      <span>{new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="font-bold text-black text-xs">₺{order.total}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Selected Order Detail */}
          <div>
            {(() => {
              const order = userOrders.find(o => o.id === selectedOrderId);
              if (!order) {
                return (
                  <div className="h-[calc(100vh-220px)] border border-border border-dashed rounded-[32px] flex flex-col items-center justify-center text-center p-8 text-zinc-400 bg-zinc-50/20">
                    <ShoppingBag size={48} strokeWidth={1.5} className="mb-4 text-zinc-300" />
                    <h3 className="font-display text-base font-bold text-black">{t("siparis-secilmedi")}</h3>
                    <p className="text-xs max-w-xs mt-1">{t("detaylarini-goruntulemek-icin-sol-listeden-bir-siparis-secin")}</p>
                  </div>
                );
              }

              return (
                <div className="border border-border bg-white rounded-[32px] p-6 md:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.02)] h-[calc(100vh-220px)] overflow-y-auto no-scrollbar flex flex-col space-y-6">
                  <div className="flex justify-between items-start border-b border-border/80 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-display font-bold">{t("siparis-detayi")}</h2>
                        <span className="text-xs text-text-secondary uppercase">#{getOrderDisplayCode(order.id)}</span>
                      </div>
                      <p className="text-[10px] text-text-secondary mt-1 font-bold uppercase tracking-wider">
                        {new Date(order.timestamp).toLocaleDateString('tr-TR')} • {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {order.tableNumber ? (
                        <span className="bg-black text-white text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                          Masa {order.tableNumber}
                        </span>
                      ) : (
                        <span className="bg-zinc-100 border border-zinc-200 text-zinc-700 text-[9px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                          Self Servis
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress timeline */}
                  {order.status !== 'rejected' ? (
                    <div className="bg-zinc-50/50 rounded-2xl p-6 border border-border/60">
                      <div className="flex items-center justify-between relative max-w-xl mx-auto">
                        <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-zinc-200/80 -z-10" />
                        <div 
                          className="absolute left-6 top-1/2 -translate-y-1/2 h-0.5 bg-black -z-10 transition-all duration-500" 
                          style={{ 
                            width: order.status === 'pending' ? '0%' : 
                                   order.status === 'preparing' ? '33.33%' : 
                                   order.status === 'ready' ? '66.66%' : '100%' 
                          }} 
                        />
                        
                        {[
                          { id: 'pending', label: 'Bekliyor' },
                          { id: 'preparing', label: t("hazirlaniyor") },
                          { id: 'ready', label: t("hazir") },
                          { id: 'completed', label: t("tamamlandi") }
                        ].map((step, idx) => {
                          const isCurrent = order.status === step.id;
                          const isPast = ['pending', 'preparing', 'ready', 'completed'].indexOf(order.status) >= idx;
                          return (
                            <div key={step.id} className="flex flex-col items-center relative z-10 text-center">
                              <div className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all duration-300 border bg-white shadow-sm",
                                isCurrent ? "border-black bg-black text-white ring-4 ring-black/10 scale-105" : 
                                isPast ? "border-black bg-black text-white" : "border-zinc-200 text-zinc-400"
                              )}>
                                {isPast && !isCurrent ? '✓' : idx + 1}
                              </div>
                              <span className={cn("text-[9px] font-bold uppercase tracking-wider mt-2", isPast ? "text-black" : "text-zinc-400")}>
                                {step.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50/50 rounded-2xl p-5 border border-red-100 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                        <X size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-red-900 uppercase tracking-widest">{t("siparis-iptal-edildi")}</h4>
                        <p className="text-xs text-red-700/80 mt-0.5">
                          İptal Nedeni: {order.cancelReason || 'Belirtilmedi'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Order Push Notification Banner for active orders */}
                  {order.status !== 'completed' && order.status !== 'rejected' && (
                    <OrderNotificationCard orderId={order.id} />
                  )}

                  {/* Items list */}
                  <div className="flex-1 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">{t("siparis-icerigi")}</h3>
                    <div className="space-y-3 bg-zinc-50/35 border border-border/80 rounded-2xl p-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-b-0">
                          <div className="w-10 h-10 rounded-lg bg-white border border-border/60 flex items-center justify-center overflow-hidden shrink-0">
                            {item.product.image ? (
                              <img src={item.product.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Coffee size={18} strokeWidth={1.5} className="text-zinc-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-bold text-black truncate">{item.product.name}</h4>
                            <p className="text-[10px] text-zinc-500 mt-0.5">₺{item.product.price} x {item.quantity}</p>
                          </div>
                          <span className="text-xs font-bold">₺{item.product.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Applied campaign */}
                  {order.appliedCampaign?.campaignTitle && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">Uygulanan Kampanya</p>
                      <p className="mt-1 text-xs font-bold text-emerald-900">{order.appliedCampaign.campaignTitle}</p>
                      {order.appliedCampaign.campaignType === 'points_discount_product' && (
                        <p className="mt-0.5 text-[10px] text-emerald-700">
                          {order.appliedCampaign.appliedQuantity} adet üründe %{order.appliedCampaign.discountPercent || 0} indirim uygulandı.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Note */}
                  {order.note && (
                    <div className="rounded-2xl border border-border bg-zinc-50/30 p-4 space-y-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">{t("siparis-notu")}</p>
                      <p className="text-xs text-text-primary italic">"{order.note}"</p>
                    </div>
                  )}

                  {/* Summary Footer */}
                  <div className="border-t border-border/80 pt-4 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-text-secondary">{t("odeme-turu")}</span>
                      <span className="font-semibold text-text-primary">
                        {order.tableNumber ? t("masa-hesabi") : t("cuzdan-bakiyesi")}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-zinc-100 pt-3">
                      <span className="text-sm font-bold text-black">Toplam Tutar</span>
                      <span className="text-lg font-display font-black text-black">₺{order.total}</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );

    const mobileOrdersContent = (
      <>
        {ordersView === 'hub' ? (
          <div className="p-4 sm:p-6 pb-32 flex flex-col items-center justify-center min-h-[50vh] space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setOrdersView('list')}
                className="bg-surface border border-border rounded-[32px] p-8 flex flex-col items-center gap-4 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="w-16 h-16 rounded-2xl bg-black text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShoppingBag size={32} />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-display font-bold">{t("siparislerim")}</h2>
                  <p className="text-xs text-text-secondary mt-1">{userOrders.length} aktif sipariş</p>
                </div>
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowCartModal(true)}
                className="bg-surface border border-border rounded-[32px] p-8 flex flex-col items-center gap-4 shadow-sm hover:shadow-md transition-all group"
              >
                <div className="w-16 h-16 rounded-2xl bg-white border border-border text-black flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ShoppingBag size={32} />
                </div>
                <div className="text-center">
                  <h2 className="text-xl font-display font-bold">Sepetim</h2>
                  <p className="text-xs text-text-secondary mt-1">{cart.reduce((a, b) => a + b.quantity, 0)} ürün</p>
                </div>
              </motion.button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-6 pb-32 space-y-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setOrdersView('hub')}
                className="w-9 h-9 rounded-full bg-surface border border-border flex items-center justify-center cursor-pointer hover:border-black transition-colors"
                aria-label="Geri"
              >
                <ChevronRight className="rotate-180" size={18} />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Geri Dön</span>
            </div>
            <div className="space-y-4">
              {userOrders.length === 0 ? (
                <div className="text-center py-20 space-y-4">
                  <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto text-text-secondary">
                    <ShoppingBag size={32} />
                  </div>
                  <p className="text-text-secondary">{t("henuz-bir-siparisin-yok")}</p>
                </div>
              ) : (
                userOrders.map(order => (
                  <div key={order.id} className="bg-surface border border-border rounded-3xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                          #{getOrderDisplayCode(order.id)}
                        </span>
                        {order.tableNumber ? (
                          <span className="bg-black text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Masa {order.tableNumber}
                          </span>
                        ) : (
                          <span className="bg-zinc-100 text-zinc-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-zinc-200">
                            Self Servis
                          </span>
                        )}
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded-lg uppercase",
                        order.status === 'pending' && "bg-amber-100 text-amber-700",
                        order.status === 'preparing' && "bg-blue-100 text-blue-700",
                        order.status === 'ready' && "bg-green-100 text-green-700",
                        order.status === 'completed' && "bg-gray-100 text-gray-700",
                        order.status === 'rejected' && "bg-red-100 text-red-700",
                      )}>
                        {order.status === 'pending' ? 'Bekliyor' : 
                         order.status === 'preparing' ? t("hazirlaniyor") : 
                         order.status === 'ready' ? t("hazir") : 
                         order.status === 'rejected' ? 'Reddedildi' : t("tamamlandi")}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                          <span>{item.quantity}x {item.product.name}</span>
                          <span className="text-text-secondary">₺{item.product.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>
                    {order.appliedCampaign?.campaignTitle && (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Kampanya</p>
                        <p className="mt-1 text-sm font-bold text-emerald-900">{order.appliedCampaign.campaignTitle}</p>
                        {order.appliedCampaign.campaignType === 'points_discount_product' && (
                          <p className="mt-1 text-xs text-emerald-700">
                            {order.appliedCampaign.appliedQuantity} adet üründe %{order.appliedCampaign.discountPercent || 0} indirim uygulandı.
                          </p>
                        )}
                      </div>
                    )}
                    {order.status !== 'completed' && order.status !== 'rejected' && (
                      <OrderNotificationCard orderId={order.id} />
                    )}
                    {order.cancelReason && (
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">{t("iptal-nedeni")}</p>
                        <p className="mt-1 text-sm text-red-700">{order.cancelReason}</p>
                      </div>
                    )}
                    <div className="pt-3 border-t border-border/50 flex justify-between items-center">
                      <span className="text-xs text-text-secondary">{new Date(order.timestamp).toLocaleTimeString()}</span>
                      <span className="font-bold">₺{order.total}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </>
    );

    content = (
      <>
        <div className="hidden md:block h-full">{desktopOrdersContent}</div>
        <div className="md:hidden">{mobileOrdersContent}</div>
      </>
    );
  } else if (activeTab === 'notifications') {
    const desktopNotificationsContent = (
      <div className="max-w-7xl mx-auto h-full p-4 sm:p-6 pb-32 md:pb-6 flex flex-col">
        {user && notifications.length > 0 && (
          <div className="flex justify-end gap-2 mb-4">
            {notifications.some(n => !n.read) && (
              <button
                onClick={() => markAllNotificationsRead()}
                className="text-[10px] font-bold text-blue-600 uppercase tracking-widest px-3.5 py-2 rounded-xl hover:bg-blue-50 transition-colors border border-blue-200 bg-blue-50/10 cursor-pointer"
              >
                Tümünü Okundu İşaretle
              </button>
            )}
            <button
              onClick={clearNotifications}
              className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-3.5 py-2 rounded-xl hover:bg-red-50 transition-colors border border-red-200 bg-red-50/10 cursor-pointer"
            >
              {t("tumunu-sil")}
            </button>
          </div>
        )}

        {/* C8: push-abonelik kartı liste akışından çıkarıldı — sekme başlığı
            altında statik durur, her poll'da yeniden mount olmaz. */}
        <div className="mb-4 shrink-0">
          <OrderNotificationCard />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-8 items-start">
          {/* Left Column: Notifications List */}
          <div className="space-y-3 h-[calc(100vh-220px)] overflow-y-auto no-scrollbar pr-2">
            {(!user || notifications.length === 0) ? (
              <div className="text-center py-20 space-y-4 border border-border border-dashed rounded-3xl bg-zinc-50/50">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto text-text-secondary border border-border">
                  <Bell size={20} />
                </div>
                <p className="text-text-secondary text-xs">{t("henuz-bir-bildirim-yok")}</p>
              </div>
            ) : (
              notifications.map(n => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  isSelected={selectedNotificationId === n.id}
                  onSelect={handleNotificationSelect}
                />
              ))
            )}
          </div>

          {/* Right Column: Notification Details */}
          <div>
            {(() => {
              const n = notifications.find(notif => notif.id === selectedNotificationId);
              if (!n) {
                return (
                  <div className="h-[calc(100vh-220px)] border border-border border-dashed rounded-[32px] flex flex-col items-center justify-center text-center p-8 text-zinc-400 bg-zinc-50/20">
                    <Bell size={48} strokeWidth={1.5} className="mb-4 text-zinc-300" />
                    <h3 className="font-display text-base font-bold text-black">{t("bildirim-secilmedi")}</h3>
                    <p className="text-xs max-w-xs mt-1">{t("detaylarini-goruntulemek-icin-sol-listeden-bir-bildirim-secin")}</p>
                  </div>
                );
              }

              return (
                <div className="border border-border bg-white rounded-[32px] p-6 md:p-8 shadow-[0_20px_60px_rgba(15,23,42,0.02)] h-[calc(100vh-220px)] overflow-y-auto no-scrollbar flex flex-col space-y-6">
                  <div className="flex justify-between items-start border-b border-border/80 pb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                        n.type === 'success' ? "bg-green-50 text-green-600 border-green-100" : 
                        n.type === 'warning' ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-blue-50 text-blue-600 border-blue-100"
                      )}>
                        <Bell size={20} />
                      </div>
                      <div>
                        <h2 className="text-lg font-display font-bold text-black leading-snug">{n.title}</h2>
                        <p className="text-[10px] text-text-secondary mt-1 font-bold uppercase tracking-wider">
                          {new Date(n.timestamp).toLocaleDateString('tr-TR')} • {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => deleteNotification(n.id)}
                      className="p-2.5 rounded-xl border border-red-150 hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
                      title="Bildirimi Sil"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex-1">
                    <p className="text-sm text-text-primary leading-relaxed bg-zinc-50/50 rounded-2xl p-6 border border-border/40 min-h-[120px]">
                      {n.message}
                    </p>
                  </div>

                  <div className="border-t border-border/80 pt-4 flex justify-end">
                    <button 
                      onClick={() => setSelectedNotificationId(null)}
                      className="px-5 py-2.5 rounded-xl border border-border text-xs font-bold uppercase tracking-wider hover:bg-zinc-50 cursor-pointer"
                    >
                      Okundu Olarak Kapat
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );

    const mobileNotificationsContent = (
      <div className="p-4 sm:p-6 pb-32 space-y-4">
        {user && notifications.length > 0 && (
          <div className="flex justify-end">
            <button
              onClick={clearNotifications}
              className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors border border-red-200 bg-red-50/10 cursor-pointer"
            >
              {t("tumunu-sil")}
            </button>
          </div>
        )}
        {/* C8: push-abonelik kartı listenin üstünde statik — scroll akışına
            gömülü değildir, her poll'da yeniden mount olmaz. */}
        <div className="shrink-0">
          <OrderNotificationCard />
        </div>
        <div className="space-y-3">
          {(!user || notifications.length === 0) ? (
            <div className="text-center py-20 space-y-4">
              <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto text-text-secondary">
                <Bell size={32} />
              </div>
              <p className="text-text-secondary">{t("henuz-bir-bildirim-yok")}</p>
            </div>
          ) : (
            notifications.map(n => (
              <MobileNotificationItem key={n.id} notification={n} onRead={markNotificationRead} />
            ))
          )}
        </div>
      </div>
    );

    content = (
      <>
        <div className="hidden md:block h-full">{desktopNotificationsContent}</div>
        <div className="md:hidden">{mobileNotificationsContent}</div>
      </>
    );
  } else if (activeTab === 'campaigns') {
    const discountCampaigns = activeCampaigns.filter(
      c => c.category === 'discount' || c.type === 'discount' || c.category === 'operational'
    );
    const financialCampaigns = activeCampaigns.filter(
      c => c.category === 'financial' || c.type === 'balance_bonus' || c.type === 'fixed_bonus'
    );
    const loyaltyCampaignsList = activeCampaigns.filter(
      c => c.category === 'loyalty' || c.type === 'points_free_product' || c.type === 'points_discount_product' || c.type === 'point_reward'
    );

    const filteredCampaignsList = customerCampaignTab === 'discount'
      ? discountCampaigns
      : customerCampaignTab === 'financial'
        ? financialCampaigns
        : customerCampaignTab === 'loyalty'
          ? loyaltyCampaignsList
          : activeCampaigns;

    content = (
      <div className="max-w-6xl mx-auto h-full p-4 sm:p-6 pb-32 md:pb-8 space-y-6">
        {campaignSelectionError && (
          <motion.div 
            initial={{ opacity: 0, y: -8 }} 
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-neutral-100 p-4 text-xs font-semibold text-black flex items-center justify-between"
          >
            <span>{campaignSelectionError}</span>
            <button onClick={() => setCampaignSelectionError('')} className="p-1 hover:bg-neutral-200 rounded-lg cursor-pointer">
              <X size={14} />
            </button>
          </motion.div>
        )}

        {/* Top Hero: Minimalist Matte Black KP Loyalty Card */}
        <div className="rounded-[28px] bg-neutral-950 text-white p-6 sm:p-7 border border-neutral-800 space-y-4 shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400">Bancho Club Sadakat</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl sm:text-4xl font-display font-extrabold tracking-tight text-white">{pointsBalance}</span>
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">KP</span>
            </div>
          </div>
        </div>

        {/* Selected Active Campaign Alert (If Any) */}
        {selectedActiveCampaign && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-neutral-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary bg-neutral-200/70 px-2 py-0.5 rounded-md">
                    Seçili Kampanya
                  </span>
                  <span className="text-xs font-bold text-black">{selectedActiveCampaign.title}</span>
                </div>
                <p className="text-[11px] text-text-secondary mt-0.5">{selectedActiveCampaign.description}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={deselectCampaign}
              className="px-3.5 py-1.5 rounded-xl border border-border bg-white hover:bg-neutral-100 text-black text-xs font-bold transition-colors cursor-pointer self-end sm:self-center"
            >
              Seçimi Kaldır
            </button>
          </motion.div>
        )}

        {/* Section Controls Bar with Filter Dropdown */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-black">Mevcut Fırsatlar</span>
            <span className="text-[11px] font-mono text-text-secondary bg-neutral-100 px-2 py-0.5 rounded-md">
              {filteredCampaignsList.length}
            </span>
          </div>

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCampaignFilterOpen(prev => !prev)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border text-xs font-bold hover:border-black/50 transition-colors cursor-pointer"
            >
              <Filter size={13} className="text-text-secondary" />
              <span className="text-black">
                {customerCampaignTab === 'all' && `Tümü (${activeCampaigns.length})`}
                {customerCampaignTab === 'discount' && `İndirimler (${discountCampaigns.length})`}
                {customerCampaignTab === 'financial' && `Cüzdan Bonusları (${financialCampaigns.length})`}
                {customerCampaignTab === 'loyalty' && `Puan Ödülleri (${loyaltyCampaignsList.length})`}
              </span>
              <ChevronDown size={13} className={cn("text-text-secondary transition-transform duration-200", isCampaignFilterOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
              {isCampaignFilterOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-20" 
                    onClick={() => setIsCampaignFilterOpen(false)} 
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-white border border-border rounded-2xl shadow-xl p-1.5 z-30 space-y-0.5"
                  >
                    {[
                      { id: 'all', label: 'Tüm Fırsatlar', count: activeCampaigns.length, icon: Gift },
                      { id: 'discount', label: 'İndirimler', count: discountCampaigns.length, icon: Tag },
                      { id: 'financial', label: 'Cüzdan Bonusları', count: financialCampaigns.length, icon: CreditCard },
                      { id: 'loyalty', label: 'Puan Ödülleri', count: loyaltyCampaignsList.length, icon: Star },
                    ].map(opt => {
                      const isSelected = customerCampaignTab === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setCustomerCampaignTab(opt.id as any);
                            setIsCampaignFilterOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer text-left",
                            isSelected 
                              ? "bg-black text-white" 
                              : "text-neutral-700 hover:bg-neutral-100"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <opt.icon size={13} className={isSelected ? "text-white" : "text-neutral-400"} />
                            <span>{opt.label}</span>
                          </div>
                          <span className={cn(
                            "text-[10px] font-mono px-1.5 py-0.5 rounded-md",
                            isSelected ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-500"
                          )}>
                            {opt.count}
                          </span>
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Campaign Cards Grid */}
        {filteredCampaignsList.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-border bg-surface p-12 text-center space-y-2">
            <Gift size={28} className="mx-auto text-text-secondary/40" />
            <h3 className="text-sm font-bold text-black">Bu Kategoride Kampanya Bulunmuyor</h3>
            <p className="text-xs text-text-secondary max-w-xs mx-auto">
              Seçtiğiniz filtreye ait aktif bir fırsat yok. Diğer sekmelere göz atabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCampaignsList.map((camp: Campaign) => {
              const isSelected = user?.selectedCampaign?.campaignId === camp.id;
              const isFinancial = camp.category === 'financial' || camp.type === 'balance_bonus' || camp.type === 'fixed_bonus';
              const isLoyalty = camp.category === 'loyalty' || camp.type === 'points_free_product' || camp.type === 'points_discount_product' || camp.type === 'point_reward';

              const pointsCost = camp.pointsCost || 0;
              const hasEnoughPoints = pointsBalance >= pointsCost;

              const categoryBadge = isFinancial
                ? { label: 'Cüzdan Bonusu', icon: CreditCard }
                : isLoyalty
                  ? { label: 'KP Ödülü', icon: Star }
                  : { label: 'İndirim', icon: Tag };

              const perkBadge = isFinancial
                ? `+${camp.value}% Bonus`
                : isLoyalty
                  ? (camp.type === 'points_discount_product' || (camp.value && camp.value > 0))
                    ? `%${camp.value} İndirim`
                    : 'Hediye Ürün'
                  : (camp.discountType === 'fixed' ? `-₺${camp.value}` : `-%${camp.value}`);

              return (
                <motion.div
                  key={camp.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "rounded-[24px] border overflow-hidden bg-surface transition-all flex flex-col justify-between group hover:border-black/50 hover:shadow-md",
                    isSelected ? "border-black ring-1 ring-black bg-white shadow-sm" : "border-border"
                  )}
                >
                  {/* Card Top Banner / Image */}
                  <div className="relative w-full h-40 bg-neutral-100 overflow-hidden border-b border-border">
                    {camp.image ? (
                      <img 
                        src={camp.image} 
                        alt={camp.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400">
                        <categoryBadge.icon size={32} className="opacity-30" />
                      </div>
                    )}

                    {/* Overlay Badges */}
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border border-border bg-white/90 text-neutral-800 shadow-sm backdrop-blur-sm flex items-center gap-1">
                        <categoryBadge.icon size={11} />
                        {categoryBadge.label}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-tight shadow-sm bg-black text-white">
                        {perkBadge}
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <h3 className="text-sm font-bold text-black leading-snug line-clamp-1">{camp.title}</h3>
                      <p className="text-xs text-text-secondary leading-relaxed line-clamp-2">{camp.description}</p>
                    </div>

                    {/* Metadata & Progress */}
                    <div className="space-y-3 pt-1">
                      {/* Loyalty Progress for KP cards */}
                      {isLoyalty && !hasEnoughPoints && (
                        <div className="space-y-1.5 p-3 rounded-xl bg-neutral-100 border border-neutral-200">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="font-medium text-neutral-600">KP İlerlemesi</span>
                            <span className="font-bold text-black font-mono">{pointsBalance} / {pointsCost} KP</span>
                          </div>
                          <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-black rounded-full"
                              style={{ width: `${Math.min(100, (pointsBalance / pointsCost) * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-neutral-600 block">
                            Bu ödül için {pointsCost - pointsBalance} KP daha gerekli
                          </span>
                        </div>
                      )}

                      {/* Detail Chips */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-2 border-t border-dashed border-border text-text-secondary">
                        <span className="font-medium text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded-md truncate max-w-[150px]">
                          {getCampaignTargetLabel(camp)}
                        </span>
                        <span>Son: {new Date(camp.expiryDate).toLocaleDateString('tr-TR')}</span>
                      </div>
                    </div>

                    {/* CTA Actions */}
                    <div className="pt-1">
                      {isFinancial ? (
                        <button
                          type="button"
                          onClick={() => {
                            setTopUpAmount(String(camp.minLoadAmount || 200));
                            setShowTopUpModal(true);
                          }}
                          className="w-full py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <CreditCard size={14} />
                          Bakiye Yükle & Bonus Kazan
                        </button>
                      ) : isLoyalty ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!hasEnoughPoints}
                            onClick={() => {
                              if (isSelected) {
                                void deselectCampaign();
                              } else {
                                void selectCampaign(camp.id);
                              }
                            }}
                            className={cn(
                              "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 border",
                              isSelected
                                ? "bg-neutral-100 text-black border-black"
                                : !hasEnoughPoints
                                  ? "bg-neutral-100 text-neutral-400 cursor-not-allowed border-neutral-200"
                                  : "bg-black hover:bg-neutral-800 text-white border-black"
                            )}
                          >
                            <Star size={13} className={hasEnoughPoints ? "fill-white" : ""} />
                            {isSelected 
                              ? 'Seçimi Kaldır' 
                              : !hasEnoughPoints 
                                ? `${pointsCost} KP Gerekli` 
                                : `Ödülü Kullan (${pointsCost} KP)`}
                          </button>
                          {isSelected && (
                            <button
                              type="button"
                              onClick={() => setShowQR(true)}
                              className="px-3 rounded-xl border border-black bg-black text-white hover:bg-neutral-800 transition-colors cursor-pointer flex items-center justify-center"
                              title="Karekodumu Göster"
                            >
                              <QrCode size={15} />
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              void deselectCampaign();
                            } else {
                              void selectCampaign(camp.id);
                            }
                          }}
                          className={cn(
                            "w-full py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 border",
                            isSelected
                              ? "bg-neutral-100 text-black border-black"
                              : "bg-black hover:bg-neutral-800 text-white border-black"
                          )}
                        >
                          <Tag size={13} />
                          {isSelected ? 'Seçimi Kaldır' : 'Kampanyayı Seç'}
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    );
  } else if (activeTab === 'profile') {
    const effectiveProfileView = (profileView === 'main' || profileView === 'settings') ? 'profile-info' : profileView;

    const sidebarMenuItems = [
      { id: 'profile-info', label: 'Ayarlar & Profil Bilgileri', icon: Settings },
      { id: 'friends-gifts', label: 'Arkadaşlar & Hediyeler', icon: Users },
      { id: 'reservations', label: 'Masa Rezervasyonu', icon: CalendarDays },
      { id: 'change-password', label: t("sifre-degistir"), icon: Shield },
      { id: 'addresses', label: 'Adreslerim', icon: MapPin },
      { id: 'payments', label: t("odeme-yontemleri"), icon: CreditCard },
      { id: 'favorites', label: t("favori-urunler"), icon: Heart },
      { id: 'orders-history', label: t("gecmis-siparislerim"), icon: ShoppingBag },
      { id: 'topups-history', label: t("bakiye-gecmisi"), icon: Wallet },
      { id: 'policies', label: 'Politikalar', icon: Shield },
      { id: 'about', label: t("hakkimizda"), icon: Star },
    ];

    let rightPanelContent = null;
    if (effectiveProfileView === 'friends-gifts') {
      rightPanelContent = (
        <div className="bg-white border border-border rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-display font-bold text-black">Arkadaşlar & Hediyeler</h2>
            <p className="text-xs text-text-secondary mt-1">Arkadaş ekleyin, bakiye hediyesi gönderin ve alın.</p>
          </div>
          <FriendsGiftsPanel />
        </div>
      );
    } else if (effectiveProfileView === 'reservations') {
      rightPanelContent = (
        <div className="bg-white border border-border rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-display font-bold text-black">Masa Rezervasyonu</h2>
            <p className="text-xs text-text-secondary mt-1">Masanızı önceden ayırtın; onayı personelden gelir.</p>
          </div>
          <ReservationPanel />
        </div>
      );
    } else if (effectiveProfileView === 'profile-info') {
      rightPanelContent = (
        <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm space-y-6">
          <div className="border-b border-border pb-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-display font-bold text-black">Profil Bilgileri & Ayarlar</h2>
              <p className="text-xs text-text-secondary mt-1">{t("kisisel-bilgilerinizi-guncelleyin-ve-avatarinizi-yonetin")}</p>
            </div>
            {user?.id && (
              <button
                type="button"
                onClick={() => setViewingUserProfileId(user.id)}
                className="px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-neutral-200/60"
              >
                <UserIcon size={14} />
                <span>Profilimi Gör</span>
              </button>
            )}
          </div>
          <div className="space-y-6">
            <div className="flex flex-col items-center py-2">
              <div className="w-24 h-24 rounded-[36px] bg-surface border border-border p-1 relative group">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full rounded-[32px] object-cover" />
                ) : (
                  <div className="w-full h-full rounded-[32px] bg-black text-white flex items-center justify-center text-3xl font-bold">
                    {user?.name?.[0] || '?'}
                  </div>
                )}
                <label className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shadow-lg cursor-pointer hover:bg-zinc-800 transition-colors">
                  <Edit2 size={14} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
              </div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mt-3">Profil Fotoğrafı</p>
            </div>

            {/* Username */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Kullanıcı Adı (@)</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 font-mono font-bold text-sm text-neutral-400">@</span>
                <input 
                  type="text" 
                  value={profileDraft.username}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  placeholder="kullanici_adi"
                  maxLength={20}
                  className="w-full p-4 pl-9 rounded-2xl bg-surface border border-border text-sm font-mono focus:outline-none focus:border-black transition-all"
                />
              </div>
              <p className="text-[10px] text-neutral-400 ml-1">Sıralamalarda ve profilinizde görünecek adınız (örn: @yusuf).</p>
            </div>

            {/* Name & Surname */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Ad</label>
                <input 
                  type="text" 
                  value={profileDraft.name}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, name: e.target.value }))}
                  className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Soyad</label>
                <input 
                  type="text" 
                  value={profileDraft.surname}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, surname: e.target.value }))}
                  className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-all"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Biyografi (Hakkımda)</label>
              <textarea 
                rows={2}
                value={profileDraft.bio}
                onChange={(e) => setProfileDraft((current) => ({ ...current, bio: e.target.value.slice(0, 160) }))}
                placeholder="Kendinizden kısaca bahsedin..."
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black resize-none transition-all"
              />
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Telefon</label>
                <input 
                  type="tel" 
                  value={profileDraft.phone}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, phone: e.target.value }))}
                  className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">E-posta</label>
                <input 
                  type="email" 
                  value={profileDraft.email}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, email: e.target.value }))}
                  className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-all"
                />
              </div>
            </div>

            {/* BirthDate & Gender */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("dogum-tarihi")}</label>
                <input 
                  type="date" 
                  value={profileDraft.birthDate}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, birthDate: e.target.value }))}
                  className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Cinsiyet</label>
                <select
                  value={profileDraft.gender || ''}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, gender: (e.target.value || '') as any }))}
                  className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-all cursor-pointer"
                >
                  <option value="">Belirtmek İstemiyorum</option>
                  <option value="male">Erkek</option>
                  <option value="female">Kadın</option>
                </select>
              </div>
            </div>

            {/* Social Media Accounts */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-black" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-black">Sosyal Medya Hesapları</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Instagram</label>
                  <input
                    type="text"
                    placeholder="@kullanici_adi"
                    value={profileDraft.socialLinks.instagram}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      socialLinks: { ...curr.socialLinks, instagram: e.target.value }
                    }))}
                    className="w-full p-3.5 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">X (Twitter)</label>
                  <input
                    type="text"
                    placeholder="@kullanici_adi"
                    value={profileDraft.socialLinks.twitter}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      socialLinks: { ...curr.socialLinks, twitter: e.target.value }
                    }))}
                    className="w-full p-3.5 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">LinkedIn</label>
                  <input
                    type="text"
                    placeholder="profil linki veya ad"
                    value={profileDraft.socialLinks.linkedin}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      socialLinks: { ...curr.socialLinks, linkedin: e.target.value }
                    }))}
                    className="w-full p-3.5 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">GitHub</label>
                  <input
                    type="text"
                    placeholder="kullanici_adi"
                    value={profileDraft.socialLinks.github}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      socialLinks: { ...curr.socialLinks, github: e.target.value }
                    }))}
                    className="w-full p-3.5 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Kişisel Web Sitesi</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={profileDraft.socialLinks.website}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      socialLinks: { ...curr.socialLinks, website: e.target.value }
                    }))}
                    className="w-full p-3.5 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                  />
                </div>
              </div>
            </div>

            {/* Privacy & Visibility Settings */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-black" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-black">Gizlilik & Paylaşım Tercihleri</h4>
              </div>
              <p className="text-[11px] text-neutral-500">Profilinizde başkalarının görebileceği bilgileri özelleştirin.</p>
              
              <div className="space-y-2">
                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Profili Herkese Gizle</span>
                    <span className="text-[10px] text-neutral-500">Sadece sizi takip eden kullanıcılar profil detaylarınızı görebilir</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.isProfilePrivate}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, isProfilePrivate: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Kahve Puanımı Göster</span>
                    <span className="text-[10px] text-neutral-500">Profilinizde kazandığınız toplam KP puanı gösterilsin</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.showKp}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, showKp: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Sosyal Medya Hesaplarımı Göster</span>
                    <span className="text-[10px] text-neutral-500">Eklediğiniz sosyal linkler profilinizde herkese açık olsun</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.showSocials}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, showSocials: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Yaşımı Göster</span>
                    <span className="text-[10px] text-neutral-500">Doğum tarihinizden hesaplanan yaşınız profilinizde yer alsın</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.showAge}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, showAge: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Cinsiyetimi Göster</span>
                    <span className="text-[10px] text-neutral-500">Seçtiğiniz cinsiyet bilgisi profilinizde gösterilsin</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.showGender}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, showGender: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Katılma Tarihimi Göster</span>
                    <span className="text-[10px] text-neutral-500">Kayıt olduğunuz ay ve yıl profilinizde görüntülensin</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.showJoinDate}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, showJoinDate: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {profileFeedback && (
              <div
                className={`p-4 rounded-2xl text-xs font-semibold text-center border transition-all ${
                  profileFeedback.type === 'success'
                    ? 'bg-neutral-100 text-black border-neutral-300'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}
              >
                {profileFeedback.message}
              </div>
            )}

            <button 
              onClick={() => {
                void saveProfileInfo();
              }}
              disabled={isSavingProfile}
              className="w-full py-4 rounded-2xl bg-black text-white hover:bg-zinc-800 font-bold text-sm transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              {isSavingProfile ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      );
    } else if (effectiveProfileView === 'change-password') {
      rightPanelContent = (
        <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-display font-bold text-black">{t("sifre-degistir")}</h2>
            <p className="text-xs text-text-secondary mt-1">Hesabınızın güvenliği için güçlü bir şifre belirleyin.</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("mevcut-sifre")}</label>
              <input 
                type="password" 
                value={passwordDraft.currentPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, currentPassword: event.target.value }))}
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-all"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("yeni-sifre")}</label>
              <input 
                type="password" 
                value={passwordDraft.newPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, newPassword: event.target.value }))}
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-all"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("yeni-sifre-tekrar")}</label>
              <input 
                type="password" 
                value={passwordDraft.confirmPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-all"
                placeholder="••••••••"
              />
            </div>

            {passwordFeedback && (
              <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
                {passwordFeedback}
              </div>
            )}

            <button 
              onClick={() => {
                void changePassword();
              }}
              className="w-full py-4 rounded-2xl bg-black text-white hover:bg-zinc-800 font-bold text-sm transition-all cursor-pointer"
            >
              {isSavingPassword ? t("guncelleniyor") : t("sifreyi-guncelle")}
            </button>
          </div>
        </div>
      );
    } else if (effectiveProfileView === 'addresses') {
      rightPanelContent = (
        <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-display font-bold text-black">Adreslerim</h2>
            <p className="text-xs text-text-secondary mt-1">Siparişleriniz için kayıtlı adres bilgilerinizi yönetin.</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start">
            <div className="space-y-4">
              {(user?.addresses || []).map(addr => (
                <div key={addr.id} className="bg-surface border border-border rounded-2xl p-5 flex items-start justify-between hover:border-black transition-all">
                  <div className="space-y-1">
                    <p className="font-bold text-sm">{addr.title}</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{addr.details}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button onClick={() => editAddress(addr)} className="text-text-secondary hover:text-black p-1"><Edit2 size={16} /></button>
                    <button 
                      onClick={() => {
                        void removeAddress(addr.id);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}

              {(user?.addresses || []).length === 0 && (
                <div className="text-center py-16 border border-dashed border-border rounded-2xl text-text-secondary text-xs">
                  Kayıtlı adresiniz bulunmuyor. Sağdaki formu kullanarak yeni bir adres ekleyebilirsiniz.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-zinc-50/50 p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-black uppercase tracking-wider">{isEditingAddress ? t("adresi-duzenle") : 'Yeni Adres Ekle'}</p>
                <p className="text-[10px] text-text-secondary">Teslimat adres bilgilerinizi giriniz.</p>
              </div>
              <input
                type="text"
                value={addressDraft.title}
                onChange={(event) => setAddressDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Adres başlığı (örn. Ev, Ofis)"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-xs focus:outline-none focus:border-black"
              />
              <textarea
                value={addressDraft.details}
                onChange={(event) => setAddressDraft((current) => ({ ...current, details: event.target.value }))}
                placeholder="Mahalle, sokak, bina no, daire, şehir"
                className="h-24 w-full resize-none rounded-xl border border-border bg-white px-4 py-3 text-xs focus:outline-none focus:border-black"
              />
              <div className="flex gap-3">
                {isEditingAddress && (
                  <button
                    onClick={resetAddressDraft}
                    className="flex-1 rounded-xl border border-border bg-white py-3 text-xs font-bold transition-all cursor-pointer"
                  >
                    {t("vazgec")}
                  </button>
                )}
                <button
                  onClick={() => {
                    void saveAddress();
                  }}
                  className="flex-1 rounded-xl bg-black py-3 text-xs font-bold text-white hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  {isEditingAddress ? 'Kaydet' : 'Ekle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (effectiveProfileView === 'payments') {
      rightPanelContent = (
        <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-display font-bold text-black">{t("odeme-yontemleri")}</h2>
            <p className="text-xs text-text-secondary mt-1">Siparişlerinizi hızlıca ödemek için kartlarınızı kaydedin.</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-8 items-start">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(user?.paymentMethods || []).map(pm => (
                <div key={pm.id} className="relative overflow-hidden rounded-2xl bg-zinc-950 text-white p-5 h-44 flex flex-col justify-between shadow-md border border-white/5 group transition-all">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl pointer-events-none" />
                  
                  <div className="flex justify-between items-start z-10">
                    <div>
                      <span className="block text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Kredi Kartı</span>
                      <span className="block text-xs font-bold uppercase tracking-wider text-white mt-0.5">{pm.brand}</span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/5">
                      <CreditCard size={16} />
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-base font-display font-medium tracking-[0.25em]">•••• •••• •••• {pm.last4}</span>
                  </div>
                  
                  <div className="flex justify-between items-end z-10 border-t border-white/10 pt-3">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Bancho Cafe</span>
                    <div className="flex gap-2">
                      <button onClick={() => editPayment(pm)} className="text-zinc-400 hover:text-white p-1 transition-colors"><Edit2 size={14} /></button>
                      <button 
                        onClick={() => {
                          void removePayment(pm.id);
                        }}
                        className="text-red-400 hover:text-red-300 p-1 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {(user?.paymentMethods || []).length === 0 && (
                <div className="col-span-2 text-center py-16 border border-dashed border-border rounded-2xl text-text-secondary text-xs">
                  Kayıtlı ödeme yönteminiz bulunmuyor. Sağdaki formu kullanarak yeni bir kart ekleyebilirsiniz.
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-zinc-50/50 p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-black uppercase tracking-wider">{isEditingPayment ? t("karti-duzenle") : 'Yeni Kart Ekle'}</p>
                <p className="text-[10px] text-text-secondary">Kart bilgilerinizi giriniz.</p>
              </div>
              <input
                type="text"
                value={paymentDraft.brand}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, brand: event.target.value }))}
                placeholder="Kart markası (örn. Visa, MasterCard)"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-xs focus:outline-none focus:border-black"
              />
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={paymentDraft.cardNumber}
                onChange={(event) =>
                  setPaymentDraft((current) => ({
                    ...current,
                    cardNumber: event.target.value.replace(/\D/g, '').slice(-4),
                  }))
                }
                placeholder="Son 4 hane"
                className="w-full rounded-xl border border-border bg-white px-4 py-3 text-xs focus:outline-none focus:border-black"
              />
              <div className="flex gap-3">
                {isEditingPayment && (
                  <button
                    onClick={resetPaymentDraft}
                    className="flex-1 rounded-xl border border-border bg-white py-3 text-xs font-bold transition-all cursor-pointer"
                  >
                    {t("vazgec")}
                  </button>
                )}
                <button
                  onClick={() => {
                    void savePayment();
                  }}
                  className="flex-1 rounded-xl bg-black py-3 text-xs font-bold text-white hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  {isEditingPayment ? 'Kaydet' : 'Ekle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    } else if (effectiveProfileView === 'favorites') {
      const favoriteProducts = products.filter(p => user?.favorites?.includes(p.id));
      rightPanelContent = (
        <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-display font-bold text-black">{t("favori-urunler")}</h2>
            <p className="text-xs text-text-secondary mt-1">Kalp eklediğiniz ve en çok sevdiğiniz lezzetler.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {favoriteProducts.map(product => (
              <motion.div 
                key={product.id}
                layoutId={`fav-${product.id}`}
                onClick={() => setSelectedProduct(product.id)}
                className="bg-surface border border-border rounded-3xl overflow-hidden group hover:border-black transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="aspect-square relative overflow-hidden bg-neutral-100 flex items-center justify-center">
                  {product.image ? (
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Coffee size={32} className="text-zinc-400" />
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleFavorite(product.id);
                    }}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-red-500 shadow-sm hover:scale-110 transition-transform cursor-pointer"
                  >
                    <Heart size={14} fill="currentColor" />
                  </button>
                </div>
                <div className="p-4 space-y-1">
                  <h3 className="font-bold text-xs truncate uppercase tracking-wider text-black">{product.name}</h3>
                  <p className="text-sm font-display font-bold text-zinc-900">₺{product.price}</p>
                </div>
              </motion.div>
            ))}

            {favoriteProducts.length === 0 && (
              <div className="col-span-full text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto text-text-secondary border border-border">
                  <Heart size={24} />
                </div>
                <p className="text-text-secondary text-sm font-medium">{t("henuz-favori-urununuz-yok")}</p>
              </div>
            )}
          </div>
        </div>
      );
    } else if (effectiveProfileView === 'orders-history') {
      const userOrders = orders.filter(o => o.userId === user?.id);
      rightPanelContent = (
        <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-display font-bold text-black">{t("gecmis-siparislerim")}</h2>
            <p className="text-xs text-text-secondary mt-1">Şimdiye kadar verdiğiniz siparişlerin tam geçmişi.</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {userOrders.length === 0 ? (
              <div className="col-span-full text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto text-text-secondary border border-border">
                  <ShoppingBag size={24} />
                </div>
                <p className="text-text-secondary text-sm">{t("henuz-bir-siparisiniz-bulunmuyor")}</p>
              </div>
            ) : (
              userOrders.map(order => (
                <div key={order.id} className="bg-surface border border-border rounded-2xl p-5 space-y-4 hover:border-black/50 transition-colors flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                            #{getOrderDisplayCode(order.id)}
                          </span>
                          {order.tableNumber ? (
                            <span className="bg-black text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Masa {order.tableNumber}
                            </span>
                          ) : (
                            <span className="bg-zinc-100 text-zinc-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-zinc-200">
                              Self Servis
                            </span>
                          )}
                        </div>
                        <span className="block text-[10px] text-text-secondary">
                          {new Date(order.timestamp).toLocaleDateString('tr-TR')} • {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase",
                        order.status === 'pending' && "bg-amber-100 text-amber-700",
                        order.status === 'preparing' && "bg-blue-100 text-blue-700",
                        order.status === 'ready' && "bg-green-100 text-green-700",
                        order.status === 'completed' && "bg-gray-100 text-gray-700",
                        order.status === 'rejected' && "bg-red-100 text-red-700",
                      )}>
                        {order.status === 'pending' ? 'Bekliyor' : 
                         order.status === 'preparing' ? t("hazirlaniyor") : 
                         order.status === 'ready' ? t("hazir") : 
                         order.status === 'rejected' ? 'Reddedildi' : t("tamamlandi")}
                      </span>
                    </div>

                    <div className="space-y-2 border-t border-border/40 pt-3">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                          <span className="text-text-secondary"><strong className="text-black font-semibold">{item.quantity}x</strong> {item.product.name}</span>
                          <span className="text-text-secondary">₺{item.product.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {order.appliedCampaign?.campaignTitle && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-700">Kampanya</p>
                        <p className="mt-0.5 text-xs font-bold text-emerald-900">{order.appliedCampaign.campaignTitle}</p>
                      </div>
                    )}

                    {order.cancelReason && (
                      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-red-600">{t("iptal-nedeni")}</p>
                        <p className="mt-0.5 text-xs text-red-700">{order.cancelReason}</p>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border/50 flex justify-between items-center bg-transparent">
                    <span className="text-xs font-bold text-text-secondary">Toplam</span>
                    <span className="font-bold text-base text-black">₺{order.total}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    } else if (effectiveProfileView === 'topups-history') {
      const topups = balanceTopUps.filter(t => t.amount > 0);
      rightPanelContent = (
        <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-display font-bold text-black">{t("bakiye-gecmisi")}</h2>
            <p className="text-xs text-text-secondary mt-1">Cüzdanınıza yaptığınız bakiye yüklemeleri.</p>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {topups.length === 0 ? (
              <div className="col-span-full text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto text-text-secondary border border-border">
                  <Wallet size={24} />
                </div>
                <p className="text-text-secondary text-sm">{t("henuz-bakiye-yuklemesi-bulunmuyor")}</p>
              </div>
            ) : (
              topups.map(topup => (
                <div key={topup.id} className="bg-surface border border-border rounded-2xl p-5 flex items-center justify-between hover:border-black/50 transition-colors">
                  <div className="space-y-1">
                    <span className="block text-sm font-bold text-black">{t("bakiye-yuklendi")}</span>
                    <span className="block text-[10px] text-text-secondary">
                      {new Date(topup.timestamp).toLocaleDateString('tr-TR')} • {new Date(topup.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {topup.bonusAmount > 0 && (
                      <span className="inline-block text-[9px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-md mt-1">
                        +₺{topup.bonusAmount} Hediye Bakiye
                      </span>
                    )}
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="text-base font-display font-bold text-green-600 block">
                      +₺{topup.amount}
                    </span>
                    <span className="text-[10px] text-text-secondary block">
                      Yansıyan: ₺{topup.creditedAmount}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    } else if (effectiveProfileView === 'policies') {
      rightPanelContent = (
        <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-display font-bold text-black">Politikalar</h2>
            <p className="text-xs text-text-secondary mt-1">Bancho Cafe uygulama kullanım sözleşmeleri ve kuralları.</p>
          </div>
          <div className="space-y-6">
            {[
              {
                title: 'Kullanım Koşulları',
                body: 'Bu uygulamayı kullanan herkes sipariş, bakiye ve hesap işlemlerini yürürlükteki mevzuata ve işletme kurallarına uygun şekilde gerçekleştirmeyi kabul eder. İşletme; fiyat, stok, kampanya ve hizmet kapsamını önceden haber vermeksizin güncelleyebilir.',
              },
              {
                title: 'Gizlilik Politikası',
                body: 'Ad, soyad, iletişim bilgileri, sipariş kayıtları ve ödeme ile ilişkili sınırlı bilgiler yalnızca hizmetin sunulması, sipariş takibi, destek süreçleri ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir. Veriler yetkisiz erişime karşı korunur ve üçüncü taraflarla yalnızca zorunlu hallerde paylaşılır.',
              },
              {
                title: 'Çerez ve Oturum Politikası',
                body: 'Uygulama oturumun açık kalması, güvenli giriş yapılması ve temel kullanıcı deneyiminin sağlanması için tarayıcı depolama alanı ve benzeri teknolojiler kullanabilir. Bu veriler reklam amaçlı değil, uygulamanın çalışması için tutulur.',
              },
              {
                title: 'Mesafeli Satış ve İptal Politikası',
                body: 'Siparişler oluşturulduktan sonra hazırlık durumuna, ürün niteliğine ve işletme operasyonuna göre iptal veya değişiklik sınırlandırılabilir. İptal, iade veya telafi süreçlerinde son karar işletme kayıtları, ürün durumu ve yasal zorunluluklar dikkate alınarak verilir.',
              },
              {
                title: 'Ödeme ve Bakiye Politikası',
                body: 'Müşteri bakiyesi yalnızca sistem içinde tanımlı hizmet ve ürünlerde kullanılabilir. Kampanyalar, indirimler ve puan kullanımları aynı siparişte belirli kurallara tabi olabilir. Şüpheli, hatalı veya mükerrer işlemler inceleme amacıyla geçici olarak askıya alınabilir.',
              },
            ].map((policy) => (
              <div key={policy.title} className="rounded-2xl border border-border bg-surface p-5 space-y-2 hover:border-black/35 transition-colors">
                <h3 className="text-sm font-bold text-black">{policy.title}</h3>
                <p className="text-xs leading-relaxed text-text-secondary">{policy.body}</p>
              </div>
            ))}
          </div>
        </div>
      );
    } else if (effectiveProfileView === 'about') {
      rightPanelContent = (
        <div className="bg-white border border-border rounded-[32px] p-8 shadow-sm space-y-6">
          <div className="border-b border-border pb-4">
            <h2 className="text-xl font-display font-bold text-black">{t("hakkimizda")}</h2>
            <p className="text-xs text-text-secondary mt-1">Uygulama sürümü, Coffee Hub detayları ve destek bilgileri.</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-lg font-display font-bold text-black">Coffee Hub</p>
              <p className="text-xs text-text-secondary">Sipariş, bakiye ve sadakat kampanyası yönetimini tek bir modern akışta toplayan akıllı kafe otomasyonu.</p>
            </div>
            <div className="space-y-2 text-xs text-text-secondary leading-relaxed border-t border-border/50 pt-4">
              <p>• Profil ekranındaki kişisel tercihleriniz ve ayarlarınız şifreli olarak veritabanımızda saklanır.</p>
              <p>• Sadakat puanları (KP) ve sipariş aşamalarınız anlık olarak hesabınıza yansıtılmaktadır.</p>
              <p>• Herhangi bir aksaklık veya destek talebinde yönetici destek hattına bağlanabilirsiniz.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={callSupportLine}
                className="rounded-xl border border-black px-4 py-3 text-xs font-bold text-black hover:bg-surface transition-all cursor-pointer text-center"
              >
                Telefonla Ara
              </button>
              <button
                type="button"
                onClick={() => setShowSupportChat(true)}
                className="rounded-xl bg-black px-4 py-3 text-xs font-bold text-white hover:bg-zinc-800 transition-all cursor-pointer text-center"
              >
                Canlı Destek
              </button>
            </div>
            <AnimatePresence>
              {showSupportChat && (
                <SupportChat mode="customer" onClose={() => setShowSupportChat(false)} />
              )}
            </AnimatePresence>
          </div>
        </div>
      );
    }

    const desktopProfileContent = (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 pb-32 md:pb-6">
        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-8 items-start">
          <div className="space-y-6">
            <div className="bg-white border border-border rounded-[32px] p-6 flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 rounded-[32px] bg-surface border border-border p-1 overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full rounded-[28px] object-cover" />
                ) : (
                  <div className="w-full h-full rounded-[28px] bg-black text-white flex items-center justify-center text-2xl font-bold">
                    {user?.name?.[0] || '?'}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-base font-display font-bold">{user?.name} {user?.surname}</h3>
                <p className="text-xs text-text-secondary/80 mt-0.5 truncate max-w-[240px]">{user?.email}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 w-full border-t border-border/80 pt-4">
                <div className="bg-zinc-50 border border-border/60 rounded-2xl p-3 text-center space-y-0.5">
                  <span className="block text-[9px] font-bold text-text-secondary uppercase tracking-wider">KP Puanı</span>
                  <span className="block text-base font-display font-bold text-black">{points}</span>
                </div>
                <div className="bg-zinc-50 border border-border/60 rounded-2xl p-3 text-center space-y-0.5">
                  <span className="block text-[9px] font-bold text-text-secondary uppercase tracking-wider">{t("siparisler")}</span>
                  <span className="block text-base font-display font-bold text-black">{orders.length}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-border rounded-[32px] p-4 space-y-1">
              {sidebarMenuItems.map((item) => {
                const isSelected = effectiveProfileView === item.id;
                const Icon = item.icon;
                return (
                  <button 
                    key={item.id} 
                    onClick={() => setProfileView(item.id as any)}
                    className={cn(
                      "w-full rounded-2xl p-3.5 flex items-center justify-between transition-colors text-left cursor-pointer",
                      isSelected 
                        ? "bg-black text-white" 
                        : "hover:bg-zinc-50 text-text-primary"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon size={16} className={isSelected ? "text-white" : "text-text-secondary"} />
                      <span className="text-xs font-bold uppercase tracking-wider">{item.label}</span>
                    </div>
                    <ChevronRight size={14} className={isSelected ? "text-white" : "text-text-secondary"} />
                  </button>
                );
              })}

              {(() => {
                const actualRole = user?.accountRole || user?.role;
                if (actualRole === 'manager') {
                  return (
                    <div className="space-y-2 mt-3">
                      <button 
                        onClick={async () => {
                          await setSessionRole('manager');
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-3.5 flex items-center justify-between transition-colors shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Users size={16} className="text-white" />
                          <span className="text-xs font-bold uppercase tracking-wider text-white">
                            Yönetici Paneli
                          </span>
                        </div>
                        <ChevronRight size={14} className="text-white" />
                      </button>
                      <button 
                        onClick={async () => {
                          await setSessionRole('staff');
                        }}
                        className="w-full bg-neutral-900 hover:bg-black text-white rounded-2xl p-3.5 flex items-center justify-between transition-colors shadow-sm cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Users size={16} className="text-white" />
                          <span className="text-xs font-bold uppercase tracking-wider text-white">
                            Personel Paneli
                          </span>
                        </div>
                        <ChevronRight size={14} className="text-white" />
                      </button>
                    </div>
                  );
                }
                if (actualRole === 'staff') {
                  return (
                    <button 
                      onClick={async () => {
                        await setSessionRole('staff');
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-3.5 flex items-center justify-between transition-colors shadow-sm mt-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Users size={16} className="text-white" />
                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                          Personel Paneli
                        </span>
                      </div>
                      <ChevronRight size={14} className="text-white" />
                    </button>
                  );
                }
                return null;
              })()}

              <button 
                onClick={logout}
                className="w-full rounded-2xl p-3.5 flex items-center justify-between hover:bg-red-50/50 text-red-500 transition-colors text-left mt-1 border-t border-border/80 pt-3 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <LogOut size={16} className="text-red-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-red-500">{t("cikis-yap")}</span>
                </div>
                <ChevronRight size={14} className="text-red-400" />
              </button>
            </div>
          </div>

          <div className="min-h-[400px]">
            {rightPanelContent}
          </div>
        </div>
      </div>
    );

    let mobileViewContent = null;
    if (profileView === 'main') {
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-8">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-24 h-24 rounded-[40px] bg-surface border border-border p-1 overflow-hidden">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-full h-full rounded-[36px] object-cover" />
              ) : (
                <div className="w-full h-full rounded-[36px] bg-black text-white flex items-center justify-center text-3xl font-bold">
                  {user?.name?.[0] || '?'}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-xl font-display font-bold">{user?.name} {user?.surname}</h1>
              <p className="text-sm text-text-secondary">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface border border-border rounded-3xl p-4 space-y-1">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Toplam Puan</p>
              <p className="text-xl font-display font-bold">{points}</p>
            </div>
            <div className="bg-surface border border-border rounded-3xl p-4 space-y-1">
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Sipariş Sayısı</p>
              <p className="text-xl font-display font-bold">{orders.length}</p>
            </div>
          </div>

          <div className="space-y-2">
            {(() => {
              const actualRole = user?.accountRole || user?.role;
              if (actualRole === 'manager') {
                return (
                  <div className="space-y-2 mb-2">
                    <button 
                      onClick={async () => {
                        await setSessionRole('manager');
                      }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-4 flex items-center justify-between transition-colors shadow-sm cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Users size={18} className="text-white" />
                        <span className="text-sm font-semibold text-white">
                          {t("yonetici-olarak-devam-et")}
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-white/80" />
                    </button>
                    <button 
                      onClick={async () => {
                        await setSessionRole('staff');
                      }}
                      className="w-full bg-neutral-900 hover:bg-black text-white rounded-2xl p-4 flex items-center justify-between transition-colors shadow-sm cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Users size={18} className="text-white" />
                        <span className="text-sm font-semibold text-white">
                          {t("personel-olarak-devam-et")}
                        </span>
                      </div>
                      <ChevronRight size={16} className="text-white/80" />
                    </button>
                  </div>
                );
              }
              if (actualRole === 'staff') {
                return (
                  <button 
                    onClick={async () => {
                      await setSessionRole('staff');
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-4 flex items-center justify-between transition-colors shadow-sm mb-2 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Users size={18} className="text-white" />
                      <span className="text-sm font-semibold text-white">
                        {t("personel-olarak-devam-et")}
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-white/80" />
                  </button>
                );
              }
              return null;
            })()}

            {[
              { label: 'Arkadaşlar & Hediyeler', icon: Users, onClick: () => setProfileView('friends-gifts') },
              { label: 'Masa Rezervasyonu', icon: CalendarDays, onClick: () => setProfileView('reservations') },
              { label: 'Ayarlar', icon: Settings, onClick: () => setProfileView('settings') },
              { label: t("gecmis-siparislerim"), icon: ShoppingBag, onClick: () => setProfileView('orders-history') },
              { label: 'Bakiye Yükleme Geçmişi', icon: Wallet, onClick: () => setProfileView('topups-history') },
              { label: 'Adreslerim', icon: MapPin, onClick: () => setProfileView('addresses') },
              { label: t("odeme-yontemleri"), icon: CreditCard, onClick: () => setProfileView('payments') },
              { label: t("favori-urunler"), icon: Heart, onClick: () => setProfileView('favorites') },
              { label: t("cikis-yap"), icon: LogOut, color: 'text-red-500', onClick: logout },
            ].map((item: any, idx) => (
              <button 
                key={idx} 
                onClick={item.onClick}
                className="w-full bg-surface border border-border rounded-2xl p-4 flex items-center justify-between hover:bg-white transition-colors"
              >
                <div className="flex items-center gap-3">
                  <item.icon size={18} className={cn("text-text-secondary", item.color)} />
                  <span className={cn("text-sm font-medium", item.color)}>{item.label}</span>
                </div>
                <ChevronRight size={16} className="text-text-secondary" />
              </button>
            ))}
          </div>
        </div>
      );
    } else if (profileView === 'addresses') {
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">Adreslerim</h1>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-5 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-bold">{isEditingAddress ? t("adresi-duzenle") : 'Yeni Adres'}</p>
              <p className="text-xs text-text-secondary">Teslimat için kullanılacak adresi kaydedin.</p>
            </div>
            <input
              type="text"
              value={addressDraft.title}
              onChange={(event) => setAddressDraft((current) => ({ ...current, title: event.target.value }))}
              placeholder="Adres başlığı"
              className="w-full rounded-2xl border border-border bg-white px-4 py-4 text-sm focus:outline-none focus:border-black"
            />
            <textarea
              value={addressDraft.details}
              onChange={(event) => setAddressDraft((current) => ({ ...current, details: event.target.value }))}
              placeholder="Mahalle, sokak, bina no, daire, şehir"
              className="h-28 w-full resize-none rounded-2xl border border-border bg-white px-4 py-4 text-sm focus:outline-none focus:border-black"
            />
            <div className="flex gap-3">
              {isEditingAddress && (
                <button
                  onClick={resetAddressDraft}
                  className="flex-1 rounded-2xl border border-border py-4 text-sm font-bold"
                >
                  {t("vazgec")}
                </button>
              )}
              <button
                onClick={() => {
                  void saveAddress();
                }}
                className="flex-1 rounded-2xl bg-black py-4 text-sm font-bold text-white"
              >
                {isEditingAddress ? 'Adresi Kaydet' : 'Adresi Ekle'}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {(user?.addresses || []).map(addr => (
              <div key={addr.id} className="bg-surface border border-border rounded-3xl p-5 flex items-start justify-between">
                <div className="space-y-1">
                  <p className="font-bold text-sm">{addr.title}</p>
                  <p className="text-xs text-text-secondary leading-relaxed">{addr.details}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => editAddress(addr)} className="text-text-secondary hover:text-black"><Edit2 size={16} /></button>
                  <button 
                    onClick={() => {
                      void removeAddress(addr.id);
                    }}
                    className="text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            <button 
              onClick={() => {
                resetAddressDraft();
              }}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-border text-text-secondary font-bold text-sm flex items-center justify-center gap-2 hover:border-black hover:text-black transition-all"
            >
              <Plus size={18} />
              Formu Temizle
            </button>
          </div>
        </div>
      );
    } else if (profileView === 'payments') {
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">{t("odeme-yontemleri")}</h1>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-5 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-bold">{isEditingPayment ? t("karti-duzenle") : 'Yeni Kart'}</p>
              <p className="text-xs text-text-secondary">Kart markası ve son 4 haneyi kaydedin.</p>
            </div>
            <input
              type="text"
              value={paymentDraft.brand}
              onChange={(event) => setPaymentDraft((current) => ({ ...current, brand: event.target.value }))}
              placeholder="Kart markası"
              className="w-full rounded-2xl border border-border bg-white px-4 py-4 text-sm focus:outline-none focus:border-black"
            />
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={paymentDraft.cardNumber}
              onChange={(event) =>
                setPaymentDraft((current) => ({
                  ...current,
                  cardNumber: event.target.value.replace(/\D/g, '').slice(-4),
                }))
              }
              placeholder="Son 4 hane"
              className="w-full rounded-2xl border border-border bg-white px-4 py-4 text-sm focus:outline-none focus:border-black"
            />
            <div className="flex gap-3">
              {isEditingPayment && (
                <button
                  onClick={resetPaymentDraft}
                  className="flex-1 rounded-2xl border border-border py-4 text-sm font-bold"
                >
                  {t("vazgec")}
                </button>
              )}
              <button
                onClick={() => {
                  void savePayment();
                }}
                className="flex-1 rounded-2xl bg-black py-4 text-sm font-bold text-white"
              >
                {isEditingPayment ? t("karti-kaydet") : t("karti-ekle")}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {(user?.paymentMethods || []).map(pm => (
              <div key={pm.id} className="bg-surface border border-border rounded-3xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-8 bg-white border border-border rounded-lg flex items-center justify-center font-bold text-[10px] uppercase">
                    {pm.brand}
                  </div>
                  <div>
                    <p className="font-bold text-sm">**** **** **** {pm.last4}</p>
                    <p className="text-[10px] text-text-secondary uppercase tracking-widest">Kredi Kartı</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => editPayment(pm)} className="text-text-secondary hover:text-black">
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      void removePayment(pm.id);
                    }}
                    className="text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}

            <button 
              onClick={() => {
                resetPaymentDraft();
              }}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-border text-text-secondary font-bold text-sm flex items-center justify-center gap-2 hover:border-black hover:text-black transition-all"
            >
              <Plus size={18} />
              Formu Temizle
            </button>
          </div>
        </div>
      );
    } else if (profileView === 'favorites') {
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">Favoriler</h1>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {products.filter(p => user?.favorites?.includes(p.id)).map(product => (
              <motion.div 
                key={product.id}
                layoutId={`fav-mobile-${product.id}`}
                onClick={() => setSelectedProduct(product.id)}
                className="bg-surface border border-border rounded-[32px] overflow-hidden group active:scale-95 transition-all"
              >
                <div className="aspect-square relative overflow-hidden">
                  <img 
                    src={product.image} 
                    alt={product.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    referrerPolicy="no-referrer"
                  />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      void toggleFavorite(product.id);
                    }}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-red-500 shadow-sm"
                  >
                    <Heart size={14} fill="currentColor" />
                  </button>
                </div>
                <div className="p-4 space-y-1">
                  <h3 className="font-bold text-sm truncate">{product.name}</h3>
                  <p className="text-xs font-display font-bold">₺{product.price}</p>
                </div>
              </motion.div>
            ))}

            {(!user?.favorites || user.favorites.length === 0) && (
              <div className="col-span-2 text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto text-text-secondary">
                  <Heart size={32} />
                </div>
                <p className="text-text-secondary text-sm font-medium">{t("henuz-favori-urununuz-yok")}</p>
              </div>
            )}
          </div>
        </div>
      );
    } else if (profileView === 'settings') {
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">Ayarlar</h1>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest px-2">Hesap</h3>
              <div className="bg-surface border border-border rounded-3xl overflow-hidden">
                {[
                  { label: 'Profil Bilgileri', icon: UserIcon, onClick: () => setProfileView('profile-info') },
                  { label: t("sifre-degistir"), icon: Shield, onClick: () => setProfileView('change-password') },
                ].map((item, idx) => (
                  <button 
                    key={idx} 
                    onClick={item.onClick}
                    className="w-full p-4 flex items-center justify-between hover:bg-white border-b border-border last:border-0 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} className="text-text-secondary" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <ChevronRight size={16} className="text-text-secondary" />
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest px-2">Uygulama</h3>
              <div className="bg-surface border border-border rounded-3xl overflow-hidden">
                {[ 
                  { label: 'Politikalar', icon: Shield, onClick: () => setProfileView('policies') },
                  { label: t("hakkimizda"), icon: Star, onClick: () => setProfileView('about') },
                ].map((item, idx) => (
                  <button 
                    key={idx} 
                    onClick={item.onClick}
                    className="w-full p-4 flex items-center justify-between hover:bg-white border-b border-border last:border-0 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} className="text-text-secondary" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <ChevronRight size={16} className="text-text-secondary" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    } else if (profileView === 'profile-info') {
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setProfileView('settings')} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center cursor-pointer border border-border">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-xl font-display font-bold">Profil Bilgileri</h1>
            </div>
            {user?.id && (
              <button
                type="button"
                onClick={() => setViewingUserProfileId(user.id)}
                className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border border-neutral-200/60"
              >
                <UserIcon size={14} />
                <span>Önizle</span>
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-col items-center py-4">
              <div className="w-20 h-20 rounded-[32px] bg-surface border border-border p-1 relative group">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Avatar" className="w-full h-full rounded-[28px] object-cover" />
                ) : (
                  <div className="w-full h-full rounded-[28px] bg-black text-white flex items-center justify-center text-2xl font-bold">
                    {user?.name?.[0] || '?'}
                  </div>
                )}
                <label className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shadow-lg cursor-pointer">
                  <Edit2 size={14} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
              </div>
            </div>

            {/* Username */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Kullanıcı Adı (@)</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 font-mono font-bold text-sm text-neutral-400">@</span>
                <input 
                  type="text" 
                  value={profileDraft.username}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  placeholder="kullanici_adi"
                  maxLength={20}
                  className="w-full p-4 pl-9 rounded-2xl bg-surface border border-border text-sm font-mono focus:outline-none focus:border-black"
                />
              </div>
              <p className="text-[10px] text-neutral-400 ml-1">Sıralamalarda ve profilinizde görünecek adınız (örn: @yusuf).</p>
            </div>

            {/* Name & Surname */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Ad</label>
                <input 
                  type="text" 
                  value={profileDraft.name}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, name: e.target.value }))}
                  className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Soyad</label>
                <input 
                  type="text" 
                  value={profileDraft.surname}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, surname: e.target.value }))}
                  className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                />
              </div>
            </div>

            {/* Bio */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Biyografi (Hakkımda)</label>
              <textarea 
                rows={2}
                value={profileDraft.bio}
                onChange={(e) => setProfileDraft((current) => ({ ...current, bio: e.target.value.slice(0, 160) }))}
                placeholder="Kendinizden kısaca bahsedin..."
                className="w-full p-3.5 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black resize-none"
              />
            </div>

            {/* Phone & Email */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Telefon</label>
              <input 
                type="tel" 
                value={profileDraft.phone}
                onChange={(e) => setProfileDraft((current) => ({ ...current, phone: e.target.value }))}
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">E-posta</label>
              <input 
                type="email" 
                value={profileDraft.email}
                onChange={(e) => setProfileDraft((current) => ({ ...current, email: e.target.value }))}
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
              />
            </div>

            {/* BirthDate & Gender */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("dogum-tarihi")}</label>
              <input 
                type="date" 
                value={profileDraft.birthDate}
                onChange={(e) => setProfileDraft((current) => ({ ...current, birthDate: e.target.value }))}
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Cinsiyet</label>
              <select
                value={profileDraft.gender || ''}
                onChange={(e) => setProfileDraft((current) => ({ ...current, gender: (e.target.value || '') as any }))}
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black cursor-pointer"
              >
                <option value="">Belirtmek İstemiyorum</option>
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
              </select>
            </div>

            {/* Social Media Accounts */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Globe size={16} className="text-black" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-black">Sosyal Medya Hesapları</h4>
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Instagram</label>
                  <input
                    type="text"
                    placeholder="@kullanici_adi"
                    value={profileDraft.socialLinks.instagram}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      socialLinks: { ...curr.socialLinks, instagram: e.target.value }
                    }))}
                    className="w-full p-3.5 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">X (Twitter)</label>
                  <input
                    type="text"
                    placeholder="@kullanici_adi"
                    value={profileDraft.socialLinks.twitter}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      socialLinks: { ...curr.socialLinks, twitter: e.target.value }
                    }))}
                    className="w-full p-3.5 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">LinkedIn</label>
                  <input
                    type="text"
                    placeholder="profil linki veya ad"
                    value={profileDraft.socialLinks.linkedin}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      socialLinks: { ...curr.socialLinks, linkedin: e.target.value }
                    }))}
                    className="w-full p-3.5 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">GitHub</label>
                  <input
                    type="text"
                    placeholder="kullanici_adi"
                    value={profileDraft.socialLinks.github}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      socialLinks: { ...curr.socialLinks, github: e.target.value }
                    }))}
                    className="w-full p-3.5 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider ml-1">Kişisel Web Sitesi</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={profileDraft.socialLinks.website}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      socialLinks: { ...curr.socialLinks, website: e.target.value }
                    }))}
                    className="w-full p-3.5 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                  />
                </div>
              </div>
            </div>

            {/* Privacy & Visibility Settings */}
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <Lock size={16} className="text-black" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-black">Gizlilik & Paylaşım Tercihleri</h4>
              </div>
              <p className="text-[11px] text-neutral-500">Profilinizde başkalarının görebileceği bilgileri özelleştirin.</p>
              
              <div className="space-y-2">
                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Profili Herkese Gizle</span>
                    <span className="text-[10px] text-neutral-500">Sadece sizi takip edenler detayları görebilir</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.isProfilePrivate}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, isProfilePrivate: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Kahve Puanımı Göster</span>
                    <span className="text-[10px] text-neutral-500">Profilinizde toplam KP puanı gösterilsin</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.showKp}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, showKp: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Sosyal Medya Hesaplarımı Göster</span>
                    <span className="text-[10px] text-neutral-500">Sosyal linkler herkese açık olsun</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.showSocials}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, showSocials: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Yaşımı Göster</span>
                    <span className="text-[10px] text-neutral-500">Doğum tarihinizden hesaplanan yaş</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.showAge}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, showAge: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Cinsiyetimi Göster</span>
                    <span className="text-[10px] text-neutral-500">Cinsiyet bilgisi görüntülensin</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.showGender}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, showGender: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 rounded-2xl bg-surface border border-border cursor-pointer hover:bg-neutral-50 transition-colors">
                  <div>
                    <span className="text-xs font-bold text-black block">Katılma Tarihimi Göster</span>
                    <span className="text-[10px] text-neutral-500">Kayıt olduğunuz ay ve yıl</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profileDraft.privacy.showJoinDate}
                    onChange={(e) => setProfileDraft((curr) => ({
                      ...curr,
                      privacy: { ...curr.privacy, showJoinDate: e.target.checked }
                    }))}
                    className="w-5 h-5 accent-black rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {profileFeedback && (
              <div
                className={`p-4 rounded-2xl text-xs font-semibold text-center border transition-all ${
                  profileFeedback.type === 'success'
                    ? 'bg-neutral-100 text-black border-neutral-300'
                    : 'bg-red-50 text-red-600 border-red-200'
                }`}
              >
                {profileFeedback.message}
              </div>
            )}

            <button 
              onClick={() => {
                void saveProfileInfo();
              }}
              disabled={isSavingProfile}
              className="w-full py-4 rounded-2xl bg-black text-white font-bold text-sm shadow-sm cursor-pointer disabled:opacity-50"
            >
              {isSavingProfile ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </div>
      );
    } else if (profileView === 'change-password') {
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('settings')} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">{t("sifre-degistir")}</h1>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("mevcut-sifre")}</label>
              <input 
                type="password" 
                value={passwordDraft.currentPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, currentPassword: event.target.value }))}
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("yeni-sifre")}</label>
              <input 
                type="password" 
                value={passwordDraft.newPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, newPassword: event.target.value }))}
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("yeni-sifre-tekrar")}</label>
              <input 
                type="password" 
                value={passwordDraft.confirmPassword}
                onChange={(event) => setPasswordDraft((current) => ({ ...current, confirmPassword: event.target.value }))}
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                placeholder="••••••••"
              />
            </div>

            {passwordFeedback && (
              <div className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary">
                {passwordFeedback}
              </div>
            )}

            <button 
              onClick={() => {
                void changePassword();
              }}
              className="w-full py-4 rounded-2xl bg-black text-white font-bold text-sm"
            >
              {isSavingPassword ? t("guncelleniyor") : t("sifreyi-guncelle")}
            </button>
          </div>
        </div>
      );
    } else if (profileView === 'policies') {
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('settings')} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">Politikalar</h1>
          </div>

          <div className="space-y-4">
            {[
              {
                title: 'Kullanım Koşulları',
                body: 'Bu uygulamayı kullanan herkes sipariş, bakiye ve hesap işlemlerini yürürlükteki mevzuata ve işletme kurallarına uygun şekilde gerçekleştirmeyi kabul eder. İşletme; fiyat, stok, kampanya ve hizmet kapsamını önceden haber vermeksizin güncelleyebilir.',
              },
              {
                title: 'Gizlilik Politikası',
                body: 'Ad, soyad, iletişim bilgileri, sipariş kayıtları ve ödeme ile ilişkili sınırlı bilgiler yalnızca hizmetin sunulması, sipariş takibi, destek süreçleri ve yasal yükümlülüklerin yerine getirilmesi amacıyla işlenir. Veriler yetkisiz erişime karşı korunur ve üçüncü taraflarla yalnızca zorunlu hallerde paylaşılır.',
              },
              {
                title: 'Çerez ve Oturum Politikası',
                body: 'Uygulama oturumun açık kalması, güvenli giriş yapılması ve temel kullanıcı deneyiminin sağlanması için tarayıcı depolama alanı ve benzeri teknolojiler kullanabilir. Bu veriler reklam amaçlı değil, uygulamanın çalışması için tutulur.',
              },
              {
                title: 'Mesafeli Satış ve İptal Politikası',
                body: 'Siparişler oluşturulduktan sonra hazırlık durumuna, ürün niteliğine ve işletme operasyonuna göre iptal veya değişiklik sınırlandırılabilir. İptal, iade veya telafi süreçlerinde son karar işletme kayıtları, ürün durumu ve yasal zorunluluklar dikkate alınarak verilir.',
              },
              {
                title: 'Ödeme ve Bakiye Politikası',
                body: 'Müşteri bakiyesi yalnızca sistem içinde tanımlı hizmet ve ürünlerde kullanılabilir. Kampanyalar, indirimler ve puan kullanımları aynı siparişte belirli kurallara tabi olabilir. Şüpheli, hatalı veya mükerrer işlemler inceleme amacıyla geçici olarak askıya alınabilir.',
              },
            ].map((policy) => (
              <div key={policy.title} className="rounded-3xl border border-border bg-surface p-5 space-y-3">
                <h2 className="text-base font-bold">{policy.title}</h2>
                <p className="text-sm leading-6 text-text-secondary">{policy.body}</p>
              </div>
            ))}
          </div>
        </div>
      );
    } else if (profileView === 'friends-gifts') {
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">Arkadaşlar & Hediyeler</h1>
          </div>
          <FriendsGiftsPanel />
        </div>
      );
    } else if (profileView === 'reservations') {
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">Masa Rezervasyonu</h1>
          </div>
          <ReservationPanel />
        </div>
      );
    } else if (profileView === 'about') {
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('settings')} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">{t("hakkimizda")}</h1>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-lg font-display font-bold">Coffee Hub</p>
              <p className="text-sm text-text-secondary">{t("siparis-bakiye-ve-kampanya-yonetimini-tek-akista-toplayan-kafe-uygulamasi")}</p>
            </div>
            <div className="space-y-2 text-sm text-text-secondary">
              <p>{t("profil-ekranindaki-tercihler-hesabiniza-bagli-olarak-kaydedilir")}</p>
              <p>{t("sadakat-kampanyalari-ve-siparis-durumu-anlik-olarak-hesabiniza-islenir")}</p>
              <p>Destek ihtiyacı olduğunda doğrudan personel ile iletişime geçebilirsiniz.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={callSupportLine}
                className="rounded-2xl border border-black px-4 py-3 text-sm font-semibold text-black transition-transform active:scale-[0.98]"
              >
                Telefonla Ara
              </button>
              <button
                type="button"
                onClick={() => setShowSupportChat(true)}
                className="rounded-2xl bg-black px-4 py-3 text-sm font-semibold text-white transition-transform active:scale-[0.98]"
              >
                Canlı Destek
              </button>
            </div>
          </div>
        </div>
      );
    } else if (profileView === 'orders-history') {
      const userOrders = orders.filter(o => o.userId === user?.id);
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">{t("gecmis-siparislerim")}</h1>
          </div>

          <div className="space-y-4">
            {userOrders.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto text-text-secondary">
                  <ShoppingBag size={32} />
                </div>
                <p className="text-text-secondary text-sm">{t("henuz-bir-siparisiniz-bulunmuyor")}</p>
              </div>
            ) : (
              userOrders.map(order => (
                <div key={order.id} className="bg-surface border border-border rounded-3xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                          #{getOrderDisplayCode(order.id)}
                        </span>
                        {order.tableNumber ? (
                          <span className="bg-black text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Masa {order.tableNumber}
                          </span>
                        ) : (
                          <span className="bg-zinc-100 text-zinc-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border border-zinc-200">
                            Self Servis
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-text-secondary">
                        {new Date(order.timestamp).toLocaleDateString('tr-TR')} • {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-lg uppercase",
                      order.status === 'pending' && "bg-amber-100 text-amber-700",
                      order.status === 'preparing' && "bg-blue-100 text-blue-700",
                      order.status === 'ready' && "bg-green-100 text-green-700",
                      order.status === 'completed' && "bg-gray-100 text-gray-700",
                      order.status === 'rejected' && "bg-red-100 text-red-700",
                    )}>
                      {order.status === 'pending' ? 'Bekliyor' : 
                       order.status === 'preparing' ? t("hazirlaniyor") : 
                       order.status === 'ready' ? t("hazir") : 
                       order.status === 'rejected' ? 'Reddedildi' : t("tamamlandi")}
                    </span>
                  </div>

                  <div className="space-y-2 border-t border-border/40 pt-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-text-secondary"><strong className="text-black font-semibold">{item.quantity}x</strong> {item.product.name}</span>
                        <span className="text-text-secondary">₺{item.product.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {order.appliedCampaign?.campaignTitle && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Kampanya</p>
                      <p className="mt-1 text-xs font-bold text-emerald-900">{order.appliedCampaign.campaignTitle}</p>
                    </div>
                  )}

                  {order.cancelReason && (
                    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-red-600">{t("iptal-nedeni")}</p>
                      <p className="mt-1 text-xs text-red-700">{order.cancelReason}</p>
                    </div>
                  )}

                  <div className="pt-3 border-t border-border/50 flex justify-between items-center">
                    <span className="text-xs font-bold text-text-secondary">Toplam</span>
                    <span className="font-bold text-base">₺{order.total}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    } else if (profileView === 'topups-history') {
      const topups = balanceTopUps.filter(t => t.amount > 0);
      mobileViewContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">{t("bakiye-yuklemelerim")}</h1>
          </div>

          <div className="space-y-3">
            {topups.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto text-text-secondary">
                  <Wallet size={32} />
                </div>
                <p className="text-text-secondary text-sm">{t("henuz-bakiye-yuklemesi-bulunmuyor")}</p>
              </div>
            ) : (
              topups.map(topup => (
                <div key={topup.id} className="bg-surface border border-border rounded-3xl p-5 flex items-center justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="block text-sm font-bold text-black">{t("bakiye-yuklendi")}</span>
                    <span className="block text-[10px] text-text-secondary">
                      {new Date(topup.timestamp).toLocaleDateString('tr-TR')} • {new Date(topup.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {topup.bonusAmount > 0 && (
                      <span className="inline-block text-[9px] bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-md mt-1">
                        +₺{topup.bonusAmount} Hediye Bakiye
                      </span>
                    )}
                  </div>
                  <div className="text-right space-y-0.5">
                    <span className="text-base font-display font-bold text-green-600 block">
                      +₺{topup.amount}
                    </span>
                    <span className="text-[10px] text-text-secondary block">
                      Karta Yansıyan: ₺{topup.creditedAmount}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    content = (
      <>
        <div className="hidden md:block">{desktopProfileContent}</div>
        <div className="md:hidden">{mobileViewContent}</div>
      </>
    );
  }

  return (
    <>
      <DynamicIslandHeader
        activeTab={activeTab}
        profileView={profileView}
        onProfileBack={profileView !== 'main' ? () => setProfileView('main') : undefined}
        cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
        onOpenCart={() => setShowCartModal(true)}
        onOpenQR={() => setShowQR(true)}
        onOpenLeaderboard={() => setShowLeaderboard(true)}
        activeOrder={activeOrder}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={`${activeTab}-${activeTab === 'profile' ? profileView : activeTab === 'orders' ? ordersView : menuView}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {content}
        </motion.div>
      </AnimatePresence>

      {/* Shared Modals */}
      
      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-[40px] w-full max-w-md relative z-10 overflow-y-auto max-h-[90vh] shadow-2xl no-scrollbar"
            >
              <div className="relative aspect-video bg-surface border-b border-border flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-transparent" />
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="w-24 h-24 rounded-[32px] bg-black text-white flex items-center justify-center shadow-2xl overflow-hidden"
                >
                  {products.find(p => p.id === selectedProduct)?.image ? (
                    <img src={products.find(p => p.id === selectedProduct)?.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <Coffee size={48} strokeWidth={1.5} />
                  )}
                </motion.div>
                <button 
                  onClick={() => setSelectedProduct(null)}
                  className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white shadow-lg text-black flex items-center justify-center hover:bg-black hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
                <button
                  onClick={() => {
                    if (selectedProduct) {
                      void toggleFavorite(selectedProduct);
                    }
                  }}
                  className="absolute top-6 left-6 w-10 h-10 rounded-full bg-white shadow-lg text-black flex items-center justify-center hover:bg-black hover:text-white transition-all"
                >
                  <Heart
                    size={18}
                    fill={selectedProduct && user?.favorites?.includes(selectedProduct) ? 'currentColor' : 'none'}
                  />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-display font-bold">{products.find(p => p.id === selectedProduct)?.name}</h2>
                    <p className="text-text-secondary text-sm">{products.find(p => p.id === selectedProduct)?.category}</p>
                  </div>
                  <span className="text-xl font-display font-bold">₺{products.find(p => p.id === selectedProduct)?.price}</span>
                </div>

                {products.find(p => p.id === selectedProduct)?.description && (
                  <p className="text-sm leading-relaxed text-text-secondary">
                    {products.find(p => p.id === selectedProduct)?.description}
                  </p>
                )}

                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">{t("icerik-alerjenler")}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {products.find(p => p.id === selectedProduct)?.ingredients?.length ? (
                      products.find(p => p.id === selectedProduct)?.ingredients?.map(ing => {
                        const Icon = INGREDIENT_ICONS[ing] || Star;
                        return (
                          <div key={ing} className="flex items-center gap-3 p-3 bg-surface border border-border rounded-2xl">
                            <div className="w-8 h-8 rounded-lg bg-white border border-border flex items-center justify-center text-text-primary">
                              <Icon size={16} />
                            </div>
                            <span className="text-xs font-bold">{ing}</span>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-text-secondary col-span-2 italic">{t("bu-urun-icin-icerik-bilgisi-girilmemis")}</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => {
                      addToCart(selectedProduct);
                      setSelectedProduct(null);
                    }}
                    disabled={!products.find(p => p.id === selectedProduct)?.inStock}
                    className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-sm disabled:opacity-50"
                  >
                    Sepete Ekle
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart FAB */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-6 right-6 max-w-[352px] mx-auto z-40"
          >
            <button 
              onClick={() => setShowCartModal(true)}
              className="w-full bg-black text-white rounded-2xl p-4 flex items-center justify-between shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">
                  {cart.reduce((a, b) => a + b.quantity, 0)}
                </div>
                <span className="font-bold">{t("siparisi-tamamla")}</span>
              </div>
              <span className="font-display font-bold">₺{cartTotal}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Modal */}
      <AnimatePresence>
        {showCartModal && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCartModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-[40px] p-8 w-full max-w-md relative z-10 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-display font-bold">Sepetim</h2>
                <div className="flex items-center gap-2">
                  {cart.length > 0 && (
                    <button 
                      onClick={() => setCart([])}
                      className="text-[10px] font-bold text-red-500 uppercase tracking-widest px-3 py-2 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      Temizle
                    </button>
                  )}
                  <button 
                    onClick={() => setShowCartModal(false)}
                    className="w-10 h-10 rounded-full bg-surface flex items-center justify-center"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {cart.map(item => {
                  const product = products.find(p => p.id === item.productId);
                  if (!product) return null;
                  return (
                    <div key={item.productId} className="flex items-center gap-4 bg-surface p-4 rounded-2xl border border-border">
                      <div className="w-16 h-16 rounded-xl bg-white border border-border flex items-center justify-center text-black shrink-0 overflow-hidden">
                        {product.image ? (
                          <img src={product.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <Coffee size={24} strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold">{product.name}</h4>
                        <p className="text-xs text-text-secondary">₺{product.price}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-white rounded-xl border border-border p-1">
                        <button 
                          onClick={() => removeFromCart(item.productId)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => addToCart(item.productId)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface transition-colors"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {cart.length === 0 && (
                  <div className="text-center py-10 space-y-3">
                    <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center mx-auto text-text-secondary">
                      <ShoppingBag size={24} />
                    </div>
                    <p className="text-text-secondary text-sm">{t("sepetin-su-an-bos")}</p>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-border space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{t("siparis-notu-opsiyonel")}</label>
                  <textarea 
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder={t("orn-sekersiz-olsun-buzsuz-olsun")}
                    className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-all resize-none h-20"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">Toplam Tutar</span>
                  <span className="text-xl font-display font-bold">₺{cartTotal}</span>
                </div>
                <button 
                  onClick={checkout}
                  disabled={cart.length === 0}
                  className="w-full py-5 rounded-3xl bg-black text-white font-bold text-lg shadow-xl shadow-black/10 active:scale-95 transition-transform disabled:opacity-50"
                >
                  {t("siparisi-onayla")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Top-Up Modal */}
      <AnimatePresence>
        {showTopUpModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTopUpModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white rounded-t-[40px] p-8 w-full max-w-md relative z-10 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-display font-bold">{t("bakiye-yukle")}</h2>
                <button 
                  onClick={() => setShowTopUpModal(false)}
                  className="w-10 h-10 rounded-full bg-surface flex items-center justify-center"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{t("yuklenecek-tutar")}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-lg">₺</span>
                    <input 
                      type="number"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-10 pr-4 py-5 rounded-3xl bg-surface border border-border text-2xl font-display font-bold focus:outline-none focus:border-black transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[50, 100, 200, 500, 1000, 2000].map(amount => (
                    <button
                      key={amount}
                      onClick={() => setTopUpAmount(amount.toString())}
                      className={cn(
                        "py-3 rounded-2xl border text-sm font-bold transition-all",
                        topUpAmount === amount.toString() ? "bg-black border-black text-white" : "bg-surface border-border text-text-secondary hover:bg-white"
                      )}
                    >
                      ₺{amount}
                    </button>
                  ))}
                </div>

                {activeFinancialCampaign && threshold > 0 && (
                  <div className="p-5 rounded-3xl bg-amber-50 border border-amber-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gift size={16} className="text-amber-600" />
                        <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">{t("kampanya-esigi")}</span>
                      </div>
                      <span className="text-[10px] font-bold text-amber-600">
                        {currentAmount >= threshold ? t("hediye-kazandiniz") : `₺${(threshold - currentAmount).toFixed(2)} kaldı`}
                      </span>
                    </div>
                    <div className="h-2 bg-amber-200/50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full bg-amber-500"
                      />
                    </div>
                    <p className="text-[10px] text-amber-800/70 font-medium">
                      {activeFinancialCampaign.title}: {threshold} ve üzeri yüklemelere {activeFinancialCampaign.type === 'balance_bonus' ? `%${activeFinancialCampaign.value} bonus` : `₺${activeFinancialCampaign.fixedGiftAmount} hediye`}!
                    </p>
                  </div>
                )}

                <button
                  onClick={() => {
                    const amount = parseFloat(topUpAmount);
                    if (isNaN(amount) || amount <= 0) {
                      return;
                    }

                    // Demo modu: ciro/bonus hesabi ve kampanya uygulaması sunucu
                    // tarafında yapılır (MP-0.1); istemci yalnızca tutarı gönderir.
                    updateBalance(amount).catch(() => {
                      alert(t("bakiye-yuklenirken-hata-olustu"));
                    });
                    setShowTopUpModal(false);
                    setTopUpAmount('');
                  }}
                  className="w-full py-5 rounded-3xl bg-black text-white font-bold text-lg shadow-xl shadow-black/10 active:scale-95 transition-transform"
                >
                  {t("yuklemeyi-tamamla")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Modal */}
      <AnimatePresence>
        {showQR && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowQR(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[40px] p-10 w-full max-w-xs relative z-10 text-center space-y-6"
            >
              <div className="space-y-2">
                <h2 className="text-xl font-display font-bold">Sadakat QR</h2>
                <p className="text-sm text-text-secondary">{t("personele-okutarak-puan-ve-kampanya-durumunuzu-gosterin")}</p>
              </div>

              {isQrLoading && (
                <div className="rounded-3xl border border-border bg-surface px-4 py-10">
                  <p className="text-sm font-medium text-text-secondary">{t("guvenli-qr-hazirlaniyor")}</p>
                </div>
              )}

              {!isQrLoading && qrError && (
                <div className="rounded-3xl border border-red-100 bg-red-50 px-4 py-6 text-sm text-red-600">
                  {qrError}
                </div>
              )}

              {!isQrLoading && loyaltyQr && (
                <div className="bg-surface p-4 rounded-3xl inline-block border border-border">
                  <QRCodeSVG value={loyaltyQr.token} size={200} includeMargin />
                </div>
              )}

              {!isQrLoading && loyaltyQr && loyaltyQr.summary.stampStatus && (
                <>
                  <div className="grid grid-cols-2 gap-3 text-left">
                    <div className="rounded-2xl border border-border bg-surface p-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-secondary">Puan</p>
                      <p className="mt-1 text-xl font-display font-bold">{loyaltyQr.summary.pointsBalance}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-text-secondary">
                        {loyaltyQr.summary.pointsRewardCredits} ücretsiz ürün hazır
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface p-4">
                      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-text-secondary">Damga</p>
                      <p className="mt-1 text-xl font-display font-bold">
                        {loyaltyQr.summary.stampStatus
                          ? `${loyaltyQr.summary.stampStatus.currentProgress}/${loyaltyQr.summary.stampStatus.requiredQuantity}`
                          : 'Yok'}
                      </p>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-text-secondary">
                        {loyaltyQr.summary.stampStatus
                          ? `${loyaltyQr.summary.stampStatus.rewardCredits} ücretsiz kahve hakkı`
                          : t("damga-kampanyasi-secili-degil")}
                      </p>
                    </div>
                  </div>

                  <p className="text-[10px] text-text-secondary uppercase tracking-widest">
                    {new Date(loyaltyQr.expiresAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} saatine kadar geçerli
                  </p>
                </>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    void loadLoyaltyQr();
                  }}
                  className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-sm"
                >
                  Yenile
                </button>
                <button 
                  onClick={() => setShowQR(false)}
                  className="flex-1 py-4 rounded-2xl border border-border font-bold text-sm"
                >
                  Kapat
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* QR Modal & Leaderboard & Public Profile */}
      <LeaderboardModal open={showLeaderboard} onClose={() => setShowLeaderboard(false)} />
      <PublicProfileModal
        userIdOrUsername={viewingUserProfileId}
        open={Boolean(viewingUserProfileId)}
        onClose={() => setViewingUserProfileId(null)}
      />
    </>
  );
};
