import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AppProvider, useApp } from "./AppContext";
import { CustomerPanel } from "./components/CustomerPanel";
import { BottomNav } from "./components/BottomNav";
import { TableSessionView } from "./components/table/TableSessionView";
import { SystemTextsProvider } from "./components/SystemTextsProvider";
import { motion, AnimatePresence } from "motion/react";
import { Smartphone, Users, Coffee, X, CheckCircle2, AlertCircle, Info, Gift, Utensils, ShoppingBag, Bell, User as UserIcon, ClipboardList, Search, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "./lib/utils";
import { ApiRequestError } from "./lib/api";
import { formatTurkeyPhoneInput, parseTurkeyPhone } from "./lib/phoneMask";
import { t } from "./shared/system-texts";
import { playChimeSound } from "./lib/pushClient";
import { NotificationPermissionBanner } from "./components/NotificationPermissionBanner";

// MP-1.6: Personel ve yonetici panelleri route-level lazy yuklenir —
// musteri ilk yukunde StaffPanel (html5-qrcode) ve ManagerPanel (recharts)
// chunk'lari indirilmez. CustomerPanel auth ekranindan sonra kesin
// gerektigi icin statik kalir.
const StaffPanel = lazy(() =>
  import("./components/StaffPanel").then((module) => ({ default: module.StaffPanel })),
);
const ManagerPanel = lazy(() =>
  import("./components/ManagerPanel").then((module) => ({ default: module.ManagerPanel })),
);

const PanelFallback = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-black border-t-transparent" />
  </div>
);

const useLockViewportInteractions = () => {
  useEffect(() => {
    let lastTouchEnd = 0;

    const preventKeyboardZoom = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["+", "-", "=", "_", "0"].includes(event.key)) {
        event.preventDefault();
      }
    };

    const preventWheelZoom = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    const preventGesture = (event: Event) => {
      event.preventDefault();
    };

    const preventPinchZoom = (event: TouchEvent) => {
      if (event.touches.length > 1) {
        event.preventDefault();
      }
    };

    const preventDoubleTapZoom = (event: TouchEvent) => {
      const now = Date.now();

      if (now - lastTouchEnd <= 300) {
        if (event.cancelable) {
          event.preventDefault();
        }
      }

      lastTouchEnd = now;
    };

    document.addEventListener("keydown", preventKeyboardZoom, { passive: false });
    document.addEventListener("wheel", preventWheelZoom, { passive: false });
    document.addEventListener("gesturestart", preventGesture as EventListener, { passive: false });
    document.addEventListener("gesturechange", preventGesture as EventListener, { passive: false });
    document.addEventListener("gestureend", preventGesture as EventListener, { passive: false });
    document.addEventListener("touchmove", preventPinchZoom, { passive: false });
    document.addEventListener("touchend", preventDoubleTapZoom, { passive: false });

    return () => {
      document.removeEventListener("keydown", preventKeyboardZoom);
      document.removeEventListener("wheel", preventWheelZoom);
      document.removeEventListener("gesturestart", preventGesture as EventListener);
      document.removeEventListener("gesturechange", preventGesture as EventListener);
      document.removeEventListener("gestureend", preventGesture as EventListener);
      document.removeEventListener("touchmove", preventPinchZoom);
      document.removeEventListener("touchend", preventDoubleTapZoom);
    };
  }, []);
};

