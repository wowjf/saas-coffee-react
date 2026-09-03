import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../AppContext';
import { Address, BalanceTopUp, Campaign, ChangeLog, PaymentMethod, UserRole } from '../types';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Minus,
  Users, 
  Package, 
  Activity,
  ChevronRight,
  Plus,
  Settings,
  LogOut,
  Bell,
  Shield,
  HelpCircle,
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
  Calendar,
  Image as ImageIcon,
  Upload,
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
  Star,
  Layers,
  Clock,
  Moon,
  Heart,
  Cake,
  Search,
  MapPin,
  CreditCard,
  ArrowLeft,
  Trash2,
  Edit2,
  Check,
  ToggleLeft as ToggleIcon,
  QrCode,
  ShoppingBag,
  Wallet,
  Languages,
  RotateCcw
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { apiRequest, uploadImage, getAuthToken } from '../lib/api';
import { cn, getOrderDisplayCode } from '../lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { t, SYSTEM_TEXTS, SYSTEM_TEXT_GROUPS, setSystemTextOverrides } from "../shared/system-texts";

const LANG_GROUP_LABELS: Record<string, string> = {
  musteri: 'Müşteri',
  yonetici: 'Yönetici',
  sistem: 'Sistem',
  genel: 'Genel',
  tablo: 'Masa',
  personel: 'Personel',
};

const data = [
  { name: '09:00', sales: 400 },
  { name: '11:00', sales: 1200 },
  { name: '13:00', sales: 900 },
  { name: '15:00', sales: 1500 },
  { name: '17:00', sales: 2100 },
  { name: '19:00', sales: 1800 },
];

const AVAILABLE_INGREDIENTS = [
  { name: t("sut"), icon: Milk },
  { name: 'Yumurta', icon: Egg },
  { name: 'Un', icon: Wheat },
  { name: 'Laktoz', icon: Droplets },
  { name: t("seker"), icon: Candy },
  { name: 'Gluten', icon: Wheat },
  { name: t("kuruyemis"), icon: Bean },
  { name: 'Kafein', icon: Zap },
  { name: 'Nane', icon: Leaf },
  { name: t("aci-biber"), icon: Flame },
  { name: 'Elma', icon: Apple },
  { name: 'Limon', icon: Citrus },
  { name: t("visne"), icon: Cherry },
  { name: 'Muz', icon: Banana },
  { name: t("uzum"), icon: Grape },
  { name: t("cilek"), icon: Cherry },
  { name: 'Kurabiye', icon: Cookie },
  { name: 'Dondurma', icon: IceCream },
  { name: t("kahve-cekirdegi"), icon: Coffee },
  { name: 'Bal', icon: Star },
  { name: t("tarcin"), icon: Star },
  { name: t("cikolata"), icon: Candy },
  { name: 'Vanilya', icon: Star },
  { name: 'Karamel', icon: Candy },
  { name: t("findik"), icon: Bean },
  { name: t("fistik"), icon: Bean },
  { name: 'Ceviz', icon: Bean },
  { name: 'Badem', icon: Bean },
  { name: 'Hindistan Cevizi', icon: Bean },
  { name: 'Yulaf', icon: Wheat },
  { name: 'Soya', icon: Droplets },
  { name: 'Krema', icon: Droplets },
  { name: t("tereyagi"), icon: Droplets },
  { name: 'Peynir', icon: Layers },
  { name: 'Meyve', icon: Apple },
  { name: 'Alkol', icon: Star },
  { name: 'Bal', icon: Star },
  { name: 'Zencefil', icon: Leaf },
  { name: t("zerdecal"), icon: Star },
  { name: 'Karanfil', icon: Star },
  { name: 'Kakule', icon: Star },
  { name: 'Susam', icon: Star },
  { name: t("hashas"), icon: Star },
];

const ICON_MAP: Record<string, any> = {
  Milk, Egg, Wheat, Droplets, Candy, Bean, Zap, Leaf, Flame, Apple, Citrus, Cherry, Banana, Grape, Cookie, IceCream, Carrot, Fish, Beef, Sandwich, Soup, Pizza, Croissant, Salad, Vegan, Nut, GlassWater, CupSoda, CandyCane, WheatOff, Drumstick, Ham, ChefHat, Donut, Popsicle, Coffee, Star, Layers
};

const DEFAULT_CATEGORY_ICON = 'Coffee';
const USER_ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'customer', label: t("musteri") },
  { value: 'staff', label: 'Personel' },
  { value: 'manager', label: t("yonetici") },
];

function getRoleLabel(role: UserRole) {
  return USER_ROLE_OPTIONS.find((option) => option.value === role)?.label || role;
}

function getGenderLabel(gender?: string) {
  if (gender === 'female') {
    return 'Kadin';
  }

  if (gender === 'male') {
    return 'Erkek';
  }

  return 'Belirtilmedi';
}

function createEmptyCampaign(kind: 'discount' | 'balance_bonus' | 'point_reward' = 'discount'): Partial<Campaign> {
  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setMonth(today.getMonth() + 1);

  if (kind === 'balance_bonus') {
    return {
      title: 'Cüzdan Yükleme Bonusu',
      description: '200 TL ve üzeri bakiye yüklemelerinize %15 hediye bakiye!',
      category: 'financial',
      type: 'balance_bonus',
      value: 15,
      minLoadAmount: 200,
      image: '/seed/banner-welcome.webp',
      startDate: today.toISOString().slice(0, 10),
      expiryDate: nextMonth.toISOString().slice(0, 10),
      active: true,
    };
  }

  if (kind === 'point_reward') {
    return {
      title: 'Puanla Ücretsiz Kahve',
      description: '250 KP ile dilediğiniz kahve bizden hediye!',
      category: 'loyalty',
      type: 'points_free_product',
      value: 0,
      pointsCost: 250,
      targetType: 'product',
      targetCategory: 'Kahveler',
      targetProductId: '',
      usageLimit: 1,
      validityHours: 24,
      image: '/seed/banner-welcome.webp',
      startDate: today.toISOString().slice(0, 10),
      expiryDate: nextMonth.toISOString().slice(0, 10),
      active: true,
    };
  }

  return {
    title: 'Özel Menü İndirimi',
    description: 'Seçili ürünlerde sepette anında indirim fırsatı!',
    category: 'discount',
    type: 'discount',
    value: 20,
    discountType: 'percentage',
    targetType: 'all',
    targetCategory: '',
    targetProductId: '',
    minOrderAmount: 0,
    startTime: '',
    endTime: '',
    image: '/seed/banner-welcome.webp',
    startDate: today.toISOString().slice(0, 10),
    expiryDate: nextMonth.toISOString().slice(0, 10),
    active: true,
  };
}

