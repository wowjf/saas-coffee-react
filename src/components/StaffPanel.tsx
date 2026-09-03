import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../AppContext';
import { SupportChat } from './SupportChat';
import { StaffReservationPanel } from './ReservationPanel';
import { LoyaltyScanResult, Order, Product, Category } from '../types';
import {
  MessageCircle, 
  CheckCircle2, 
  Clock, 
  Coffee, 
  AlertCircle, 
  Scan, 
  LogOut,
  User as UserIcon,
  Users,
  Settings,
  X,
  Utensils,
  ChevronRight,
  ArrowLeft,
  Check,
  Plus,
  ShoppingBag,
  Wallet,
  Search,
  RefreshCw,
  DollarSign,
  UserPlus,
  Minus,
  Bell
} from 'lucide-react';
import { LoyaltyQrScanner } from './LoyaltyQrScanner';
import { apiRequest } from '../lib/api';
import { cn, getOrderDisplayCode, matchesOrderCode } from '../lib/utils';
import { t } from "../shared/system-texts";
import { subscribeToPush, getNotificationPermission, sendTestNotification, isPushSupported } from '../lib/pushClient';

export const StaffPanel: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { 
    user, 
    logout, 
    updateUser, 
    orders, 
    updateOrderStatus: updateStatus, 
    products, 
    categories,
    setSessionRole
  } = useApp();

  const renderPortal = (content: React.ReactNode) => {
    const el = typeof document !== 'undefined' ? document.getElementById('modal-root') : null;
    return el ? createPortal(content, el) : content;
  };

  // Local state for table tracking
  const [tables, setTables] = useState<any[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [tableFilter, setTableFilter] = useState<'all' | 'active' | 'empty' | 'pending'>('all');
  const [tableSearch, setTableSearch] = useState('');

  // Local state for manual walk-in sessions
  const [showAddGuestForm, setShowAddGuestForm] = useState(false);
  // User search state for host selection (empty table)
  const [hostSearchQuery, setHostSearchQuery] = useState('');
  const [hostSearchResults, setHostSearchResults] = useState<any[]>([]);
  const [hostSearchLoading, setHostSearchLoading] = useState(false);
  const [selectedHostUser, setSelectedHostUser] = useState<any | null>(null);
  // User search state for add guest (active table)
  const [guestSearchQuery, setGuestSearchQuery] = useState('');
  const [guestSearchResults, setGuestSearchResults] = useState<any[]>([]);
  const [guestSearchLoading, setGuestSearchLoading] = useState(false);

  // Waiter ordering state
  const [showWaiterCatalog, setShowWaiterCatalog] = useState(false);
  const [waiterCart, setWaiterCart] = useState<{ product: Product; quantity: number }[]>([]);
  const [waiterOrderNote, setWaiterOrderNote] = useState('');
  const [waiterSearchQuery, setWaiterSearchQuery] = useState('');
  const [selectedWaiterCategory, setSelectedWaiterCategory] = useState('all');

  // Live Orders state
  const [orderFilter, setOrderFilter] = useState<'all' | 'pending' | 'preparing' | 'ready' | 'completed'>('all');
  const [orderSearch, setOrderSearch] = useState('');
  const [rejectModalOrderId, setRejectModalOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Stokta yok');

  // Loyalty scanner states
  const [showScanner, setShowScanner] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scanResult, setScanResult] = useState<LoyaltyScanResult | null>(null);
  const [scannedToken, setScannedToken] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [loyaltyActionLoading, setLoyaltyActionLoading] = useState<string | null>(null);

  // Profile / Settings states
  const [profileView, setProfileView] = useState<'main' | 'settings'>('main');
  const [profileDraft, setProfileDraft] = useState({ 
    name: user?.name || '', 
    surname: user?.surname || '', 
    phone: user?.phone || '', 
    birthDate: user?.birthDate || '',
    gender: user?.gender || 'female'
  });
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [profileFeedback, setProfileFeedback] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // C1: garson çağrıları — canlı siparişler sekmesinde gösterilir
  const [waiterCalls, setWaiterCalls] = useState<any[]>([]);

  // C4: canlı destek sohbeti
  const [showSupportChat, setShowSupportChat] = useState(false);

  // C5: rezervasyon yönetimi (masa sekmesinde açılır)
  const [showReservations, setShowReservations] = useState(false);
  const [supportChatPending, setSupportChatPending] = useState(0);

  const fetchSupportChatPending = async () => {
    try {
      const rooms = await apiRequest<any[]>('/api/chat/rooms');
      setSupportChatPending(Array.isArray(rooms) ? rooms.filter((r: any) => r.status === 'waiting').length : 0);
    } catch {
      // best-effort
    }
  };
  const [isLoadingCalls, setIsLoadingCalls] = useState(false);

  const fetchWaiterCalls = async () => {
    try {
      setIsLoadingCalls(true);
      const data = await apiRequest<any[]>('/api/waiter-calls');
      setWaiterCalls(Array.isArray(data) ? data : []);
    } catch {
      // çağrı listesi alınamadıysa panel sessiz kalır (best-effort)
    } finally {
      setIsLoadingCalls(false);
    }
  };

  const handleCallAction = async (callId: string, action: 'acknowledge' | 'complete') => {
    try {
      await apiRequest(`/api/waiter-calls/${callId}/${action}`, { method: 'POST' });
      await fetchWaiterCalls();
    } catch (err: any) {
      alert(err.message || t("islem-basarisiz-oldu"));
    }
  };

  // Synchronize profile draft on user load
  useEffect(() => {
    if (user) {
      setProfileDraft({
        name: user.name,
        surname: user.surname,
        phone: user.phone,
        birthDate: user.birthDate,
        gender: user.gender || 'female'
      });
    }
  }, [user]);

  // Fetch tables and self-heal
  const fetchTables = async (showLoading = false) => {
    try {
      if (showLoading) setLoadingTables(true);
      const data = await apiRequest<any[]>('/api/tables');
      setTables(data);
      
      // If a table details sheet is open, update its active copy
      if (selectedTable) {
        const updatedSelected = data.find(t => t.tableNumber === selectedTable.tableNumber);
        setSelectedTable(updatedSelected || null);
      }
    } catch (err) {
      console.error("fetch tables error:", err);
    } finally {
      if (showLoading) setLoadingTables(false);
    }
  };

  // C1: canlı sekmedeyken garson çağrılarını periyodik tazele
  useEffect(() => {
    if (activeTab === 'live') {
      fetchWaiterCalls();
      fetchSupportChatPending();
      const interval = setInterval(() => {
        fetchWaiterCalls();
        fetchSupportChatPending();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Poll tables
  useEffect(() => {
    if (activeTab === 'tables') {
      fetchTables(true);
      const interval = setInterval(() => fetchTables(false), 8000);
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  // Debounced search for host user (empty table)
  useEffect(() => {
    if (hostSearchQuery.trim().length < 2) {
      setHostSearchResults([]);
      return;
    }
    setHostSearchLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const data = await apiRequest<any[]>(`/api/users/search?q=${encodeURIComponent(hostSearchQuery.trim())}`);
        setHostSearchResults(data);
      } catch { setHostSearchResults([]); }
      setHostSearchLoading(false);
    }, 350);
    return () => clearTimeout(timeout);
  }, [hostSearchQuery]);

  // Debounced search for guest user (add to existing table)
  useEffect(() => {
    if (guestSearchQuery.trim().length < 2) {
      setGuestSearchResults([]);
      return;
    }
    setGuestSearchLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const data = await apiRequest<any[]>(`/api/users/search?q=${encodeURIComponent(guestSearchQuery.trim())}`);
        setGuestSearchResults(data);
      } catch { setGuestSearchResults([]); }
      setGuestSearchLoading(false);
    }, 350);
    return () => clearTimeout(timeout);
  }, [guestSearchQuery]);

  // Handle manual session opening
  const handleForceCreateSession = async () => {
    if (!selectedTable || !selectedHostUser) return;
    try {
      setLoadingTables(true);
      await apiRequest('/api/table-sessions/force-create', {
        method: 'POST',
        body: JSON.stringify({
          tableNumber: selectedTable.tableNumber,
          userId: selectedHostUser._id
        })
      });
      setSelectedHostUser(null);
      setHostSearchQuery('');
      setHostSearchResults([]);
      await fetchTables(false);
    } catch (err: any) {
      alert(err.message || t("oturum-baslatilamadi"));
    } finally {
      setLoadingTables(false);
    }
  };

  // Handle manual guest addition
  const handleAddWalkinGuest = async (userId: string) => {
    if (!selectedTable?.session) return;
    try {
      setLoadingTables(true);
      await apiRequest('/api/table-sessions/add-walkin', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken: selectedTable.session.sessionToken,
          userId
        })
      });
      setGuestSearchQuery('');
      setGuestSearchResults([]);
      setShowAddGuestForm(false);
      await fetchTables(false);
    } catch (err: any) {
      alert(err.message || t("katilimci-eklenemedi"));
    } finally {
      setLoadingTables(false);
    }
  };

  // Handle approve / reject pending guests
  const handleApproveParticipant = async (pendingUserId: string, action: 'approve' | 'reject') => {
    if (!selectedTable?.session) return;
    try {
      setLoadingTables(true);
      await apiRequest('/api/table-sessions/approve-participant', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken: selectedTable.session.sessionToken,
          pendingUserId,
          action
        })
      });
      await fetchTables(false);
    } catch (err: any) {
      alert(err.message || t("islem-basarisiz"));
    } finally {
      setLoadingTables(false);
    }
  };

  // Handle manual table payment & close (Checkout)
  const handleCheckoutTable = async () => {
    if (!selectedTable?.session) return;
    const confirmClose = window.confirm(`Masa ${selectedTable.tableNumber} hesabının tamamı kasadan tahsil edilip kapatılsın mı?`);
    if (!confirmClose) return;

    try {
      setLoadingTables(true);
      await apiRequest('/api/table-sessions/pay', {
        method: 'POST',
        body: JSON.stringify({
          sessionToken: selectedTable.session.sessionToken,
          paymentType: 'all'
        })
      });
      setSelectedTable(null);
      await fetchTables(false);
    } catch (err: any) {
      alert(err.message || t("odeme-kaydi-olusturulamadi"));
    } finally {
      setLoadingTables(false);
    }
  };

  // Waiter product quantity adjustment
  const handleUpdateWaiterCart = (product: Product, amount: number) => {
    const existing = waiterCart.find(i => i.product.id === product.id);
    if (existing) {
      const newQty = existing.quantity + amount;
      if (newQty <= 0) {
        setWaiterCart(waiterCart.filter(i => i.product.id !== product.id));
      } else {
        setWaiterCart(waiterCart.map(i => i.product.id === product.id ? { ...i, quantity: newQty } : i));
      }
    } else if (amount > 0) {
      setWaiterCart([...waiterCart, { product, quantity: 1 }]);
    }
  };

  // Handle submitting waiter order
  const handleStaffSubmitOrder = async () => {
    if (!selectedTable?.session || waiterCart.length === 0) return;
    try {
      setLoadingTables(true);
      const itemsPayload = waiterCart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity
      }));
      await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          tableSessionToken: selectedTable.session.sessionToken,
          items: itemsPayload,
          note: waiterOrderNote
        })
      });
      setWaiterCart([]);
      setWaiterOrderNote('');
      setShowWaiterCatalog(false);
      await fetchTables(false);
    } catch (err: any) {
      alert(err.message || t("siparis-verilemedi"));
    } finally {
      setLoadingTables(false);
    }
  };

  // Order status advancement logic
  const handleUpdateOrderStatus = async (orderId: string, nextStatus: Order['status']) => {
    try {
      await updateStatus(orderId, nextStatus);
      // Trigger tables update too in case orders tab alters status of a table order
      if (activeTab === 'tables') {
        await fetchTables(false);
      }
    } catch (err: any) {
      alert(err.message || t("siparis-guncellenemedi"));
    }
  };

  // Confirm order cancellation
  const handleCancelOrder = async () => {
    if (!rejectModalOrderId) return;
    try {
      await updateStatus(rejectModalOrderId, 'rejected', { cancelReason: rejectReason });
      setRejectModalOrderId(null);
      if (activeTab === 'tables') {
        await fetchTables(false);
      }
    } catch (err: any) {
      alert(err.message || t("siparis-iptal-edilemedi"));
    }
  };

  // Loyalty QR code scanner resolvers
  const handleScannerDetected = async (token: string) => {
    try {
      setScannerError('');
      setLoyaltyActionLoading('resolve');
      setScannedToken(token);
      const result = await apiRequest<LoyaltyScanResult>('/api/loyalty/scan/resolve', {
        method: 'POST',
        body: JSON.stringify({ token })
      });
      setScanResult(result);
      setShowScanner(false);
    } catch (err: any) {
      setScannerError(err.message || t("sadakat-kodu-gecersiz"));
      setScanResult(null);
    } finally {
      setLoyaltyActionLoading(null);
    }
  };

  const handleRedeemCampaign = async (campaignId: string) => {
    if (!scannedToken) return;
    try {
      setLoyaltyActionLoading(campaignId);
      const result = await apiRequest<LoyaltyScanResult>('/api/loyalty/scan/redeem-campaign', {
        method: 'POST',
        body: JSON.stringify({ token: scannedToken, campaignId })
      });
      setScanResult(result);
      alert(t("hediye-basariyla-tanimlandi"));
    } catch (err: any) {
      alert(err.message || t("kampanya-tanimlanamadi"));
    } finally {
      setLoyaltyActionLoading(null);
    }
  };

  const handleLoadBalance = async () => {
    if (!scanResult?.customer?.id) return;
    const amt = parseFloat(topupAmount);
    if (isNaN(amt) || amt <= 0) {
      alert(t("lutfen-gecerli-bir-yukleme-miktari-girin"));
      return;
    }
    try {
      setLoyaltyActionLoading('balance');
      const updatedUserRes: any = await apiRequest(`/api/users/${scanResult.customer.id}/balance`, {
        method: 'POST',
        body: JSON.stringify({ amount: amt })
      });
      alert(`₺${amt} bakiye başarıyla yüklendi!`);
      setTopupAmount('');
      // Re-resolve loyalty token to update values
      if (scannedToken) {
        handleScannerDetected(scannedToken);
      }
    } catch (err: any) {
      alert(err.message || t("bakiye-yukleme-basarisiz"));
    } finally {
      setLoyaltyActionLoading(null);
    }
  };

  // Profile Save
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileFeedback('');
    try {
      await updateUser(profileDraft);
      setProfileFeedback(t("profiliniz-basariyla-guncellendi"));
    } catch (err: any) {
      setProfileFeedback(err.message || t("profil-guncellenirken-hata-olustu"));
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Password Update
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordDraft.newPassword !== passwordDraft.confirmPassword) {
      setPasswordFeedback(t("yeni-sifreler-eslesmiyor"));
      return;
    }
    setIsSavingPassword(true);
    setPasswordFeedback('');
    try {
      await apiRequest('/api/users/me/password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword: passwordDraft.currentPassword,
          newPassword: passwordDraft.newPassword
        })
      });
      setPasswordFeedback(t("sifreniz-basariyla-degistirildi"));
      setPasswordDraft({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordFeedback(err.message || t("sifre-guncellenirken-hata-olustu"));
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Helper: Format elapsed time
  const getElapsedTime = (openedAtStr: string) => {
    if (!openedAtStr) return '';
    const openedAt = new Date(openedAtStr);
    const diffMs = Date.now() - openedAt.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} dk`;
    const diffHours = Math.floor(diffMins / 60);
    const remMins = diffMins % 60;
    return `${diffHours} sa ${remMins} dk`;
  };

  // Tab 1: Live Orders
  if (activeTab === 'live') {
    const filteredOrders = orders.filter(o => {
      const matchStatus = 
        orderFilter === 'all' ? ['pending', 'preparing', 'ready'].includes(o.status) :
        orderFilter === 'completed' ? ['completed', 'rejected'].includes(o.status) :
        o.status === orderFilter;
      
      const normalizedQuery = orderSearch.toLowerCase().trim();
      const matchSearch = !normalizedQuery || 
        o.userName.toLowerCase().includes(normalizedQuery) ||
        (o.tableNumber && o.tableNumber.includes(normalizedQuery)) ||
        matchesOrderCode(o.id, normalizedQuery);
        
      return matchStatus && matchSearch;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return (
      <div className="p-5 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-display font-bold text-text-primary">{t("canli-siparisler")}</h1>
            <p className="text-xs text-text-secondary">{t("hazirlanan-ve-teslim-bekleyen-siparisler")}</p>
          </div>
          <div className="flex items-center gap-2">
            {isPushSupported() && (
              <button
                type="button"
                onClick={async () => {
                  if (getNotificationPermission() !== 'granted') {
                    await subscribeToPush();
                  } else {
                    await sendTestNotification();
                  }
                }}
                className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center border transition-all cursor-pointer",
                  getNotificationPermission() === 'granted'
                    ? "bg-neutral-100 border-neutral-300 text-black"
                    : "bg-surface border-border text-neutral-400 hover:text-black hover:border-black"
                )}
                title={getNotificationPermission() === 'granted' ? "Bildirimler ve Ses Açık (Tıkla ve Test Et)" : "Yeni Sipariş Bildirimlerini Aç"}
              >
                <Bell size={18} />
              </button>
            )}
            <button 
              onClick={() => {
                setScanResult(null);
                setScannerError('');
                setShowScanner(true);
              }}
              className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            >
              <Scan size={18} />
            </button>
            <button
              onClick={() => setShowSupportChat(true)}
              className="w-10 h-10 rounded-2xl bg-white border border-border flex items-center justify-center shadow-sm active:scale-95 transition-transform relative"
              title="Destek Sohbetleri"
            >
              <MessageCircle size={18} />
              {supportChatPending > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {supportChatPending}
                </span>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showSupportChat && (
            <SupportChat mode="staff" onClose={() => setShowSupportChat(false)} />
          )}
        </AnimatePresence>

        {/* C1: Garson Çağrıları */}
        {(waiterCalls.length > 0 || isLoadingCalls) && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-text-secondary">Garson Çağrıları</h2>
              {waiterCalls.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {waiterCalls.length} aktif
                </span>
              )}
            </div>
            <div className="space-y-2">
              {waiterCalls.map((call) => (
                <div
                  key={call.id}
                  className={cn(
                    "bg-white border rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm",
                    call.priority === 'urgent' ? "border-red-200" : "border-amber-200"
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-black">Masa {call.tableNumber}</span>
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider",
                        call.type === 'bill' && "bg-blue-100 text-blue-700",
                        call.type === 'help' && "bg-green-100 text-green-700",
                        call.type === 'order' && "bg-purple-100 text-purple-700",
                        call.type === 'complaint' && "bg-red-100 text-red-700",
                        call.priority === 'urgent' && "bg-red-500 text-white"
                      )}>
                        {call.type === 'bill' ? 'Hesap' :
                         call.type === 'help' ? t("yardim") :
                         call.type === 'order' ? t("ek-siparis") :
                         call.type === 'complaint' ? 'Şikayet' : call.type}
                      </span>
                      <span className="text-[10px] text-text-secondary">
                        {call.userName} • {new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {call.message && (
                      <p className="text-xs text-text-secondary mt-1 truncate">{call.message}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {call.status === 'pending' ? (
                      <button
                        onClick={() => handleCallAction(call.id, 'acknowledge')}
                        className="px-3 py-2 rounded-xl bg-black text-white text-xs font-bold active:scale-95 transition-transform"
                      >
                        Al
                      </button>
                    ) : call.status === 'acknowledged' ? (
                      <button
                        onClick={() => handleCallAction(call.id, 'complete')}
                        className="px-3 py-2 rounded-xl bg-green-600 text-white text-xs font-bold active:scale-95 transition-transform"
                      >
                        Bitir
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-green-600">{t("tamamlandi")}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            type="text"
            placeholder="Masa veya isim ara..."
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {([
            { id: 'all', label: 'Aktif' },
            { id: 'pending', label: 'Bekleyen' },
            { id: 'preparing', label: t("hazirlaniyor") },
            { id: 'ready', label: 'Teslim Bekleyen' },
            { id: 'completed', label: 'Tamamlananlar' }
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setOrderFilter(tab.id)}
              className={cn(
                "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors border",
                orderFilter === tab.id 
                  ? "bg-black border-black text-white" 
                  : "bg-surface border-border text-text-secondary hover:bg-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Orders list */}
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center text-text-secondary space-y-2">
              <Coffee className="mx-auto text-text-secondary/40" size={32} />
              <p className="text-sm font-medium">{t("gosterilecek-siparis-bulunmuyor")}</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const orderCode = getOrderDisplayCode(order.id);
              const isTableOrder = !!order.tableSessionToken;
              const dateObj = new Date(order.timestamp);
              const orderTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <motion.div 
                  layout
                  key={order.id}
                  className={cn(
                    "bg-white border border-border rounded-[24px] p-5 space-y-4 transition-all shadow-sm hover:shadow-md",
                    order.status === 'pending' && "border-amber-400 bg-amber-50/10",
                    order.status === 'ready' && "border-emerald-400 bg-emerald-50/10"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary bg-surface px-2 py-0.5 rounded-lg border border-border">
                          #{orderCode}
                        </span>
                        {isTableOrder ? (
                          <span className="text-xs font-bold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                            Masa {order.tableNumber}
                          </span>
                        ) : (
                          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200">
                            Paket Servis
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-text-primary">{order.userName}</h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-text-secondary text-xs font-medium">
                      <Clock size={12} />
                      <span>{orderTime}</span>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="divide-y divide-border border-y border-border py-3 space-y-2">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs py-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-black bg-surface border border-border w-5 h-5 rounded flex items-center justify-center">
                            {item.quantity}
                          </span>
                          <span className="font-medium text-text-primary">{item.product.name}</span>
                        </div>
                        <span className="font-semibold text-text-secondary">₺{item.product.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  {order.note && (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100/50 flex items-start gap-2">
                      <AlertCircle size={14} className="text-amber-700 shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-amber-800">
                        <span className="font-bold">Not: </span>"{order.note}"
                      </p>
                    </div>
                  )}

                  {order.cancelReason && (
                    <div className="p-3 bg-red-50 rounded-xl border border-red-100 flex items-start gap-2">
                      <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
                      <p className="text-xs font-medium text-red-700">
                        <span className="font-bold">{t("iptal-nedeni-2")} </span>{order.cancelReason}
                      </p>
                    </div>
                  )}

                  {/* Bottom total and actions */}
                  <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Tutar</span>
                      <span className="text-base font-display font-bold text-black">₺{order.total}</span>
                    </div>

                    <div className="flex gap-2">
                      {order.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                            className="bg-black text-white hover:bg-neutral-800 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors"
                          >
                            Onayla
                          </button>
                          <button
                            onClick={() => {
                              setRejectModalOrderId(order.id);
                              setRejectReason('Stokta yok');
                            }}
                            className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors border border-red-200/50"
                          >
                            Reddet
                          </button>
                        </>
                      )}

                      {order.status === 'preparing' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                          className="bg-emerald-500 text-white hover:bg-emerald-600 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm shadow-emerald-500/10"
                        >
                          {t("hazir")}
                        </button>
                      )}

                      {order.status === 'ready' && (
                        <button
                          onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                          className="bg-blue-600 text-white hover:bg-blue-700 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm shadow-blue-600/10"
                        >
                          Teslim Et
                        </button>
                      )}

                      {order.status === 'completed' && (
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl flex items-center gap-1 border border-emerald-100">
                          <CheckCircle2 size={14} />
                          Teslim Edildi
                        </span>
                      )}

                      {order.status === 'rejected' && (
                        <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-xl flex items-center gap-1 border border-red-100">
                          <X size={14} />
                          Reddedildi
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Rejection Modal */}
        <AnimatePresence>
          {rejectModalOrderId && renderPortal(
            <div className="absolute inset-0 z-[80] flex items-end sm:items-center justify-center p-4 pointer-events-auto">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setRejectModalOrderId(null)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, y: 100 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 100 }}
                className="relative w-full max-w-sm bg-white rounded-3xl p-6 space-y-6 shadow-2xl border border-border"
              >
                <div className="space-y-1">
                  <h3 className="text-lg font-bold font-display text-text-primary">{t("siparis-iptal-nedeni")}</h3>
                  <p className="text-xs text-text-secondary">{t("lutfen-siparisi-iptal-etme-nedeninizi-secin")}</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {['Stokta yok', t("musteri-vazgecti"), t("hatali-siparis"), t("diger")].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setRejectReason(reason)}
                      className={cn(
                        "p-4 rounded-2xl border text-left text-sm font-semibold transition-colors flex items-center justify-between",
                        rejectReason === reason 
                          ? "border-red-500 bg-red-50 text-red-700" 
                          : "border-border hover:bg-surface text-text-primary"
                      )}
                    >
                      <span>{reason}</span>
                      {rejectReason === reason && <Check size={16} className="text-red-700" />}
                    </button>
                  ))}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setRejectModalOrderId(null)}
                    className="flex-1 rounded-2xl border border-border py-3.5 text-xs font-bold text-text-primary bg-surface hover:bg-white"
                  >
                    {t("vazgec")}
                  </button>
                  <button
                    onClick={handleCancelOrder}
                    className="flex-1 rounded-2xl bg-red-600 py-3.5 text-xs font-bold text-white shadow-lg shadow-red-600/10"
                  >
                    {t("iptal-et")}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Loyalty scan results details */}
        <AnimatePresence>
          {showScanner && renderPortal(
            <div className="absolute inset-0 z-[80] flex items-center justify-center p-4 pointer-events-auto">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowScanner(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-sm bg-white rounded-3xl p-6 space-y-6 shadow-2xl border border-border"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold font-display">Sadakat QR Tara</h3>
                  <button onClick={() => setShowScanner(false)} className="p-1 rounded-full hover:bg-surface border border-border">
                    <X size={16} />
                  </button>
                </div>
                
                <LoyaltyQrScanner 
                  active={showScanner}
                  onDetected={handleScannerDetected}
                  onError={(msg) => setScannerError(msg)}
                />
                
                {scannerError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-xl border border-red-100">
                    {scannerError}
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Loyalty Resolve Results Modal */}
        <AnimatePresence>
          {scanResult && renderPortal(
            <div className="absolute inset-0 z-[80] flex items-center justify-center p-4 pointer-events-auto">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setScanResult(null)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-sm bg-white rounded-[32px] p-6 space-y-6 shadow-2xl border border-border max-h-[85vh] overflow-y-auto no-scrollbar"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold font-display text-text-primary">{t("musteri-sadakat-karti")}</h3>
                  <button onClick={() => setScanResult(null)} className="p-1 rounded-full hover:bg-surface border border-border">
                    <X size={16} />
                  </button>
                </div>

                <div className="bg-surface rounded-2xl p-4 border border-border space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-500/20 font-bold font-display text-lg">
                      {scanResult.customer.name[0]}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-text-primary">{scanResult.customer.name}</h4>
                      <p className="text-[11px] text-text-secondary">{scanResult.customer.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                    <div className="bg-white p-3 rounded-xl border border-border space-y-0.5">
                      <span className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider block">Puan</span>
                      <span className="text-lg font-bold font-display text-black block">{scanResult.summary.pointsBalance} KP</span>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-border space-y-0.5">
                      <span className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider block">Bakiye</span>
                      <span className="text-lg font-bold font-display text-emerald-600 block">₺{scanResult.summary.stampStatus?.rewardCredits || 0} Hediye</span>
                    </div>
                  </div>
                </div>

                {/* Top Up Balance Section */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <Wallet size={12} className="text-text-secondary" />
                    {t("bakiye-yukle")}
                  </h4>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-secondary">₺</span>
                      <input 
                        type="number"
                        placeholder={t("yuklenecek-miktar")}
                        value={topupAmount}
                        onChange={(e) => setTopupAmount(e.target.value)}
                        className="w-full bg-surface border border-border rounded-2xl py-3 pl-8 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                    <button 
                      onClick={handleLoadBalance}
                      disabled={loyaltyActionLoading === 'balance'}
                      className="bg-black text-white hover:bg-neutral-800 px-5 rounded-2xl text-xs font-bold uppercase transition-colors shrink-0 flex items-center gap-1.5"
                    >
                      {loyaltyActionLoading === 'balance' ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={14} />}
                      Yükle
                    </button>
                  </div>
                </div>

                {/* Redeemable Rewards */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-widest flex items-center gap-1.5">
                    <Coffee size={12} className="text-text-secondary" />
                    {t("kullanilabilir-hediye-kampanyalari")}
                  </h4>
                  {scanResult.summary.availableRewards.length === 0 ? (
                    <p className="text-xs text-text-secondary text-center py-4 italic">{t("kullanilabilir-odul-bulunmuyor")}</p>
                  ) : (
                    <div className="space-y-2">
                      {scanResult.summary.availableRewards.map((reward) => (
                        <div key={reward.campaignId} className="flex justify-between items-center p-3 rounded-xl border border-border bg-surface text-xs font-medium">
                          <div className="space-y-0.5 pr-2">
                            <span className="font-bold text-text-primary block">{reward.campaignTitle}</span>
                            <span className="text-[10px] text-text-secondary block">Bedeli: {reward.pointsCost} KP</span>
                          </div>
                          <button
                            onClick={() => handleRedeemCampaign(reward.campaignId)}
                            disabled={!reward.isEligible || !!loyaltyActionLoading}
                            className={cn(
                              "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors shrink-0",
                              reward.isEligible 
                                ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                                : "bg-border text-text-secondary cursor-not-allowed"
                            )}
                          >
                            {loyaltyActionLoading === reward.campaignId ? (
                              <RefreshCw size={10} className="animate-spin" />
                            ) : "Kullan"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Tab 2: Table Session Tracker Map
  if (activeTab === 'tables') {
    const activeTables = tables.filter(t => !!t.currentSessionId);
    const emptyTables = tables.filter(t => !t.currentSessionId);
    const tablesWithRequests = tables.filter(t => t.session?.pendingParticipants?.length > 0);

    const activeCount = activeTables.length;
    const emptyCount = emptyTables.length;
    const totalUnpaid = tables.reduce((sum, t) => sum + (t.session?.unpaidAmount || 0), 0);
    const pendingRequestTotal = tables.reduce((sum, t) => sum + (t.session?.pendingParticipants?.length || 0), 0);

    // Apply filters
    const filteredTables = tables.filter(t => {
      const isOccupied = !!t.currentSessionId;
      if (tableFilter === 'active' && !isOccupied) return false;
      if (tableFilter === 'empty' && isOccupied) return false;
      if (tableFilter === 'pending' && !(t.session?.pendingParticipants?.length > 0)) return false;

      const q = tableSearch.trim();
      if (q && !t.tableNumber.includes(q)) return false;
      return true;
    });

    return (
      <div className="p-5 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h1 className="text-2xl font-display font-bold text-text-primary">Masa Takibi</h1>
            <p className="text-xs text-text-secondary">{t("masalarin-doluluk-siparis-ve-odeme-durumu")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowReservations((prev) => !prev)}
              className={cn(
                "px-3 py-2 rounded-xl text-xs font-bold border transition-colors",
                showReservations ? "bg-black text-white border-black" : "border-border bg-white hover:bg-surface text-black",
              )}
            >
              Rezervasyonlar
            </button>
            <button 
              onClick={() => fetchTables(true)} 
              disabled={loadingTables}
              className="p-2 border border-border rounded-xl bg-white hover:bg-surface text-text-secondary shadow-sm transition-colors active:scale-95 flex items-center justify-center"
            >
              <RefreshCw size={16} className={cn(loadingTables && "animate-spin text-black")} />
            </button>
          </div>
        </div>

        {/* C5: rezervasyon yönetimi */}
        {showReservations && <StaffReservationPanel />}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-surface border border-border p-3.5 rounded-2xl text-center space-y-0.5 shadow-sm">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">Masa</span>
            <span className="text-base font-display font-bold text-text-primary block">{activeCount} / 60</span>
            <div className="w-full bg-border h-1 rounded-full overflow-hidden mt-1 mx-auto max-w-[80%]">
              <div className="bg-emerald-500 h-1" style={{ width: `${(activeCount / 60) * 100}%` }} />
            </div>
          </div>
          <div className={cn(
            "border p-3.5 rounded-2xl text-center space-y-0.5 shadow-sm transition-colors",
            pendingRequestTotal > 0 ? "bg-amber-500/10 border-amber-500 animate-pulse" : "bg-surface border-border"
          )}>
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">{t("istekler")}</span>
            <span className={cn("text-base font-display font-bold block", pendingRequestTotal > 0 ? "text-amber-700 font-black" : "text-text-primary")}>
              {pendingRequestTotal}
            </span>
            <span className="text-[9px] text-text-secondary block">Onay bekleyen</span>
          </div>
          <div className="bg-surface border border-border p-3.5 rounded-2xl text-center space-y-0.5 shadow-sm">
            <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">{t("kasa-alacagi")}</span>
            <span className="text-sm font-display font-bold text-emerald-600 block truncate" title={`₺${totalUnpaid}`}>
              ₺{totalUnpaid.toFixed(0)}
            </span>
            <span className="text-[9px] text-text-secondary block">Aktif toplam</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            type="text"
            placeholder={t("masa-numarasi-ara-orn-4")}
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {([
            { id: 'all', label: t("tumu-2") },
            { id: 'active', label: 'Dolu' },
            { id: 'empty', label: t("bos") },
            { id: 'pending', label: 'Onay Bekleyen' }
          ] as const).map((chip) => (
            <button
              key={chip.id}
              onClick={() => setTableFilter(chip.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors",
                tableFilter === chip.id 
                  ? "bg-black border-black text-white" 
                  : "bg-surface border-border text-text-secondary"
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Table Map Visual Grid */}
        <div className="bg-surface border border-border rounded-[28px] p-4 space-y-3">
          <h3 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">{t("kroki-masa-gorunumu")}</h3>
          
          <div className="grid grid-cols-5 gap-2 px-1">
            {filteredTables.map((t) => {
              const isOccupied = !!t.currentSessionId;
              const hasRequests = t.session?.pendingParticipants?.length > 0;
              const isSelected = selectedTable?.tableNumber === t.tableNumber;

              return (
                <button
                  key={t.tableNumber}
                  onClick={() => setSelectedTable(t)}
                  className={cn(
                    "w-12 h-12 rounded-xl text-xs font-bold border flex flex-col items-center justify-center transition-all relative",
                    isOccupied 
                      ? "bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/20" 
                      : "bg-white text-text-primary border-border hover:border-black/30",
                    hasRequests && "bg-amber-500 border-amber-600 text-white animate-bounce",
                    isSelected && "ring-2 ring-black ring-offset-2 scale-95"
                  )}
                >
                  <span>{t.tableNumber}</span>
                  {isOccupied && !hasRequests && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 bg-white/70 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* List of Active Tables */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-text-primary uppercase tracking-widest flex items-center gap-1.5">
            <Utensils size={14} className="text-text-secondary" />
            Aktif Masalar ({activeCount})
          </h3>
          
          <div className="space-y-3">
            {activeTables.length === 0 ? (
              <p className="text-xs text-text-secondary italic text-center py-4">{t("su-an-aktif-masa-bulunmuyor")}</p>
            ) : (
              activeTables.map((table) => {
                const session = table.session;
                if (!session) return null;
                const elapsed = getElapsedTime(session.openedAt);

                return (
                  <div 
                    key={table.tableNumber} 
                    className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between hover:border-black/20 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-base text-black">Masa {table.tableNumber}</span>
                        <span className="text-[10px] text-text-secondary font-medium">⏱️ {elapsed}</span>
                      </div>
                      <p className="text-xs text-text-secondary">
                        {session.hostName} • {session.participants.length} kişi
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[9px] text-text-secondary uppercase tracking-widest block font-bold">Kalan</span>
                        <span className="text-sm font-bold font-display text-emerald-600 block">₺{session.unpaidAmount}</span>
                      </div>
                      <button 
                        onClick={() => setSelectedTable(table)}
                        className="w-8 h-8 rounded-xl bg-surface border border-border hover:bg-neutral-100 flex items-center justify-center text-text-primary"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Table Details Slideover Modal */}
        <AnimatePresence>
          {selectedTable && renderPortal(
            <div className="absolute inset-0 z-[80] flex items-end justify-center pointer-events-auto">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  setSelectedTable(null);
                  setShowAddGuestForm(false);
                  setHostSearchQuery(''); setHostSearchResults([]); setSelectedHostUser(null);
                  setGuestSearchQuery(''); setGuestSearchResults([]);
                }}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              
              <motion.div 
                initial={{ y: 300, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 300, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="relative w-full bg-white rounded-t-[36px] shadow-2xl border-t border-border max-h-[85dvh] overflow-y-auto no-scrollbar flex flex-col z-[80] pb-safe"
              >
                {/* Drag bar indicator */}
                <div className="w-12 h-1 bg-border rounded-full mx-auto my-3" />
                
                <div className="px-6 pb-6 space-y-6 flex-1">
                  {/* Top table info */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-display font-bold text-text-primary">Masa {selectedTable.tableNumber}</h2>
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          selectedTable.currentSessionId ? "bg-emerald-500 animate-pulse" : "bg-neutral-300"
                        )} />
                      </div>
                      {selectedTable.session && (
                        <p className="text-xs text-text-secondary">
                          ⏱️ {getElapsedTime(selectedTable.session.openedAt)} önce açıldı.
                        </p>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedTable(null);
                        setShowAddGuestForm(false);
                        setHostSearchQuery(''); setHostSearchResults([]); setSelectedHostUser(null);
                        setGuestSearchQuery(''); setGuestSearchResults([]);
                      }} 
                      className="p-1 rounded-full border border-border hover:bg-surface"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Active Session details */}
                  {selectedTable.session ? (
                    <div className="space-y-6">
                      {/* Financial info */}
                      <div className="bg-surface rounded-2xl p-4 border border-border grid grid-cols-3 gap-2">
                        <div className="text-center space-y-0.5 border-r border-border">
                          <span className="text-[9px] text-text-secondary font-bold uppercase tracking-wider block">Toplam</span>
                          <span className="text-sm font-bold font-display text-text-primary block">₺{selectedTable.session.totalBill}</span>
                        </div>
                        <div className="text-center space-y-0.5 border-r border-border">
                          <span className="text-[9px] text-text-secondary font-bold uppercase tracking-wider block">{t("odenen")}</span>
                          <span className="text-sm font-bold font-display text-slate-500 block">₺{selectedTable.session.totalPaid}</span>
                        </div>
                        <div className="text-center space-y-0.5">
                          <span className="text-[9px] text-text-secondary font-bold uppercase tracking-wider block">Kalan</span>
                          <span className="text-sm font-bold font-display text-emerald-600 block">₺{selectedTable.session.unpaidAmount}</span>
                        </div>
                      </div>

                      {/* Pending Join Requests */}
                      {selectedTable.session.pendingParticipants?.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Onay Bekleyenler ({selectedTable.session.pendingParticipants.length})</h4>
                          <div className="space-y-2">
                            {selectedTable.session.pendingParticipants.map((p: any) => (
                              <div key={p.userId} className="flex justify-between items-center p-3 rounded-xl border border-amber-300 bg-amber-50/50 text-xs font-semibold">
                                <span className="text-amber-900">{p.userName}</span>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleApproveParticipant(p.userId, 'approve')}
                                    className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-md active:scale-95"
                                  >
                                    <Check size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleApproveParticipant(p.userId, 'reject')}
                                    className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-md active:scale-95"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Participants list */}
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                            <Users size={12} />
                            Masadakiler ({selectedTable.session.participants.length})
                          </h4>
                          
                          <button
                            onClick={() => setShowAddGuestForm(!showAddGuestForm)}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                          >
                            <Plus size={10} />
                            Misafir Ekle
                          </button>
                        </div>

                        {showAddGuestForm && (
                          <div className="space-y-2 p-3 bg-surface rounded-xl border border-border">
                            <div className="relative">
                              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                              <input 
                                type="text" 
                                placeholder={t("kullanici-ara-ad-soyad-telefon")}
                                value={guestSearchQuery}
                                onChange={(e) => setGuestSearchQuery(e.target.value)}
                                className="w-full bg-white border border-border rounded-xl pl-8 pr-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                              />
                              {guestSearchLoading && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                  <div className="w-3.5 h-3.5 border-2 border-text-secondary/30 border-t-text-secondary rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                            {guestSearchResults.length > 0 && (
                              <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                                {guestSearchResults.map((u: any) => (
                                  <button
                                    key={u._id}
                                    onClick={() => handleAddWalkinGuest(u._id)}
                                    className="w-full flex items-center gap-2.5 bg-white border border-border rounded-xl px-3 py-2 hover:border-emerald-300 hover:shadow-sm transition-all text-left active:scale-[0.98]"
                                  >
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-[10px] font-bold text-amber-700 shrink-0">
                                      {(u.name || '?')[0]}{(u.surname || '?')[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-xs font-bold text-text-primary truncate">{u.name} {u.surname}</p>
                                      <p className="text-[10px] text-text-secondary truncate">{u.phone || 'Telefon yok'}</p>
                                    </div>
                                    <UserPlus size={12} className="text-emerald-600 shrink-0" />
                                  </button>
                                ))}
                              </div>
                            )}
                            {guestSearchQuery.trim().length >= 2 && guestSearchResults.length === 0 && !guestSearchLoading && (
                              <p className="text-[10px] text-text-secondary text-center py-2 opacity-70">{t("kullanici-bulunamadi")}</p>
                            )}
                          </div>
                        )}

                        <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden bg-surface">
                          {selectedTable.session.participants.map((p: any) => {
                            const isHost = p.userId === selectedTable.session.hostUserId;

                            return (
                              <div key={p.userId} className="flex justify-between items-center p-3 text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-text-primary">{p.userName}</span>
                                  {isHost && (
                                    <span className="text-[9px] font-bold bg-black text-white px-1.5 py-0.5 rounded">Ev Sahibi</span>
                                  )}
                                </div>
                                <span className="font-semibold text-text-secondary">
                                  {p.paidAmount > 0 ? `Ödedi: ₺${p.paidAmount}` : t("borclu")}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Table orders list */}
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-text-secondary uppercase tracking-widest flex items-center gap-1.5">
                          <ShoppingBag size={12} />
                          Masa Siparişleri ({selectedTable.session.orders?.length || 0})
                        </h4>
                        
                        <div className="space-y-2">
                          {!selectedTable.session.orders || selectedTable.session.orders.length === 0 ? (
                            <p className="text-xs text-text-secondary italic text-center py-2">{t("bu-masada-henuz-siparis-yok")}</p>
                          ) : (
                            selectedTable.session.orders.map((o: any) => (
                              <div key={o.id} className="p-3 border border-border rounded-xl bg-surface space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-text-primary">#{getOrderDisplayCode(o.id)} • {o.userName}</span>
                                  <span className={cn(
                                    "font-bold px-2 py-0.5 rounded-md text-[9px] border uppercase tracking-wider",
                                    o.status === 'pending' && "bg-amber-50 border-amber-200 text-amber-700",
                                    o.status === 'preparing' && "bg-indigo-50 border-indigo-200 text-indigo-700",
                                    o.status === 'ready' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                                    o.status === 'completed' && "bg-slate-100 border-slate-200 text-text-secondary"
                                  )}>
                                    {o.status === 'pending' ? 'Bekliyor' : o.status === 'preparing' ? t("hazirlaniyor") : o.status === 'ready' ? t("hazir") : t("tamamlandi")}
                                  </span>
                                </div>
                                <div className="text-text-secondary text-[11px] font-medium">
                                  {o.items.map((i: any) => `${i.quantity}x ${i.product.name}`).join(', ')}
                                </div>
                                <div className="flex justify-between items-center pt-1.5 border-t border-border/40">
                                  <span className="font-bold">₺{o.total}</span>
                                  {o.status === 'pending' && (
                                    <button 
                                      onClick={() => handleUpdateOrderStatus(o.id, 'preparing')}
                                      className="bg-black text-white text-[10px] font-bold px-2.5 py-1 rounded-md"
                                    >
                                      Onayla
                                    </button>
                                  )}
                                  {o.status === 'preparing' && (
                                    <button 
                                      onClick={() => handleUpdateOrderStatus(o.id, 'ready')}
                                      className="bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md"
                                    >
                                      {t("hazir")}
                                    </button>
                                  )}
                                  {o.status === 'ready' && (
                                    <button 
                                      onClick={() => handleUpdateOrderStatus(o.id, 'completed')}
                                      className="bg-blue-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md"
                                    >
                                      Teslim Et
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Main action buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => {
                            setWaiterCart([]);
                            setWaiterOrderNote('');
                            setShowWaiterCatalog(true);
                          }}
                          className="flex-1 bg-black text-white rounded-2xl py-4 text-xs font-bold uppercase tracking-wider shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-1.5"
                        >
                          <Plus size={14} />
                          {t("siparis-yaz")}
                        </button>
                        <button
                          onClick={handleCheckoutTable}
                          className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 rounded-2xl py-4 text-xs font-bold uppercase tracking-wider shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-1.5 border border-emerald-500/20"
                        >
                          <DollarSign size={14} />
                          {t("odemeyi-al")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // Empty table walk-in opener form
                    <div className="space-y-4 py-4">
                      <div className="p-4 bg-surface rounded-2xl border border-border flex items-center gap-3">
                        <Coffee size={24} className="text-text-secondary opacity-35" />
                        <div>
                          <h4 className="text-sm font-bold text-text-primary">{t("masa-bos")}</h4>
                          <p className="text-xs text-text-secondary">{t("walk-in-musteriler-icin-yeni-bir-oturum-baslatin")}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-text-secondary font-bold uppercase tracking-widest">{t("musteri-ara")}</label>
                        <div className="relative">
                          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                          <input 
                            type="text" 
                            placeholder="Ad, soyad veya telefon ile ara..."
                            value={hostSearchQuery}
                            onChange={(e) => { setHostSearchQuery(e.target.value); setSelectedHostUser(null); }}
                            className="w-full bg-surface border border-border rounded-2xl pl-10 pr-4 py-3.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5"
                          />
                          {hostSearchLoading && (
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                              <div className="w-4 h-4 border-2 border-text-secondary/30 border-t-text-secondary rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        {/* Search results */}
                        {hostSearchResults.length > 0 && !selectedHostUser && (
                          <div className="mt-2 space-y-2 max-h-[180px] overflow-y-auto pr-1">
                            {hostSearchResults.map((u: any) => (
                              <button
                                key={u._id}
                                onClick={() => { setSelectedHostUser(u); setHostSearchResults([]); }}
                                className="w-full flex items-center gap-3 bg-white border border-border rounded-2xl px-4 py-3 hover:border-black/20 hover:shadow-sm transition-all text-left active:scale-[0.98]"
                              >
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center text-sm font-bold text-amber-700 shrink-0">
                                  {(u.name || '?')[0]}{(u.surname || '?')[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-text-primary truncate">{u.name} {u.surname}</p>
                                  <p className="text-[11px] text-text-secondary truncate">{u.phone || 'Telefon yok'}</p>
                                </div>
                                <UserPlus size={14} className="text-text-secondary shrink-0" />
                              </button>
                            ))}
                          </div>
                        )}
                        {hostSearchQuery.trim().length >= 2 && hostSearchResults.length === 0 && !hostSearchLoading && !selectedHostUser && (
                          <p className="text-xs text-text-secondary text-center py-3 opacity-70">{t("kullanici-bulunamadi")}</p>
                        )}
                      </div>
                      {/* Selected user card */}
                      {selectedHostUser && (
                        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-200 to-emerald-300 flex items-center justify-center text-sm font-bold text-emerald-800 shrink-0">
                            {(selectedHostUser.name || '?')[0]}{(selectedHostUser.surname || '?')[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-emerald-900 truncate">{selectedHostUser.name} {selectedHostUser.surname}</p>
                            <p className="text-[11px] text-emerald-700 truncate">{selectedHostUser.phone || 'Telefon yok'}</p>
                          </div>
                          <button onClick={() => { setSelectedHostUser(null); setHostSearchQuery(''); }} className="p-1.5 rounded-full hover:bg-emerald-100">
                            <X size={14} className="text-emerald-700" />
                          </button>
                        </div>
                      )}
                      <button
                        onClick={handleForceCreateSession}
                        disabled={!selectedHostUser}
                        className={`w-full rounded-2xl py-4 text-xs font-bold uppercase tracking-wider shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-1.5 ${selectedHostUser ? 'bg-black text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'}`}
                      >
                        <UserPlus size={14} />
                        {t("masa-oturumunu-ac")}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Waiter Ordering Catalog Modal */}
        <AnimatePresence>
          {showWaiterCatalog && selectedTable && renderPortal(
            <div className="absolute inset-0 z-[100] flex items-end justify-center pointer-events-auto">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowWaiterCatalog(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                className="relative w-full bg-white rounded-t-[36px] shadow-2xl border-t border-border h-[92dvh] flex flex-col"
              >
                {/* Header */}
                <div className="px-5 pt-4 pb-3 border-b border-border flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-bold font-display text-text-primary">Sipariş Yaz (Masa {selectedTable.tableNumber})</h3>
                    <p className="text-[10px] text-text-secondary font-medium">{t("waitress-panel-urun-katalogu")}</p>
                  </div>
                  <button 
                    onClick={() => setShowWaiterCatalog(false)}
                    className="p-1 border border-border rounded-full hover:bg-surface"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Filter and search */}
                <div className="px-5 py-3 space-y-3 border-b border-border bg-surface">
                  <div className="relative">
                    <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input 
                      type="text" 
                      placeholder={t("urun-ismi-ara")}
                      value={waiterSearchQuery}
                      onChange={(e) => setWaiterSearchQuery(e.target.value)}
                      className="w-full bg-white border border-border rounded-xl py-2 pl-9 pr-4 text-xs font-medium focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    <button
                      onClick={() => setSelectedWaiterCategory('all')}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors whitespace-nowrap",
                        selectedWaiterCategory === 'all' 
                          ? "bg-black border-black text-white" 
                          : "bg-white border-border text-text-secondary"
                      )}
                    >
                      {t("tumu-2")}
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedWaiterCategory(cat.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors whitespace-nowrap",
                          selectedWaiterCategory === cat.id 
                            ? "bg-black border-black text-white" 
                            : "bg-white border-border text-text-secondary"
                        )}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Product Catalog Grid list */}
                <div className="flex-1 overflow-y-auto p-5 space-y-3 no-scrollbar">
                  {products
                    .filter(p => {
                      if (selectedWaiterCategory !== 'all' && p.category !== selectedWaiterCategory) return false;
                      const q = waiterSearchQuery.toLowerCase().trim();
                      if (q && !p.name.toLowerCase().includes(q)) return false;
                      return true;
                    })
                    .map((prod) => {
                      const cartItem = waiterCart.find(i => i.product.id === prod.id);
                      const qty = cartItem ? cartItem.quantity : 0;

                      return (
                        <div 
                          key={prod.id} 
                          className={cn(
                            "flex items-center justify-between p-3 border border-border rounded-2xl bg-white shadow-sm transition-colors",
                            !prod.inStock && "opacity-50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-text-secondary">
                              <Coffee size={20} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-text-primary">{prod.name}</h4>
                              <span className="text-xs font-semibold text-text-secondary">₺{prod.price}</span>
                            </div>
                          </div>

                          {prod.inStock ? (
                            <div className="flex items-center gap-2">
                              {qty > 0 ? (
                                <>
                                  <button 
                                    onClick={() => handleUpdateWaiterCart(prod, -1)}
                                    className="w-7 h-7 rounded-lg border border-border bg-surface hover:bg-neutral-100 text-text-primary flex items-center justify-center active:scale-90 transition-transform"
                                  >
                                    <Minus size={12} />
                                  </button>
                                  <span className="text-xs font-bold w-4 text-center">{qty}</span>
                                </>
                              ) : null}
                              <button 
                                onClick={() => handleUpdateWaiterCart(prod, 1)}
                                className="w-7 h-7 rounded-lg bg-black text-white hover:bg-neutral-800 flex items-center justify-center active:scale-90 transition-transform"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md border border-red-100">{t("stok-disi")}</span>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Footer waiter order review */}
                <div className="p-5 border-t border-border bg-surface space-y-4">
                  {waiterCart.length > 0 && (
                    <div className="space-y-3">
                      {/* Cart review */}
                      <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto no-scrollbar">
                        {waiterCart.map((item) => (
                          <span key={item.product.id} className="text-[10px] font-semibold bg-white border border-border rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shadow-sm">
                            {item.product.name}
                            <span className="font-bold text-emerald-600">x{item.quantity}</span>
                          </span>
                        ))}
                      </div>

                      {/* Custom note */}
                      <input 
                        type="text" 
                        placeholder={t("musteri-notu-orn-sekersiz-buzlu")}
                        value={waiterOrderNote}
                        onChange={(e) => setWaiterOrderNote(e.target.value)}
                        className="w-full bg-white border border-border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[9px] text-text-secondary uppercase tracking-widest font-bold block">{t("toplam-siparis")}</span>
                      <span className="text-base font-display font-bold text-black block">
                        ₺{waiterCart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)}
                      </span>
                    </div>

                    <button
                      onClick={handleStaffSubmitOrder}
                      disabled={waiterCart.length === 0}
                      className={cn(
                        "px-6 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow-lg active:scale-95 transition-transform flex items-center gap-1.5",
                        waiterCart.length > 0 ? "bg-black text-white hover:bg-neutral-800" : "bg-neutral-200 text-neutral-400 cursor-not-allowed"
                      )}
                    >
                      <Check size={14} />
                      {t("siparisi-gonder")}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Tab 3: Order Query / Search
  if (activeTab === 'query') {
    const searchResult = orders.find((order) => matchesOrderCode(order.id, orderSearch));

    return (
      <div className="p-5 space-y-6">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-display font-bold text-text-primary">{t("siparis-sorgula")}</h1>
          <p className="text-xs text-text-secondary">{t("siparis-kodu-veya-id-ile-anlik-arama-yapin")}</p>
        </div>

        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input 
            type="text"
            placeholder={t("siparis-kodunu-girin-orn-a1b2")}
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            className="w-full bg-surface border border-border rounded-2xl py-3.5 pl-11 pr-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5"
          />
        </div>

        <AnimatePresence mode="wait">
          {orderSearch && searchResult ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white border border-border rounded-[28px] p-6 space-y-5 shadow-lg"
            >
              <div className="flex flex-col items-center text-center space-y-3">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center border",
                  searchResult.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600"
                )}>
                  <Coffee size={28} />
                </div>
                <div className="space-y-0.5">
                  <h2 className="text-base font-bold text-text-primary">{searchResult.userName}</h2>
                  <p className="text-[10px] text-text-secondary uppercase tracking-widest font-bold">
                    Sipariş #{getOrderDisplayCode(searchResult.id)}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-border border-y border-border py-3 space-y-2">
                {searchResult.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs py-1.5">
                    <span className="text-text-secondary">
                      <span className="font-bold text-text-primary bg-surface border border-border w-5 h-5 rounded inline-flex items-center justify-center mr-1.5">
                        {item.quantity}
                      </span> 
                      {item.product.name}
                    </span>
                    <span className="font-semibold">₺{item.product.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">Toplam Tutar</span>
                  <span className="text-base font-display font-bold text-black block">₺{searchResult.total}</span>
                </div>
                
                <div className="flex gap-2">
                  {searchResult.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => handleUpdateOrderStatus(searchResult.id, 'preparing')}
                        className="bg-black text-white px-4 py-2 rounded-xl text-xs font-bold"
                      >
                        Onayla
                      </button>
                      <button 
                        onClick={() => {
                          setRejectModalOrderId(searchResult.id);
                          setRejectReason('Stokta yok');
                        }}
                        className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-xs font-bold border border-red-200"
                      >
                        Reddet
                      </button>
                    </>
                  )}
                  {searchResult.status === 'preparing' && (
                    <button 
                      onClick={() => handleUpdateOrderStatus(searchResult.id, 'ready')}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      {t("hazir")}
                    </button>
                  )}
                  {searchResult.status === 'ready' && (
                    <button 
                      onClick={() => handleUpdateOrderStatus(searchResult.id, 'completed')}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      Teslim Et
                    </button>
                  )}
                  {searchResult.status === 'completed' && (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                      Teslim Edildi
                    </span>
                  )}
                  {searchResult.status === 'rejected' && (
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-100">
                      Reddedildi
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ) : orderSearch ? (
            <div className="py-12 text-center text-text-secondary">
              <AlertCircle className="mx-auto text-text-secondary/40 mb-2" size={32} />
              <p className="text-sm font-medium">{t("bu-kod-ile-eslesen-aktif-bir-siparis-bulunamadi")}</p>
            </div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }

  // Tab 4: Profile & Settings View
  if (activeTab === 'profile') {
    if (profileView === 'settings') {
      return (
        <div className="p-5 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                setProfileView('main');
                setProfileFeedback('');
                setPasswordFeedback('');
              }} 
              className="p-2 border border-border rounded-xl bg-white hover:bg-surface text-text-secondary shadow-sm transition-colors active:scale-95"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-lg font-bold font-display text-text-primary">{t("profil-ayarlari")}</h1>
              <p className="text-[10px] text-text-secondary">{t("kisisel-bilgilerinizi-ve-sifrenizi-guncelleyin")}</p>
            </div>
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSaveProfile} className="bg-white border border-border rounded-[28px] p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-widest flex items-center gap-1.5 pb-1 border-b border-border/60">
              <UserIcon size={12} className="text-text-secondary" />
              {t("kisisel-bilgiler")}
            </h3>

            {profileFeedback && (
              <div className={cn(
                "p-3 rounded-xl text-xs font-medium border",
                profileFeedback.includes(t("basariyla")) ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
              )}>
                {profileFeedback}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] text-text-secondary font-bold uppercase tracking-wider">{t("isim")}</label>
                <input 
                  type="text" 
                  value={profileDraft.name}
                  onChange={(e) => setProfileDraft({ ...profileDraft, name: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-text-secondary font-bold uppercase tracking-wider">Soyisim</label>
                <input 
                  type="text" 
                  value={profileDraft.surname}
                  onChange={(e) => setProfileDraft({ ...profileDraft, surname: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-text-secondary font-bold uppercase tracking-wider">Telefon</label>
              <input 
                type="tel" 
                value={profileDraft.phone}
                onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] text-text-secondary font-bold uppercase tracking-wider">{t("dogum-tarihi")}</label>
                <input 
                  type="date" 
                  value={profileDraft.birthDate ? profileDraft.birthDate.split('T')[0] : ''}
                  onChange={(e) => setProfileDraft({ ...profileDraft, birthDate: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2 text-xs font-medium focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-text-secondary font-bold uppercase tracking-wider">Cinsiyet</label>
                <select 
                  value={profileDraft.gender}
                  onChange={(e) => setProfileDraft({ ...profileDraft, gender: e.target.value as any })}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none"
                >
                  <option value="female">{t("kadin")}</option>
                  <option value="male">Erkek</option>
                </select>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isSavingProfile}
              className="w-full bg-black text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
            >
              {isSavingProfile ? <RefreshCw size={12} className="animate-spin" /> : t("degisiklikleri-kaydet")}
            </button>
          </form>

          {/* Change Password Form */}
          <form onSubmit={handleUpdatePassword} className="bg-white border border-border rounded-[28px] p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-text-primary uppercase tracking-widest flex items-center gap-1.5 pb-1 border-b border-border/60">
              <Settings size={12} className="text-text-secondary" />
              {t("sifre-degistir")}
            </h3>

            {passwordFeedback && (
              <div className={cn(
                "p-3 rounded-xl text-xs font-medium border",
                passwordFeedback.includes(t("basariyla")) ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-700"
              )}>
                {passwordFeedback}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[9px] text-text-secondary font-bold uppercase tracking-wider">{t("mevcut-sifre")}</label>
              <input 
                type="password" 
                value={passwordDraft.currentPassword}
                onChange={(e) => setPasswordDraft({ ...passwordDraft, currentPassword: e.target.value })}
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] text-text-secondary font-bold uppercase tracking-wider">{t("yeni-sifre")}</label>
                <input 
                  type="password" 
                  value={passwordDraft.newPassword}
                  onChange={(e) => setPasswordDraft({ ...passwordDraft, newPassword: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-text-secondary font-bold uppercase tracking-wider">{t("yeni-sifre-tekrar")}</label>
                <input 
                  type="password" 
                  value={passwordDraft.confirmPassword}
                  onChange={(e) => setPasswordDraft({ ...passwordDraft, confirmPassword: e.target.value })}
                  className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-xs font-medium focus:outline-none"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isSavingPassword}
              className="w-full bg-black text-white py-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors"
            >
              {isSavingPassword ? <RefreshCw size={12} className="animate-spin" /> : t("sifreyi-guncelle")}
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="p-5 space-y-6">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-display font-bold text-text-primary">Profil</h1>
          <p className="text-xs text-text-secondary">{t("hesap-ayarlari-ve-musteri-ekranina-gecis")}</p>
        </div>

        {/* User Card */}
        <div className="bg-white border border-border rounded-[32px] p-5 flex items-center gap-4 shadow-sm">
          <div className="w-16 h-16 bg-neutral-900 rounded-3xl flex items-center justify-center font-display font-bold text-white text-2xl border border-neutral-800">
            {user?.name?.[0]}{user?.surname?.[0]}
          </div>
          <div>
            <h2 className="font-display font-bold text-lg text-text-primary">{user?.name} {user?.surname}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[9px] font-bold bg-neutral-100 text-text-secondary border border-border px-2 py-0.5 rounded-full uppercase tracking-wider">
                Personel
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-text-secondary font-medium">Vardiyada</span>
            </div>
            <p className="text-xs text-text-secondary/70 mt-1">{user?.email}</p>
          </div>
        </div>

        {/* Menu Buttons list */}
        <div className="space-y-2">
          {((user?.accountRole || user?.role) === 'manager') && (
            <button 
              onClick={async () => {
                await setSessionRole('manager');
              }}
              className="w-full bg-neutral-900 hover:bg-black text-white rounded-2xl p-4 flex items-center justify-between transition-colors shadow-lg shadow-neutral-900/10 active:scale-98 transition-transform cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Users size={18} className="text-white" />
                <span className="text-sm font-semibold text-white">{t("yonetici-olarak-devam-et")}</span>
              </div>
              <ChevronRight size={16} className="text-white/80" />
            </button>
          )}

          {/* Switch Role to Customer Button */}
          <button 
            onClick={async () => {
              await setSessionRole('customer');
            }}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl p-4 flex items-center justify-between transition-colors shadow-lg shadow-emerald-600/10 active:scale-98 transition-transform cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Users size={18} className="text-white" />
              <span className="text-sm font-semibold text-white">{t("musteri-olarak-devam-et")}</span>
            </div>
            <ChevronRight size={16} className="text-white/80" />
          </button>

          {/* Settings */}
          <button 
            onClick={() => setProfileView('settings')}
            className="w-full bg-surface border border-border rounded-2xl p-4 flex items-center justify-between hover:bg-white hover:border-black/20 transition-all"
          >
            <div className="flex items-center gap-3">
              <Settings size={18} className="text-text-secondary" />
              <span className="text-sm font-semibold text-text-primary">{t("profil-ayarlari")}</span>
            </div>
            <ChevronRight size={16} className="text-text-secondary" />
          </button>

          {/* Logout */}
          <button 
            onClick={logout}
            className="w-full bg-red-50 border border-red-100 hover:bg-red-100 hover:border-red-200 rounded-2xl p-4 flex items-center justify-between transition-all"
          >
            <div className="flex items-center gap-3">
              <LogOut size={18} className="text-red-600" />
              <span className="text-sm font-semibold text-red-700">Oturumu Kapat</span>
            </div>
            <X size={16} className="text-red-500" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