const Toast = () => {
  const { notifications, markNotificationRead } = useApp();
  const [visibleToasts, setVisibleToasts] = useState<string[]>([]);
  const processedIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (notifications.length === 0) {
      return;
    }

    const storedSeen = localStorage.getItem("seen_notifications");
    const seenIds: string[] = storedSeen ? JSON.parse(storedSeen) : [];

    const unreadNotSeen = notifications.filter(
      (notification) =>
        !notification.read &&
        !seenIds.includes(notification.id) &&
        !processedIds.current.has(notification.id) &&
        !visibleToasts.includes(notification.id),
    );

    if (unreadNotSeen.length === 0) {
      return;
    }

    const latest = unreadNotSeen[0];
    processedIds.current.add(latest.id);

    const newSeenIds = [latest.id, ...seenIds].slice(0, 50);
    localStorage.setItem("seen_notifications", JSON.stringify(newSeenIds));
    setVisibleToasts((prev) => [latest.id, ...prev].slice(0, 3));

    playChimeSound();

    markNotificationRead(latest.id).catch((error) => {
      console.error("Failed to mark notification as read:", error);
    });

    const timeout = window.setTimeout(() => {
      setVisibleToasts((prev) => prev.filter((id) => id !== latest.id));
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [notifications, visibleToasts, markNotificationRead]);

  return (
    <div className="fixed top-4 left-4 right-4 z-[200] pointer-events-none flex flex-col gap-2 items-center">
      <AnimatePresence>
        {notifications
          .filter((notification) => visibleToasts.includes(notification.id))
          .map((notification) => (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className={cn(
                "w-full max-w-sm rounded-2xl border p-4 shadow-xl backdrop-blur-md pointer-events-auto flex items-start gap-3",
                notification.type === "success" && "bg-green-50/90 border-green-100 text-green-900",
                notification.type === "error" && "bg-red-50/90 border-red-100 text-red-900",
                notification.type === "warning" && "bg-amber-50/90 border-amber-100 text-amber-900",
                notification.type === "info" && "bg-blue-50/90 border-blue-100 text-blue-900",
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                  notification.type === "success" && "bg-green-100 text-green-600",
                  notification.type === "error" && "bg-red-100 text-red-600",
                  notification.type === "warning" && "bg-amber-100 text-amber-600",
                  notification.type === "info" && "bg-blue-100 text-blue-600",
                )}
              >
                {notification.type === "success" ? (
                  <CheckCircle2 size={18} />
                ) : notification.type === "error" || notification.type === "warning" ? (
                  <AlertCircle size={18} />
                ) : (
                  <Info size={18} />
                )}
              </div>
              <div className="flex-1 pt-0.5">
                <h4 className="mb-0.5 text-xs font-bold uppercase tracking-wider">{notification.title}</h4>
                <p className="text-xs leading-relaxed opacity-80">{notification.message}</p>
              </div>
              <button
                onClick={() => setVisibleToasts((prev) => prev.filter((id) => id !== notification.id))}
                className="shrink-0 rounded-lg p-1 transition-colors hover:bg-black/5"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
};

// Madde 15: doğrulanmamış müşteriye ilk girişte bir kez gösterilen kırmızı
// bilgilendirme pop-up'ı. Profili Tamamla → profil sekmesi; Şimdilik Atla →
// localStorage'a kullanıcı bazlı tek seferlik kapatma yazar.
const VerificationPopup: React.FC<{
  visible: boolean;
  onDismiss: () => void;
  onComplete: () => void;
}> = ({ visible, onDismiss, onComplete }) => {
  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[240] flex items-center justify-center bg-black/50 px-5"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", damping: 26, stiffness: 340 }}
          className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.22)] border-2 border-red-500"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
              <AlertCircle size={22} className="text-red-500" />
            </div>
            <div className="space-y-1 min-w-0">
              <h2 className="text-lg font-display font-bold text-black leading-tight">Profilinizi Tamamlayın</h2>
              <p className="text-xs text-text-secondary leading-relaxed">
                Kampanyalardan ve KP sıralamasından yararlanabilmek için telefon, e-posta ve T.C. kimlik numaranızın
                doğrulanması gerekir. Bu bilgileri paylaşmazsanız KP kazanamaz ve sıralamada listelenemezsiniz.
              </p>
            </div>
          </div>

          <div className="mt-5 space-y-2.5">
            <button
              type="button"
              onClick={onComplete}
              className="w-full py-3.5 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-transform active:scale-[0.98] cursor-pointer"
            >
              Profili Tamamla
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-3 rounded-2xl border border-border bg-surface text-text-secondary text-xs font-bold hover:text-black transition-colors cursor-pointer"
            >
              Şimdilik Atla
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const RegistrationScreen = () => {
  const { updateUser } = useApp();
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    const phoneE164 = parseTurkeyPhone(phone);
    if (!phoneE164 || !birthDate) {
      return;
    }

    setLoading(true);
    try {
      await updateUser({ phone: phoneE164, birthDate });
      window.location.reload();
    } catch (error) {
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-surface flex flex-col p-8 space-y-12 no-scrollbar">
      <div className="space-y-4 text-center pt-12">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[32px] bg-black shadow-xl">
          <Users size={32} className="text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold">Profilini Tamamla</h1>
          <p className="text-sm text-text-secondary">
            {t("sana-ozel-firsatlar-ve-daha-iyi-bir-deneyim-icin-birkac-bilgiye-ihtiyacimiz-var")}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-6">
        <div className="space-y-1.5">
          <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            {t("telefon-numarasi")}
          </label>
          <input
            type="tel"
            placeholder="+90 5-- --- -- --"
            inputMode="numeric"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(formatTurkeyPhoneInput(event.target.value))}
            className="h-16 w-full rounded-2xl border border-border bg-white px-6 text-sm shadow-sm transition-all focus:border-black focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label className="ml-1 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            {t("dogum-tarihi")}
          </label>
          <input
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
            className="h-16 w-full rounded-2xl border border-border bg-white px-6 text-sm shadow-sm transition-all focus:border-black focus:outline-none"
          />
        </div>
      </div>

      <button
        onClick={handleComplete}
        disabled={!phone || !birthDate || loading}
        className="flex w-full items-center justify-center gap-3 rounded-2xl bg-black py-5 text-sm font-bold text-white shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
      >
        {loading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <>
            <CheckCircle2 size={20} />
            {t("kaydi-tamamla")}
          </>
        )}
      </button>
    </div>
  );
};

