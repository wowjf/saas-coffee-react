import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useApp } from "../../AppContext";
import { cn, getOrderDisplayCode } from "../../lib/utils";
import { 
  Users, 
  Clock, 
  Check, 
  X, 
  CreditCard, 
  Coffee, 
  User as UserIcon,
  ChevronRight,
  TrendingUp,
  Receipt
} from "lucide-react";
import { t } from "../../shared/system-texts";
import { WaiterCallButton } from "../WaiterCallButton";

export const TableSessionView: React.FC<{ activeTab?: string }> = ({ activeTab }) => {
  const {
    user,
    tableNumber,
    tableSessionToken,
    tableSession,
    tableMetrics,
    tableOrders,
    joinOrCreateTableSession,
    approveParticipant,
    payTableBill,
    leaveTableSession,
    refreshTableSession,
  } = useApp();

  const [joinStatus, setJoinStatus] = useState<"loading" | "pending" | "active" | "rejected" | "idle">("idle");
  const [hostName, setHostName] = useState("");
  const [paymentFeedback, setPaymentFeedback] = useState("");
  const [isPaying, setIsPaying] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutType, setCheckoutType] = useState<"self" | "split" | "all" | null>(null);

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveStep, setLeaveStep] = useState<"choice" | "pay-choice" | "confirm-nopay">("choice");
  const [isLeaving, setIsLeaving] = useState(false);

  const joinRequestedRef = useRef(false);

  // 1. Oturuma katılma veya oluşturma akışı
  useEffect(() => {
    if (!tableSessionToken && tableNumber) {
      if (joinRequestedRef.current) return;
      joinRequestedRef.current = true;

      setJoinStatus("loading");
      joinOrCreateTableSession(tableNumber)
        .then((res) => {
          if (res.status === "active" && res.sessionToken) {
            setJoinStatus("active");
            // URL'yi dinamik session linki ile güncelle
            window.history.replaceState(null, "", `/table/${tableNumber}/session/${res.sessionToken}`);
            // AppContext'teki popstate tetiklenmesi için özel event fırlat
            window.dispatchEvent(new PopStateEvent("popstate"));
          } else if (res.status === "pending") {
            setJoinStatus("pending");
            setHostName(res.hostName || "Masa Sahibi");
          }
        })
        .catch((err) => {
          console.error("Join table error:", err);
          setJoinStatus("rejected");
          joinRequestedRef.current = false;
        });
    } else if (tableSessionToken) {
      setJoinStatus("active");
    }
  }, [tableNumber, tableSessionToken, joinOrCreateTableSession]);

  // 2. Bekleme odasındayken onay poller'ı
  useEffect(() => {
    if (joinStatus !== "pending" || !tableNumber) return;

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/table-sessions/poll-status?tableNumber=${tableNumber}`, {
          headers: {
            "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
          }
        });
        const data = await res.json();
        if (data.approved && data.sessionToken) {
          window.clearInterval(interval);
          setJoinStatus("active");
          window.history.replaceState(null, "", `/table/${tableNumber}/session/${data.sessionToken}`);
          window.dispatchEvent(new PopStateEvent("popstate"));
        } else if (data.status === "rejected") {
          window.clearInterval(interval);
          setJoinStatus("rejected");
        }
      } catch (error) {
        console.error("Poller error:", error);
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [joinStatus, tableNumber]);

  // 3. Ödeme işlemi
  const handlePayment = async () => {
    if (!checkoutType || !tableSessionToken) return;
    setIsPaying(true);
    setPaymentFeedback("");
    try {
      await payTableBill(tableSessionToken, checkoutType);
      setPaymentFeedback(t("odeme-basariyla-alindi-tesekkur-ederiz"));
      setTimeout(() => {
        setShowCheckoutModal(false);
        setCheckoutType(null);
        setPaymentFeedback("");
      }, 2000);
    } catch (error: any) {
      setPaymentFeedback(error.message || t("odeme-sirasinda-bir-hata-olustu"));
    } finally {
      setIsPaying(false);
    }
  };

  const leaveTable = () => {
    window.location.href = "/";
  };

  // --- RENDERING VIEWS ---

  // A. Yükleniyor Ekranı
  if (joinStatus === "loading") {
    return (
      <div className="h-[calc(100dvh-5rem)] flex flex-col items-center justify-center p-8 text-center space-y-6 bg-surface">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-black border-t-transparent" />
        <div className="space-y-2">
          <h2 className="text-xl font-display font-bold">Masa {tableNumber}</h2>
          <p className="text-sm text-text-secondary">{t("oturum-aciliyor-lutfen-bekleyin")}</p>
        </div>
      </div>
    );
  }

  // B. Bekleme Odası
  if (joinStatus === "pending") {
    return (
      <div className="h-[calc(100dvh-5rem)] flex flex-col items-center justify-center p-8 text-center space-y-8 bg-surface">
        <div className="relative">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[36px] bg-white border border-border shadow-md text-amber-500 animate-pulse">
            <Clock size={40} />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-black text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow">
            Onay Bekliyor
          </div>
        </div>
        <div className="space-y-3 max-w-xs">
          <h2 className="text-2xl font-display font-bold">Masa {tableNumber}</h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            {t("giris-talebiniz-iletildi-masa-sahibi")} <strong className="text-black">{hostName}</strong> {t("tarafindan-onay-verilmesi-bekleniyor")}
          </p>
        </div>
        <button
          onClick={leaveTable}
          className="px-6 py-3 rounded-2xl bg-white border border-border text-sm font-semibold hover:border-black active:scale-95 transition-transform shadow-sm"
        >
          {t("masadan-ayril")}
        </button>
      </div>
    );
  }

  // C. Reddedildi / Hata Ekranı
  if (joinStatus === "rejected") {
    return (
      <div className="h-[calc(100dvh-5rem)] flex flex-col items-center justify-center p-8 text-center space-y-6 bg-surface">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[28px] bg-red-50 text-red-500 border border-red-100 shadow-sm">
          <X size={36} />
        </div>
        <div className="space-y-2 max-w-xs">
          <h2 className="text-xl font-display font-bold">{t("istek-reddedildi")}</h2>
          <p className="text-sm leading-relaxed text-text-secondary">
            {t("masa-sahibi-bu-masaya-katilma-isteginizi-onaylamadi-veya-oturum-sonlandirildi")}
          </p>
        </div>
        <button
          onClick={leaveTable}
          className="px-6 py-3 rounded-2xl bg-black text-white text-sm font-semibold active:scale-95 transition-transform shadow"
        >
          {t("ana-sayfaya-don")}
        </button>
      </div>
    );
  }

  // D. Aktif Masa Oturumu (Detaylar & Ödeme)
  if (joinStatus === "active" && tableSession) {
    const isHost = tableSession.hostUserId === user?.id;
    const currentUserId = user?.id || "";

    // Oturum kapatılmışsa veya kapalı durumdaysa fatura başarı ekranı göster
    if (tableSession.status === "closed") {
      return (
        <div className="min-h-[calc(100dvh-5rem)] flex flex-col items-center justify-center p-8 text-center space-y-8 bg-surface">
          <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[36px] bg-green-50 border border-green-200 text-green-600 shadow-sm">
            <Check size={44} />
          </div>
          <div className="space-y-3">
            <h2 className="text-2xl font-display font-bold">{t("masa-kapatildi")}</h2>
            <p className="text-sm text-text-secondary max-w-xs leading-relaxed">
              {t("masa-hesabi-basariyla-odendi-ve-oturum-kapatildi-afiyet-olsun")}
            </p>
          </div>
          <button
            onClick={leaveTable}
            className="px-6 py-3.5 rounded-2xl bg-black text-white text-sm font-semibold shadow active:scale-95 transition-transform"
          >
            {t("ana-menuye-don")}
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-[calc(100dvh-5rem)] bg-surface pb-12">
        {/* Header */}
        <div className="bg-white border-b border-border px-6 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">{t("masamiz")}</span>
            <h1 className="text-2xl font-display font-bold">Masa {tableSession.tableNumber}</h1>
          </div>
          <div className="flex items-center gap-3">
            <WaiterCallButton
              tableNumber={tableSession.tableNumber}
              tableSessionToken={tableSessionToken}
            />
            <button 
              onClick={() => {
                setLeaveStep("choice");
                setShowLeaveModal(true);
              }}
              className="text-red-500 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-100 hover:bg-red-50 transition-all flex items-center gap-1"
            >
              {t("ayril")}
            </button>
            <div className="bg-black text-white text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow">
              <Users size={12} />
              {tableSession.participants.length} Kişi
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-6">
          {/* A. Onay Bekleyen Misafirler (Sadece Masa Sahibi Görür) */}
          {isHost && tableSession.pendingParticipants && tableSession.pendingParticipants.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50/70 border border-amber-200/60 rounded-3xl p-5 space-y-3 shadow-sm"
            >
              <div className="flex items-center gap-2 text-amber-900">
                <Users size={16} />
                <h3 className="text-xs font-bold uppercase tracking-wider">Katılım İstekleri ({tableSession.pendingParticipants.length})</h3>
              </div>
              <div className="divide-y divide-amber-200/30">
                {tableSession.pendingParticipants.map((p: any) => (
                  <div key={p.userId} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                    <span className="text-sm font-semibold text-amber-950">{p.userName}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => approveParticipant(tableSession.sessionToken, p.userId, "reject")}
                        className="w-8 h-8 rounded-xl bg-white border border-amber-200 flex items-center justify-center text-red-500 hover:bg-red-50 transition-colors shadow-sm"
                      >
                        <X size={16} />
                      </button>
                      <button
                        onClick={() => approveParticipant(tableSession.sessionToken, p.userId, "approve")}
                        className="w-8 h-8 rounded-xl bg-black flex items-center justify-center text-white hover:bg-black/80 transition-colors shadow-sm"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* B. Hesap Kartı */}
          {tableMetrics && (
            <div className="bg-black text-white rounded-[32px] p-6 shadow-xl relative overflow-hidden">
              {/* Background Glow */}
              <div className="absolute right-0 top-0 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
              <div className="space-y-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">{t("masa-toplam-tutari")}</span>
                    <h2 className="text-4xl font-display font-bold">₺{tableMetrics.totalBill}</h2>
                  </div>
                  <div className="bg-white/10 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md flex items-center gap-1.5">
                    <Receipt size={12} />
                    {t("acik-hesap")}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 text-sm">
                  <div>
                    <span className="block text-[10px] text-white/50 uppercase tracking-wider font-medium">{t("odenen")}</span>
                    <span className="font-semibold text-green-400">₺{tableMetrics.totalPaid}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-white/50 uppercase tracking-wider font-medium">Kalan</span>
                    <span className="font-semibold text-amber-300">₺{tableMetrics.remainingBill}</span>
                  </div>
                </div>

                {tableMetrics.totalBill === 0 ? (
                  <div className="py-3 bg-white/5 text-white/40 text-center font-bold text-xs rounded-xl uppercase tracking-wider border border-white/10">
                    {t("henuz-hesap-yok")}
                  </div>
                ) : tableMetrics.remainingBill > 0 ? (
                  <button
                    onClick={() => setShowCheckoutModal(true)}
                    className="w-full py-4 bg-white text-black font-bold text-sm rounded-2xl flex items-center justify-center gap-2 hover:bg-white/90 active:scale-[0.98] transition-all shadow"
                  >
                    <CreditCard size={18} />
                    {t("odeme-yap-hesabi-kapat")}
                  </button>
                ) : (
                  <div className="py-3 bg-green-500/20 text-green-300 text-center font-bold text-xs rounded-xl uppercase tracking-wider border border-green-500/30">
                    {t("tum-hesap-odendi")}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* C. Katılımcı Listesi */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary pl-1">{t("masadaki-arkadaslar")}</h3>
            <div className="bg-white border border-border rounded-[28px] p-5 space-y-4 shadow-sm">
              {tableSession.participants.map((p: any) => {
                const isUserHost = tableSession.hostUserId === p.userId;
                const userOrdersTotal = tableMetrics?.individualTotals?.[p.userId] || 0;
                const isExpanded = expandedUserId === p.userId;

                const userOrders = tableOrders.filter((o: any) => o.userId === p.userId);
                const orderedItems: { name: string; quantity: number; price: number; total: number }[] = [];
                userOrders.forEach((o: any) => {
                  o.items.forEach((item: any) => {
                    const existing = orderedItems.find(x => x.name === item.product.name);
                    if (existing) {
                      existing.quantity += item.quantity;
                      existing.total = Number((existing.total + item.product.price * item.quantity).toFixed(2));
                    } else {
                      orderedItems.push({
                        name: item.product.name,
                        quantity: item.quantity,
                        price: item.product.price,
                        total: Number((item.product.price * item.quantity).toFixed(2))
                      });
                    }
                  });
                });

                return (
                  <div key={p.userId} className="border-b border-border last:border-0 pb-3 last:pb-0 first:pt-0 pt-3">
                    <div 
                      onClick={() => setExpandedUserId(isExpanded ? null : p.userId)}
                      className="flex items-center justify-between cursor-pointer hover:bg-surface/50 p-1.5 rounded-xl transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-text-secondary relative">
                          <UserIcon size={18} />
                          {isUserHost && (
                            <div className="absolute -top-1 -right-1 bg-black text-white w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold border border-white">
                              H
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="block text-sm font-semibold text-black">
                            {p.userName} {p.userId === currentUserId && "(Sen)"}
                          </span>
                          <span className="text-[10px] text-text-secondary">₺{userOrdersTotal} tutarında sipariş</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.paidAmount > 0 ? (
                          <span className="text-[10px] font-bold text-green-600 bg-green-50 border border-green-100 px-2 py-1 rounded-xl">
                            ₺{p.paidAmount} Ödedi
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-text-secondary bg-surface px-2 py-1 rounded-xl">
                            {t("odemedi")}
                          </span>
                        )}
                        <ChevronRight size={14} className={`text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden pl-10 pr-2 mt-2"
                        >
                          <div className="bg-surface rounded-2xl p-3 border border-border space-y-2 mt-1">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary">{t("siparis-detaylari")}</span>
                            {orderedItems.length === 0 ? (
                              <p className="text-xs text-text-secondary">{t("henuz-siparis-vermedi")}</p>
                            ) : (
                              <div className="divide-y divide-border/55">
                                {orderedItems.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center py-1.5 text-xs first:pt-0 last:pb-0">
                                    <span className="text-text-secondary">{item.name} <strong className="text-black font-semibold">x{item.quantity}</strong></span>
                                    <span className="font-bold text-black">₺{item.total}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}

              {/* Ayrılanlar Listesi */}
              {tableSession.leftParticipants && tableSession.leftParticipants.length > 0 && (
                <div className="border-t border-border/80 pt-4 mt-4 space-y-3">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest pl-1">{t("masadan-ayrilanlar")}</span>
                  {tableSession.leftParticipants.map((p: any) => {
                    const isExpanded = expandedUserId === p.userId;
                    const userOrders = tableOrders.filter((o: any) => o.userId === p.userId);
                    const userOrdersTotal = tableMetrics?.individualTotals?.[p.userId] || 0;

                    const orderedItems: { name: string; quantity: number; price: number; total: number }[] = [];
                    userOrders.forEach((o: any) => {
                      o.items.forEach((item: any) => {
                        const existing = orderedItems.find(x => x.name === item.product.name);
                        if (existing) {
                          existing.quantity += item.quantity;
                          existing.total = Number((existing.total + item.product.price * item.quantity).toFixed(2));
                        } else {
                          orderedItems.push({
                            name: item.product.name,
                            quantity: item.quantity,
                            price: item.product.price,
                            total: Number((item.product.price * item.quantity).toFixed(2))
                          });
                        }
                      });
                    });

                    return (
                      <div key={p.userId} className="border-b border-border last:border-0 pb-3 last:pb-0 pt-1">
                        <div 
                          onClick={() => setExpandedUserId(isExpanded ? null : p.userId)}
                          className="flex items-center justify-between cursor-pointer hover:bg-surface/50 p-1.5 rounded-xl transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-surface flex items-center justify-center text-text-secondary/60 relative">
                              <UserIcon size={18} />
                              <div className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold border border-white">
                                X
                              </div>
                            </div>
                            <div>
                              <span className="block text-sm font-semibold text-text-secondary line-through">
                                {p.userName}
                              </span>
                              <span className="text-[10px] text-text-secondary">₺{userOrdersTotal} tutarında sipariş</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {p.totalUnpaid > 0 ? (
                              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-1 rounded-xl">
                                ₺{p.totalUnpaid} Borç Aktarıldı
                              </span>
                            ) : (
                              <span className="text-[10px] font-semibold text-green-700 bg-green-50 border border-green-100 px-2 py-1 rounded-xl">
                                {t("odedi-ve-ayrildi")}
                              </span>
                            )}
                            <ChevronRight size={14} className={`text-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </div>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden pl-10 pr-2 mt-2"
                            >
                              <div className="bg-surface rounded-2xl p-3 border border-border space-y-2 mt-1">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-text-secondary">{t("ayrilan-kullanici-siparis-detaylari")}</span>
                                {orderedItems.length === 0 ? (
                                  <p className="text-xs text-text-secondary">{t("siparisi-yok")}</p>
                                ) : (
                                  <div className="divide-y divide-border/55">
                                    {orderedItems.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-center py-1.5 text-xs first:pt-0 last:pb-0">
                                        <span className="text-text-secondary">{item.name} <strong className="text-black font-semibold">x{item.quantity}</strong></span>
                                        <span className="font-bold text-black">₺{item.total}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* D. Masadaki Sipariş Geçmişi */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary pl-1">{t("masa-siparisleri")}</h3>
            <div className="bg-white border border-border rounded-[28px] p-5 space-y-4 shadow-sm">
              {(!tableMetrics || !tableMetrics.totalBill) ? (
                <div className="text-center py-6 space-y-2">
                  <Coffee size={24} className="mx-auto text-text-secondary opacity-40 animate-bounce" />
                  <p className="text-xs text-text-secondary">{t("henuz-siparis-verilmedi-siparislerinizi-sepete-ekleyip-masaya-iletebilirsiniz")}</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
                  {tableMetrics.individualTotals && Object.entries(tableMetrics.individualTotals).map(([pId, amount]) => {
                    const participant = tableSession.participants.find((p: any) => p.userId === pId);
                    if (!participant || amount === 0) return null;

                    return (
                      <div key={pId} className="flex items-center justify-between py-1.5">
                        <span className="text-xs font-medium text-black">{participant.userName}</span>
                        <span className="text-xs font-bold text-black">₺{String(amount)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* E. Masa Sipariş Durumları */}
          {tableOrders && tableOrders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary pl-1">{t("siparis-durumlari")}</h3>
              <div className="space-y-3">
                {tableOrders.map((order: any) => (
                  <div key={order.id} className="bg-white border border-border rounded-[28px] p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">
                          #{getOrderDisplayCode(order.id)}
                        </span>
                        <span className="text-[11px] font-semibold text-black">
                          {order.userName} • {new Date(order.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className={cn(
                        "text-[9px] font-bold px-2 py-0.5 rounded-lg uppercase tracking-wider",
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

                    <div className="space-y-1.5 border-t border-border/40 pt-2 text-xs">
                      {order.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-text-secondary">
                          <span>{item.product.name} <strong className="text-black font-bold">x{item.quantity}</strong></span>
                          <span className="font-semibold text-black">₺{item.product.price * item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {order.cancelReason && (
                      <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-[11px] text-red-700">
                        <strong>{t("iptal-nedeni-2")}</strong> {order.cancelReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ÖDEME SEÇENEKLERİ MODALI */}
        <AnimatePresence>
          {showCheckoutModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-5"
            >
              {/* Tap outer to close */}
              <div className="absolute inset-0" onClick={() => !isPaying && setShowCheckoutModal(false)} />

              <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 80, scale: 0.98 }}
                className="w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] bg-white p-6 shadow-2xl relative z-10"
              >
                <div className="flex justify-between items-center mb-5 pb-2 border-b border-border">
                  <h3 className="text-lg font-display font-bold">{t("masa-hesabi-odeme")}</h3>
                  <button 
                    disabled={isPaying}
                    onClick={() => setShowCheckoutModal(false)}
                    className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-secondary"
                  >
                    <X size={16} />
                  </button>
                </div>

                {!checkoutType ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => setCheckoutType("self")}
                      className="w-full p-4 rounded-2xl border border-border hover:border-black text-left flex justify-between items-center transition-all group active:scale-[0.98]"
                    >
                      <div>
                        <span className="block text-sm font-semibold text-black">{t("kendi-yedigimi-ode")}</span>
                        <span className="text-xs text-text-secondary">{t("sadece-senin-siparislerinin-toplami")}</span>
                      </div>
                      <ChevronRight size={16} className="text-text-secondary group-hover:text-black transition-colors" />
                    </button>

                    <button
                      onClick={() => setCheckoutType("split")}
                      className="w-full p-4 rounded-2xl border border-border hover:border-black text-left flex justify-between items-center transition-all group active:scale-[0.98]"
                    >
                      <div>
                        <span className="block text-sm font-semibold text-black">{t("hesabi-esit-bol")}</span>
                        <span className="text-xs text-text-secondary">{t("masa-toplami-kisi-sayisina-bolunur")}</span>
                      </div>
                      <ChevronRight size={16} className="text-text-secondary group-hover:text-black transition-colors" />
                    </button>

                    <button
                      onClick={() => setCheckoutType("all")}
                      className="w-full p-4 rounded-2xl border border-border hover:border-black text-left flex justify-between items-center transition-all group active:scale-[0.98]"
                    >
                      <div>
                        <span className="block text-sm font-semibold text-black">{t("tum-hesabi-ode")}</span>
                        <span className="text-xs text-text-secondary">{t("masanin-kalan-tum-borcunu-kapatir")}</span>
                      </div>
                      <ChevronRight size={16} className="text-text-secondary group-hover:text-black transition-colors" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-surface rounded-2xl p-4 text-center space-y-1">
                      <span className="text-xs text-text-secondary">Seçilen Mod: {checkoutType === "self" ? t("kendi-yedigimi-ode") : checkoutType === "split" ? t("hesabi-bol") : t("tumunu-ode")}</span>
                      <h4 className="text-2xl font-display font-bold">
                        ₺{
                          checkoutType === "self"
                            ? Math.max(0, Number(((tableMetrics.individualTotals?.[currentUserId] || 0) - (tableSession.participants.find((p: any) => p.userId === currentUserId)?.paidAmount || 0)).toFixed(2)))
                            : checkoutType === "split"
                              ? Math.max(0, Number(((tableMetrics.totalBill / tableSession.participants.length) - (tableSession.participants.find((p: any) => p.userId === currentUserId)?.paidAmount || 0)).toFixed(2)))
                              : tableMetrics.remainingBill
                        }
                      </h4>
                    </div>

                    {paymentFeedback && (
                      <div className={`p-4 rounded-2xl text-xs font-semibold text-center border ${paymentFeedback.includes(t("basariyla")) ? "bg-green-50 border-green-200 text-green-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                        {paymentFeedback}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        disabled={isPaying}
                        onClick={() => setCheckoutType(null)}
                        className="py-3.5 rounded-xl border border-border text-sm font-semibold active:scale-95 disabled:opacity-50 transition-all"
                      >
                        Geri
                      </button>
                      <button
                        disabled={isPaying}
                        onClick={handlePayment}
                        className="py-3.5 rounded-xl bg-black text-white text-sm font-semibold active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                      >
                        {isPaying ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <>
                            <Check size={16} />
                            {t("ode")}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AYRILMA SEÇENEKLERİ MODALI */}
        <AnimatePresence>
          {showLeaveModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[250] flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-5"
            >
              <div className="absolute inset-0" onClick={() => !isLeaving && setShowLeaveModal(false)} />

              <motion.div
                initial={{ opacity: 0, y: 100, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 80, scale: 0.98 }}
                className="w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] bg-white p-6 shadow-2xl relative z-10"
              >
                <div className="flex justify-between items-center mb-5 pb-2 border-b border-border">
                  <h3 className="text-lg font-display font-bold">{t("masadan-ayril")}</h3>
                  <button 
                    disabled={isLeaving}
                    onClick={() => setShowLeaveModal(false)}
                    className="w-8 h-8 rounded-full bg-surface flex items-center justify-center text-text-secondary"
                  >
                    <X size={16} />
                  </button>
                </div>

                {leaveStep === "choice" && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setLeaveStep("pay-choice")}
                      className="w-full p-4 rounded-2xl border border-border hover:border-black text-left flex justify-between items-center transition-all group active:scale-[0.98]"
                    >
                      <div>
                        <span className="block text-sm font-semibold text-black">{t("ode-ve-ayril")}</span>
                        <span className="text-xs text-text-secondary">{t("hesabini-kapatarak-masadan-ayril")}</span>
                      </div>
                      <ChevronRight size={16} className="text-text-secondary group-hover:text-black" />
                    </button>

                    {tableSession.participants.length > 1 && (
                      <button
                        onClick={() => setLeaveStep("confirm-nopay")}
                        className="w-full p-4 rounded-2xl border border-red-100 hover:border-red-500 text-left flex justify-between items-center transition-all group active:scale-[0.98] bg-red-50/20"
                      >
                        <div>
                          <span className="block text-sm font-semibold text-red-600">{t("odemeden-ayril")}</span>
                          <span className="text-xs text-text-secondary">{t("siparislerini-masadaki-diger-kisilere-aktar")}</span>
                        </div>
                        <ChevronRight size={16} className="text-red-500 group-hover:text-red-600" />
                      </button>
                    )}
                  </div>
                )}
                {leaveStep === "pay-choice" && (() => {
                  const ownUnpaid = Math.max(0, Number(((tableMetrics.individualTotals?.[user?.id || ''] || 0) - (tableSession.participants.find((p: any) => p.userId === user?.id)?.paidAmount || 0)).toFixed(2)));
                  const isLastParticipant = tableSession.participants.length === 1;
                  const hasOtherUnpaid = tableMetrics.remainingBill > ownUnpaid;

                  return (
                    <div className="space-y-4">
                      <div className="bg-surface rounded-2xl p-4 text-center space-y-1">
                        <span className="text-xs text-text-secondary">{t("ode-ve-ayril-modu")}</span>
                        <h4 className="text-sm font-medium text-black">{t("nasil-odemek-istersiniz")}</h4>
                      </div>

                      <div className="space-y-2">
                        {isLastParticipant && hasOtherUnpaid && (
                          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 px-4 py-3 text-xs text-amber-800 leading-relaxed text-left mb-3">
                            ⚠️ Masada diğer katılımcılardan kalan ödenmemiş borçlar bulunmaktadır. Son katılımcı olduğunuz için ayrılmadan önce tüm kalan hesabı (₺{tableMetrics.remainingBill}) kapatmanız gerekmektedir.
                          </div>
                        )}

                        {!(isLastParticipant && hasOtherUnpaid) && (
                          <button
                            disabled={isLeaving}
                            type="button"
                            onClick={async () => {
                              setIsLeaving(true);
                              try {
                                await leaveTableSession(tableSessionToken, "pay", "self");
                                setShowLeaveModal(false);
                              } catch (err: any) {
                                alert(err.message || t("odeme-sirasinda-hata-olustu"));
                              } finally {
                                setIsLeaving(false);
                              }
                            }}
                            className="w-full py-4 rounded-2xl bg-black text-white font-bold text-sm hover:bg-black/90 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {isLeaving ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            ) : (
                              `Kendi Hesabımı Öde (₺${ownUnpaid})`
                            )}
                          </button>
                        )}

                        <button
                          disabled={isLeaving}
                          type="button"
                          onClick={async () => {
                            setIsLeaving(true);
                            try {
                              await leaveTableSession(tableSessionToken, "pay", "all");
                              setShowLeaveModal(false);
                            } catch (err: any) {
                              alert(err.message || t("odeme-sirasinda-hata-olustu"));
                            } finally {
                              setIsLeaving(false);
                            }
                          }}
                          className="w-full py-4 rounded-2xl border border-black text-black font-bold text-sm hover:bg-surface transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {isLeaving ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                          ) : (
                            `Tüm Masanın Kalan Hesabını Öde (₺${tableMetrics.remainingBill})`
                          )}
                        </button>

                        <button
                          disabled={isLeaving}
                          type="button"
                          onClick={() => setLeaveStep("choice")}
                          className="w-full py-2.5 rounded-xl border border-border text-xs text-text-secondary font-medium cursor-pointer"
                        >
                          {t("geri-don")}
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {leaveStep === "confirm-nopay" && (
                  <div className="space-y-4">
                    <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-center space-y-2">
                      <span className="block text-xs text-red-600 font-bold uppercase tracking-wider">Dikkat</span>
                      <p className="text-xs text-red-700 leading-relaxed">
                        {t("masadan-odeme-yapmadan-ayriliyorsunuz")} <strong>₺{Math.max(0, Number(((tableMetrics.individualTotals?.[user?.id || ''] || 0) - (tableSession.participants.find((p: any) => p.userId === user?.id)?.paidAmount || 0)).toFixed(2)))}</strong> {t("tutarindaki-kalan-borcunuz-masadaki-diger-kisilere-aktarilacak-ve-masadaki-arkadaslariniza-bilgi-gosterilecektir")}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        disabled={isLeaving}
                        onClick={() => setLeaveStep("choice")}
                        className="py-3.5 rounded-xl border border-border text-sm font-semibold active:scale-95 disabled:opacity-50 transition-all"
                      >
                        {t("vazgec")}
                      </button>
                      <button
                        disabled={isLeaving}
                        onClick={async () => {
                          setIsLeaving(true);
                          try {
                            await leaveTableSession(tableSessionToken, "no-pay");
                            setShowLeaveModal(false);
                          } catch (err: any) {
                            alert(err.message || t("ayrilirken-hata-olustu"));
                          } finally {
                            setIsLeaving(false);
                          }
                        }}
                        className="py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center"
                      >
                        {isLeaving ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          t("onayla-ve-ayril")
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return null;
};