const TableQrManagement: React.FC = () => {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(false);

  const fetchTables = async () => {
    try {
      const res = await fetch('/api/tables', {
        headers: {
          'Authorization': `Bearer ${getAuthToken() || ''}`
        }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setTables(data);
      }
    } catch (err) {
      console.error('Error fetching tables:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTables();
  }, []);

  const handleInitialize = async () => {
    if (!window.confirm(t("60-adet-masayi-sisteme-eklemek-istediginize-emin-misiniz"))) {
      return;
    }
    setInitLoading(true);
    try {
      const res = await fetch('/api/tables/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken() || ''}`,
          'Content-Type': 'application/json'
        }
      });
      let data: any = {};
      try {
        const text = await res.text();
        if (text) {
          data = JSON.parse(text);
        }
      } catch (e) {
        console.error("Error parsing response:", e);
      }
      if (res.ok) {
        alert(t("masalar-basariyla-olusturuldu"));
        await fetchTables();
      } else {
        alert(data.message || `İşlem başarısız (Hata: ${res.status}).`);
      }
    } catch (err) {
      console.error(err);
      alert(t("bir-baglanti-hatasi-olustu"));
    } finally {
      setInitLoading(false);
    }
  };

  const handleForceClose = async (tableNumber: string) => {
    if (!window.confirm(`Masa ${tableNumber} oturumunu sonlandırmak istediğinize emin misiniz?`)) {
      return;
    }
    
    setActionLoading(tableNumber);
    try {
      const res = await fetch(`/api/tables/${tableNumber}/force-close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getAuthToken() || ''}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Masa ${tableNumber} oturumu sonlandırıldı.`);
        await fetchTables();
      } else {
        alert(data.message || t("oturum-sonlandirilamadi"));
      }
    } catch (err) {
      console.error('Error force closing table session:', err);
      alert(t("islem-sirasinda-bir-hata-olustu"));
    } finally {
      setActionLoading(null);
    }
  };

  const downloadQR = (tableNumber: string) => {
    const svgElement = document.getElementById(`qr-svg-${tableNumber}`);
    if (!svgElement) return;

    const svgString = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    
    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `masa-${tableNumber}-qr.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(svgUrl);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
        <p className="text-xs text-text-secondary font-medium">{t("masalar-yukleniyor")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider">{t("masa-qr-kodlari")}</h2>
        <span className="text-[10px] font-bold text-text-secondary bg-surface px-2 py-1 rounded-lg border border-border">
          {tables.length} Masa Tanımlı
        </span>
      </div>

      {tables.length === 0 ? (
        <div className="rounded-[32px] border border-dashed border-border bg-surface p-8 text-center space-y-4">
          <p className="text-xs text-text-secondary font-medium">
            {t("veritabaninda-tanimli-masa-bulunamadi-lutfen-masalari-ilklendirin-veya-sayfanizi-yenileyin")}
          </p>
          <button
            onClick={handleInitialize}
            disabled={initLoading}
            className="px-6 py-3 bg-black text-white text-xs font-bold rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
          >
            {initLoading ? t("olusturuluyor") : t("60-masayi-ilklendir")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xs:grid-cols-2 gap-4">
          {tables.map((table) => {
            const tableUrl = `${window.location.origin}/table/${table.tableNumber}`;
            const isSessionActive = !!table.currentSessionId;

            return (
              <div 
                key={table.tableNumber} 
                className="bg-white border border-border rounded-[28px] p-5 flex items-center justify-between shadow-sm relative overflow-hidden group hover:border-black transition-all"
              >
                <div className="space-y-3 flex-1 pr-4">
                  <div>
                    <h3 className="font-display font-bold text-lg text-black">Masa {table.tableNumber}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-2 h-2 rounded-full ${isSessionActive ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`} />
                      <span className="text-[10px] text-text-secondary font-medium">
                        {isSessionActive ? 'Aktif Oturum Var' : t("bosta")}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <a 
                      href={tableUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-black bg-surface hover:bg-black hover:text-white border border-border px-3 py-1.5 rounded-xl transition-all"
                    >
                      <span>{t("masayi-ac")}</span>
                      <ChevronRight size={12} />
                    </a>

                    {isSessionActive && (
                      <button
                        disabled={actionLoading === table.tableNumber}
                        onClick={() => handleForceClose(table.tableNumber)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-500 hover:text-white border border-red-100 hover:border-red-500 px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                      >
                        {actionLoading === table.tableNumber ? t("kapatiliyor") : 'Oturumu Kapat'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center bg-surface p-3 rounded-2xl border border-border group-hover:border-black/20 transition-colors flex-shrink-0">
                  <QRCodeSVG 
                    id={`qr-svg-${table.tableNumber}`}
                    value={tableUrl}
                    size={90}
                    level="H"
                    includeMargin={false}
                  />
                  <button
                    onClick={() => downloadQR(table.tableNumber)}
                    className="text-[9px] font-bold text-text-secondary hover:text-black mt-2 underline"
                  >
                    {t("indir-svg")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ManagerPanel: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { 
    role, setRole, setSessionRole,
    products, addProduct, updateProduct, deleteProduct,
    orders, updateOrderStatus,
    campaigns, addCampaign, updateCampaign, deleteCampaign,
    ingredients, addIngredient, updateIngredient, deleteIngredient,
    recentChanges, logChange,
    categories, addCategory, updateCategory, deleteCategory,
    user, logout, updateUser,
    staff, addStaff, updateStaffRole, deleteStaff, resetSystem,
    updateUserRole, deleteUser,
    balanceTopUps,
    users,
    points
  } = useApp();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [dashboardStats, setDashboardStats] = useState<any | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [topUpTypeFilter, setTopUpTypeFilter] = useState<'all' | 'topup' | 'payment'>('all');
  const [topUpSearchQuery, setTopUpSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editProductData, setEditProductData] = useState<any>(null);
  const [profileView, setProfileView] = useState<'main' | 'addresses' | 'payments' | 'favorites' | 'settings' | 'profile-info' | 'change-password' | 'language' | 'dark-mode' | 'about' | 'policies' | 'orders-history' | 'topups-history'>('main');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showAllTopUps, setShowAllTopUps] = useState(false);
  const [showAllPopularProducts, setShowAllPopularProducts] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', surname: '', email: '', role: 'staff' as 'staff' | 'manager' });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [visibleMetrics, setVisibleMetrics] = useState({ revenue: true, users: true });
  const [profileDraft, setProfileDraft] = useState({ name: '', surname: '', phone: '', email: '', birthDate: '' });
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const [addressDraft, setAddressDraft] = useState({ id: '', title: '', details: '' });
  const [paymentDraft, setPaymentDraft] = useState({ id: '', brand: '', cardNumber: '' });
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [isEditingPayment, setIsEditingPayment] = useState(false);

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
    if (!brand || last4.length < 4) {
      return;
    }

    const currentPayments = user?.paymentMethods || [];
    const payload = { id: paymentDraft.id || Date.now().toString(), type: 'card' as const, brand, last4 };
    const nextPayments = isEditingPayment
      ? currentPayments.map((p) => p.id === paymentDraft.id ? payload : p)
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

  // Dynamic Chart Data
  const getChartData = () => {
    const now = new Date();
    let filteredTopUps = balanceTopUps;
    let filteredUsers = users;

    if (dateRange === 'today') {
      const today = new Date().setHours(0, 0, 0, 0);
      filteredTopUps = filteredTopUps.filter((topUp) => new Date(topUp.timestamp).getTime() >= today);
      filteredUsers = filteredUsers.filter(u => u.createdAt && new Date(u.createdAt).getTime() >= today);
    } else if (dateRange === 'week') {
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
      filteredTopUps = filteredTopUps.filter((topUp) => new Date(topUp.timestamp).getTime() >= lastWeek);
      filteredUsers = filteredUsers.filter(u => u.createdAt && new Date(u.createdAt).getTime() >= lastWeek);
    } else if (dateRange === 'month') {
      const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();
      filteredTopUps = filteredTopUps.filter((topUp) => new Date(topUp.timestamp).getTime() >= lastMonth);
      filteredUsers = filteredUsers.filter(u => u.createdAt && new Date(u.createdAt).getTime() >= lastMonth);
    } else if (dateRange === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate).getTime();
      const end = new Date(customEndDate).setHours(23, 59, 59, 999);
      filteredTopUps = filteredTopUps.filter((topUp) => {
        const t = new Date(topUp.timestamp).getTime();
        return t >= start && t <= end;
      });
      filteredUsers = filteredUsers.filter(u => {
        if (!u.createdAt) return false;
        const t = new Date(u.createdAt).getTime();
        return t >= start && t <= end;
      });
    }

    // Group by time/date
    const grouped: { [key: string]: { sales: number; users: number } } = {};
    
    filteredTopUps.forEach((topUp) => {
      if (topUp.amount <= 0) return; // Sadece pozitif bakiye yüklemeleri cirodur
      const d = new Date(topUp.timestamp);
      const key = dateRange === 'today' 
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (!grouped[key]) grouped[key] = { sales: 0, users: 0 };
      grouped[key].sales += topUp.amount;
    });

    filteredUsers.forEach(u => {
      if (!u.createdAt) return;
      const d = new Date(u.createdAt);
      const key = dateRange === 'today' 
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      if (!grouped[key]) grouped[key] = { sales: 0, users: 0 };
      grouped[key].users += 1;
    });

    const result = Object.entries(grouped).map(([name, data]) => ({ 
      name, 
      sales: data.sales,
      userCount: data.users 
    }));

    if (dateRange === 'today') {
      return result.sort((a, b) => a.name.localeCompare(b.name));
    }
    return result.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
  };

  const chartData = getChartData();

  const getPeriodBounds = () => {
    const now = new Date();
    let currentStart = 0;
    let currentEnd = now.getTime();
    let previousStart = 0;
    let previousEnd = 0;

    if (dateRange === 'today') {
      const todayStart = new Date().setHours(0, 0, 0, 0);
      currentStart = todayStart;
      currentEnd = now.getTime();
      previousStart = todayStart - 24 * 60 * 60 * 1000;
      previousEnd = todayStart - 1;
    } else if (dateRange === 'week') {
      const duration = 7 * 24 * 60 * 60 * 1000;
      currentStart = now.getTime() - duration;
      currentEnd = now.getTime();
      previousStart = now.getTime() - 2 * duration;
      previousEnd = now.getTime() - duration;
    } else if (dateRange === 'month') {
      const duration = 30 * 24 * 60 * 60 * 1000;
      currentStart = now.getTime() - duration;
      currentEnd = now.getTime();
      previousStart = now.getTime() - 2 * duration;
      previousEnd = now.getTime() - duration;
    } else if (dateRange === 'custom') {
      const start = customStartDate ? new Date(customStartDate).getTime() : new Date().setHours(0, 0, 0, 0);
      const end = customEndDate ? new Date(customEndDate).setHours(23, 59, 59, 999) : now.getTime();
      const duration = end - start;
      currentStart = start;
      currentEnd = end;
      previousStart = start - duration;
      previousEnd = start - 1;
    }

    return { currentStart, currentEnd, previousStart, previousEnd };
  };

  const getPeriodLabel = () => {
    if (dateRange === 'today') return t("bugun");
    if (dateRange === 'week') return t("son-7-gun");
    if (dateRange === 'month') return t("son-30-gun");
    if (customStartDate && customEndDate) {
      const formatShort = (value: string) =>
        new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
      return `${formatShort(customStartDate)} - ${formatShort(customEndDate)}`;
    }
    return t("ozel-aralik");
  };

  useEffect(() => {
    if (activeTab !== 'dashboard') return;

    const { currentStart, currentEnd } = getPeriodBounds();
    const params = new URLSearchParams({
      start: new Date(currentStart).toISOString(),
      end: new Date(currentEnd).toISOString(),
    });

    let cancelled = false;
    setStatsLoading(true);

    apiRequest(`/api/analytics/dashboard?${params.toString()}`)
      .then((data) => {
        if (!cancelled) setDashboardStats(data);
      })
      .catch(() => {
        if (!cancelled) setDashboardStats(null);
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    setProfileView('main');
  }, [activeTab]);

  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState(DEFAULT_CATEGORY_ICON);
  const [newCategoryImage, setNewCategoryImage] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserRole>('all');
  const [userGenderFilter, setUserGenderFilter] = useState<'all' | 'female' | 'male' | 'unspecified'>('all');
  const [userDateSort, setUserDateSort] = useState<'newest' | 'oldest'>('newest');
  const [userPointsSort, setUserPointsSort] = useState<'none' | 'lowest' | 'highest'>('none');
  const [logActionFilter, setLogActionFilter] = useState<'all' | string>('all');
  const [logManagerFilter, setLogManagerFilter] = useState<'all' | string>('all');
  const [logDateFilter, setLogDateFilter] = useState<'today' | 'yesterday' | 'last7' | 'last30' | 'single' | 'range'>('today');
  const [logSingleDate, setLogSingleDate] = useState('');
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [logTimeFilter, setLogTimeFilter] = useState('');
  const [cmsView, setCmsView] = useState<'dashboard' | 'products' | 'campaigns' | 'ingredients' | 'changes' | 'users' | 'tables' | 'languages' | 'inventory'>('dashboard');
  const [productManagementView, setProductManagementView] = useState<'menu' | 'products' | 'categories' | 'ingredients'>('menu');

  // C3: envanter yönetimi
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [inventoryFeedback, setInventoryFeedback] = useState('');
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [newInventoryItem, setNewInventoryItem] = useState({ name: '', unit: 'kg', currentStock: 0, minStock: 0, reorderPoint: 0, supplier: '', costPerUnit: 0 });
  const [restockDraft, setRestockDraft] = useState<Record<string, string>>({});

  const fetchInventory = async () => {
    try {
      setIsLoadingInventory(true);
      const data = await apiRequest<any[]>('/api/inventory');
      setInventoryItems(Array.isArray(data) ? data : []);
    } catch {
      setInventoryFeedback('Envanter yüklenemedi.');
    } finally {
      setIsLoadingInventory(false);
    }
  };

  useEffect(() => {
    if (cmsView === 'inventory') {
      fetchInventory();
    }
  }, [cmsView]);

  const handleCreateInventoryItem = async () => {
    const { name, unit } = newInventoryItem;
    if (!name.trim() || !unit.trim()) {
      setInventoryFeedback('Malzeme adı ve birimi zorunludur.');
      return;
    }
    try {
      await apiRequest('/api/inventory', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          unit: unit.trim(),
          currentStock: Number(newInventoryItem.currentStock) || 0,
          minStock: Number(newInventoryItem.minStock) || 0,
          reorderPoint: Number(newInventoryItem.reorderPoint) || 0,
          supplier: newInventoryItem.supplier.trim(),
          costPerUnit: Number(newInventoryItem.costPerUnit) || 0,
        }),
      });
      setShowAddInventoryModal(false);
      setNewInventoryItem({ name: '', unit: 'kg', currentStock: 0, minStock: 0, reorderPoint: 0, supplier: '', costPerUnit: 0 });
      setInventoryFeedback('');
      await fetchInventory();
    } catch (err: any) {
      setInventoryFeedback(err.message || 'Malzeme eklenemedi.');
    }
  };

  const handleRestock = async (itemId: string) => {
    const amount = Number(restockDraft[itemId]);
    if (!amount || amount <= 0) {
      setInventoryFeedback('Geçerli bir miktar girin.');
      return;
    }
    try {
      await apiRequest(`/api/inventory/${itemId}/movement`, {
        method: 'POST',
        body: JSON.stringify({ type: 'in', quantity: amount, reason: 'Panel stok girişi' }),
      });
      setRestockDraft((prev) => ({ ...prev, [itemId]: '' }));
      setInventoryFeedback('');
      await fetchInventory();
    } catch (err: any) {
      setInventoryFeedback(err.message || 'Stok girişi başarısız.');
    }
  };
  const [langSearchQuery, setLangSearchQuery] = useState('');
  const [langGroupFilter, setLangGroupFilter] = useState<'all' | string>('all');
  const [langOverrides, setLangOverrides] = useState<Record<string, string>>({});
  const [langDrafts, setLangDrafts] = useState<Record<string, string>>({});
  const [langSaving, setLangSaving] = useState<string | null>(null);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState(t("tumu-2"));
  const [productStockFilter, setProductStockFilter] = useState<'all' | 'in' | 'out'>('all');
  const [bulkActionType, setBulkActionType] = useState<'price' | 'discount' | 'delete' | null>(null);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkIsPercentage, setBulkIsPercentage] = useState(true);

  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [categoryUsageFilter, setCategoryUsageFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [categoryBulkAction, setCategoryBulkAction] = useState<'delete' | 'clear-image' | null>(null);

  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');
  const [ingredientUsageFilter, setIngredientUsageFilter] = useState<'all' | 'used' | 'unused'>('all');
  const [ingredientBulkAction, setIngredientBulkAction] = useState<'delete' | 'reset-icon' | null>(null);

  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [campaignSearchQuery, setCampaignSearchQuery] = useState('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [campaignCategoryFilter, setCampaignCategoryFilter] = useState<'all' | Campaign['category']>('all');
  const [campaignBulkAction, setCampaignBulkAction] = useState<'activate' | 'deactivate' | 'delete' | null>(null);

  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    category: 'Coffee',
    description: '',
    inStock: true,
    ingredients: [] as string[],
    image: ''
  });

  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<string | null>(null);
  const [campaignKind, setCampaignKind] = useState<'discount' | 'balance_bonus' | 'point_reward'>('discount');
  const [campaignCategory, setCampaignCategory] = useState<any>('discount');
  const [campaignType, setCampaignType] = useState<any>('discount');
  const [newCampaign, setNewCampaign] = useState<Partial<Campaign>>(createEmptyCampaign('discount'));
  const campaignTargetProducts = products.filter((product) =>
    !newCampaign.targetCategory || product.category === newCampaign.targetCategory,
  );

  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<string | null>(null);
  const [newIngredient, setNewIngredient] = useState({ name: '', iconName: 'Star' });
  const [ingredientPendingDelete, setIngredientPendingDelete] = useState<{
    id: string;
    name: string;
    usageCount: number;
  } | null>(null);

  const getCategoryUsageCount = (categoryName: string) =>
    products.filter((product) => product.category === categoryName).length;

  const getIngredientUsageCount = (ingredientName: string) =>
    products.filter((product) => (product.ingredients || []).includes(ingredientName)).length;

  const notifyManager = async (
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'error' = 'info',
    targetUserId?: string,
    targetRole?: 'manager',
  ) => {
    void title;
    void message;
    void type;
    void targetUserId;
    void targetRole;
    return Promise.resolve();
  };

  const resolveErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback;

  const runManagerAction = async (action: () => Promise<void>, fallbackMessage: string) => {
    try {
      await action();
      return true;
    } catch (error) {
      const message = resolveErrorMessage(error, fallbackMessage);
      console.error(fallbackMessage, error);
      await notifyManager('Hata', message, 'error', user?.id);
      return false;
    }
  };

  const resetCategoryForm = () => {
    setEditingCategory(null);
    setNewCategoryName('');
    setNewCategoryIcon(DEFAULT_CATEGORY_ICON);
    setNewCategoryImage('');
  };

  const resetIngredientForm = () => {
    setEditingIngredient(null);
    setNewIngredient({ name: '', iconName: 'Star' });
  };

  const openIngredientModal = (ingredient?: any) => {
    if (ingredient) {
      setEditingIngredient(ingredient.id);
      setNewIngredient({ name: ingredient.name, iconName: ingredient.iconName });
    } else {
      resetIngredientForm();
    }
    setShowIngredientModal(true);
  };

  const closeCategoryModal = () => {
    setShowAddCategoryModal(false);
    resetCategoryForm();
  };

  const closeIngredientModal = () => {
    setShowIngredientModal(false);
    resetIngredientForm();
  };

  const openCategoryModal = (category?: { id: string; name: string; iconName: string; image?: string }) => {
    if (category) {
      setEditingCategory(category.id);
      setNewCategoryName(category.name);
      setNewCategoryIcon(category.iconName);
      setNewCategoryImage(category.image || '');
    } else {
      resetCategoryForm();
    }
    setShowAddCategoryModal(true);
  };

  useEffect(() => {
    if (cmsView === 'ingredients') {
      setCmsView('products');
      setProductManagementView('ingredients');
      return;
    }

    if (cmsView !== 'products') {
      setProductManagementView('menu');
    }
  }, [cmsView]);

  useEffect(() => {
    setSelectedProducts([]);
    setBulkActionType(null);
    setBulkValue('');
    setSelectedCategories([]);
    setCategoryBulkAction(null);
    setSelectedIngredients([]);
    setIngredientBulkAction(null);
  }, [productManagementView]);

  useEffect(() => {
    setSelectedCampaigns([]);
    setCampaignBulkAction(null);
  }, [cmsView]);

  const langAllGroups = Array.from(new Set(Object.values(SYSTEM_TEXT_GROUPS)));

  const loadLangOverrides = async () => {
    try {
      const result = await apiRequest<{ overrides: Record<string, string> }>('/api/system-texts');
      setLangOverrides(result.overrides || {});
      setLangDrafts(result.overrides || {});
    } catch {
      setLangOverrides({});
    }
  };

  useEffect(() => {
    if (cmsView === 'languages') {
      loadLangOverrides();
    }
  }, [cmsView]);

  const saveLangText = async (key: string) => {
    const value = (langDrafts[key] ?? '').trim();
    if (!value) return;
    setLangSaving(key);
    try {
      const result = await apiRequest<{ key: string; value: string }>(`/api/system-texts/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      });
      setLangOverrides((prev) => ({ ...prev, [result.key]: result.value }));
      setLangDrafts((prev) => ({ ...prev, [result.key]: result.value }));
      setSystemTextOverrides({ ...langOverrides, [result.key]: result.value });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Metin kaydedilemedi.');
    } finally {
      setLangSaving(null);
    }
  };

  const resetLangText = async (key: string) => {
    setLangSaving(key);
    try {
      await apiRequest<{ key: string; value: string }>(`/api/system-texts/${key}/reset`, { method: 'POST' });
      setLangOverrides((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setLangDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSystemTextOverrides(Object.fromEntries(Object.entries(langOverrides).filter(([entryKey]) => entryKey !== key)));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Metin sıfırlanamadı.');
    } finally {
      setLangSaving(null);
    }
  };

  const langFilteredKeys = Object.keys(SYSTEM_TEXTS)
    .filter((key) => {
      if (langGroupFilter !== 'all' && (SYSTEM_TEXT_GROUPS[key] ?? '') !== langGroupFilter) return false;
      if (!langSearchQuery.trim()) return true;
      const needle = langSearchQuery.trim().toLocaleLowerCase('tr');
      const current = langOverrides[key] ?? SYSTEM_TEXTS[key];
      return (
        key.toLocaleLowerCase('tr').includes(needle) ||
        current.toLocaleLowerCase('tr').includes(needle)
      );
    });

  useEffect(() => {
    if (user) {
      setProfileDraft({
        name: user.name || '',
        surname: user.surname || '',
        phone: user.phone || '',
        email: user.email || '',
        birthDate: user.birthDate || '',
      });
    }
  }, [user?.name, user?.surname, user?.phone, user?.email, user?.birthDate]);

  const saveProfileInfo = async () => {
    try {
      await updateUser({
        name: profileDraft.name.trim(),
        surname: profileDraft.surname.trim(),
        phone: profileDraft.phone.trim(),
        email: profileDraft.email.trim(),
        birthDate: profileDraft.birthDate,
      });
      setProfileView('main');
    } catch (err) {
      console.error("Profile update failed:", err);
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

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'avatar' | 'category' | 'campaign' | 'product' | 'edit-product',
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';

    if (!file) return;

    try {
      const scope = type === 'edit-product' ? 'product' : type;
      const { url } = await uploadImage(scope, file);

      if (type === 'avatar') {
        await updateUser({ avatar: url });
      } else if (type === 'edit-product') {
        setEditProductData((prev: any) => ({ ...prev, image: url }));
      } else if (type === 'category') {
        setNewCategoryImage(url);
      } else if (type === 'campaign') {
        setNewCampaign((prev: any) => ({ ...prev, image: url }));
      } else {
        setNewProduct(prev => ({ ...prev, image: url }));
      }
    } catch (error) {
      console.error('Image upload failed:', error);
      await notifyManager('Hata', t("gorsel-yuklenirken-bir-hata-olustu"), 'error', user?.id);
    }
  };


  const closeCampaignModal = () => {
    setShowCampaignModal(false);
    setEditingCampaign(null);
    setCampaignKind('discount');
    setCampaignCategory('discount');
    setCampaignType('discount');
    setNewCampaign(createEmptyCampaign('discount'));
  };

  const openCampaignModal = (campaign?: Campaign) => {
    if (campaign) {
      setEditingCampaign(campaign.id);
      let kind: 'discount' | 'balance_bonus' | 'point_reward' = 'discount';
      if (campaign.category === 'financial' || campaign.type === 'balance_bonus' || campaign.type === 'fixed_bonus') {
        kind = 'balance_bonus';
      } else if (campaign.category === 'loyalty' || campaign.type === 'points_free_product' || campaign.type === 'points_discount_product' || campaign.type === 'point_reward') {
        kind = 'point_reward';
      }
      setCampaignKind(kind);
      setCampaignCategory(campaign.category || kind);
      setCampaignType(campaign.type || kind);
      setNewCampaign({
        ...createEmptyCampaign(kind),
        ...campaign,
      });
    } else {
      setEditingCampaign(null);
      setCampaignKind('discount');
      setCampaignCategory('discount');
      setCampaignType('discount');
      setNewCampaign(createEmptyCampaign('discount'));
    }

    setShowCampaignModal(true);
  };

  useEffect(() => {
    const fallbackCategory = categories[0]?.name || '';

    if (!categories.some((category) => category.name === newProduct.category) && newProduct.category !== fallbackCategory) {
      setNewProduct((prev) => ({
        ...prev,
        category: fallbackCategory,
      }));
    }
  }, [categories, newProduct.category]);

  useEffect(() => {
    if (!newCampaign.targetCategory && newCampaign.targetProductId) {
      const nextProduct = products.find((product) => product.id === newCampaign.targetProductId);
      if (nextProduct?.category) {
        setNewCampaign((prev) => ({
          ...prev,
          targetCategory: nextProduct.category,
        }));
      }
      return;
    }

    if (
      newCampaign.targetProductId &&
      !campaignTargetProducts.some((product) => product.id === newCampaign.targetProductId)
    ) {
      setNewCampaign((prev) => ({
        ...prev,
        targetProductId: '',
      }));
    }
  }, [campaignTargetProducts, newCampaign.targetCategory, newCampaign.targetProductId, products]);

  const filteredProducts = products.filter(p => productFilter === t("tumu-2") || p.category === productFilter);
  const filteredProductCards = filteredProducts.filter((product) => {
    const query = productSearchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      product.name.toLowerCase().includes(query) ||
      product.category.toLowerCase().includes(query);
    const matchesStock =
      productStockFilter === 'all' ||
      (productStockFilter === 'in' ? product.inStock : !product.inStock);

    return matchesQuery && matchesStock;
  });
  const logActionOptions = Array.from(new Set(recentChanges.map((log) => String(log.action)))) as string[];
  logActionOptions.sort((left, right) =>
    left.localeCompare(right, 'tr'),
  );
  const logManagerOptions = Array.from(new Set(recentChanges.map((log) => String(log.userName)))) as string[];
  logManagerOptions.sort((left, right) =>
    left.localeCompare(right, 'tr'),
  );
  const filteredRecentChanges = recentChanges.filter((log: ChangeLog) => {
    if (logActionFilter !== 'all' && log.action !== logActionFilter) {
      return false;
    }

    if (logManagerFilter !== 'all' && log.userName !== logManagerFilter) {
      return false;
    }

    const logDate = new Date(log.timestamp);
    const logDayStart = new Date(logDate);
    logDayStart.setHours(0, 0, 0, 0);

    if (logDateFilter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      if (logDayStart.getTime() !== todayStart.getTime()) {
        return false;
      }
    }

    if (logDateFilter === 'yesterday') {
      const yesterdayStart = new Date();
      yesterdayStart.setHours(0, 0, 0, 0);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      if (logDayStart.getTime() !== yesterdayStart.getTime()) {
        return false;
      }
    }

    if (logDateFilter === 'last7') {
      const last7Start = new Date();
      last7Start.setHours(0, 0, 0, 0);
      last7Start.setDate(last7Start.getDate() - 6);
      if (logDate < last7Start) {
        return false;
      }
    }

    if (logDateFilter === 'last30') {
      const last30Start = new Date();
      last30Start.setHours(0, 0, 0, 0);
      last30Start.setDate(last30Start.getDate() - 29);
      if (logDate < last30Start) {
        return false;
      }
    }

    if (logDateFilter === 'single' && logSingleDate) {
      const selectedDay = new Date(logSingleDate);
      selectedDay.setHours(0, 0, 0, 0);
      if (logDayStart.getTime() !== selectedDay.getTime()) {
        return false;
      }
    }

    if (logDateFilter === 'range') {
      if (logStartDate) {
        const rangeStart = new Date(logStartDate);
        rangeStart.setHours(0, 0, 0, 0);
        if (logDate < rangeStart) {
          return false;
        }
      }

      if (logEndDate) {
        const rangeEnd = new Date(logEndDate);
        rangeEnd.setHours(23, 59, 59, 999);
        if (logDate > rangeEnd) {
          return false;
        }
      }
    }

    if (logTimeFilter) {
      const currentTime = logDate.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      if (currentTime !== logTimeFilter) {
        return false;
      }
    }

    return true;
  });
  const filteredCategoryCards = categories.filter((category) => {
    const query = categorySearchQuery.trim().toLowerCase();
    const usageCount = getCategoryUsageCount(category.name);
    const matchesQuery =
      !query ||
      category.name.toLowerCase().includes(query) ||
      category.iconName.toLowerCase().includes(query);
    const matchesUsage =
      categoryUsageFilter === 'all' ||
      (categoryUsageFilter === 'used' ? usageCount > 0 : usageCount === 0);

    return matchesQuery && matchesUsage;
  });
  const filteredIngredientCards = ingredients.filter((ingredient) => {
    const query = ingredientSearchQuery.trim().toLowerCase();
    const usageCount = getIngredientUsageCount(ingredient.name);
    const matchesQuery =
      !query ||
      ingredient.name.toLowerCase().includes(query) ||
      ingredient.iconName.toLowerCase().includes(query);
    const matchesUsage =
      ingredientUsageFilter === 'all' ||
      (ingredientUsageFilter === 'used' ? usageCount > 0 : usageCount === 0);

    return matchesQuery && matchesUsage;
  });
  const filteredCampaignCards = campaigns.filter((campaign) => {
    const query = campaignSearchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      campaign.title.toLowerCase().includes(query) ||
      campaign.description.toLowerCase().includes(query);
    const matchesStatus =
      campaignStatusFilter === 'all' ||
      (campaignStatusFilter === 'active' ? campaign.active : !campaign.active);
    const matchesCategory =
      campaignCategoryFilter === 'all' || campaign.category === campaignCategoryFilter;

    return matchesQuery && matchesStatus && matchesCategory;
  });
  const filteredUsers = [...users]
    .filter((member) => {
      const query = userSearchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        `${member.name} ${member.surname}`.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query);
      const matchesRole = userRoleFilter === 'all' || member.role === userRoleFilter;
      const matchesGender =
        userGenderFilter === 'all'
          ? true
          : userGenderFilter === 'unspecified'
            ? !member.gender
            : member.gender === userGenderFilter;

      return matchesQuery && matchesRole && matchesGender;
    })
    .sort((left, right) => {
      if (userPointsSort === 'highest') {
        if ((right.points || 0) !== (left.points || 0)) {
          return (right.points || 0) - (left.points || 0);
        }
      } else if (userPointsSort === 'lowest') {
        if ((left.points || 0) !== (right.points || 0)) {
          return (left.points || 0) - (right.points || 0);
        }
      }

      const leftDate = new Date(left.createdAt || 0).getTime();
      const rightDate = new Date(right.createdAt || 0).getTime();
      return userDateSort === 'oldest' ? leftDate - rightDate : rightDate - leftDate;
    });

  const toggleProductSelection = (id: string) => {
    setSelectedProducts(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleCategorySelection = (id: string) => {
    setSelectedCategories((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleIngredientSelection = (id: string) => {
    setSelectedIngredients((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleCampaignSelection = (id: string) => {
    setSelectedCampaigns((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleBulkAction = async () => {
    if (selectedProducts.length === 0) return;

    if (bulkActionType === 'delete') {
      const ok = await runManagerAction(async () => {
        await Promise.all(selectedProducts.map((id) => deleteProduct(id)));
        await logChange('Toplu Silme', `${selectedProducts.length} ürün silindi.`);
        await notifyManager('Toplu Silme', `${selectedProducts.length} ürün başarıyla silindi.`, 'warning', undefined, 'manager');
      }, t("secili-urunler-silinemedi"));

      if (ok) {
        setSelectedProducts([]);
        setBulkActionType(null);
      }

      return;
    }

    const value = Number(bulkValue);
    if (isNaN(value)) return;

    const ok = await runManagerAction(async () => {
      await Promise.all(
        selectedProducts.map(async (id) => {
          const product = products.find((item) => item.id === id);

          if (!product) {
            return;
          }

          if (bulkActionType === 'price') {
            const adjustment = bulkIsPercentage ? product.price * (value / 100) : value;
            await updateProduct(id, { price: Math.max(0, product.price + adjustment) });
          }

          if (bulkActionType === 'discount') {
            const discount = bulkIsPercentage ? product.price * (value / 100) : value;
            await updateProduct(id, { price: Math.max(0, product.price - discount) });
          }
        }),
      );

      await logChange(t("toplu-duzenleme"), `${selectedProducts.length} ürün üzerinde ${bulkActionType} işlemi yapıldı.`);
      await notifyManager(t("toplu-duzenleme"), t("secili-urunler-basariyla-guncellendi"), 'success', undefined, 'manager');
    }, t("toplu-urun-guncellemesi-yapilamadi"));

    if (ok) {
      setSelectedProducts([]);
      setBulkActionType(null);
      setBulkValue('');
    }
  };

  const handleCategoryBulkAction = async () => {
    if (selectedCategories.length === 0 || !categoryBulkAction) return;

    const ok = await runManagerAction(async () => {
      if (categoryBulkAction === 'delete') {
        await Promise.all(selectedCategories.map((id) => deleteCategory(id)));
        await logChange('Toplu Kategori Silme', `${selectedCategories.length} kategori silindi.`);
        return;
      }

      await Promise.all(
        selectedCategories.map(async (id) => {
          const category = categories.find((item) => item.id === id);
          if (!category) {
            return;
          }

          await updateCategory(category.id, category.name, category.iconName, '');
        }),
      );
      await logChange('Toplu Kategori Guncelleme', `${selectedCategories.length} kategorinin gorseli temizlendi.`);
    }, 'Toplu kategori islemi yapilamadi.');

    if (ok) {
      setSelectedCategories([]);
      setCategoryBulkAction(null);
    }
  };

  const handleIngredientBulkAction = async () => {
    if (selectedIngredients.length === 0 || !ingredientBulkAction) return;

    const ok = await runManagerAction(async () => {
      if (ingredientBulkAction === 'delete') {
        await Promise.all(selectedIngredients.map((id) => deleteIngredient(id)));
        await logChange('Toplu Alerjen Silme', `${selectedIngredients.length} alerjen silindi.`);
        return;
      }

      await Promise.all(
        selectedIngredients.map(async (id) => {
          await updateIngredient(id, { iconName: 'Star' });
        }),
      );
      await logChange('Toplu Alerjen Guncelleme', `${selectedIngredients.length} alerjenin ikonu varsayilana cekildi.`);
    }, 'Toplu alerjen islemi yapilamadi.');

    if (ok) {
      setSelectedIngredients([]);
      setIngredientBulkAction(null);
    }
  };

  const handleCampaignBulkAction = async () => {
    if (selectedCampaigns.length === 0 || !campaignBulkAction) return;

    const ok = await runManagerAction(async () => {
      if (campaignBulkAction === 'delete') {
        await Promise.all(selectedCampaigns.map((id) => deleteCampaign(id)));
        await logChange('Toplu Kampanya Silme', `${selectedCampaigns.length} kampanya silindi.`);
        return;
      }

      await Promise.all(
        selectedCampaigns.map(async (id) => {
          await updateCampaign(id, { active: campaignBulkAction === 'activate' });
        }),
      );
      await logChange(
        'Toplu Kampanya Guncelleme',
        `${selectedCampaigns.length} kampanya ${campaignBulkAction === 'activate' ? 'aktif' : 'pasif'} yapildi.`,
      );
    }, 'Toplu kampanya islemi yapilamadi.');

    if (ok) {
      setSelectedCampaigns([]);
      setCampaignBulkAction(null);
    }
  };

  const toggleIngredient = (productId: string, ingredient: string) => {
    if (editProductData && productId === editingProduct) {
      const currentIngredients = editProductData.ingredients || [];
      const newIngredients = currentIngredients.includes(ingredient)
        ? currentIngredients.filter((i: string) => i !== ingredient)
        : [...currentIngredients, ingredient];
      setEditProductData({ ...editProductData, ingredients: newIngredients });
      return;
    }

    const p = products.find(prod => prod.id === productId);
    if (p) {
      const currentIngredients = p.ingredients || [];
      const newIngredients = currentIngredients.includes(ingredient)
        ? currentIngredients.filter(i => i !== ingredient)
        : [...currentIngredients, ingredient];
      updateProduct(productId, { ingredients: newIngredients });
    }
  };

  const totalRevenue = balanceTopUps.filter(t => t.amount > 0).reduce((sum, topUp) => sum + topUp.amount, 0);
  const registeredUsersCount = users.length;

  if (activeTab === 'dashboard') {
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodBounds();

    // ── Popüler ürünler (sunucu agregasyonu, tarih aralıklı) ──
    const rangeOrders = orders.filter((order: any) => {
      const orderTime = new Date(order.timestamp).getTime();
      return orderTime >= currentStart && orderTime <= currentEnd;
    });

    const productSales: Record<string, number> = {};
    const productRevenue: Record<string, number> = {};
    const productOrderCount: Record<string, number> = {};
    rangeOrders.forEach((order: any) => {
      if (order.status === "rejected") return;
      order.items.forEach((item: any) => {
        const pId = item.product?.id || item.productId;
        if (!pId) return;
        productSales[pId] = (productSales[pId] || 0) + item.quantity;
        productRevenue[pId] = (productRevenue[pId] || 0) + item.quantity * (Number(item.product?.price) || 0);
        productOrderCount[pId] = (productOrderCount[pId] || 0) + 1;
      });
    });

    const clientPopularProducts = [...products]
      .map(p => ({
        id: p.id,
        name: p.name,
        price: p.price,
        image: p.image,
        category: p.category,
        salesCount: productSales[p.id] || 0,
        revenue: productRevenue[p.id] || 0,
        orderCount: productOrderCount[p.id] || 0,
      }))
      .sort((a, b) => b.salesCount - a.salesCount || b.revenue - a.revenue);

    const allPopularProducts = dashboardStats ? dashboardStats.popularProducts : clientPopularProducts;
    const soldPopularProducts = allPopularProducts.filter((p: any) => p.salesCount > 0);
    const popularProducts = soldPopularProducts.slice(0, 3);
    const maxSalesCount = Math.max(...allPopularProducts.map((p: any) => p.salesCount), 1);

    // ── Bakiye işlemleri (tarih aralıklı) ──
    const statsTopUps: BalanceTopUp[] = dashboardStats
      ? dashboardStats.topUps
      : balanceTopUps.filter((topUp) => {
          const topUpTime = new Date(topUp.timestamp).getTime();
          return topUpTime >= currentStart && topUpTime <= currentEnd;
        });

    const topUpSummary = dashboardStats?.topUpSummary || {
      loaded: statsTopUps.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
      spent: Math.abs(statsTopUps.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0)),
      bonus: statsTopUps.reduce((sum, t) => sum + (t.bonusAmount || 0), 0),
      count: statsTopUps.length,
    };

    const filteredTopUps = statsTopUps.filter((t) => {
      if (topUpTypeFilter === 'topup' && t.amount <= 0) return false;
      if (topUpTypeFilter === 'payment' && t.amount >= 0) return false;
      const query = topUpSearchQuery.trim().toLowerCase();
      if (
        query &&
        !(t.userName || '').toLowerCase().includes(query) &&
        !(t.userEmail || '').toLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });

    const totalRevenue = balanceTopUps
      .filter((topUp) => {
        if (topUp.amount <= 0) return false;
        const topUpTime = new Date(topUp.timestamp).getTime();
        return topUpTime >= currentStart && topUpTime <= currentEnd;
      })
      .reduce((acc, topUp) => acc + topUp.amount, 0);

    const previousRevenue = balanceTopUps
      .filter((topUp) => {
        if (topUp.amount <= 0) return false;
        const topUpTime = new Date(topUp.timestamp).getTime();
        return topUpTime >= previousStart && topUpTime <= previousEnd;
      })
      .reduce((acc, topUp) => acc + topUp.amount, 0);

    let revenueChangePercent = 0;
    if (previousRevenue > 0) {
      revenueChangePercent = ((totalRevenue - previousRevenue) / previousRevenue) * 100;
    } else if (totalRevenue > 0) {
      revenueChangePercent = 100;
    }

    const registeredUsersCount = users.length;
    const previousTotalUsers = users.filter((u) => {
      if (!u.createdAt) return true;
      return new Date(u.createdAt).getTime() <= previousEnd;
    }).length;

    let usersChangePercent = 0;
    if (previousTotalUsers > 0) {
      usersChangePercent = ((registeredUsersCount - previousTotalUsers) / previousTotalUsers) * 100;
    } else if (registeredUsersCount > 0) {
      usersChangePercent = 100;
    }

    return (
      <div className="p-6 pb-32 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">{t("yonetim-paneli")}</h1>
          <div className="flex items-center gap-2">
            <select 
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="bg-surface border border-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
            >
              <option value="today">{t("bugun")}</option>
              <option value="week">Bu Hafta</option>
              <option value="month">Bu Ay</option>
              <option value="custom">{t("ozel")}</option>
            </select>
          </div>
        </div>

        {dateRange === 'custom' && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 gap-4 p-4 bg-surface border border-border rounded-3xl"
          >
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{t("baslangic")}</label>
              <input 
                type="date" 
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">{t("bitis")}</label>
              <input 
                type="date" 
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs"
              />
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface border border-border rounded-3xl p-5 space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center">
              <span className="text-lg font-bold">₺</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Toplam Ciro</p>
              <p className="text-xl font-display font-bold">₺{totalRevenue.toLocaleString()}</p>
            </div>
            <div className={cn(
              "flex items-center gap-1 text-[10px] font-bold",
              revenueChangePercent > 0 ? "text-green-600" : revenueChangePercent < 0 ? "text-red-500" : "text-text-secondary"
            )}>
              {revenueChangePercent > 0 ? (
                <>
                  <TrendingUp size={12} />
                  +{revenueChangePercent.toFixed(1)}%
                </>
              ) : revenueChangePercent < 0 ? (
                <>
                  <TrendingDown size={12} />
                  {revenueChangePercent.toFixed(1)}%
                </>
              ) : (
                <>
                  <Minus size={12} />
                  0.0%
                </>
              )}
            </div>
          </div>
          <div className="bg-surface border border-border rounded-3xl p-5 space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-white border border-border flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t("kayitli-kullanici")}</p>
              <p className="text-xl font-display font-bold">{registeredUsersCount}</p>
            </div>
            <div className={cn(
              "flex items-center gap-1 text-[10px] font-bold",
              usersChangePercent > 0 ? "text-green-600" : usersChangePercent < 0 ? "text-red-500" : "text-text-secondary"
            )}>
              {usersChangePercent > 0 ? (
                <>
                  <TrendingUp size={12} />
                  +{usersChangePercent.toFixed(1)}%
                </>
              ) : usersChangePercent < 0 ? (
                <>
                  <TrendingDown size={12} />
                  {usersChangePercent.toFixed(1)}%
                </>
              ) : (
                <>
                  <Minus size={12} />
                  0.0%
                </>
              )}
            </div>
          </div>
        </div>

        {/* Revenue Chart */}
        <section className="bg-surface border border-border rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-bold uppercase tracking-wider">{t("bakiye-yukleme-cirosu")}</h2>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setVisibleMetrics(prev => ({ ...prev, revenue: !prev.revenue }))}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
                    visibleMetrics.revenue ? "bg-black text-white" : "bg-white border border-border text-text-secondary"
                  )}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full", visibleMetrics.revenue ? "bg-green-400" : "bg-gray-300")} />
                  Ciro
                </button>
                <button 
                  onClick={() => setVisibleMetrics(prev => ({ ...prev, users: !prev.users }))}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all",
                    visibleMetrics.users ? "bg-black text-white" : "bg-white border border-border text-text-secondary"
                  )}
                >
                  <div className={cn("w-1.5 h-1.5 rounded-full", visibleMetrics.users ? "bg-blue-400" : "bg-gray-300")} />
                  {t("kayitli-kullanici")}
                </button>
              </div>
            </div>
            <BarChart3 size={16} className="text-text-secondary" />
          </div>
          <div className="h-48 w-full min-w-0 overflow-hidden">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#6B7280' }} 
                />
                <YAxis 
                  hide={true}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                />
                {visibleMetrics.revenue && (
                  <Area 
                    type="monotone" 
                    dataKey="sales" 
                    name="Ciro (₺)"
                    stroke="#22c55e" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorSales)" 
                  />
                )}
                {visibleMetrics.users && (
                  <Area 
                    type="monotone" 
                    dataKey="userCount" 
                    name={t("kullanici")}
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorUsers)" 
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Recent Top-ups Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">{t("son-bakiye-islemleri")}</h2>
              <p className="text-[10px] text-text-secondary mt-0.5 font-medium">
                {getPeriodLabel()} · {topUpSummary.count} işlem
              </p>
            </div>
            {statsTopUps.length > 5 ? (
              <button
                onClick={() => setShowAllTopUps(true)}
                className="text-xs font-bold text-text-secondary hover:text-black transition-colors"
              >
                {t("tumunu-gor")}
              </button>
            ) : (
              <Clock size={16} className="text-text-secondary" />
            )}
          </div>

          {/* Period Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-surface border border-border rounded-2xl p-3">
              <p className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">{t("yuklenen")}</p>
              <p className="text-sm font-bold text-green-600 mt-0.5">₺{topUpSummary.loaded.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-3">
              <p className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">{t("odenen")}</p>
              <p className="text-sm font-bold text-amber-600 mt-0.5">₺{topUpSummary.spent.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-3">
              <p className="text-[9px] font-bold text-text-secondary uppercase tracking-wider">Bonus</p>
              <p className="text-sm font-bold text-violet-600 mt-0.5">₺{topUpSummary.bonus.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          {statsLoading && statsTopUps.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-6 text-center text-xs text-text-secondary">
              {t("yukleniyor")}
            </div>
          ) : (
            <div className="space-y-3">
              {statsTopUps.slice(0, 5).map((topUp: BalanceTopUp) => {
                const isRefundOrPayment = topUp.amount < 0;
                const displayAmount = Math.abs(topUp.creditedAmount || topUp.amount);
                return (
                  <div key={topUp.id} className="bg-surface border border-border rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center font-bold text-xs">
                          {topUp.userName ? topUp.userName[0].toUpperCase() : "U"}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold">{topUp.userName || t("kullanici")}</h3>
                          <p className="text-[10px] text-text-secondary">{topUp.userEmail}</p>
                          <p className="text-[10px] text-text-secondary uppercase tracking-widest">
                            {new Date(topUp.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-bold ${isRefundOrPayment ? 'text-amber-600' : 'text-green-600'}`}>
                          {isRefundOrPayment ? '-' : '+'}₺{displayAmount.toFixed(2)}
                        </p>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest ${isRefundOrPayment ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                          {isRefundOrPayment ? t("odeme") : t("yuklendi")}
                        </span>
                      </div>
                    </div>

                    {!isRefundOrPayment && Number(topUp.amount) !== Number(topUp.creditedAmount) && (
                      <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wallet size={12} className="text-text-secondary" />
                          <span className="text-[10px] text-text-secondary font-medium">{t("ciroya-katki")}</span>
                        </div>
                        <span className="text-[10px] font-bold text-black">₺{Number(topUp.amount).toFixed(2)}</span>
                      </div>
                    )}

                    {topUp.bonusAmount > 0 && (
                      <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Gift size={12} className="text-text-secondary" />
                          <span className="text-[10px] text-text-secondary font-medium">Bonus:</span>
                        </div>
                        <span className="text-[10px] font-bold text-green-600">₺{topUp.bonusAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              {statsTopUps.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-xs text-text-secondary">
                  {t("bu-donemde-bakiye-yukleme-veya-odeme-islemi-yok")}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Popular Products */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">{t("populer-urunler")}</h2>
              <p className="text-[10px] text-text-secondary mt-0.5 font-medium">
                {getPeriodLabel()} · En çok satan {popularProducts.length} ürün
              </p>
            </div>
            {allPopularProducts.length > 3 ? (
              <button
                onClick={() => setShowAllPopularProducts(true)}
                className="text-xs font-bold text-text-secondary hover:text-black transition-colors"
              >
                {t("tumunu-gor")}
              </button>
            ) : (
              <TrendingUp size={16} className="text-text-secondary" />
            )}
          </div>
          {statsLoading && soldPopularProducts.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface p-6 text-center text-xs text-text-secondary">
              {t("yukleniyor")}
            </div>
          ) : (
            <div className="space-y-3">
              {popularProducts.map((product: any, idx: number) => {
                const share = maxSalesCount > 0 ? (product.salesCount / maxSalesCount) * 100 : 0;
                return (
                  <div key={product.id} className="bg-surface border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-black text-white' : 'bg-white border border-border text-text-secondary'}`}>
                          {idx + 1}
                        </div>
                        <img src={product.image} className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                        <div>
                          <h3 className="text-sm font-bold">{product.name}</h3>
                          <p className="text-[10px] text-text-secondary">
                            {product.salesCount} adet · ₺{Number(product.revenue || 0).toLocaleString('tr-TR')} ciro
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-text-secondary" />
                    </div>
                    <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-black rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(share, 3)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {popularProducts.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-xs text-text-secondary">
                  {t("bu-donemde-satilan-urun-yok")}
                </div>
              )}
            </div>
          )}
        </section>

        {/* All TopUps Modal */}
        {showAllTopUps && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              onClick={() => setShowAllTopUps(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <div className="relative bg-white border border-border w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl z-10 flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="p-6 border-b border-border flex items-center justify-between bg-surface/50 backdrop-blur">
                <div>
                  <h3 className="text-lg font-display font-bold text-black">{t("tum-bakiye-hareketleri")}</h3>
                  <p className="text-[10px] text-text-secondary font-medium">
                    {getPeriodLabel()} · {filteredTopUps.length} işlem
                  </p>
                </div>
                <button
                  onClick={() => setShowAllTopUps(false)}
                  className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Filters */}
              <div className="px-6 pt-4 space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={topUpSearchQuery}
                    onChange={(e) => setTopUpSearchQuery(e.target.value)}
                    placeholder={t("isim-veya-e-posta-ara")}
                    className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2.5 text-xs font-medium focus:outline-none focus:border-black transition-colors"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(['all', 'topup', 'payment'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setTopUpTypeFilter(type)}
                      className={cn(
                        "text-[10px] font-bold py-2 rounded-xl border transition-colors",
                        topUpTypeFilter === type
                          ? type === 'payment'
                            ? "bg-amber-500 text-white border-amber-500"
                            : type === 'topup'
                              ? "bg-green-500 text-white border-green-500"
                              : "bg-black text-white border-black"
                          : "bg-white border-border text-text-secondary"
                      )}
                    >
                      {type === 'all' ? t("tumu-2") : type === 'topup' ? t("yukleme") : t("odeme")}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="bg-green-50 border border-green-100 rounded-xl px-3 py-2">
                    <p className="text-[8px] font-bold text-green-700 uppercase tracking-wider">{t("yuklenen")}</p>
                    <p className="text-xs font-bold text-green-700">₺{topUpSummary.loaded.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    <p className="text-[8px] font-bold text-amber-700 uppercase tracking-wider">{t("odenen")}</p>
                    <p className="text-xs font-bold text-amber-700">₺{topUpSummary.spent.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
                    <p className="text-[8px] font-bold text-violet-700 uppercase tracking-wider">Bonus</p>
                    <p className="text-xs font-bold text-violet-700">₺{topUpSummary.bonus.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {/* List */}
              <div className="p-6 overflow-y-auto space-y-3 flex-1 no-scrollbar bg-surface/20">
                {filteredTopUps.map((topUp: any) => {
                  const isRefundOrPayment = topUp.amount < 0;
                  const displayAmount = Math.abs(Number(topUp.creditedAmount || topUp.amount));
                  return (
                    <div key={topUp.id || topUp._id} className="bg-white border border-border rounded-2xl p-4 space-y-3 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-50 border border-border flex items-center justify-center font-bold text-xs text-black">
                            {topUp.userName ? topUp.userName[0].toUpperCase() : "U"}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-black">{topUp.userName || t("kullanici")}</h4>
                            <span className="text-[9px] text-text-secondary font-medium block">{topUp.userEmail}</span>
                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-widest inline-block mt-1 ${isRefundOrPayment ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                              {isRefundOrPayment ? t("odeme") : t("yukleme")}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-bold font-display ${isRefundOrPayment ? 'text-amber-600' : 'text-green-500'}`}>
                            {isRefundOrPayment ? '-' : '+'}{displayAmount.toFixed(2)} TL
                          </span>
                          <span className="text-[9px] text-text-secondary font-medium block">
                            {new Date(topUp.timestamp).toLocaleDateString("tr-TR", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </span>
                        </div>
                      </div>
                      {topUp.bonusAmount > 0 && (
                        <div className="flex items-center justify-between bg-green-500/5 border border-green-500/10 px-3 py-1.5 rounded-xl">
                          <div className="flex items-center gap-1.5 text-green-600 text-[10px] font-bold">
                            <Gift size={10} />
                            Hediye Bakiye
                          </div>
                          <span className="text-[10px] font-bold text-green-600">+{topUp.bonusAmount.toFixed(2)} TL</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredTopUps.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-xs text-text-secondary">
                    {statsTopUps.length === 0
                      ? t("bu-donemde-bakiye-islemi-bulunmuyor")
                      : t("arama-veya-filtre-ile-eslesen-islem-bulunamadi")}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* All Popular Products Modal */}
        {showAllPopularProducts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div 
              onClick={() => setShowAllPopularProducts(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <div className="relative bg-white border border-border w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl z-10 flex flex-col max-h-[85vh]">
              {/* Header */}
              <div className="p-6 border-b border-border flex items-center justify-between bg-surface/50 backdrop-blur">
                <div>
                  <h3 className="text-lg font-display font-bold text-black">{t("urun-satis-istatistikleri")}</h3>
                  <p className="text-[10px] text-text-secondary font-medium">
                    {getPeriodLabel()} · {allPopularProducts.reduce((sum: number, p: any) => sum + (p.salesCount || 0), 0)} adet satıldı
                  </p>
                </div>
                <button
                  onClick={() => setShowAllPopularProducts(false)}
                  className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center hover:bg-gray-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* List */}
              <div className="p-6 overflow-y-auto space-y-3 flex-1 no-scrollbar bg-surface/20">
                {allPopularProducts.map((product: any, idx: number) => {
                  const share = maxSalesCount > 0 ? (product.salesCount / maxSalesCount) * 100 : 0;
                  const isSold = product.salesCount > 0;
                  return (
                    <div key={product.id} className="bg-white border border-border rounded-2xl p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx < 3 && isSold ? 'bg-black text-white' : 'bg-gray-50 border border-border text-text-secondary'}`}>
                            {idx + 1}
                          </div>
                          <img src={product.image} className="w-10 h-10 rounded-xl object-cover" referrerPolicy="no-referrer" />
                          <div>
                            <h4 className="text-xs font-bold text-black">{product.name}</h4>
                            <span className="text-[9px] text-text-secondary font-medium block">
                              {product.category} · ₺{Number(product.price || 0).toLocaleString('tr-TR')}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-bold font-display ${isSold ? 'text-black' : 'text-text-secondary'}`}>
                            {product.salesCount} Adet
                          </span>
                          <span className="text-[9px] text-text-secondary font-medium block">
                            {isSold ? `₺${Number(product.revenue || 0).toLocaleString('tr-TR')} ciro` : t("satis-yok")}
                          </span>
                        </div>
                      </div>
                      {isSold && (
                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-black rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(share, 3)}%` }}
                            />
                          </div>
                          <span className="text-[9px] font-bold text-text-secondary">{share.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {allPopularProducts.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-xs text-text-secondary">
                    {t("henuz-urun-bulunmuyor")}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (activeTab === 'staff') {
    return (
      <div className="p-6 pb-32 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">Personel</h1>
          <button 
            onClick={() => setShowAddStaffModal(true)}
            className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {staff.length === 0 ? (
            <div className="text-center py-12 bg-surface border border-dashed border-border rounded-3xl">
              <Users className="mx-auto text-text-secondary mb-3 opacity-20" size={48} />
              <p className="text-sm text-text-secondary">{t("henuz-personel-eklenmemis")}</p>
            </div>
          ) : (
            staff.map((member) => (
              <div key={member.id} className="bg-surface border border-border rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-border flex items-center justify-center font-bold text-lg">
                      {member.name[0]}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm">{member.name} {member.surname}</h3>
                      <p className="text-xs text-text-secondary">{getRoleLabel(member.role)}</p>
                      <p className="text-[10px] text-text-secondary opacity-70">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-lg uppercase",
                      member.status === 'Vardiyada' ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                    )}>
                      {member.status}
                    </span>
                    <button 
                      onClick={async () => {
                        await runManagerAction(async () => {
                          await deleteStaff(member.id);
                          await logChange('Personel Silindi', `${member.name} ${member.surname} personeli silindi.`);
                          await notifyManager('Personel Silindi', `${member.name} ${member.surname} başarıyla silindi.`, 'warning', undefined, 'manager');
                        }, 'Personel silinemedi.');
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Rol</label>
                  <select
                    value={member.role}
                    onChange={async (event) => {
                      const nextRole = event.target.value as UserRole;

                      if (nextRole === member.role) {
                        return;
                      }

                      await runManagerAction(async () => {
                        await updateStaffRole(member.id, nextRole);
                        await logChange(
                          t("personel-rolu-guncellendi"),
                          `${member.name} ${member.surname} rolü ${getRoleLabel(nextRole)} olarak güncellendi.`,
                        );
                        await notifyManager(
                          t("personel-rolu-guncellendi"),
                          `${member.name} ${member.surname} artık ${getRoleLabel(nextRole)} rolünde.`,
                          'success',
                          undefined,
                          'manager',
                        );
                      }, t("personel-rolu-guncellenemedi"));
                    }}
                    className="h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm font-medium text-[#171411] focus:outline-none focus:border-black transition-colors"
                  >
                    {USER_ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-secondary">
                    {t("musteri-secilirse-kisi-personel-listesinden-cikarilir")}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add Staff Modal */}
        <AnimatePresence>
          {showAddStaffModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddStaffModal(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-[40px] p-8 shadow-2xl overflow-hidden"
              >
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-display font-bold">Personel Ekle</h2>
                    <button 
                      onClick={() => setShowAddStaffModal(false)}
                      className="w-10 h-10 rounded-2xl bg-gray-50 flex items-center justify-center text-text-secondary"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary ml-1">Ad</label>
                        <input
                          type="text"
                          value={newStaff.name}
                          onChange={(e) => setNewStaff({ ...newStaff, name: e.target.value })}
                          className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 text-sm focus:ring-2 focus:ring-black transition-all"
                          placeholder="Ad"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary ml-1">Soyad</label>
                        <input
                          type="text"
                          value={newStaff.surname}
                          onChange={(e) => setNewStaff({ ...newStaff, surname: e.target.value })}
                          className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 text-sm focus:ring-2 focus:ring-black transition-all"
                          placeholder="Soyad"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary ml-1">E-posta</label>
                      <input
                        type="email"
                        value={newStaff.email}
                        onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                        className="w-full h-14 bg-gray-50 border-none rounded-2xl px-5 text-sm focus:ring-2 focus:ring-black transition-all"
                        placeholder="personel@example.com"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary ml-1">Rol</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setNewStaff({ ...newStaff, role: 'staff' })}
                          className={cn(
                            "h-14 rounded-2xl text-sm font-bold transition-all border-2",
                            newStaff.role === 'staff' 
                              ? "bg-black text-white border-black" 
                              : "bg-gray-50 text-text-secondary border-transparent"
                          )}
                        >
                          Garson
                        </button>
                        <button
                          onClick={() => setNewStaff({ ...newStaff, role: 'manager' })}
                          className={cn(
                            "h-14 rounded-2xl text-sm font-bold transition-all border-2",
                            newStaff.role === 'manager' 
                              ? "bg-black text-white border-black" 
                              : "bg-gray-50 text-text-secondary border-transparent"
                          )}
                        >
                          {t("yonetici")}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!newStaff.name || !newStaff.surname || !newStaff.email) {
                        await notifyManager('Hata', t("lutfen-tum-alanlari-doldurun"), 'error', user?.id);
                        return;
                      }

                      const ok = await runManagerAction(async () => {
                        await addStaff(newStaff);
                        await logChange('Personel Eklendi', `${newStaff.name} ${newStaff.surname} (${newStaff.email}) personeli eklendi.`);
                        await notifyManager('Personel Eklendi', `${newStaff.name} ${newStaff.surname} başarıyla eklendi.`, 'success', undefined, 'manager');
                      }, t("personel-eklenirken-bir-sorun-olustu"));

                      if (ok) {
                        setShowAddStaffModal(false);
                        setNewStaff({ name: '', surname: '', email: '', role: 'staff' });
                      }
                    }}
                    className="w-full h-16 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Plus size={20} />
                    Personel Ekle
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  if (activeTab === 'cms') {
    const cmsActiveKey = cmsView === 'products' ? `${cmsView}-${productManagementView}` : cmsView;
    return (
      <div className="p-6 pb-32 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-display font-bold">{t("icerik-yonetimi")}</h1>
          {cmsView !== 'dashboard' && (
            <button 
              onClick={() => {
                if (cmsView === 'products' && productManagementView !== 'menu') {
                  setProductManagementView('menu');
                  return;
                }

                setCmsView('dashboard');
              }}
              className="text-xs font-bold text-text-secondary hover:text-black flex items-center gap-1"
            >
              <ChevronRight size={14} className="rotate-180" />
              {t("geri-don")}
            </button>
          )}
        </div>
        
        <AnimatePresence mode="wait">
          <motion.div
            key={cmsActiveKey}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="space-y-6"
          >
        
        {cmsView === 'dashboard' && (
          <div className="bg-surface border border-border rounded-3xl overflow-hidden">
            {[
              { label: t("urun-yonetimi"), description: t("menu-ve-fiyatlar"), icon: Package, onClick: () => { setCmsView('products'); setProductManagementView('menu'); } },
              { label: t("kampanya-yonetimi"), description: t("banner-ve-firsatlar"), icon: Gift, onClick: () => setCmsView('campaigns') },
              { label: t("son-degisiklikler"), description: t("islem-gunlugu"), icon: Activity, onClick: () => setCmsView('changes') },
              { label: t("kayitli-kullanicilar"), description: t("musteri-listesi"), icon: Users, onClick: () => setCmsView('users') },
              { label: t("masa-qr-kodlari"), description: '60 Masa Linki ve QR', icon: QrCode, onClick: () => setCmsView('tables') },
              { label: 'Dil Yönetimi', description: 'Sistem metinleri ve çeviriler', icon: Languages, onClick: () => setCmsView('languages') },
              { label: 'Envanter', description: 'Malzeme stokları ve stok girişleri', icon: Package, onClick: () => setCmsView('inventory') },
            ].map((item: any, idx) => (
              <button 
                key={idx} 
                onClick={item.onClick}
                className="w-full p-5 flex items-center justify-between hover:bg-white border-b border-border last:border-0 transition-colors text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center text-text-secondary shrink-0 transition-transform group-hover:scale-105">
                    <item.icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-black">{item.label}</h3>
                    <p className="text-[11px] text-text-secondary mt-0.5">{item.description}</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-text-secondary shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        )}

        {cmsView === 'products' && (
          <div className="space-y-5">
            {productManagementView === 'menu' && (
              <div className="bg-surface border border-border rounded-3xl overflow-hidden">
                {[
                  {
                    id: 'products',
                    title: t("urun-yonetimi"),
                    description: `${products.length} ürün kaydı ve menü akışı`,
                    icon: Package,
                  },
                  {
                    id: 'categories',
                    title: t("kategori-yonetimi"),
                    description: `${categories.length} kategori ve ürün bağlantısı`,
                    icon: Layers,
                  },
                  {
                    id: 'ingredients',
                    title: t("alerjen-yonetimi"),
                    description: `${ingredients.length} alerjen ve malzeme kaydı`,
                    icon: Leaf,
                  },
                ].map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setProductManagementView(section.id as 'products' | 'categories' | 'ingredients')}
                    className="w-full p-5 flex items-center justify-between hover:bg-white border-b border-border last:border-0 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white border border-border flex items-center justify-center text-text-secondary shrink-0 transition-transform group-hover:scale-105">
                        <section.icon size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-black">{section.title}</h3>
                        <p className="text-[11px] text-text-secondary mt-0.5">{section.description}</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-text-secondary shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            )}

            {productManagementView === 'products' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider">Urun Yonetimi</h2>
                    <p className="text-[11px] text-text-secondary">Menu urunleri, fiyat ve stok bilgileri</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(true)}
                    className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white shadow-lg shadow-black/10"
                  >
                    <Plus size={14} />
                    Yeni Urun
                  </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {['Tumu', ...categories.map((category) => category.name)].map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setProductFilter(category === 'Tumu' ? t("tumu-2") : category)}
                      className={cn(
                        'whitespace-nowrap rounded-xl border px-4 py-2 text-xs font-bold transition-colors',
                        productFilter === (category === 'Tumu' ? t("tumu-2") : category)
                          ? 'border-black bg-black text-white'
                          : 'border-border bg-white text-text-secondary',
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={productSearchQuery}
                    onChange={(event) => setProductSearchQuery(event.target.value)}
                    placeholder="Urun veya kategori ara"
                    className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
                  />
                  <select
                    value={productStockFilter}
                    onChange={(event) => setProductStockFilter(event.target.value as 'all' | 'in' | 'out')}
                    className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
                  >
                    <option value="all">Stok: Tumu</option>
                    <option value="in">Stokta</option>
                    <option value="out">Stok Disi</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    {filteredProductCards.length} urun gosteriliyor
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = filteredProductCards.map((product) => product.id);
                      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedProducts.includes(id));
                      setSelectedProducts((prev) => {
                        if (allVisibleSelected) {
                          return prev.filter((id) => !visibleIds.includes(id));
                        }

                        return Array.from(new Set([...prev, ...visibleIds]));
                      });
                    }}
                    className="rounded-xl border border-border bg-white px-4 py-2 text-[11px] font-bold text-black transition-colors hover:border-black"
                  >
                    {filteredProductCards.length > 0 && filteredProductCards.every((product) => selectedProducts.includes(product.id))
                      ? 'Secimi Temizle'
                      : 'Tumunu Sec'}
                  </button>
                </div>

                {selectedProducts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[28px] bg-black p-4 text-white shadow-xl"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold">{selectedProducts.length} urun secildi</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setBulkActionType('price')} className="rounded-lg bg-white/10 px-3 py-2 text-[11px] font-bold">
                          Fiyat
                        </button>
                        <button type="button" onClick={() => setBulkActionType('discount')} className="rounded-lg bg-white/10 px-3 py-2 text-[11px] font-bold">
                          Indirim
                        </button>
                        <button type="button" onClick={() => setBulkActionType('delete')} className="rounded-lg bg-red-500/20 px-3 py-2 text-[11px] font-bold text-red-200">
                          Sil
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                <AnimatePresence>
                  {bulkActionType && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setBulkActionType(null)}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                      />
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative z-10 w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl"
                      >
                        <div className="space-y-5">
                          <h3 className="text-xl font-display font-bold">
                            {bulkActionType === 'price' ? 'Toplu Fiyat Ayarla' : bulkActionType === 'discount' ? 'Toplu Indirim Uygula' : 'Secili Urunleri Sil'}
                          </h3>
                          {bulkActionType !== 'delete' ? (
                            <div className="space-y-4">
                              <div className="flex rounded-xl border border-border bg-surface p-1">
                                <button
                                  type="button"
                                  onClick={() => setBulkIsPercentage(true)}
                                  className={cn(
                                    'flex-1 rounded-lg py-2 text-xs font-bold transition-all',
                                    bulkIsPercentage ? 'bg-white text-black shadow-sm' : 'text-text-secondary',
                                  )}
                                >
                                  Yuzde
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setBulkIsPercentage(false)}
                                  className={cn(
                                    'flex-1 rounded-lg py-2 text-xs font-bold transition-all',
                                    !bulkIsPercentage ? 'bg-white text-black shadow-sm' : 'text-text-secondary',
                                  )}
                                >
                                  TL
                                </button>
                              </div>
                              <input
                                type="number"
                                value={bulkValue}
                                onChange={(event) => setBulkValue(event.target.value)}
                                placeholder={bulkActionType === 'price' ? 'Deger girin' : 'Indirim girin'}
                                className="h-12 w-full rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
                              />
                            </div>
                          ) : (
                            <p className="text-sm leading-6 text-text-secondary">
                              Secili {selectedProducts.length} urunu silmek uzeresiniz. Bu islem geri alinmaz.
                            </p>
                          )}
                          <div className="flex gap-3">
                            <button
                              type="button"
                              onClick={() => setBulkActionType(null)}
                              className="flex-1 rounded-2xl border border-border px-4 py-4 text-sm font-bold"
                            >
                              Iptal
                            </button>
                            <button
                              type="button"
                              onClick={handleBulkAction}
                              className={cn(
                                'flex-1 rounded-2xl px-4 py-4 text-sm font-bold text-white',
                                bulkActionType === 'delete' ? 'bg-red-500' : 'bg-black',
                              )}
                            >
                              Uygula
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                <div className="space-y-3">
                  {filteredProductCards.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-border bg-surface px-5 py-10 text-center">
                      <p className="text-sm font-bold text-black">Gosterilecek urun yok</p>
                      <p className="mt-2 text-xs leading-5 text-text-secondary">
                        Secili kategori icinde urun bulunmuyor. Yeni urun ekleyebilir veya filtreyi degistirebilirsiniz.
                      </p>
                    </div>
                  ) : (
                    filteredProductCards.map((product) => (
                      <div key={product.id} className={cn('rounded-[28px] border bg-surface p-4', selectedProducts.includes(product.id) ? 'border-black bg-white shadow-md' : 'border-border')}>
                        <div className="flex items-start gap-4">
                          <button
                            type="button"
                            onClick={() => toggleProductSelection(product.id)}
                            className={cn(
                              'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                              selectedProducts.includes(product.id) ? 'border-black bg-black text-white' : 'border-border bg-white text-transparent',
                            )}
                          >
                            <Check size={14} />
                          </button>
                          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <Coffee size={22} className="text-text-secondary opacity-30" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-black">{product.name}</p>
                                <p className="mt-1 text-[11px] text-text-secondary">{product.category}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-black">TL {product.price}</p>
                                <span className={cn(
                                  'mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-bold',
                                  product.inStock ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600',
                                )}>
                                  {product.inStock ? 'Stokta' : 'Stok Disi'}
                                </span>
                              </div>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <p className="text-[11px] text-text-secondary">
                                {(product.ingredients || []).length} alerjen/malzeme baglantisi
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProduct(product.id);
                                  setEditProductData({ ...product });
                                }}
                                className="rounded-xl border border-border bg-white px-4 py-2 text-xs font-bold text-black transition-colors hover:border-black"
                              >
                                Duzenle
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {productManagementView === 'categories' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider">Kategori Yonetimi</h2>
                    <p className="text-[11px] text-text-secondary">Her kategori urunlerle birebir baglidir</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCategoryModal()}
                    className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white shadow-lg shadow-black/10"
                  >
                    <Plus size={14} />
                    Yeni Kategori
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={categorySearchQuery}
                    onChange={(event) => setCategorySearchQuery(event.target.value)}
                    placeholder="Kategori ara"
                    className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
                  />
                  <select
                    value={categoryUsageFilter}
                    onChange={(event) => setCategoryUsageFilter(event.target.value as 'all' | 'used' | 'unused')}
                    className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
                  >
                    <option value="all">Baglanti: Tumu</option>
                    <option value="used">Urun bagli</option>
                    <option value="unused">Bos kategoriler</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    {filteredCategoryCards.length} kategori gosteriliyor
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = filteredCategoryCards.map((category) => category.id);
                      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedCategories.includes(id));
                      setSelectedCategories((prev) => {
                        if (allVisibleSelected) {
                          return prev.filter((id) => !visibleIds.includes(id));
                        }

                        return Array.from(new Set([...prev, ...visibleIds]));
                      });
                    }}
                    className="rounded-xl border border-border bg-white px-4 py-2 text-[11px] font-bold text-black transition-colors hover:border-black"
                  >
                    {filteredCategoryCards.length > 0 && filteredCategoryCards.every((category) => selectedCategories.includes(category.id))
                      ? 'Secimi Temizle'
                      : 'Tumunu Sec'}
                  </button>
                </div>

                {selectedCategories.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[28px] bg-black p-4 text-white shadow-xl"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold">{selectedCategories.length} kategori secildi</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setCategoryBulkAction('clear-image')} className="rounded-lg bg-white/10 px-3 py-2 text-[11px] font-bold">
                          Gorsel Temizle
                        </button>
                        <button type="button" onClick={() => setCategoryBulkAction('delete')} className="rounded-lg bg-red-500/20 px-3 py-2 text-[11px] font-bold text-red-200">
                          Sil
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                <AnimatePresence>
                  {categoryBulkAction && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCategoryBulkAction(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl">
                        <div className="space-y-5">
                          <h3 className="text-xl font-display font-bold">
                            {categoryBulkAction === 'delete' ? 'Secili Kategorileri Sil' : 'Secili Kategorilerden Gorseli Temizle'}
                          </h3>
                          <p className="text-sm leading-6 text-text-secondary">
                            {selectedCategories.length} kategori uzerinde toplu islem yapilacak.
                          </p>
                          <div className="flex gap-3">
                            <button type="button" onClick={() => setCategoryBulkAction(null)} className="flex-1 rounded-2xl border border-border px-4 py-4 text-sm font-bold">
                              Iptal
                            </button>
                            <button type="button" onClick={handleCategoryBulkAction} className={cn('flex-1 rounded-2xl px-4 py-4 text-sm font-bold text-white', categoryBulkAction === 'delete' ? 'bg-red-500' : 'bg-black')}>
                              Uygula
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                <div className="space-y-3">
                  {filteredCategoryCards.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-border bg-surface px-5 py-10 text-center">
                      <p className="text-sm font-bold text-black">Kategori kaydi yok</p>
                      <p className="mt-2 text-xs leading-5 text-text-secondary">
                        Once kategori ekleyin, sonra urunleri ilgili kategoriye baglayin.
                      </p>
                    </div>
                  ) : (
                    filteredCategoryCards.map((category) => {
                      const Icon = ICON_MAP[category.iconName] || Coffee;
                      const usageCount = getCategoryUsageCount(category.name);

                      return (
                        <div key={category.id} className={cn('rounded-[28px] border bg-surface p-4', selectedCategories.includes(category.id) ? 'border-black bg-white shadow-md' : 'border-border')}>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => toggleCategorySelection(category.id)}
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                                selectedCategories.includes(category.id) ? 'border-black bg-black text-white' : 'border-border bg-white text-transparent',
                              )}
                            >
                              <Check size={14} />
                            </button>
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white">
                              {category.image ? (
                                <img src={category.image} alt={category.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <Icon size={22} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-black">{category.name}</p>
                              <p className="mt-1 text-[11px] text-text-secondary">{usageCount} urun bagli</p>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => openCategoryModal(category)}
                              className="rounded-xl border border-border bg-white px-4 py-3 text-xs font-bold text-black transition-colors hover:border-black"
                            >
                              Duzenle
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!window.confirm(`${category.name} kategorisini silmek istediginize emin misiniz?`)) {
                                  return;
                                }

                                const ok = await runManagerAction(async () => {
                                  await deleteCategory(category.id);
                                  await logChange('Kategori Silindi', `${category.name} kategorisi silindi.`);
                                  await notifyManager('Kategori Silindi', `${category.name} basariyla silindi.`, 'warning', undefined, 'manager');
                                }, 'Kategori silinemedi.');

                                if (ok && productFilter === category.name) {
                                  setProductFilter(t("tumu-2"));
                                }
                              }}
                              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {productManagementView === 'ingredients' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-wider">Alerjen Yonetimi</h2>
                    <p className="text-[11px] text-text-secondary">Alerjenler urun kartlarina isim bazli baglidir</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openIngredientModal()}
                    className="flex items-center gap-2 rounded-xl bg-black px-4 py-2 text-xs font-bold text-white shadow-lg shadow-black/10"
                  >
                    <Plus size={14} />
                    Yeni Alerjen
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    value={ingredientSearchQuery}
                    onChange={(event) => setIngredientSearchQuery(event.target.value)}
                    placeholder="Alerjen ara"
                    className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
                  />
                  <select
                    value={ingredientUsageFilter}
                    onChange={(event) => setIngredientUsageFilter(event.target.value as 'all' | 'used' | 'unused')}
                    className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
                  >
                    <option value="all">Kullanim: Tumu</option>
                    <option value="used">Urunlerde kullanilan</option>
                    <option value="unused">Bos alerjenler</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-text-secondary">
                    {filteredIngredientCards.length} alerjen gosteriliyor
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = filteredIngredientCards.map((ingredient) => ingredient.id);
                      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIngredients.includes(id));
                      setSelectedIngredients((prev) => {
                        if (allVisibleSelected) {
                          return prev.filter((id) => !visibleIds.includes(id));
                        }

                        return Array.from(new Set([...prev, ...visibleIds]));
                      });
                    }}
                    className="rounded-xl border border-border bg-white px-4 py-2 text-[11px] font-bold text-black transition-colors hover:border-black"
                  >
                    {filteredIngredientCards.length > 0 && filteredIngredientCards.every((ingredient) => selectedIngredients.includes(ingredient.id))
                      ? 'Secimi Temizle'
                      : 'Tumunu Sec'}
                  </button>
                </div>

                {selectedIngredients.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-[28px] bg-black p-4 text-white shadow-xl"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-bold">{selectedIngredients.length} alerjen secildi</p>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setIngredientBulkAction('reset-icon')} className="rounded-lg bg-white/10 px-3 py-2 text-[11px] font-bold">
                          Ikonu Sifirla
                        </button>
                        <button type="button" onClick={() => setIngredientBulkAction('delete')} className="rounded-lg bg-red-500/20 px-3 py-2 text-[11px] font-bold text-red-200">
                          Sil
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                <AnimatePresence>
                  {ingredientBulkAction && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIngredientBulkAction(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl">
                        <div className="space-y-5">
                          <h3 className="text-xl font-display font-bold">
                            {ingredientBulkAction === 'delete' ? 'Secili Alerjenleri Sil' : 'Secili Alerjenlerin Ikonunu Sifirla'}
                          </h3>
                          <p className="text-sm leading-6 text-text-secondary">
                            {selectedIngredients.length} alerjen uzerinde toplu islem yapilacak.
                          </p>
                          <div className="flex gap-3">
                            <button type="button" onClick={() => setIngredientBulkAction(null)} className="flex-1 rounded-2xl border border-border px-4 py-4 text-sm font-bold">
                              Iptal
                            </button>
                            <button type="button" onClick={handleIngredientBulkAction} className={cn('flex-1 rounded-2xl px-4 py-4 text-sm font-bold text-white', ingredientBulkAction === 'delete' ? 'bg-red-500' : 'bg-black')}>
                              Uygula
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                <div className="space-y-3">
                  {filteredIngredientCards.length === 0 ? (
                    <div className="rounded-[28px] border border-dashed border-border bg-surface px-5 py-10 text-center">
                      <p className="text-sm font-bold text-black">Alerjen kaydi yok</p>
                      <p className="mt-2 text-xs leading-5 text-text-secondary">
                        Urunlerde kullanmadan once alerjen ve malzemeleri buradan tanimlayin.
                      </p>
                    </div>
                  ) : (
                    filteredIngredientCards.map((ingredient) => {
                      const usageCount = getIngredientUsageCount(ingredient.name);
                      const Icon = ICON_MAP[ingredient.iconName] || Star;

                      return (
                        <div key={ingredient.id} className={cn('rounded-[28px] border bg-surface p-4', selectedIngredients.includes(ingredient.id) ? 'border-black bg-white shadow-md' : 'border-border')}>
                          <div className="flex items-center gap-4">
                            <button
                              type="button"
                              onClick={() => toggleIngredientSelection(ingredient.id)}
                              className={cn(
                                'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition-colors',
                                selectedIngredients.includes(ingredient.id) ? 'border-black bg-black text-white' : 'border-border bg-white text-transparent',
                              )}
                            >
                              <Check size={14} />
                            </button>
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-white">
                              <Icon size={22} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-black">{ingredient.name}</p>
                              <p className="mt-1 text-[11px] text-text-secondary">{usageCount} urunde secili</p>
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => openIngredientModal(ingredient)}
                              className="rounded-xl border border-border bg-white px-4 py-3 text-xs font-bold text-black transition-colors hover:border-black"
                            >
                              Duzenle
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setIngredientPendingDelete({
                                  id: ingredient.id,
                                  name: ingredient.name,
                                  usageCount,
                                })
                              }
                              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
                            >
                              Sil
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Campaign Management View */}
        {cmsView === 'campaigns' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-display font-bold">Kampanya Yönetimi</h2>
                <p className="text-xs text-text-secondary">Aktif indirimler, cüzdan yükleme bonusları ve KP sadakat ödülleri</p>
              </div>
              <button 
                onClick={() => openCampaignModal()}
                className="flex items-center gap-2 bg-black hover:bg-neutral-800 text-white px-5 py-3 rounded-2xl text-xs font-bold shadow-lg shadow-black/10 transition-all active:scale-95"
              >
                <Plus size={16} />
                Yeni Kampanya Oluştur
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-surface border border-border">
                <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Toplam Kampanya</p>
                <p className="text-2xl font-display font-bold mt-1 text-black">{campaigns.length}</p>
                <span className="text-[10px] text-text-secondary font-medium">{campaigns.filter(c => c.active).length} Aktif</span>
              </div>
              <div className="p-4 rounded-2xl bg-surface border border-border">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">İndirimler</p>
                  <Tag size={13} className="text-text-secondary" />
                </div>
                <p className="text-2xl font-display font-bold mt-1 text-black">
                  {campaigns.filter(c => c.category === 'discount' || c.type === 'discount' || c.category === 'operational').length}
                </p>
                <span className="text-[10px] text-text-secondary font-medium">Menü & Sepet</span>
              </div>
              <div className="p-4 rounded-2xl bg-surface border border-border">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">Cüzdan Bonusu</p>
                  <CreditCard size={13} className="text-text-secondary" />
                </div>
                <p className="text-2xl font-display font-bold mt-1 text-black">
                  {campaigns.filter(c => c.category === 'financial' || c.type === 'balance_bonus' || c.type === 'fixed_bonus').length}
                </p>
                <span className="text-[10px] text-text-secondary font-medium">Bakiye Yükleme</span>
              </div>
              <div className="p-4 rounded-2xl bg-surface border border-border">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">KP Ödülleri</p>
                  <Star size={13} className="text-text-secondary" />
                </div>
                <p className="text-2xl font-display font-bold mt-1 text-black">
                  {campaigns.filter(c => c.category === 'loyalty' || c.type === 'points_free_product' || c.type === 'points_discount_product' || c.type === 'point_reward').length}
                </p>
                <span className="text-[10px] text-text-secondary font-medium">Sadakat Puanı</span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="space-y-3">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    type="text"
                    value={campaignSearchQuery}
                    onChange={(event) => setCampaignSearchQuery(event.target.value)}
                    placeholder="Kampanya başlığı veya açıklaması ara..."
                    className="w-full h-11 pl-11 pr-4 rounded-2xl border border-border bg-white text-sm focus:outline-none focus:border-black transition-colors"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={campaignStatusFilter}
                    onChange={(event) => setCampaignStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}
                    className="h-11 rounded-2xl border border-border bg-white px-4 text-xs font-bold focus:outline-none focus:border-black"
                  >
                    <option value="all">Durum: Tümü</option>
                    <option value="active">Sadece Aktif</option>
                    <option value="inactive">Sadece Pasif</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const visibleIds = filteredCampaignCards.map((campaign) => campaign.id);
                      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedCampaigns.includes(id));
                      setSelectedCampaigns((prev) => {
                        if (allVisibleSelected) {
                          return prev.filter((id) => !visibleIds.includes(id));
                        }
                        return Array.from(new Set([...prev, ...visibleIds]));
                      });
                    }}
                    className="rounded-2xl border border-border bg-white px-4 py-2 text-xs font-bold text-black transition-colors hover:border-black"
                  >
                    {filteredCampaignCards.length > 0 && filteredCampaignCards.every((campaign) => selectedCampaigns.includes(campaign.id))
                      ? 'Seçimi Temizle'
                      : 'Tümünü Seç'}
                  </button>
                </div>
              </div>

              {/* Filter Category Pills (Clean Monochrome) */}
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'all', label: 'Tüm Kampanyalar' },
                  { id: 'discount', label: 'İndirimler' },
                  { id: 'financial', label: 'Cüzdan Bonusları' },
                  { id: 'loyalty', label: 'KP Ödülleri' },
                ].map(filter => {
                  const isCurrent = campaignCategoryFilter === filter.id;
                  return (
                    <button
                      key={filter.id}
                      onClick={() => setCampaignCategoryFilter(filter.id as any)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all",
                        isCurrent
                          ? "bg-black text-white shadow-sm"
                          : "bg-surface border border-border text-text-secondary hover:border-black/50 hover:text-black"
                      )}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedCampaigns.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-black p-4 text-white shadow-xl flex items-center justify-between gap-3"
              >
                <p className="text-xs font-bold">{selectedCampaigns.length} kampanya seçildi</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setCampaignBulkAction('activate')} className="rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-bold transition-colors">
                    Aktif Et
                  </button>
                  <button type="button" onClick={() => setCampaignBulkAction('deactivate')} className="rounded-xl bg-white/10 hover:bg-white/20 px-3 py-2 text-xs font-bold transition-colors">
                    Pasif Et
                  </button>
                  <button type="button" onClick={() => setCampaignBulkAction('delete')} className="rounded-xl bg-red-500/20 hover:bg-red-500/30 px-3 py-2 text-xs font-bold text-red-200 transition-colors">
                    Sil
                  </button>
                </div>
              </motion.div>
            )}

            <AnimatePresence>
              {campaignBulkAction && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCampaignBulkAction(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl space-y-5">
                    <h3 className="text-xl font-display font-bold">
                      {campaignBulkAction === 'delete'
                        ? 'Seçili Kampanyaları Sil'
                        : campaignBulkAction === 'activate'
                          ? 'Seçili Kampanyaları Aktif Et'
                          : 'Seçili Kampanyaları Pasif Et'}
                    </h3>
                    <p className="text-sm leading-6 text-text-secondary">
                      {selectedCampaigns.length} kampanya üzerinde toplu işlem uygulanacak. Onaylıyor musunuz?
                    </p>
                    <div className="flex gap-3">
                      <button type="button" onClick={() => setCampaignBulkAction(null)} className="flex-1 rounded-2xl border border-border px-4 py-4 text-sm font-bold">
                        İptal
                      </button>
                      <button type="button" onClick={handleCampaignBulkAction} className={cn('flex-1 rounded-2xl px-4 py-4 text-sm font-bold text-white', campaignBulkAction === 'delete' ? 'bg-red-500' : 'bg-black')}>
                        Uygula
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 gap-3">
              {filteredCampaignCards.length === 0 && (
                <div className="rounded-[28px] border border-dashed border-border bg-surface px-5 py-12 text-center space-y-3">
                  <Gift size={28} className="mx-auto text-text-secondary/40" />
                  <p className="text-sm font-bold text-black">Kampanya Bulunamadı</p>
                  <p className="text-xs text-text-secondary max-w-xs mx-auto">
                    Seçili arama veya filtre kriterlerine uygun kampanya bulunmuyor.
                  </p>
                </div>
              )}

              {filteredCampaignCards.map(camp => {
                const isFinancial = camp.category === 'financial' || camp.type === 'balance_bonus' || camp.type === 'fixed_bonus';
                const isLoyalty = camp.category === 'loyalty' || camp.type === 'points_free_product' || camp.type === 'points_discount_product' || camp.type === 'point_reward';
                
                const typeBadge = isFinancial
                  ? { label: 'Cüzdan Bonusu', icon: CreditCard }
                  : isLoyalty
                    ? { label: 'KP Sadakat Ödülü', icon: Star }
                    : { label: 'İndirim Kampanyası', icon: Tag };

                const targetProductName = camp.targetProductId 
                  ? products.find(p => p.id === camp.targetProductId)?.name 
                  : null;

                const targetLabel = targetProductName 
                  ? `Ürün: ${targetProductName}` 
                  : camp.targetCategory 
                    ? `Kategori: ${camp.targetCategory}` 
                    : isFinancial 
                      ? `Min. ₺${camp.minLoadAmount || 0} Yükleme`
                      : 'Tüm Menü';

                const perkLabel = isFinancial
                  ? `+${camp.value}% Bonus`
                  : isLoyalty
                    ? (camp.type === 'points_discount_product' || (camp.value && camp.value > 0))
                      ? `%${camp.value} İndirim (${camp.pointsCost} KP)`
                      : `Hediye Ürün (${camp.pointsCost} KP)`
                    : (camp.discountType === 'fixed' ? `-₺${camp.value}` : `-%${camp.value}`);

                return (
                  <div 
                    key={camp.id} 
                    className={cn(
                      'bg-surface border rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:bg-white transition-all',
                      selectedCampaigns.includes(camp.id) ? 'border-black bg-white shadow-md' : 'border-border'
                    )}
                  >
                    <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleCampaignSelection(camp.id)}
                        className={cn(
                          'flex h-6 w-6 shrink-0 mt-1 sm:mt-0 items-center justify-center rounded-lg border transition-colors',
                          selectedCampaigns.includes(camp.id) ? 'border-black bg-black text-white' : 'border-border bg-white text-transparent',
                        )}
                      >
                        <Check size={14} />
                      </button>

                      <div className="w-14 h-14 rounded-2xl bg-zinc-100 border border-border flex items-center justify-center overflow-hidden shrink-0 relative">
                        {camp.image ? (
                          <img src={camp.image} alt={camp.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <typeBadge.icon size={20} className="text-zinc-400" />
                        )}
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-black truncate">{camp.title}</h3>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-border bg-neutral-100 text-neutral-800 flex items-center gap-1">
                            <typeBadge.icon size={10} />
                            {typeBadge.label}
                          </span>
                        </div>
                        <p className="text-xs text-text-secondary line-clamp-1">{camp.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-text-secondary pt-0.5">
                          <span className="font-medium bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded-md">{targetLabel}</span>
                          <span>•</span>
                          <span>Son: {new Date(camp.expiryDate).toLocaleDateString('tr-TR')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                      {/* Perk Highlight */}
                      <div className="text-left sm:text-right">
                        <span className="text-sm font-display font-bold text-black block">{perkLabel}</span>
                      </div>

                      {/* Active/Passive Toggle Button */}
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await runManagerAction(async () => {
                            await updateCampaign(camp.id, { active: !camp.active });
                            await notifyManager('Kampanya Güncellendi', `${camp.title} ${!camp.active ? 'aktif' : 'pasif'} yapıldı.`, 'success', undefined, 'manager');
                          }, 'Durum değiştirilemedi.');
                        }}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                          camp.active
                            ? "bg-black text-white border-black"
                            : "bg-surface text-text-secondary border-border hover:bg-neutral-100"
                        )}
                        title="Tıkla ve durumu değiştir"
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", camp.active ? "bg-emerald-400" : "bg-neutral-400")} />
                        {camp.active ? 'Aktif' : 'Pasif'}
                      </button>

                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => openCampaignModal(camp)}
                          className="p-2 text-text-secondary hover:bg-neutral-100 hover:text-black rounded-xl transition-colors"
                          title="Düzenle"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button 
                          onClick={async () => {
                            await runManagerAction(async () => {
                              await deleteCampaign(camp.id);
                              await logChange('Kampanya Silindi', `${camp.title} kaldırıldı.`);
                              await notifyManager('Kampanya Silindi', `${camp.title} başarıyla silindi.`, 'warning', undefined, 'manager');
                            }, 'Kampanya silinemedi.');
                          }}
                          className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                          title="Sil"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {cmsView === 'languages' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider">Dil Yönetimi</h2>
              <span className="text-[10px] font-bold text-text-secondary bg-surface px-2 py-1 rounded-lg border border-border">
                {Object.keys(langOverrides).length} / {Object.keys(SYSTEM_TEXTS).length} metin düzenlendi
              </span>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
              <input
                type="text"
                value={langSearchQuery}
                onChange={(event) => setLangSearchQuery(event.target.value)}
                placeholder="Canlı arama: metin veya anahtar ara..."
                className="w-full h-11 rounded-2xl border border-border bg-white pl-9 pr-4 text-sm focus:outline-none focus:border-black"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {['all', ...langAllGroups].map((group) => (
                <button
                  key={group}
                  onClick={() => setLangGroupFilter(group)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-bold border transition-colors whitespace-nowrap',
                    langGroupFilter === group
                      ? 'bg-black text-white border-black'
                      : 'bg-white text-text-secondary border-border hover:border-black'
                  )}
                >
                  {group === 'all' ? 'Tümü' : (LANG_GROUP_LABELS[group] ?? group)}
                </button>
              ))}
            </div>

            {langFilteredKeys.length === 0 ? (
              <div className="text-center py-12 text-sm text-text-secondary">Sonuç bulunamadı.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {langFilteredKeys.map((key) => {
                  const current = langOverrides[key] ?? SYSTEM_TEXTS[key];
                  const draft = langDrafts[key] ?? current;
                  const isChanged = draft !== current;
                  const isOverride = key in langOverrides;
                  const group = SYSTEM_TEXT_GROUPS[key];

                  return (
                    <div key={key} className="bg-surface border border-border rounded-2xl p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-[10px] text-text-secondary truncate font-mono">{key}</code>
                        <span className="px-2 py-0.5 rounded-full bg-black/5 text-[10px] font-bold whitespace-nowrap">
                          {LANG_GROUP_LABELS[group] ?? group}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={draft}
                        onChange={(event) => setLangDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                        className="w-full h-10 rounded-xl border border-border bg-white px-3 text-sm focus:outline-none focus:border-black"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => saveLangText(key)}
                          disabled={langSaving === key || !isChanged}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                            isChanged && langSaving !== key
                              ? 'bg-black text-white'
                              : 'bg-black/5 text-text-secondary cursor-not-allowed'
                          )}
                        >
                          <Check size={12} />
                          Kaydet
                        </button>
                        {isOverride && (
                          <button
                            onClick={() => resetLangText(key)}
                            disabled={langSaving === key}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <RotateCcw size={12} />
                            Varsayılana Sıfırla
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {cmsView === 'changes' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider">{t("islem-gunlugu")}</h2>
              <span className="text-[10px] font-bold text-text-secondary bg-surface px-2 py-1 rounded-lg border border-border">
                {filteredRecentChanges.length} / {recentChanges.length} İşlem
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <select
                value={logActionFilter}
                onChange={(event) => setLogActionFilter(event.target.value)}
                className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
              >
                <option value="all">{t("islem-turu-tumu")}</option>
                {logActionOptions.map((action) => (
                  <option key={action} value={action}>
                    {action}
                  </option>
                ))}
              </select>

              <select
                value={logManagerFilter}
                onChange={(event) => setLogManagerFilter(event.target.value)}
                className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
              >
                <option value="all">{t("islemi-yapan-tumu")}</option>
                {logManagerOptions.map((manager) => (
                  <option key={manager} value={manager}>
                    {manager}
                  </option>
                ))}
              </select>

              <select
                value={logDateFilter}
                onChange={(event) => setLogDateFilter(event.target.value as 'today' | 'yesterday' | 'last7' | 'last30' | 'single' | 'range')}
                className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
              >
                <option value="today">{t("islem-tarihi-bugun")}</option>
                <option value="yesterday">{t("islem-tarihi-dun")}</option>
                <option value="last7">{t("islem-tarihi-son-7-gun")}</option>
                <option value="last30">{t("islem-tarihi-son-1-ay")}</option>
                <option value="single">{t("islem-tarihi-ozel-bir-gun")}</option>
                <option value="range">{t("islem-tarihi-ozel-tarih-araligi")}</option>
              </select>

              <input
                type="time"
                value={logTimeFilter}
                onChange={(event) => setLogTimeFilter(event.target.value)}
                className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
              />

              {logDateFilter === 'single' && (
                <input
                  type="date"
                  value={logSingleDate}
                  onChange={(event) => setLogSingleDate(event.target.value)}
                  className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black md:col-span-2"
                />
              )}

              {logDateFilter === 'range' && (
                <>
                  <input
                    type="date"
                    value={logStartDate}
                    onChange={(event) => setLogStartDate(event.target.value)}
                    className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
                  />
                  <input
                    type="date"
                    value={logEndDate}
                    onChange={(event) => setLogEndDate(event.target.value)}
                    className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
                  />
                </>
              )}
            </div>

            <div className="space-y-3">
              {filteredRecentChanges.length === 0 ? (
                <div className="text-center py-12 text-text-secondary space-y-2">
                  <Activity size={32} className="mx-auto opacity-20" />
                  <p className="text-xs">{t("secilen-filtrelere-uygun-islem-bulunamadi")}</p>
                </div>
              ) : (
                filteredRecentChanges.map(log => (
                  <div key={log.id} className="bg-surface border border-border rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-black">{log.action}</span>
                      <div className="text-right">
                        <div className="text-[10px] text-text-secondary">
                          {new Date(log.timestamp).toLocaleDateString('tr-TR')}
                        </div>
                        <div className="text-[10px] font-semibold text-text-secondary">
                          {new Date(log.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs font-medium">{log.details}</p>
                    <div className="flex items-center gap-1 text-[10px] text-text-secondary">
                      <UserIcon size={10} />
                      {log.userName}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {cmsView === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider">Kayitli Kullanicilar</h2>
              <span className="text-[10px] font-bold text-text-secondary bg-surface px-2 py-1 rounded-lg border border-border">
                {filteredUsers.length} / {users.length} Kullanici
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input
                type="text"
                placeholder="Ara: ad, soyad veya e-posta"
                value={userSearchQuery}
                onChange={(event) => setUserSearchQuery(event.target.value)}
                className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
              />
              <select
                value={userRoleFilter}
                onChange={(event) => setUserRoleFilter(event.target.value as 'all' | UserRole)}
                className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
              >
                <option value="all">Rol: Tumu</option>
                {USER_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <select
                value={userGenderFilter}
                onChange={(event) => setUserGenderFilter(event.target.value as 'all' | 'female' | 'male' | 'unspecified')}
                className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
              >
                <option value="all">Cinsiyet: Tumu</option>
                <option value="female">Kadin</option>
                <option value="male">Erkek</option>
                <option value="unspecified">Belirtilmemis</option>
              </select>
              <select
                value={userDateSort}
                onChange={(event) => setUserDateSort(event.target.value as 'newest' | 'oldest')}
                className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black"
              >
                <option value="newest">Kayit Tarihi: En yeni</option>
                <option value="oldest">Kayit Tarihi: En eski</option>
              </select>
              <select
                value={userPointsSort}
                onChange={(event) => setUserPointsSort(event.target.value as 'none' | 'lowest' | 'highest')}
                className="h-11 rounded-2xl border border-border bg-white px-4 text-sm focus:outline-none focus:border-black md:col-span-2"
              >
                <option value="none">Puan: Varsayilan</option>
                <option value="lowest">Puan: En dusuk</option>
                <option value="highest">Puan: En yuksek</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {filteredUsers.map(u => (
                <div key={u.id} className="bg-surface border border-border rounded-3xl p-4 space-y-4">
                  <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white border border-border flex-shrink-0">
                    {u.avatar ? (
                      <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-indigo-50 text-indigo-600 font-bold text-lg">
                        {u.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{u.name} {u.surname}</h3>
                    <p className="text-xs text-text-secondary truncate">{u.email}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-right">
                    <select
                      value={u.role}
                      onChange={async (event) => {
                        const nextRole = event.target.value as UserRole;

                        if (nextRole === u.role) {
                          return;
                        }

                        await runManagerAction(async () => {
                          await updateUserRole(u.id, nextRole);
                          await logChange(
                            t("kullanici-rolu-guncellendi"),
                            `${u.name} ${u.surname} rolü ${getRoleLabel(nextRole)} olarak güncellendi.`,
                          );
                          await notifyManager(
                            t("kullanici-rolu-guncellendi"),
                            `${u.name} ${u.surname} artık ${getRoleLabel(nextRole)} rolünde.`,
                            'success',
                            undefined,
                            'manager',
                          );
                        }, t("kullanici-rolu-guncellenemedi"));
                      }}
                      className="h-9 rounded-xl border border-border bg-white px-3 text-[11px] font-bold text-[#171411] focus:outline-none focus:border-black transition-colors"
                    >
                      {USER_ROLE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {u.id === user?.id && (
                      <span className="text-[10px] font-medium text-text-secondary">Aktif hesap</span>
                    )}
                    {u.id !== user?.id && (
                      <button
                        onClick={async () => {
                          if (!window.confirm(`${u.name} ${u.surname} kullanıcısını silmek istediğinize emin misiniz?`)) {
                            return;
                          }

                          await runManagerAction(async () => {
                            await deleteUser(u.id);
                            await logChange(t("kullanici-silindi"), `${u.name} ${u.surname} (${u.email}) sistemden silindi.`);
                            await notifyManager(t("kullanici-silindi"), `${u.name} ${u.surname} başarıyla silindi.`, 'warning', undefined, 'manager');
                          }, t("kullanici-silinemedi"));
                        }}
                        className="flex items-center gap-1 rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-500 transition-colors hover:bg-red-100"
                      >
                        <Trash2 size={12} />
                        Sil
                      </button>
                    )}
                  </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-2xl border border-border bg-white px-3 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">Rol</p>
                      <p className="mt-1 font-bold">{getRoleLabel(u.role)}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white px-3 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">Cinsiyet</p>
                      <p className="mt-1 font-bold">{getGenderLabel(u.gender)}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white px-3 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">Kayit</p>
                      <p className="mt-1 font-bold">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('tr-TR') : '-'}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white px-3 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-text-secondary">Puan</p>
                      <p className="mt-1 font-bold">{u.points || 0}</p>
                    </div>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="rounded-3xl border border-dashed border-border bg-surface p-8 text-center text-sm text-text-secondary">
                  Secili filtrelerle eslesen kullanici bulunamadi.
                </div>
              )}
            </div>
          </div>
        )}

        {cmsView === 'tables' && (
          <TableQrManagement />
        )}

        {cmsView === 'inventory' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-display font-bold">Malzeme Envanteri</h2>
                <p className="text-xs text-text-secondary">Sipariş tamamlandıkça stoklar otomatik düşer; eşik altındakiler uyarı üretir.</p>
              </div>
              <button
                onClick={() => setShowAddInventoryModal(true)}
                className="px-4 py-2.5 rounded-xl bg-black text-white text-xs font-bold active:scale-95 transition-transform"
              >
                + Malzeme
              </button>
            </div>

            {inventoryFeedback && (
              <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs font-semibold text-red-700">{inventoryFeedback}</div>
            )}

            {isLoadingInventory ? (
              <div className="py-12 text-center text-text-secondary text-sm">Envanter yükleniyor…</div>
            ) : inventoryItems.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-sm text-text-secondary">Henüz malzeme kaydı yok.</p>
                <p className="text-xs text-text-secondary/70">Ürünlerin malzeme adlarıyla eşleşen kayıtları otomatik stok düşümü için kullanılır.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {inventoryItems.map((item) => {
                  const isLow = item.currentStock <= (item.reorderPoint || 0);
                  return (
                    <div
                      key={item.id}
                      className={`bg-white border rounded-2xl p-4 shadow-sm ${isLow ? 'border-red-200' : 'border-border'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-black">{item.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-surface text-text-secondary uppercase">{item.unit}</span>
                            {isLow && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-red-100 text-red-700 uppercase tracking-wider">Düşük Stok</span>
                            )}
                          </div>
                          <p className="text-xs text-text-secondary mt-1">
                            Stok: <strong className={isLow ? 'text-red-600' : 'text-black'}>{item.currentStock}</strong> {item.unit}
                            {' • '}Yeniden sipariş: {item.reorderPoint || 0}
                            {item.supplier ? ` • ${item.supplier}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            placeholder="Miktar"
                            value={restockDraft[item.id] ?? ''}
                            onChange={(e) => setRestockDraft((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            className="w-20 px-2 py-2 rounded-xl bg-surface border border-border text-xs text-center focus:outline-none focus:border-black"
                          />
                          <button
                            onClick={() => handleRestock(item.id)}
                            className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold active:scale-95 transition-transform"
                          >
                            Stok Girişi
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* C3: Yeni Malzeme Modalı */}
        <AnimatePresence>
          {showAddInventoryModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddInventoryModal(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[32px] p-8 w-full max-w-sm relative z-10 space-y-5 shadow-2xl"
              >
                <h3 className="text-xl font-display font-bold">Yeni Malzeme</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Malzeme Adı</label>
                    <input
                      value={newInventoryItem.name}
                      onChange={(e) => setNewInventoryItem({ ...newInventoryItem, name: e.target.value })}
                      placeholder="örn. Espresso Çekirdeği"
                      className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                    />
                    <p className="text-[10px] text-text-secondary mt-1">Ürün malzemeleriyle aynı adı kullanın — otomatik stok düşümü ad eşleşmesiyle çalışır.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Birim</label>
                      <input
                        value={newInventoryItem.unit}
                        onChange={(e) => setNewInventoryItem({ ...newInventoryItem, unit: e.target.value })}
                        placeholder="kg / litre / adet"
                        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Mevcut Stok</label>
                      <input
                        type="number"
                        min="0"
                        value={newInventoryItem.currentStock}
                        onChange={(e) => setNewInventoryItem({ ...newInventoryItem, currentStock: Number(e.target.value) })}
                        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Yeniden Sipariş Noktası</label>
                      <input
                        type="number"
                        min="0"
                        value={newInventoryItem.reorderPoint}
                        onChange={(e) => setNewInventoryItem({ ...newInventoryItem, reorderPoint: Number(e.target.value) })}
                        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Tedarikçi</label>
                      <input
                        value={newInventoryItem.supplier}
                        onChange={(e) => setNewInventoryItem({ ...newInventoryItem, supplier: e.target.value })}
                        className="w-full mt-1 px-3 py-2.5 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => setShowAddInventoryModal(false)}
                    className="py-3 rounded-xl border border-border text-sm font-semibold"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={handleCreateInventoryItem}
                    className="py-3 rounded-xl bg-black text-white text-sm font-bold active:scale-95 transition-transform"
                  >
                    Ekle
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add/Edit Ingredient Modal */}
        <AnimatePresence>
          {showIngredientModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeIngredientModal}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[32px] p-8 w-full max-w-sm relative z-10 space-y-6 shadow-2xl"
              >
                <h3 className="text-xl font-display font-bold">
                  {editingIngredient ? t("malzeme-duzenle") : 'Yeni Malzeme Ekle'}
                </h3>
                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-28 h-28 rounded-[28px] bg-surface border border-dashed border-border flex items-center justify-center overflow-hidden relative group">
                      {newCategoryImage ? (
                        <>
                          <img src={newCategoryImage} alt="Kategori" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex gap-2">
                              <label className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                                <Upload size={18} />
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'category')} />
                              </label>
                              <button
                                type="button"
                                onClick={() => setNewCategoryImage('')}
                                className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-110 transition-transform"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-2 text-text-secondary hover:text-black transition-colors">
                          <Upload size={22} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Gorsel Yukle</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'category')} />
                        </label>
                      )}
                    </div>
                    <p className="text-[10px] text-text-secondary text-center">Kategori gorseli opsiyoneldir</p>
                  </div>
                  <div className="hidden">
                    <div className="w-28 h-28 rounded-[28px] bg-surface border border-dashed border-border flex items-center justify-center overflow-hidden relative group">
                      {newCategoryImage ? (
                        <>
                          <img src={newCategoryImage} alt="Kategori" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex gap-2">
                              <label className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                                <Upload size={18} />
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'category')} />
                              </label>
                              <button
                                type="button"
                                onClick={() => setNewCategoryImage('')}
                                className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-110 transition-transform"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-2 text-text-secondary hover:text-black transition-colors">
                          <Upload size={22} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">GÃ¶rsel YÃ¼kle</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'category')} />
                        </label>
                      )}
                    </div>
                    <p className="text-[10px] text-text-secondary text-center">Kategori gÃ¶rseli opsiyoneldir</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Malzeme Adı</label>
                    <input 
                      type="text" 
                      value={newIngredient.name}
                      onChange={e => setNewIngredient({...newIngredient, name: e.target.value})}
                      placeholder="Örn: Yer Fıstığı"
                      className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">İkon Seçimi</label>
                    <div className="grid grid-cols-5 gap-2 max-h-40 overflow-y-auto p-1 no-scrollbar">
                      {Object.keys(ICON_MAP).map(iconName => {
                        const Icon = ICON_MAP[iconName];
                        return (
                          <button
                            key={iconName}
                            onClick={() => setNewIngredient({...newIngredient, iconName})}
                            className={cn(
                              "w-10 h-10 rounded-xl border flex items-center justify-center transition-all",
                              newIngredient.iconName === iconName 
                                ? "bg-black border-black text-white" 
                                : "bg-surface border-border text-text-secondary hover:bg-white"
                            )}
                          >
                            <Icon size={18} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={closeIngredientModal}
                      className="flex-1 py-4 rounded-2xl border border-border font-bold text-sm"
                    >
                      {t("iptal")}
                    </button>
                    <button 
                      onClick={async () => {
                        const trimmedName = newIngredient.name.trim();

                        if (!trimmedName) return;

                        const ingredientPayload = {
                          ...newIngredient,
                          name: trimmedName,
                        };

                        const ok = await runManagerAction(async () => {
                          if (editingIngredient) {
                            await updateIngredient(editingIngredient, ingredientPayload);
                            await logChange('Malzeme Güncellendi', `${newIngredient.name} güncellendi.`);
                          } else {
                            await addIngredient(ingredientPayload);
                            await logChange('Yeni Malzeme', `${newIngredient.name} eklendi.`);
                          }
                        }, 'Malzeme kaydedilemedi.');

                        if (ok) {
                          closeIngredientModal();
                        }
                      }}
                      className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-sm shadow-lg"
                    >
                      Kaydet
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {ingredientPendingDelete && (
            <div className="fixed inset-0 z-[115] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIngredientPendingDelete(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative z-10 w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl space-y-5"
              >
                <div className="space-y-2">
                  <h3 className="text-xl font-display font-bold">Malzemeyi Sil</h3>
                  <p className="text-sm text-text-secondary">
                    <span className="font-bold text-black">{ingredientPendingDelete.name}</span> silinirse secili oldugu urunlerden de kaldirilacak.
                  </p>
                  <p className="text-xs text-text-secondary">
                    Etkilenen urun sayisi: {ingredientPendingDelete.usageCount}
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIngredientPendingDelete(null)}
                    className="flex-1 py-4 rounded-2xl border border-border font-bold text-sm"
                  >
                    Vazgec
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const currentIngredient = ingredientPendingDelete;

                      const ok = await runManagerAction(async () => {
                        await deleteIngredient(currentIngredient.id);
                        await logChange('Malzeme Silindi', `${currentIngredient.name} listeden kaldirildi.`);
                        await notifyManager('Malzeme Silindi', `${currentIngredient.name} basariyla silindi.`, 'warning', undefined, 'manager');
                      }, 'Malzeme silinemedi.');

                      if (ok) {
                        setIngredientPendingDelete(null);
                      }
                    }}
                    className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-bold text-sm shadow-lg shadow-red-600/20"
                  >
                    Sil
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add Product Modal */}
        <AnimatePresence>
          {showAddProductModal && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddProductModal(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="bg-white rounded-t-[40px] p-8 w-full max-w-md relative z-10 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold">{t("yeni-urun-ekle")}</h2>
                  <button 
                    onClick={() => setShowAddProductModal(false)}
                    className="w-10 h-10 rounded-full bg-surface flex items-center justify-center"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-32 h-32 rounded-[32px] bg-surface border border-dashed border-border flex items-center justify-center overflow-hidden relative group">
                      {newProduct.image ? (
                        <>
                          <img src={newProduct.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button 
                            onClick={() => setNewProduct({...newProduct, image: ''})}
                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-2 text-text-secondary hover:text-black transition-colors">
                          <Upload size={24} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">{t("gorsel-yukle")}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleImageUpload(e, 'product')}
                          />
                        </label>
                      )}
                    </div>
                    <p className="text-[10px] text-text-secondary text-center">Önerilen: 800x800px WebP</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Ürün Adı</label>
                    <input 
                      type="text" 
                      value={newProduct.name}
                      onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                      placeholder="Örn: Flat White"
                      className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Aciklama</label>
                    <textarea
                      value={newProduct.description}
                      onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                      placeholder="Urunu kisa ve net bir sekilde tanimlayin"
                      className="w-full min-h-24 resize-none rounded-2xl bg-surface border border-border p-4 text-sm focus:outline-none focus:border-black transition-colors"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Fiyat (₺)</label>
                      <input 
                        type="number" 
                        value={newProduct.price}
                        onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                        placeholder="0.00"
                        className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Kategori</label>
                      <select 
                        value={newProduct.category}
                        onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                        className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-colors appearance-none"
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.name}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t("icerik-alerjenler")}</label>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 no-scrollbar">
                      {ingredients.map(ing => {
                        const isSelected = newProduct.ingredients.includes(ing.name);
                        const Icon = ICON_MAP[ing.iconName] || Star;
                        return (
                          <button
                            key={ing.id}
                            onClick={() => {
                              const next = isSelected 
                                ? newProduct.ingredients.filter(i => i !== ing.name)
                                : [...newProduct.ingredients, ing.name];
                              setNewProduct({...newProduct, ingredients: next});
                            }}
                            className={cn(
                              "flex items-center gap-2 p-3 rounded-xl border transition-all text-left",
                              isSelected ? "bg-black border-black text-white" : "bg-surface border-border text-text-secondary"
                            )}
                          >
                            <Icon size={14} />
                            <span className="text-[10px] font-bold">{ing.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button 
                    onClick={async () => {
                      if (!newProduct.name || !newProduct.price || !newProduct.category) return;

                      const productData = {
                        ...newProduct,
                        price: Number(newProduct.price)
                      };

                      const ok = await runManagerAction(async () => {
                        await addProduct(productData);
                        await logChange(t("yeni-urun"), `${productData.name} menüye eklendi.`);
                        await notifyManager('Ürün Eklendi', `${productData.name} başarıyla menüye eklendi.`, 'success', undefined, 'manager');
                      }, 'Ürün kaydedilemedi.');

                      if (ok) {
                        setShowAddProductModal(false);
                        setNewProduct({
                          name: '',
                          price: '',
                          category: categories[0]?.name || '',
                          description: '',
                          inStock: true,
                          ingredients: [],
                          image: ''
                        });
                      }
                    }}
                    className="w-full py-4 rounded-2xl bg-black text-white font-bold text-sm shadow-lg shadow-black/10"
                  >
                    Ürünü Kaydet
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Add Category Modal */}
        <AnimatePresence>
          {showAddCategoryModal && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeCategoryModal}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[32px] p-8 w-full max-w-sm relative z-10 space-y-6 shadow-2xl"
              >
                <h3 className="text-xl font-display font-bold">
                  {editingCategory ? t("kategori-duzenle") : 'Yeni Kategori Ekle'}
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t("kategori-adi")}</label>
                    <input 
                      type="text" 
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      placeholder={t("orn-atistirmaliklar")}
                      className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-colors"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t("ikon-secin")}</label>
                    <div className="grid grid-cols-5 gap-2">
                      {Object.keys(ICON_MAP).map(iconName => {
                        const Icon = ICON_MAP[iconName];
                        return (
                          <button
                            key={iconName}
                            onClick={() => setNewCategoryIcon(iconName)}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-all border",
                              newCategoryIcon === iconName ? "bg-black text-white border-black" : "bg-surface border-border text-text-secondary hover:bg-white"
                            )}
                          >
                            <Icon size={18} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={closeCategoryModal}
                      className="flex-1 py-4 rounded-2xl border border-border font-bold text-sm"
                    >
                      {t("iptal")}
                    </button>
                    <button 
                      onClick={async () => {
                        const nextCategoryName = newCategoryName.trim();

                        if (!nextCategoryName) {
                          await notifyManager('Hata', t("kategori-adi-gerekli"), 'error', user?.id);
                          return;
                        }

                        if (
                          categories.some(
                            (category) =>
                              category.id !== editingCategory &&
                              category.name.toLowerCase() === nextCategoryName.toLowerCase(),
                          )
                        ) {
                          await notifyManager('Hata', 'Bu kategori zaten mevcut.', 'error', user?.id);
                          return;
                        }

                        const ok = await runManagerAction(async () => {
                          if (editingCategory) {
                            await updateCategory(editingCategory, nextCategoryName, newCategoryIcon, newCategoryImage);
                            await logChange(t("kategori-guncellendi"), `${nextCategoryName} kategorisi güncellendi.`);
                            await notifyManager(t("kategori-guncellendi"), `${nextCategoryName} başarıyla güncellendi.`, 'success', undefined, 'manager');
                          } else {
                            await addCategory(nextCategoryName, newCategoryIcon, newCategoryImage);
                            await logChange('Yeni Kategori', `${nextCategoryName} kategorisi eklendi.`);
                            await notifyManager('Kategori Eklendi', `${nextCategoryName} başarıyla eklendi.`, 'success', undefined, 'manager');
                          }
                        }, 'Kategori kaydedilemedi.');

                        if (ok) {
                          closeCategoryModal();
                        }
                      }}
                      className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-sm shadow-lg"
                    >
                      {editingCategory ? 'Kaydet' : 'Ekle'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Edit Product Modal */}
        <AnimatePresence>
          {editingProduct && editProductData && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setEditingProduct(null);
                  setEditProductData(null);
                }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                className="bg-white rounded-t-[40px] p-8 w-full max-w-md relative z-10 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-display font-bold">{t("urun-duzenle")}</h2>
                    <p className="text-xs text-text-secondary">
                      {editProductData.name} detaylarını güncelleyin
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setEditingProduct(null);
                      setEditProductData(null);
                    }}
                    className="w-10 h-10 rounded-full bg-surface flex items-center justify-center"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-32 h-32 rounded-[32px] bg-surface border border-dashed border-border flex items-center justify-center overflow-hidden relative group">
                      {editProductData.image ? (
                        <>
                          <img src={editProductData.image} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex gap-2">
                              <label className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                                <Upload size={18} />
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => handleImageUpload(e, 'edit-product')}
                                />
                              </label>
                              <button 
                                onClick={() => setEditProductData({ ...editProductData, image: '' })}
                                className="w-10 h-10 rounded-full bg-red-500 text-white flex items-center justify-center hover:scale-110 transition-transform"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <label className="cursor-pointer flex flex-col items-center gap-2 text-text-secondary hover:text-black transition-colors">
                          <Upload size={24} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">{t("gorsel-yukle")}</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleImageUpload(e, 'edit-product')}
                          />
                        </label>
                      )}
                    </div>
                    <p className="text-[10px] text-text-secondary text-center">Görseli değiştirmek için tıklayın veya sürükleyin</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Ürün Adı</label>
                      <input 
                        type="text" 
                        value={editProductData.name}
                        onChange={e => setEditProductData({ ...editProductData, name: e.target.value })}
                        className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Fiyat (₺)</label>
                      <input 
                        type="number" 
                        value={editProductData.price}
                        onChange={e => setEditProductData({ ...editProductData, price: Number(e.target.value) })}
                        className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Kategori</label>
                    <select 
                      value={editProductData.category}
                      onChange={e => setEditProductData({ ...editProductData, category: e.target.value })}
                      className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-colors appearance-none"
                    >
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>


                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Aciklama</label>
                    <textarea
                      value={editProductData.description || ""}
                      onChange={e => setEditProductData({ ...editProductData, description: e.target.value })}
                      className="w-full min-h-24 resize-none rounded-2xl bg-surface border border-border p-4 text-sm focus:outline-none focus:border-black transition-colors"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">{t("icerik-alerjenler")}</label>
                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto p-1 no-scrollbar">
                      {ingredients.map(ing => {
                        const isSelected = editProductData.ingredients?.includes(ing.name);
                        const Icon = ICON_MAP[ing.iconName] || Star;
                        return (
                          <button

                            onClick={() => toggleIngredient(editingProduct!, ing.name)}
                            className={cn(
                              "flex items-center gap-3 p-4 rounded-2xl border transition-all text-left",
                              isSelected 
                                ? "bg-black border-black text-white shadow-lg" 
                                : "bg-surface border-border text-text-primary hover:bg-white"
                            )}
                          >
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center",
                              isSelected ? "bg-white/20" : "bg-white border border-border"
                            )}>
                              <Icon size={16} />
                            </div>
                            <span className="text-xs font-bold">{ing.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button 
                    onClick={async () => {
                      const { id, ...updates } = editProductData;

                      const ok = await runManagerAction(async () => {
                        await updateProduct(id, updates);
                        await logChange('Ürün Güncellendi', `${editProductData.name} detayları düzenlendi.`);
                        await notifyManager('Başarılı', 'Ürün güncellendi.', 'success', undefined, 'manager');
                      }, 'Ürün güncellenemedi.');

                      if (ok) {
                        setEditingProduct(null);
                        setEditProductData(null);
                      }
                    }}
                    className="w-full py-4 rounded-2xl bg-black text-white font-bold text-sm shadow-lg shadow-black/10 active:scale-[0.98] transition-all"
                  >
                    {t("degisiklikleri-kaydet")}
                  </button>
                  <button 
                    onClick={async () => {
                      if (window.confirm(`${editProductData.name} ürününü silmek istediğinize emin misiniz?`)) {
                        const ok = await runManagerAction(async () => {
                          await deleteProduct(editingProduct!);
                          await logChange('Ürün Silindi', `${editProductData.name} silindi.`);
                          await notifyManager('Ürün Silindi', `${editProductData.name} başarıyla silindi.`, 'warning', undefined, 'manager');
                        }, 'Ürün silinemedi.');

                        if (ok) {
                          setEditingProduct(null);
                          setEditProductData(null);
                        }
                      }
                    }}
                    className="w-full py-4 rounded-2xl bg-red-50 text-red-500 font-bold text-sm hover:bg-red-100 transition-colors"
                  >
                    Ürünü Sil
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Campaign Creation / Edit Modal */}
        <AnimatePresence>
          {showCampaignModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeCampaignModal}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white rounded-[36px] p-6 sm:p-8 w-full max-w-4xl relative z-10 shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar space-y-6 my-auto"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h2 className="text-xl font-display font-bold">
                      {editingCampaign ? 'Kampanyayı Düzenle' : 'Yeni Kampanya Oluştur'}
                    </h2>
                    <p className="text-xs text-text-secondary mt-0.5">
                      {editingCampaign ? 'Kampanya detaylarını ve kurallarını güncelleyin' : 'Aşağıdaki 3 temel modelden birini seçerek anında kampanya başlatın'}
                    </p>
                  </div>
                  <button 
                    onClick={closeCampaignModal}
                    className="w-10 h-10 rounded-full bg-surface hover:bg-zinc-100 flex items-center justify-center transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Template Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'discount',
                      title: 'İndirim Kampanyası',
                      desc: 'Sepette % veya Sabit TL indirim',
                      icon: Tag,
                    },
                    {
                      id: 'balance_bonus',
                      title: 'Cüzdan Bonusu',
                      desc: 'Bakiye yüklemelerine hediye %',
                      icon: CreditCard,
                    },
                    {
                      id: 'point_reward',
                      title: 'KP Sadakat Ödülü',
                      desc: 'Puanla ücretsiz ürün veya indirim',
                      icon: Star,
                    },
                  ].map(tmpl => {
                    const isSelected = campaignKind === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => {
                          setCampaignKind(tmpl.id as any);
                          const defaults = createEmptyCampaign(tmpl.id as any);
                          setNewCampaign(prev => ({
                            ...defaults,
                            title: prev.title || defaults.title,
                            description: prev.description || defaults.description,
                            image: prev.image || defaults.image,
                          }));
                          if (tmpl.id === 'balance_bonus') {
                            setCampaignCategory('financial');
                            setCampaignType('balance_bonus');
                          } else if (tmpl.id === 'point_reward') {
                            setCampaignCategory('loyalty');
                            setCampaignType('points_free_product');
                          } else {
                            setCampaignCategory('discount');
                            setCampaignType('discount');
                          }
                        }}
                        className={cn(
                          "p-4 rounded-2xl border text-left transition-all flex items-start gap-3 relative cursor-pointer",
                          isSelected
                            ? "border-black bg-neutral-100 text-black shadow-sm"
                            : "border-border bg-white text-text-secondary hover:bg-neutral-50 hover:border-black/40 hover:text-black"
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                          isSelected ? "bg-black text-white border-black" : "bg-neutral-100 text-neutral-700 border-border"
                        )}>
                          <tmpl.icon size={16} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-black">{tmpl.title}</h4>
                          <p className="text-[10px] text-text-secondary mt-0.5">{tmpl.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 2-Column Responsive Body */}
                <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-6 items-start">
                  {/* Left Column: Form Controls */}
                  <div className="space-y-5">
                    {/* 1. Basic Info */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-black text-white text-[10px] flex items-center justify-center font-mono">1</span>
                        Temel Bilgiler
                      </h4>

                      {/* Image Upload */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Kampanya Görseli</label>
                        <div className="w-full h-28 rounded-2xl bg-surface border border-dashed border-border flex items-center justify-center overflow-hidden relative group">
                          {newCampaign.image ? (
                            <>
                              <img src={newCampaign.image} alt="Kampanya" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                                <label className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                                  <Upload size={16} />
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    className="hidden" 
                                    onChange={(e) => handleImageUpload(e, 'campaign')}
                                  />
                                </label>
                                <button 
                                  type="button"
                                  onClick={() => setNewCampaign({ ...newCampaign, image: '' })}
                                  className="w-9 h-9 rounded-full bg-neutral-900 text-white flex items-center justify-center hover:scale-105 transition-transform"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center gap-1 text-text-secondary hover:text-black transition-colors p-4">
                              <Upload size={18} />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Görsel Seç veya Yükle</span>
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleImageUpload(e, 'campaign')}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Kampanya Başlığı</label>
                        <input 
                          type="text"
                          placeholder="Örn: Hafta Sonu Filtre Kahve İndirimi"
                          className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black transition-colors"
                          value={newCampaign.title || ''}
                          onChange={e => setNewCampaign({...newCampaign, title: e.target.value})}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Açıklama</label>
                        <textarea 
                          placeholder="Müşterilere gösterilecek kısa kampanya detayını yazın..."
                          rows={2}
                          className="w-full p-3 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black transition-colors resize-none"
                          value={newCampaign.description || ''}
                          onChange={e => setNewCampaign({...newCampaign, description: e.target.value})}
                        />
                      </div>
                    </div>

                    {/* 2. Specific Rule Settings */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-black text-white text-[10px] flex items-center justify-center font-mono">2</span>
                        Kampanya Kuralı & Oranları
                      </h4>

                      {/* If DISCOUNT */}
                      {campaignKind === 'discount' && (
                        <div className="space-y-3">
                          {/* Discount Type & Value */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">İndirim Türü</label>
                              <div className="grid grid-cols-2 gap-1.5 bg-surface p-1 rounded-xl border border-border">
                                <button
                                  type="button"
                                  onClick={() => setNewCampaign({ ...newCampaign, discountType: 'percentage' })}
                                  className={cn(
                                    "py-2 text-xs font-bold rounded-lg transition-all",
                                    newCampaign.discountType !== 'fixed' ? "bg-black text-white shadow-sm" : "text-text-secondary hover:text-black"
                                  )}
                                >
                                  % Yüzde
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setNewCampaign({ ...newCampaign, discountType: 'fixed' })}
                                  className={cn(
                                    "py-2 text-xs font-bold rounded-lg transition-all",
                                    newCampaign.discountType === 'fixed' ? "bg-black text-white shadow-sm" : "text-text-secondary hover:text-black"
                                  )}
                                >
                                  ₺ Sabit Tutar
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                                {newCampaign.discountType === 'fixed' ? 'İndirim Tutarı (TL)' : 'İndirim Oranı (%)'}
                              </label>
                              <input 
                                type="number"
                                min="1"
                                placeholder={newCampaign.discountType === 'fixed' ? '50' : '20'}
                                className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm font-bold focus:outline-none focus:border-black transition-colors"
                                value={newCampaign.value || ''}
                                onChange={e => setNewCampaign({...newCampaign, value: Number(e.target.value)})}
                              />
                            </div>
                          </div>

                          {/* Scope Target */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">İndirimin Geçerli Olduğu Kapsam</label>
                            <div className="grid grid-cols-3 gap-1.5 bg-surface p-1 rounded-xl border border-border">
                              <button
                                type="button"
                                onClick={() => setNewCampaign({ ...newCampaign, targetType: 'all', targetCategory: '', targetProductId: '' })}
                                className={cn(
                                  "py-2 text-xs font-bold rounded-lg transition-all",
                                  (!newCampaign.targetType || newCampaign.targetType === 'all') ? "bg-black text-white shadow-sm" : "text-text-secondary hover:text-black"
                                )}
                              >
                                Tüm Menü
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewCampaign({ ...newCampaign, targetType: 'category', targetProductId: '' })}
                                className={cn(
                                  "py-2 text-xs font-bold rounded-lg transition-all",
                                  newCampaign.targetType === 'category' ? "bg-black text-white shadow-sm" : "text-text-secondary hover:text-black"
                                )}
                              >
                                Kategori
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewCampaign({ ...newCampaign, targetType: 'product' })}
                                className={cn(
                                  "py-2 text-xs font-bold rounded-lg transition-all",
                                  newCampaign.targetType === 'product' ? "bg-black text-white shadow-sm" : "text-text-secondary hover:text-black"
                                )}
                              >
                                Tek Ürün
                              </button>
                            </div>
                          </div>

                          {/* Dynamic Category / Product dropdown */}
                          {newCampaign.targetType === 'category' && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Hedef Kategori</label>
                              <select
                                className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                                value={newCampaign.targetCategory || ''}
                                onChange={e => setNewCampaign({ ...newCampaign, targetCategory: e.target.value })}
                              >
                                <option value="">Bir kategori seçin</option>
                                {categories.map(cat => (
                                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {newCampaign.targetType === 'product' && (
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Hedef Ürün</label>
                              <select
                                className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                                value={newCampaign.targetProductId || ''}
                                onChange={e => setNewCampaign({ ...newCampaign, targetProductId: e.target.value })}
                              >
                                <option value="">Bir ürün seçin</option>
                                {products.map(prod => (
                                  <option key={prod.id} value={prod.id}>{prod.name} (₺{prod.price})</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Optional Happy Hour / Hours */}
                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Başlangıç Saati (Opsiyonel)</label>
                              <input 
                                type="time"
                                className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                                value={newCampaign.startTime || ''}
                                onChange={e => setNewCampaign({ ...newCampaign, startTime: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Bitiş Saati (Opsiyonel)</label>
                              <input 
                                type="time"
                                className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                                value={newCampaign.endTime || ''}
                                onChange={e => setNewCampaign({ ...newCampaign, endTime: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* If BALANCE BONUS */}
                      {campaignKind === 'balance_bonus' && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Min. Yükleme Tutarı (TL)</label>
                              <input 
                                type="number"
                                min="10"
                                placeholder="Örn: 200"
                                className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm font-bold focus:outline-none focus:border-black transition-colors"
                                value={newCampaign.minLoadAmount || ''}
                                onChange={e => setNewCampaign({...newCampaign, minLoadAmount: Number(e.target.value)})}
                              />
                              <span className="text-[10px] text-text-secondary">Bu tutar ve üzeri yüklemelere bonus verilir</span>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Hediye Bonus Oranı (%)</label>
                              <input 
                                type="number"
                                min="1"
                                max="100"
                                placeholder="Örn: 15"
                                className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm font-bold focus:outline-none focus:border-black transition-colors"
                                value={newCampaign.value || ''}
                                onChange={e => setNewCampaign({...newCampaign, value: Number(e.target.value)})}
                              />
                              <span className="text-[10px] text-text-secondary">Yüklenen tutara eklenecek hediye bakiye %</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* If POINT REWARD (KP) */}
                      {campaignKind === 'point_reward' && (
                        <div className="space-y-3">
                          {/* Reward Shape */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Ödül Şekli</label>
                            <div className="grid grid-cols-2 gap-1.5 bg-surface p-1 rounded-xl border border-border">
                              <button
                                type="button"
                                onClick={() => setNewCampaign({ ...newCampaign, type: 'points_free_product', value: 0 })}
                                className={cn(
                                  "py-2 text-xs font-bold rounded-lg transition-all",
                                  newCampaign.type !== 'points_discount_product' ? "bg-black text-white shadow-sm" : "text-text-secondary hover:text-black"
                                )}
                              >
                                Ücretsiz Ürün
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewCampaign({ ...newCampaign, type: 'points_discount_product', value: 50 })}
                                className={cn(
                                  "py-2 text-xs font-bold rounded-lg transition-all",
                                  newCampaign.type === 'points_discount_product' ? "bg-black text-white shadow-sm" : "text-text-secondary hover:text-black"
                                )}
                              >
                                % İndirim
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Gerekli KP Puan Bedeli</label>
                              <input 
                                type="number"
                                min="10"
                                placeholder="Örn: 250"
                                className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm font-bold focus:outline-none focus:border-black transition-colors"
                                value={newCampaign.pointsCost || ''}
                                onChange={e => setNewCampaign({...newCampaign, pointsCost: Number(e.target.value)})}
                              />
                            </div>
                            {newCampaign.type === 'points_discount_product' ? (
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">İndirim Oranı (%)</label>
                                <input 
                                  type="number"
                                  min="1"
                                  max="100"
                                  placeholder="Örn: 50"
                                  className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm font-bold focus:outline-none focus:border-black transition-colors"
                                  value={newCampaign.value || ''}
                                  onChange={e => setNewCampaign({...newCampaign, value: Number(e.target.value)})}
                                />
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Kullanım Adedi</label>
                                <input 
                                  type="number"
                                  min="1"
                                  className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm font-bold focus:outline-none focus:border-black transition-colors"
                                  value={newCampaign.usageLimit || 1}
                                  onChange={e => setNewCampaign({...newCampaign, usageLimit: Number(e.target.value)})}
                                />
                              </div>
                            )}
                          </div>

                          {/* Target Product */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Hediye Edilecek Ürün</label>
                            <select
                              className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                              value={newCampaign.targetProductId || ''}
                              onChange={e => setNewCampaign({ ...newCampaign, targetProductId: e.target.value })}
                            >
                              <option value="">Bir ürün seçin</option>
                              {products.map(prod => (
                                <option key={prod.id} value={prod.id}>{prod.name} (₺{prod.price})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 3. Dates & Status */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-black text-white text-[10px] flex items-center justify-center font-mono">3</span>
                        Tarih & Durum
                      </h4>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Başlangıç Tarihi</label>
                          <input 
                            type="date"
                            className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                            value={newCampaign.startDate || ''}
                            onChange={e => setNewCampaign({ ...newCampaign, startDate: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Bitiş Tarihi</label>
                          <input 
                            type="date"
                            className="w-full h-11 px-4 rounded-xl bg-surface border border-border text-xs focus:outline-none focus:border-black"
                            value={newCampaign.expiryDate || ''}
                            onChange={e => setNewCampaign({ ...newCampaign, expiryDate: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-2xl bg-surface border border-border">
                        <div>
                          <span className="text-xs font-bold block">Kampanya Durumu</span>
                          <span className="text-[10px] text-text-secondary">Oluşturulduğu anda yayına alınsın mı?</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewCampaign({ ...newCampaign, active: !(newCampaign.active ?? true) })}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 border",
                            (newCampaign.active ?? true)
                              ? "bg-black text-white border-black"
                              : "bg-surface text-text-secondary border-border"
                          )}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full", (newCampaign.active ?? true) ? "bg-emerald-400" : "bg-neutral-400")} />
                          {(newCampaign.active ?? true) ? 'Aktif' : 'Pasif'}
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-3 border-t border-border">
                      <button 
                        type="button"
                        onClick={closeCampaignModal}
                        className="flex-1 py-3.5 rounded-2xl border border-border font-bold text-xs hover:bg-neutral-100 transition-colors"
                      >
                        Vazgeç
                      </button>
                      <button 
                        type="button"
                        onClick={async () => {
                          if (!newCampaign.title?.trim() || !newCampaign.description?.trim()) {
                            await notifyManager('Hata', 'Kampanya başlığı ve açıklaması zorunludur.', 'error', user?.id);
                            return;
                          }

                          if (!newCampaign.expiryDate) {
                            await notifyManager('Hata', 'Bitiş tarihi zorunludur.', 'error', user?.id);
                            return;
                          }

                          if ((newCampaign.startDate || '') > (newCampaign.expiryDate || '')) {
                            await notifyManager('Hata', 'Başlangıç tarihi bitiş tarihinden sonra olamaz.', 'error', user?.id);
                            return;
                          }

                          let category: Campaign['category'] = 'discount';
                          let type: Campaign['type'] = 'discount';

                          if (campaignKind === 'balance_bonus') {
                            category = 'financial';
                            type = 'balance_bonus';
                            if (!newCampaign.value || newCampaign.value <= 0) {
                              await notifyManager('Hata', 'Bonus yüzdesi girilmelidir.', 'error', user?.id);
                              return;
                            }
                          } else if (campaignKind === 'point_reward') {
                            category = 'loyalty';
                            type = newCampaign.type === 'points_discount_product' ? 'points_discount_product' : 'points_free_product';
                            if (!newCampaign.pointsCost || newCampaign.pointsCost <= 0) {
                              await notifyManager('Hata', 'Geçerli bir KP puan bedeli girmelisiniz.', 'error', user?.id);
                              return;
                            }
                          } else {
                            category = 'discount';
                            type = 'discount';
                            if (!newCampaign.value || newCampaign.value <= 0) {
                              await notifyManager('Hata', 'İndirim tutarı veya oranı girilmelidir.', 'error', user?.id);
                              return;
                            }
                          }

                          const campPayload: Partial<Campaign> = {
                            ...newCampaign,
                            category,
                            type,
                            title: newCampaign.title.trim(),
                            description: newCampaign.description.trim(),
                            active: newCampaign.active ?? true,
                            startDate: newCampaign.startDate || new Date().toISOString().slice(0, 10),
                            expiryDate: newCampaign.expiryDate,
                          };

                          const ok = await runManagerAction(async () => {
                            if (editingCampaign) {
                              await updateCampaign(editingCampaign, campPayload);
                              await logChange('Kampanya Güncellendi', `${campPayload.title} güncellendi.`);
                              await notifyManager('Kampanya Güncellendi', `${campPayload.title} başarıyla güncellendi.`, 'success', undefined, 'manager');
                            } else {
                              await addCampaign(campPayload as any);
                              await logChange('Yeni Kampanya', `${campPayload.title} oluşturuldu.`);
                              await notifyManager('Yeni Kampanya', `${campPayload.title} oluşturuldu ve yayına alındı.`, 'success', undefined, 'manager');
                            }
                          }, 'Kampanya kaydedilemedi.');

                          if (ok) {
                            closeCampaignModal();
                          }
                        }}
                        className="flex-1 py-3.5 rounded-2xl bg-black hover:bg-neutral-800 text-white font-bold text-xs shadow-lg shadow-black/10 transition-all active:scale-95"
                      >
                        {editingCampaign ? 'Değişiklikleri Kaydet' : 'Kampanyayı Yayınla'}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Live Mobile Preview Card (Clean Monochrome) */}
                  <div className="space-y-3 sticky top-4">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                        Canlı Kart Önizlemesi
                      </span>
                      <span className="text-[10px] font-mono text-text-secondary bg-neutral-100 px-2 py-0.5 rounded-md">Mobil</span>
                    </div>

                    {/* Mockup Card */}
                    <div className="bg-white border border-border rounded-[28px] overflow-hidden shadow-sm p-4 space-y-4">
                      {/* Card Image with Badge */}
                      <div className="w-full h-40 rounded-2xl bg-neutral-100 overflow-hidden relative border border-border">
                        {newCampaign.image ? (
                          <img src={newCampaign.image} alt="Önizleme" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400">
                            <ImageIcon size={28} />
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          <span className="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm bg-black text-white">
                            {campaignKind === 'balance_bonus'
                              ? `+${newCampaign.value || 0}% Bonus`
                              : campaignKind === 'point_reward'
                                ? (newCampaign.type === 'points_discount_product' ? `%${newCampaign.value || 50} İndirim` : 'Hediye Ürün')
                                : (newCampaign.discountType === 'fixed' ? `-₺${newCampaign.value || 0}` : `-%${newCampaign.value || 0}`)}
                          </span>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-border bg-neutral-100 text-neutral-800">
                            {campaignKind === 'balance_bonus' ? 'Cüzdan Fırsatı' : campaignKind === 'point_reward' ? 'KP Sadakat Ödülü' : 'Özel İndirim'}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-black leading-snug">
                          {newCampaign.title || 'Kampanya Başlığı'}
                        </h3>
                        <p className="text-xs text-text-secondary leading-relaxed">
                          {newCampaign.description || 'Kampanya açıklaması buraya gelecek...'}
                        </p>

                        {/* Extra Details */}
                        <div className="pt-2 border-t border-dashed border-border flex items-center justify-between text-[11px] text-text-secondary">
                          <div>
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-text-secondary/70">Kapsam</span>
                            <span className="font-semibold text-black">
                              {campaignKind === 'balance_bonus'
                                ? `Min. ₺${newCampaign.minLoadAmount || 0} Yükleme`
                                : campaignKind === 'point_reward'
                                  ? `${newCampaign.pointsCost || 0} KP Bedeli`
                                  : newCampaign.targetType === 'product' && newCampaign.targetProductId
                                    ? (products.find(p => p.id === newCampaign.targetProductId)?.name || 'Seçili Ürün')
                                    : newCampaign.targetType === 'category' && newCampaign.targetCategory
                                      ? `${newCampaign.targetCategory} Kategorisi`
                                      : 'Tüm Menü'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-text-secondary/70">Son Gün</span>
                            <span className="font-semibold text-black">
                              {newCampaign.expiryDate ? new Date(newCampaign.expiryDate).toLocaleDateString('tr-TR') : 'Süresiz'}
                            </span>
                          </div>
                        </div>

                        {/* Preview CTA Button */}
                        <div className="pt-2">
                          <div className="w-full py-3 rounded-xl font-bold text-xs text-center bg-black text-white">
                            {campaignKind === 'balance_bonus'
                              ? 'Bakiye Yükle & Kazan'
                              : campaignKind === 'point_reward'
                                ? `Ödülü Kullan (${newCampaign.pointsCost || 0} KP)`
                                : 'Fırsattan Yararlan'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  if (activeTab === 'profile') {
    let profileContent: React.ReactNode = null;

    if (profileView === 'main') {
      profileContent = (
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
              <p className="text-sm text-text-secondary">
                {user?.email} • Yönetici
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <button 
              onClick={async () => {
                await setSessionRole('staff');
              }}
              className="w-full bg-neutral-900 hover:bg-black text-white rounded-2xl p-4 flex items-center justify-between transition-colors shadow-sm cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Users size={18} className="text-white" />
                <span className="text-sm font-semibold text-white">{t("personel-olarak-devam-et")}</span>
              </div>
              <ChevronRight size={16} className="text-white/80" />
            </button>

            <button 
              onClick={async () => {
                await setSessionRole('customer');
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-4 flex items-center justify-between transition-colors shadow-sm cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Users size={18} className="text-white" />
                <span className="text-sm font-semibold text-white">{t("musteri-olarak-devam-et")}</span>
              </div>
              <ChevronRight size={16} className="text-white/80" />
            </button>

            {[
              { label: 'Ayarlar', icon: Settings, onClick: () => setProfileView('settings') },
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
      profileContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">Adreslerim</h1>
          </div>

          <div className="bg-surface border border-border rounded-3xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
              {isEditingAddress ? t("adresi-duzenle") : 'Yeni Adres'}
            </h3>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder={t("adres-basligi-orn-ev-is")}
                value={addressDraft.title}
                onChange={(event) => setAddressDraft((current) => ({ ...current, title: event.target.value }))}
                className="w-full p-4 rounded-2xl bg-white border border-border text-sm focus:outline-none focus:border-black"
              />
              <textarea 
                placeholder={t("detayli-adres")}
                value={addressDraft.details}
                onChange={(event) => setAddressDraft((current) => ({ ...current, details: event.target.value }))}
                className="w-full p-4 rounded-2xl bg-white border border-border text-sm focus:outline-none focus:border-black h-24 resize-none"
              />
              <div className="flex gap-2">
                {isEditingAddress && (
                  <button 
                    onClick={resetAddressDraft}
                    className="flex-1 py-4 rounded-2xl border border-border text-sm font-bold active:scale-[0.98]"
                  >
                    {t("vazgec")}
                  </button>
                )}
                <button 
                  onClick={() => {
                    void saveAddress();
                  }}
                  className="flex-1 py-4 rounded-2xl bg-black text-white text-sm font-bold active:scale-[0.98]"
                >
                  {isEditingAddress ? 'Adresi Kaydet' : 'Adresi Ekle'}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary pl-1">{t("kayitli-adresler")}</h3>
            {(user?.addresses || []).length === 0 ? (
              <p className="text-sm text-text-secondary pl-1 italic">{t("henuz-kayitli-bir-adresiniz-yok")}</p>
            ) : (
              (user?.addresses || []).map(addr => (
                <div key={addr.id} className="bg-surface border border-border rounded-3xl p-5 flex items-start justify-between shadow-sm">
                  <div className="space-y-1">
                    <span className="block text-sm font-bold text-black">{addr.title}</span>
                    <p className="text-xs text-text-secondary leading-relaxed">{addr.details}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => editAddress(addr)} className="text-text-secondary hover:text-black"><Edit2 size={16} /></button>
                    <button onClick={() => {
                      void removeAddress(addr.id);
                    }} className="text-red-500"><Trash2 size={16} /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    } else if (profileView === 'payments') {
      profileContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">{t("odeme-yontemleri")}</h1>
          </div>

          <div className="bg-surface border border-border rounded-3xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">
              {isEditingPayment ? t("karti-duzenle") : 'Yeni Kart'}
            </h3>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder={t("kart-tanimi-orn-garanti-akbank")}
                value={paymentDraft.brand}
                onChange={(event) => setPaymentDraft((current) => ({ ...current, brand: event.target.value }))}
                className="w-full p-4 rounded-2xl bg-white border border-border text-sm focus:outline-none focus:border-black"
              />
              <input 
                type="text" 
                placeholder={t("son-4-hane-orn-1234")}
                maxLength={4}
                value={paymentDraft.cardNumber}
                onChange={(event) => {
                  const val = event.target.value.replace(/\D/g, '').slice(0, 4);
                  setPaymentDraft((current) => ({ ...current, cardNumber: val }));
                }}
                className="w-full p-4 rounded-2xl bg-white border border-border text-sm focus:outline-none focus:border-black"
              />
              <div className="flex gap-2">
                {isEditingPayment && (
                  <button 
                    onClick={resetPaymentDraft}
                    className="flex-1 py-4 rounded-2xl border border-border text-sm font-bold active:scale-[0.98]"
                  >
                    {t("vazgec")}
                  </button>
                )}
                <button 
                  onClick={() => {
                    void savePayment();
                  }}
                  className="flex-1 py-4 rounded-2xl bg-black text-white text-sm font-bold active:scale-[0.98]"
                >
                  {isEditingPayment ? t("karti-kaydet") : t("karti-ekle")}
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary pl-1">{t("kayitli-kartlar")}</h3>
            {(user?.paymentMethods || []).length === 0 ? (
              <p className="text-sm text-text-secondary pl-1 italic">{t("henuz-kayitli-bir-odeme-yonteminiz-yok")}</p>
            ) : (
              (user?.paymentMethods || []).map(pm => (
                <div key={pm.id} className="bg-surface border border-border rounded-3xl p-5 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-8 rounded-lg bg-white border border-border flex items-center justify-center font-bold text-xs text-text-secondary">
                      CARD
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-black">{pm.brand}</span>
                      <span className="text-xs text-text-secondary">•••• •••• •••• {pm.last4}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => editPayment(pm)} className="text-text-secondary hover:text-black">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => {
                      void removePayment(pm.id);
                    }} className="text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    } else if (profileView === 'favorites') {
      const favoriteProducts = products.filter(p => user?.favorites?.includes(p.id));
      profileContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">{t("favori-urunler")}</h1>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {favoriteProducts.length === 0 ? (
              <p className="text-sm text-text-secondary pl-1 italic">{t("henuz-favori-urununuz-yok")}</p>
            ) : (
              favoriteProducts.map(product => (
                <div key={product.id} className="bg-surface border border-border rounded-3xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden shrink-0">
                      {product.image ? (
                        <img src={product.image} className="w-full h-full object-cover" />
                      ) : (
                        <Coffee size={20} className="text-text-secondary" />
                      )}
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-black">{product.name}</span>
                      <span className="text-xs text-text-secondary">₺{product.price}</span>
                    </div>
                  </div>
                  <button onClick={() => {
                    void toggleFavorite(product.id);
                  }} className="text-red-500 p-2">
                    <Heart size={20} fill="currentColor" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      );
    } else if (profileView === 'settings') {
      profileContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('main')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
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
              <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest px-2">{t("hakkinda")}</h3>
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

            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-red-600 uppercase tracking-widest px-2">{t("tehlikeli-bolge")}</h3>
              <div className="bg-red-50/50 border border-red-100 rounded-3xl overflow-hidden">
                <button 
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full p-4 flex items-center justify-between hover:bg-red-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Trash2 size={18} className="text-red-600" />
                    <span className="text-sm font-bold text-red-600">{t("sistemi-sifirla")}</span>
                  </div>
                  <ChevronRight size={16} className="text-red-600" />
                </button>
              </div>
              <p className="text-[10px] text-text-secondary px-4">
                {t("bu-islem-urunler-kampanyalar-kategoriler-malzemeler-siparisler-bildirimler-ve-loglar-dahil-tum-verileri-temizler")}
              </p>
            </div>
          </div>

          {/* Reset Confirmation Modal */}
          <AnimatePresence>
            {showResetConfirm && (
              <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowResetConfirm(false)}
                  className="absolute inset-0 bg-black/60 backdrop-blur-md"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  className="relative w-full max-w-sm bg-white rounded-[40px] p-8 shadow-2xl text-center space-y-6"
                >
                  <div className="w-20 h-20 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                    <Trash2 size={40} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-display font-bold">Emin misiniz?</h2>
                    <p className="text-sm text-text-secondary">
                      {t("bu-islem-geri-alinamaz-sistemdeki-tum-koleksiyonlar-temizlenecek-ve-yalnizca-yonetici-hesabiniz-korunacaktir")}
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={async () => {
                        const ok = await runManagerAction(async () => {
                          await resetSystem();
                          await notifyManager(t("sistem-sifirlandi"), t("tum-mvp-verileri-temizlendi-yalnizca-yonetici-hesabiniz-birakildi"), 'warning', undefined, 'manager');
                        }, t("sistem-sifirlanamadi"));

                        if (ok) {
                          setShowResetConfirm(false);
                          setProfileView('main');
                        }
                      }}
                      className="w-full h-14 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors"
                    >
                      {t("evet-her-seyi-sifirla")}
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="w-full h-14 bg-gray-100 text-gray-600 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                    >
                      {t("vazgec")}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      );
    } else if (profileView === 'profile-info') {
      profileContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('settings')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">Profil Bilgileri</h1>
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
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void handleImageUpload(e, 'avatar');
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("isim")}</label>
                <input 
                  type="text" 
                  value={profileDraft.name}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, name: e.target.value }))}
                  className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">Soyisim</label>
                <input 
                  type="text" 
                  value={profileDraft.surname}
                  onChange={(e) => setProfileDraft((current) => ({ ...current, surname: e.target.value }))}
                  className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
                />
              </div>
            </div>

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

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("dogum-tarihi")}</label>
              <input 
                type="date" 
                value={profileDraft.birthDate ? profileDraft.birthDate.split('T')[0] : ''}
                onChange={(e) => setProfileDraft((current) => ({ ...current, birthDate: e.target.value }))}
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black text-text-primary"
              />
            </div>

            <button 
              onClick={() => {
                void saveProfileInfo();
              }}
              className="w-full py-4 rounded-2xl bg-black text-white font-bold text-sm shadow-lg shadow-black/10 mt-4"
            >
              {t("bilgileri-guncelle")}
            </button>
          </div>
        </div>
      );
    } else if (profileView === 'change-password') {
      profileContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('settings')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
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
                onChange={(e) => setPasswordDraft((current) => ({ ...current, currentPassword: e.target.value }))}
                placeholder="••••••••"
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("yeni-sifre")}</label>
              <input 
                type="password" 
                value={passwordDraft.newPassword}
                onChange={(e) => setPasswordDraft((current) => ({ ...current, newPassword: e.target.value }))}
                placeholder="••••••••"
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-text-secondary uppercase tracking-widest ml-1">{t("yeni-sifre-tekrar")}</label>
              <input 
                type="password" 
                value={passwordDraft.confirmPassword}
                onChange={(e) => setPasswordDraft((current) => ({ ...current, confirmPassword: e.target.value }))}
                placeholder="••••••••"
                className="w-full p-4 rounded-2xl bg-surface border border-border text-sm focus:outline-none focus:border-black"
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
              className="w-full py-4 rounded-2xl bg-black text-white font-bold text-sm shadow-lg shadow-black/10 mt-4"
            >
              {isSavingPassword ? t("guncelleniyor") : t("sifreyi-guncelle")}
            </button>
          </div>
        </div>
      );
    } else if (profileView === 'policies') {
      profileContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('settings')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-display font-bold">{t("uygulama-politikalari")}</h1>
          </div>

          <div className="rounded-3xl border border-border bg-surface p-6 space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-bold">KVKK Metni</p>
              <p className="text-xs text-text-secondary leading-relaxed">{t("verileriniz-guvenlik-standartlarimiza-uygun-olarak-korunmaktadir-kisisel-verilerinizin-islenmesi-hakkinda-detaylar")}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold">{t("kullanim-sartlari")}</p>
              <p className="text-xs text-text-secondary leading-relaxed">{t("verilen-hizmetler-uzerinden-yaptiginiz-siparislerde-bu-sartlari-kabul-etmis-sayilirsiniz")}</p>
            </div>
          </div>
        </div>
      );
    } else if (profileView === 'about') {
      profileContent = (
        <div className="p-6 pb-32 space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setProfileView('settings')} className="w-10 h-10 rounded-full bg-surface border border-border flex items-center justify-center">
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
            </div>
          </div>
        </div>
      );
    } else if (profileView === 'orders-history') {
      const userOrders = orders.filter(o => o.userId === user?.id);
      profileContent = (
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
      profileContent = (
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

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={profileView}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {profileContent}
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
};