type InlineAuthError = {
  field: "name" | "surname" | "username" | "gender" | "email" | "password" | "phone" | "birthDate" | "form";
  message: string;
} | null;

const AppContent = () => {
  const { role, user, isAuthReady, loginWithEmail, setSessionRole, registerWithEmail, resetPassword, isTableMode, tableSessionToken, products } = useApp();
  const [activeTab, setActiveTab] = useState("home");
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);
  const [registerName, setRegisterName] = useState("");
  const [registerSurname, setRegisterSurname] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerGender, setRegisterGender] = useState<"female" | "male" | "">("");
  const [registerPhone, setRegisterPhone] = useState("");
  const [registerBirthDate, setRegisterBirthDate] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<InlineAuthError>(null);
  const [pendingSessionChoice, setPendingSessionChoice] = useState<"staff" | "manager" | null>(null);
  const [sessionChoiceLoading, setSessionChoiceLoading] = useState(false);
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);

  const customerTabs = [
    { id: "home", label: t("menu"), icon: Coffee },
    { id: "campaigns", label: t("firsatlar"), icon: Gift },
    isTableMode 
      ? { id: "table-session", label: "Masa", icon: Utensils }
      : { id: "orders", label: t("siparisler"), icon: ShoppingBag },
    { id: "notifications", label: "Bildirimler", icon: Bell },
    { id: "profile", label: "Profil", icon: UserIcon },
  ];

  const staffTabs = [
    { id: "live", label: t("canli"), icon: ClipboardList },
    { id: "tables", label: "Masalar", icon: Utensils },
    { id: "query", label: "Sorgu", icon: Search },
    { id: "profile", label: "Profil", icon: UserIcon },
  ];

  const managerTabs = [
    { id: "dashboard", label: t("ozet"), icon: LayoutDashboard },
    { id: "staff", label: "Personel", icon: Users },
    { id: "cms", label: t("icerik"), icon: Settings },
    { id: "profile", label: "Profil", icon: UserIcon },
  ];

  const tabs = role === "customer" ? customerTabs : role === "staff" ? staffTabs : managerTabs;


  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Madde 15: doğrulanmamış müşteriye ilk ana sayfa girişinde bir kez
  // gösterilen bilgilendirme pop-up'ı. "Şimdilik Atla" kullanıcı başına
  // kalıcıdır; profil tamamlandığında bir daha görünmez.
  useEffect(() => {
    if (!user || role !== "customer") {
      setShowVerificationPopup(false);
      return;
    }
    const v = user.identityVerification;
    const isUnverified = !v?.phone || !v?.email || !v?.tckn;
    const dismissedKey = `cafe_verification_dismissed_${user.id}`;
    const wasDismissed = localStorage.getItem(dismissedKey) === "1";
    setShowVerificationPopup(isUnverified && !wasDismissed);
  }, [user, role]);

  useEffect(() => {
    if (role === "customer") {
      setActiveTab("home");
    }
    if (role === "staff") {
      setActiveTab("live");
    }
    if (role === "manager") {
      setActiveTab("dashboard");
    }
  }, [role]);

  useEffect(() => {
    if (!user) {
      setPendingSessionChoice(null);
      return;
    }

    const accountRole = user.accountRole || user.role;
    const shouldPrompt =
      (accountRole === "staff" || accountRole === "manager") &&
      user.sessionRole == null;

    setPendingSessionChoice(shouldPrompt ? accountRole : null);
  }, [user]);

  const clearAuthError = (field?: "name" | "surname" | "username" | "gender" | "email" | "password" | "phone" | "birthDate") => {
    if (!authError) {
      return;
    }

    if (!field || authError.field === field || authError.field === "form") {
      setAuthError(null);
    }
  };

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();

    if (isRegistering && !registerName.trim()) {
      setAuthError({ field: "name", message: "Ad gerekli" });
      return;
    }

    if (isRegistering && !registerSurname.trim()) {
      setAuthError({ field: "surname", message: "Soyad gerekli" });
      return;
    }

    if (isRegistering && !registerUsername.trim()) {
      setAuthError({ field: "username", message: "Kullanıcı adı gerekli" });
      return;
    }

    if (isRegistering) {
      const cleanUsername = registerUsername.trim().toLowerCase().replace(/^@/, '');
      const usernameRegex = /^[a-z0-9_]{3,20}$/;
      if (!usernameRegex.test(cleanUsername)) {
        setAuthError({ field: "username", message: "Kullanıcı adı 3-20 karakter, yalnızca küçük harf, rakam ve alt çizgi içerebilir" });
        return;
      }
    }

    if (isRegistering && !registerGender) {
      setAuthError({ field: "gender", message: t("cinsiyet-secimi-gerekli") });
      return;
    }

    if (isRegistering && !registerPhone.trim()) {
      setAuthError({ field: "phone", message: t("telefon-numarasi-gerekli") });
      return;
    }

    let registerPhoneE164 = "";
    if (isRegistering) {
      registerPhoneE164 = parseTurkeyPhone(registerPhone);
      if (!registerPhoneE164) {
        setAuthError({ field: "phone", message: "Telefon numarası +90 5-- --- -- -- biçiminde ve eksiksiz olmalıdır." });
        return;
      }
    }

    if (isRegistering && !registerBirthDate.trim()) {
      setAuthError({ field: "birthDate", message: t("dogum-tarihi-gerekli") });
      return;
    }

    if (isRegistering) {
      const birth = new Date(registerBirthDate);
      if (isNaN(birth.getTime())) {
        setAuthError({ field: "birthDate", message: t("gecerli-bir-dogum-tarihi-giriniz") });
        return;
      }
      const currentYear = new Date().getFullYear();
      const age = currentYear - birth.getFullYear();
      if (age < 12 || age > 100) {
        setAuthError({ field: "birthDate", message: t("lutfen-gercekci-bir-dogum-tarihi-giriniz-yas-12-100-olmalidir") });
        return;
      }
    }

    if (!loginEmail || !loginPassword) {
      return;
    }

    setAuthError(null);
    setAuthLoading(true);

    try {
      if (isRegistering) {
        await registerWithEmail(
          registerName.trim(),
          registerSurname.trim(),
          registerUsername.trim().toLowerCase().replace(/^@/, ''),
          registerGender as 'female' | 'male',
          registerPhoneE164,
          registerBirthDate.trim(),
          loginEmail,
          loginPassword
        );
      } else {
        const loggedInUser = await loginWithEmail(loginEmail, loginPassword);
        const accountRole = loggedInUser.accountRole || loggedInUser.role;

        if (accountRole === "staff" || accountRole === "manager") {
          setPendingSessionChoice(accountRole);
        }
      }
    } catch (error) {
      const apiError = error instanceof ApiRequestError ? error : null;
      const message =
        error instanceof Error ? error.message : t("giris-sirasinda-beklenmeyen-bir-hata-olustu");

      // Login errors are intentionally generic (no email/password distinction)
      // to prevent user enumeration. The backend returns INVALID_CREDENTIALS.
      if (!isRegistering && apiError?.code === "INVALID_CREDENTIALS") {
        setAuthError({ field: "form", message: "E-posta/Kullanıcı adı veya şifre hatalı." });
        return;
      }

      if (isRegistering && apiError?.status === 409) {
        if (message.toLowerCase().includes("kullanıcı adı")) {
          setAuthError({ field: "username", message });
        } else {
          setAuthError({ field: "email", message });
        }
        return;
      }

      setAuthError({ field: "form", message });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail) {
      setAuthError({ field: "email", message: t("lutfen-e-posta-adresini-gir") });
      return;
    }

    try {
      await resetPassword(loginEmail);
      setAuthError({
        field: "form",
        message: t("sifre-sifirlama-talebi-alindi"),
      });
    } catch (error) {
      setAuthError({
        field: "form",
        message: error instanceof Error ? error.message : t("sifre-sifirlama-yapilamadi"),
      });
    }
  };

  const handleSessionChoice = async (nextRole: "customer" | "staff" | "manager") => {
    setSessionChoiceLoading(true);
    setAuthError(null);

    try {
      await setSessionRole(nextRole);
      setPendingSessionChoice(null);
    } catch (error) {
      setAuthError({
        field: "form",
        message: error instanceof Error ? error.message : "Oturum secimi kaydedilemedi.",
      });
    } finally {
      setSessionChoiceLoading(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="h-[100dvh] overflow-hidden bg-surface flex flex-col items-center justify-center p-10 text-center space-y-6">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-black border-t-transparent" />
        <p className="text-[10px] font-medium uppercase tracking-widest text-text-secondary">{t("yukleniyor")}</p>
      </div>
    );
  }

  if (!user) {
    const marqueeProducts = products && products.length > 0
      ? [...products, ...products, ...products, ...products, ...products, ...products]
      : [];

    return (
      <div className={cn(
        "h-[100dvh] overflow-hidden bg-white",
        !isMobile && "md:grid md:grid-cols-[450px_1fr] h-screen w-screen"
      )}>
        {/* Left Side: Form */}
        <div className="h-full overflow-y-auto px-6 py-12 md:py-16 no-scrollbar bg-white border-r border-border/50">
          <div className="min-h-full w-full flex flex-col justify-center items-center">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
            <motion.div 
              layout 
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="rounded-[32px] border border-border bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.04)] overflow-hidden"
            >
              <div className="mb-5 md:mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white shrink-0">
                  <Coffee size={20} />
                </div>
                <div className="h-9 flex items-center overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.h1 
                      key={isRegistering ? "register" : "login"}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.2 }}
                      className="font-display text-3xl font-semibold text-black leading-none"
                    >
                      {isRegistering ? t("kayit-ol") : t("giris-yapin")}
                    </motion.h1>
                  </AnimatePresence>
                </div>
              </div>

              <div className="relative overflow-hidden w-full">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={isRegistering ? "register" : "login"}
                    initial={{ opacity: 0, x: isRegistering ? 160 : -160 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: isRegistering ? -160 : 160 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="w-full"
                  >
                    {isRegistering ? (
                      <form onSubmit={handleEmailAuth} className="space-y-3 md:space-y-4">
                        <div className="space-y-2">
                          <div className="relative flex items-center">
                            <span className="absolute left-5 font-mono font-bold text-sm text-zinc-400">@</span>
                            <input
                              type="text"
                              placeholder="kullanici_adi (örn: @yusuf)"
                              value={registerUsername}
                              onChange={(event) => {
                                setRegisterUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
                                clearAuthError("username");
                              }}
                              maxLength={20}
                              className={cn(
                                "h-14 w-full rounded-2xl border bg-white pl-10 pr-5 text-sm font-mono text-black transition-all placeholder:text-text-secondary focus:outline-none focus:border-black",
                                authError?.field === "username" ? "border-red-300" : "border-border",
                              )}
                              required
                            />
                          </div>
                          {authError?.field === "username" && (
                            <p className="pl-1 text-[11px] font-medium text-red-500">{authError.message}</p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Ad"
                              value={registerName}
                              onChange={(event) => {
                                setRegisterName(event.target.value);
                                clearAuthError("name");
                              }}
                              className={cn(
                                "h-14 w-full rounded-2xl border bg-white px-5 text-sm text-black transition-all placeholder:text-text-secondary focus:outline-none focus:border-black",
                                authError?.field === "name" ? "border-red-300" : "border-border",
                              )}
                              required
                            />
                            {authError?.field === "name" && (
                              <p className="pl-1 text-[11px] font-medium text-red-500">{authError.message}</p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <input
                              type="text"
                              placeholder="Soyad"
                              value={registerSurname}
                              onChange={(event) => {
                                setRegisterSurname(event.target.value);
                                clearAuthError("surname");
                              }}
                              className={cn(
                                "h-14 w-full rounded-2xl border bg-white px-5 text-sm text-black transition-all placeholder:text-text-secondary focus:outline-none focus:border-black",
                                authError?.field === "surname" ? "border-red-300" : "border-border",
                              )}
                              required
                            />
                            {authError?.field === "surname" && (
                              <p className="pl-1 text-[11px] font-medium text-red-500">{authError.message}</p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-3 bg-zinc-100/60 p-1.5 rounded-2xl border border-border/80 relative overflow-hidden">
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => {
                                setRegisterGender("female");
                                clearAuthError("gender");
                              }}
                              className={cn(
                                "h-12 rounded-xl text-xs font-bold transition-colors duration-300 flex items-center justify-center gap-2 relative z-10 cursor-pointer",
                                registerGender === "female" ? "text-white" : "text-zinc-500 hover:text-zinc-800"
                              )}
                            >
                              Kadın
                              {registerGender === "female" && (
                                <motion.div
                                  layoutId="active-gender"
                                  className="absolute inset-0 bg-pink-600 rounded-xl -z-10 shadow-md shadow-pink-500/20"
                                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                />
                              )}
                            </motion.button>
                            <motion.button
                              type="button"
                              whileTap={{ scale: 0.96 }}
                              onClick={() => {
                                setRegisterGender("male");
                                clearAuthError("gender");
                              }}
                              className={cn(
                                "h-12 rounded-xl text-xs font-bold transition-colors duration-300 flex items-center justify-center gap-2 relative z-10 cursor-pointer",
                                registerGender === "male" ? "text-white" : "text-zinc-500 hover:text-zinc-800"
                              )}
                            >
                              Erkek
                              {registerGender === "male" && (
                                <motion.div
                                  layoutId="active-gender"
                                  className="absolute inset-0 bg-sky-600 rounded-xl -z-10 shadow-md shadow-sky-500/20"
                                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                                />
                              )}
                            </motion.button>
                          </div>
                          {authError?.field === "gender" && (
                            <p className="pl-1 text-[11px] font-medium text-red-500">{authError.message}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <input
                            type="tel"
                            placeholder="+90 5-- --- -- --"
                            inputMode="numeric"
                            autoComplete="tel"
                            value={registerPhone}
                            onChange={(event) => {
                              setRegisterPhone(formatTurkeyPhoneInput(event.target.value));
                              clearAuthError("phone");
                            }}
                            className={cn(
                              "h-14 w-full rounded-2xl border bg-white px-5 text-sm text-black transition-all placeholder:text-text-secondary focus:outline-none focus:border-black",
                              authError?.field === "phone" ? "border-red-300" : "border-border",
                            )}
                            required
                          />
                          {authError?.field === "phone" && (
                            <p className="pl-1 text-[11px] font-medium text-red-500">{authError.message}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="relative">
                            <span className="absolute left-5 top-2 text-[9px] font-bold text-text-secondary uppercase tracking-wider">{t("dogum-tarihi")}</span>
                            <input
                              type="date"
                              value={registerBirthDate}
                              onChange={(event) => {
                                setRegisterBirthDate(event.target.value);
                                clearAuthError("birthDate");
                              }}
                              className={cn(
                                "h-14 w-full rounded-2xl border bg-white px-5 pt-4 text-sm text-black transition-all placeholder:text-text-secondary focus:outline-none focus:border-black",
                                authError?.field === "birthDate" ? "border-red-300" : "border-border",
                              )}
                              required
                            />
                          </div>
                          {authError?.field === "birthDate" && (
                            <p className="pl-1 text-[11px] font-medium text-red-500">{authError.message}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <input
                            type="email"
                            placeholder="Mail"
                            value={loginEmail}
                            onChange={(event) => {
                              setLoginEmail(event.target.value);
                              clearAuthError("email");
                            }}
                            className={cn(
                              "h-14 w-full rounded-2xl border bg-white px-5 text-sm text-black transition-all placeholder:text-text-secondary focus:outline-none focus:border-black",
                              authError?.field === "email" ? "border-red-300" : "border-border",
                            )}
                            required
                          />
                          {authError?.field === "email" && (
                            <p className="pl-1 text-[11px] font-medium text-red-500">{authError.message}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <input
                            type="password"
                            placeholder={t("sifre")}
                            value={loginPassword}
                            onChange={(event) => {
                              setLoginPassword(event.target.value);
                              clearAuthError("password");
                            }}
                            className={cn(
                              "h-14 w-full rounded-2xl border bg-white px-5 text-sm text-black transition-all placeholder:text-text-secondary focus:outline-none focus:border-black",
                              authError?.field === "password" ? "border-red-300" : "border-border",
                            )}
                            required
                          />
                          {authError?.field === "password" && (
                            <p className="pl-1 text-[11px] font-medium text-red-500">{authError.message}</p>
                          )}
                        </div>

                        {authError?.field === "form" && (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                            <p className="text-[11px] leading-5 text-red-600">{authError.message}</p>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={authLoading}
                          className="flex h-14 w-full items-center justify-center rounded-2xl bg-black text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 relative overflow-hidden cursor-pointer"
                        >
                          {authLoading ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <span className="font-semibold">{t("kayit-ol")}</span>
                          )}
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setIsRegistering(false);
                              setAuthError(null);
                              setRegisterGender("");
                            }}
                            className="h-12 rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-black transition-colors hover:border-black cursor-pointer"
                          >
                            {t("giris-yap")}
                          </button>
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="h-12 rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-black transition-colors hover:border-black cursor-pointer"
                          >
                            {t("sifre-yenile")}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleEmailAuth} className="space-y-3 md:space-y-4">
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="E-posta veya @kullanici_adi"
                            value={loginEmail}
                            onChange={(event) => {
                              setLoginEmail(event.target.value);
                              clearAuthError("email");
                            }}
                            className={cn(
                              "h-14 w-full rounded-2xl border bg-white px-5 text-sm text-black transition-all placeholder:text-text-secondary focus:outline-none focus:border-black",
                              authError?.field === "email" ? "border-red-300" : "border-border",
                            )}
                            required
                          />
                          {authError?.field === "email" && (
                            <p className="pl-1 text-[11px] font-medium text-red-500">{authError.message}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <input
                            type="password"
                            placeholder={t("sifre")}
                            value={loginPassword}
                            onChange={(event) => {
                              setLoginPassword(event.target.value);
                              clearAuthError("password");
                            }}
                            className={cn(
                              "h-14 w-full rounded-2xl border bg-white px-5 text-sm text-black transition-all placeholder:text-text-secondary focus:outline-none focus:border-black",
                              authError?.field === "password" ? "border-red-300" : "border-border",
                            )}
                            required
                          />
                          {authError?.field === "password" && (
                            <p className="pl-1 text-[11px] font-medium text-red-500">{authError.message}</p>
                          )}
                        </div>

                        {authError?.field === "form" && (
                          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                            <p className="text-[11px] leading-5 text-red-600">{authError.message}</p>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={authLoading}
                          className="flex h-14 w-full items-center justify-center rounded-2xl bg-black text-sm font-semibold text-white transition-all active:scale-[0.98] disabled:opacity-60 relative overflow-hidden cursor-pointer"
                        >
                          {authLoading ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <span className="font-semibold">{t("giris-yap")}</span>
                          )}
                        </button>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setIsRegistering(true);
                              setAuthError(null);
                              setRegisterGender("");
                            }}
                            className="h-12 rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-black transition-colors hover:border-black cursor-pointer"
                          >
                            {t("kayit-ol")}
                          </button>
                          <button
                            type="button"
                            onClick={handleForgotPassword}
                            className="h-12 rounded-2xl border border-border bg-white px-4 text-sm font-semibold text-black transition-colors hover:border-black cursor-pointer"
                          >
                            {t("sifre-yenile")}
                          </button>
                        </div>
                      </form>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

        {/* Right Side: Hero Section (Visible only on desktop) */}
        {!isMobile && (
          <div className="hidden md:flex flex-col justify-center items-center relative overflow-hidden bg-zinc-950 text-white p-12 select-none h-full">
            {/* Soft Ambient Blobs */}
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-zinc-800/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-zinc-800/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="z-10 text-center max-w-2xl px-6 flex flex-col items-center">
              <motion.h2 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-5xl font-display font-black tracking-tight mb-4"
              >
                {t("bancho-kafeye-hosgeldiniz")}
              </motion.h2>
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="text-base text-zinc-400 font-medium tracking-wide mb-16 max-w-md"
              >
                {t("kahve-kokusunun-mutlulukla-bulustugu-yer-en-taze-cekirdekler-ve-size-ozel-ayricaliklarla-dolu-bir-deneyim")}
              </motion.p>
            </div>

            {/* Infinite Product Marquee Slider */}
            <div className="w-full relative py-6 overflow-hidden flex items-center">
              {/* Fade Overlays */}
              <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-zinc-950 to-transparent pointer-events-none z-10" />
              <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-zinc-950 to-transparent pointer-events-none z-10" />

              {marqueeProducts.length > 0 ? (
                <div className="animate-marquee flex gap-6">
                  {marqueeProducts.map((product, idx) => (
                    <div 
                      key={`${product.id}-${idx}`}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center gap-3 w-40 h-52 shrink-0 backdrop-blur-sm shadow-xl transition-all duration-300 hover:border-white/20 hover:bg-white/10"
                    >
                      <div className="w-24 h-24 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center border border-white/5 shrink-0">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <Coffee size={28} className="text-zinc-400" />
                        )}
                      </div>
                      <div className="text-center w-full min-w-0 flex items-center justify-center flex-1">
                        <p className="text-xs font-bold text-white truncate w-full">{product.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full flex justify-center items-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                </div>
              )}
            </div>

            {/* Footer with Logo */}
            <a 
              href="https://firsatweb.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="absolute bottom-8 left-0 right-0 flex items-center justify-center gap-2.5 z-10 hover:opacity-90 transition-opacity cursor-pointer group"
            >
              <img 
                src="https://firsatweb.com/logo.png" 
                alt={t("firsat-web-logo")} 
                className="w-6 h-6 rounded-full object-cover border border-white/10 shadow-md group-hover:scale-105 transition-transform duration-200"
              />
              <span className="text-[10px] font-medium tracking-widest uppercase text-zinc-400 group-hover:text-zinc-200 transition-colors duration-200">
                Bu bir <span className="text-[#0017FF] font-extrabold tracking-normal group-hover:text-[#3355FF] transition-colors duration-200">{t("firsat-web")}</span> {t("urunudur")}
              </span>
            </a>
          </div>
        )}
      </div>
    );
  }

  if (!pendingSessionChoice && role === "customer" && (!user.phone || !user.birthDate)) {
    return <RegistrationScreen />;
  }

  if (!isMobile) {
    return (
      <div className="h-screen w-screen flex bg-surface overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-white flex flex-col shrink-0">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-border flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black text-white shrink-0">
              <Coffee size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-base leading-tight truncate">Bancho Cafe</h1>
              <p className="text-[9px] text-text-secondary uppercase tracking-widest font-bold mt-0.5">
                {role === "manager" ? t("yonetici") : role === "staff" ? "Personel" : t("musteri")}
              </p>
            </div>
          </div>
          
          {/* Sidebar Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer",
                    active 
                      ? "bg-black text-white shadow-md shadow-black/10" 
                      : "text-text-secondary hover:bg-black/5 hover:text-black"
                  )}
                >
                  <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          
          {/* Sidebar Footer */}
          <div className="p-4 border-t border-border bg-surface/50">
            <div className="flex items-center gap-3 px-2 py-2">
              {user?.avatar ? (
                <img src={user.avatar} alt="Avatar" className="w-10 h-10 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-black/5 flex items-center justify-center text-black font-bold text-sm shrink-0">
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-black truncate leading-tight">{user?.name} {user?.surname}</p>
                <p className="text-[10px] text-text-secondary truncate mt-0.5">{user?.email}</p>
              </div>
            </div>
          </div>
        </aside>
        
        {/* Main Content Area */}
        <main className="flex-1 h-full overflow-y-auto bg-background relative no-scrollbar">
          <div className="p-8 pb-12 w-full h-full">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab + role}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full w-full"
              >
                {role === "customer" && (
                  isTableMode && !tableSessionToken ? (
                    <TableSessionView activeTab={activeTab} />
                  ) : activeTab === "table-session" ? (
                    <TableSessionView activeTab={activeTab} />
                  ) : (
                    <CustomerPanel activeTab={activeTab} />
                  )
                )}
                {role === "staff" && (
                  <Suspense fallback={<PanelFallback />}>
                    <StaffPanel activeTab={activeTab} />
                  </Suspense>
                )}
                {role === "manager" && (
                  <Suspense fallback={<PanelFallback />}>
                    <ManagerPanel activeTab={activeTab} />
                  </Suspense>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <Toast />
        </main>
        <VerificationPopup
          visible={showVerificationPopup}
          onDismiss={() => {
            if (user) localStorage.setItem(`cafe_verification_dismissed_${user.id}`, "1");
            setShowVerificationPopup(false);
          }}
          onComplete={() => {
            if (user) localStorage.setItem(`cafe_verification_dismissed_${user.id}`, "1");
            setShowVerificationPopup(false);
            setActiveTab("profile");
          }}
        />
      </div>
    );
  }

  return (
    <div className="no-scrollbar flex flex-col relative bg-background overflow-hidden w-full h-[100dvh]">
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + role}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {role === "customer" && (
              isTableMode && !tableSessionToken ? (
                <TableSessionView activeTab={activeTab} />
              ) : activeTab === "table-session" ? (
                <TableSessionView activeTab={activeTab} />
              ) : (
                <CustomerPanel activeTab={activeTab} />
              )
            )}
            {role === "staff" && (
              <Suspense fallback={<PanelFallback />}>
                <StaffPanel activeTab={activeTab} />
              </Suspense>
            )}
            {role === "manager" && (
              <Suspense fallback={<PanelFallback />}>
                <ManagerPanel activeTab={activeTab} />
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <Toast />
      <NotificationPermissionBanner />
      <div id="modal-root" className="absolute inset-0 pointer-events-none z-[100]" />
      <VerificationPopup
        visible={showVerificationPopup}
        onDismiss={() => {
          if (user) localStorage.setItem(`cafe_verification_dismissed_${user.id}`, "1");
          setShowVerificationPopup(false);
        }}
        onComplete={() => {
          if (user) localStorage.setItem(`cafe_verification_dismissed_${user.id}`, "1");
          setShowVerificationPopup(false);
          setActiveTab("profile");
        }}
      />
      <AnimatePresence>
        {user && pendingSessionChoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 px-5"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
            >
              <div className="mb-4 space-y-1">
                <h2 className="text-xl font-display font-semibold text-black">
                  {pendingSessionChoice === "manager" ? "Yönetici Girişi" : "Personel Girişi"}
                </h2>
              </div>

              <div className="space-y-3">
                {pendingSessionChoice === "manager" ? (
                  <>
                    <button
                      type="button"
                      disabled={sessionChoiceLoading}
                      onClick={() => handleSessionChoice("manager")}
                      className="w-full rounded-2xl border border-black bg-black px-4 py-4 text-left text-white transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    >
                      <span className="block text-sm font-semibold">
                        Yönetici olarak devam et
                      </span>
                      <span className="mt-1 block text-xs text-white/75">Vardiya başlayacaktır.</span>
                    </button>

                    <button
                      type="button"
                      disabled={sessionChoiceLoading}
                      onClick={() => handleSessionChoice("staff")}
                      className="w-full rounded-2xl border border-neutral-200 bg-neutral-900 px-4 py-4 text-left text-white transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                    >
                      <span className="block text-sm font-semibold">
                        Personel olarak devam et
                      </span>
                      <span className="mt-1 block text-xs text-white/75">Garson / Personel paneli ile vardiya başlar.</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={sessionChoiceLoading}
                    onClick={() => handleSessionChoice("staff")}
                    className="w-full rounded-2xl border border-black bg-black px-4 py-4 text-left text-white transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    <span className="block text-sm font-semibold">
                      Personel olarak devam et
                    </span>
                    <span className="mt-1 block text-xs text-white/75">Vardiya başlayacaktır.</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={sessionChoiceLoading}
                  onClick={() => handleSessionChoice("customer")}
                  className="w-full rounded-2xl border border-border bg-white px-4 py-4 text-left text-black transition-transform active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  <span className="block text-sm font-semibold">Müşteri olarak devam et</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  useLockViewportInteractions();

  return (
    <AppProvider>
      <SystemTextsProvider>
        <AppContent />
      </SystemTextsProvider>
    </AppProvider>
  );
}
