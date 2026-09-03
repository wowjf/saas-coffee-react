import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type {
  BalanceTopUp,
  Campaign,
  Category,
  ChangeLog,
  Ingredient,
  Notification,
  Order,
  Product,
  StaffMember,
  User,
  UserRole,
} from "./types";
import { apiRequest, clearAuthToken, getAuthToken, setAuthToken } from "./lib/api";
import { t } from "./shared/system-texts";

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  isAuthReady: boolean;
  role: UserRole;
  setRole: (role: UserRole) => void;
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  notifications: Notification[];
  markNotificationRead: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  // C6: mutasyon sonrası anında senkron (hediye bakiyesi vb. dış bileşenler için)
  syncAfterMutation: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  balance: number;
  updateBalance: (amount: number) => Promise<void>;
  points: number;
  logout: () => Promise<void>;
  loginWithEmail: (emailOrUsername: string, password: string) => Promise<User>;
  setSessionRole: (role: UserRole) => Promise<void>;
  registerWithEmail: (
    name: string,
    surname: string,
    username: string,
    gender: "female" | "male",
    phone: string,
    birthDate: string,
    email: string,
    password: string
  ) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  createOrder: (order: Omit<Order, "id">, options?: { couponCode?: string }) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status: Order["status"],
    options?: { cancelReason?: string },
  ) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  addProduct: (product: Omit<Product, "id">) => Promise<void>;
  updateProduct: (productId: string, updates: Partial<Product>) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  addCampaign: (campaign: Omit<Campaign, "id">) => Promise<void>;
  updateCampaign: (campaignId: string, updates: Partial<Campaign>) => Promise<void>;
  deleteCampaign: (campaignId: string) => Promise<void>;
  addIngredient: (ingredient: Omit<Ingredient, "id">) => Promise<void>;
  updateIngredient: (ingredientId: string, updates: Partial<Ingredient>) => Promise<void>;
  deleteIngredient: (ingredientId: string) => Promise<void>;
  addCategory: (name: string, iconName: string, image?: string) => Promise<void>;
  updateCategory: (categoryId: string, name: string, iconName: string, image?: string) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  campaigns: Campaign[];
  setCampaigns: React.Dispatch<React.SetStateAction<Campaign[]>>;
  ingredients: Ingredient[];
  setIngredients: React.Dispatch<React.SetStateAction<Ingredient[]>>;
  recentChanges: ChangeLog[];
  logChange: (action: string, details: string) => Promise<void>;
  balanceTopUps: BalanceTopUp[];
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  cart: { productId: string; quantity: number }[];
  setCart: React.Dispatch<React.SetStateAction<{ productId: string; quantity: number }[]>>;
  staff: StaffMember[];
  addStaff: (staff: Omit<StaffMember, "id" | "status">) => Promise<void>;
  updateStaffRole: (id: string, role: UserRole) => Promise<void>;
  deleteStaff: (id: string) => Promise<void>;
  updateUserRole: (id: string, role: UserRole) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  resetSystem: () => Promise<void>;
  users: User[];
  
  // Table Session types
  tableSession: any;
  tableMetrics: any;
  tableOrders: any[];
  isTableMode: boolean;
  tableSessionToken: string;
  tableNumber: string;
  joinOrCreateTableSession: (targetTableNumber: string) => Promise<{ status: "active" | "pending"; sessionToken?: string; hostName?: string }>;
  approveParticipant: (sessionToken: string, pendingUserId: string, action: "approve" | "reject") => Promise<void>;
  payTableBill: (sessionToken: string, paymentType: "self" | "split" | "all") => Promise<void>;
  leaveTableSession: (sessionToken: string, action: "pay" | "no-pay", paymentType?: "self" | "all") => Promise<void>;
  refreshTableSession: () => Promise<void>;
}

interface BootstrapPayload {
  user: User | null;
  role: UserRole;
  products: Product[];
  orders: Order[];
  notifications: Notification[];
  campaigns: Campaign[];
  ingredients: Ingredient[];
  recentChanges: ChangeLog[];
  balanceTopUps: BalanceTopUp[];
  categories: Category[];
  staff: StaffMember[];
  users: User[];
}

// MP-0.9: Manager bootstrap'ının ağır bölümü artık ayrı endpoint'te
// (GET /api/admin/overview) — 5 sn'lik bootstrap polling'i kullanıcı
// listesini / bakiye hareketlerini / logları çekmiyor.
interface AdminOverviewPayload {
  users: User[];
  balanceTopUps: BalanceTopUp[];
  recentChanges: ChangeLog[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>("customer");
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [serverNotifications, setServerNotifications] = useState<Notification[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recentChanges, setRecentChanges] = useState<ChangeLog[]>([]);
  const [balanceTopUps, setBalanceTopUps] = useState<BalanceTopUp[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cart, setCart] = useState<{ productId: string; quantity: number }[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [token, setToken] = useState<string | null>(() => getAuthToken());
  // MP-0.9: manager oturumundan çıkıldığını tek seferlik yakalamak için
  // (temizlik effect'i her bootstrap'ta yeniden çalıştığından ref kullanılır).
  const wasManagerRef = useRef(false);

  // Table Session States
  const [isTableMode, setIsTableMode] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [tableSessionToken, setTableSessionToken] = useState("");
  const [tableSession, setTableSession] = useState<any>(null);
  const [tableMetrics, setTableMetrics] = useState<any>(null);
  const [tableOrders, setTableOrders] = useState<any[]>([]);

  useEffect(() => {
    const parseUrl = () => {
      const path = window.location.pathname;
      const tableRegex = /^\/(?:table|masa)(?:[-/])([0-9a-zA-Z-]+)(?:\/session\/([0-9a-zA-Z-]+))?$/;
      const match = path.match(tableRegex);
      if (match) {
        setIsTableMode(true);
        setTableNumber(match[1]);
        setTableSessionToken(match[2] || "");
      } else {
        setIsTableMode(false);
        setTableNumber("");
        setTableSessionToken("");
        setTableSession(null);
        setTableMetrics(null);
        setTableOrders([]);
      }
    };

    parseUrl();

    window.addEventListener("popstate", parseUrl);
    return () => window.removeEventListener("popstate", parseUrl);
  }, []);

  // MP-1.7: Siralama her render'da degil, yalnizca sunucudan gelen liste
  // degistiginde yeniden hesaplanir.
  const notifications = useMemo(
    () =>
      [...serverNotifications].sort((a, b) =>
        b.timestamp.localeCompare(a.timestamp),
      ),
    [serverNotifications],
  );

  const applyBootstrap = useCallback((payload: BootstrapPayload) => {
    setUser(payload.user);
    const effectiveRole = payload.role || payload.user?.effectiveRole || payload.user?.role || "customer";
    setRole(effectiveRole);
    setProducts(payload.products || []);
    setOrders(payload.orders || []);
    setServerNotifications(payload.notifications || []);
    setCampaigns(payload.campaigns || []);
    setIngredients(payload.ingredients || []);
    // MP-0.9: manager için bakiye geçmişi bootstrap'ta artık boş geliyor —
    // mevcut listeyi /api/admin/overview'dan gelen veriyi ezmeden korumak
    // için atlanır. Diğer roller kendi geçmişini bootstrap'tan almaya devam
    // eder (geriye uyumluluk).
    if (effectiveRole !== "manager") {
      setBalanceTopUps(payload.balanceTopUps || []);
    }
    setCategories(payload.categories || []);
    setStaff(payload.staff || []);
    // users / recentChanges manager için /api/admin/overview'dan gelir.
  }, []);

  const refreshAdminOverview = useCallback(async () => {
    try {
      const payload = await apiRequest<AdminOverviewPayload>("/api/admin/overview", {});
      setUsers(payload.users || []);
      setBalanceTopUps(payload.balanceTopUps || []);
      setRecentChanges(payload.recentChanges || []);
    } catch (error) {
      console.error("Admin overview failed:", error);
    }
  }, []);

  const refreshBootstrap = useCallback(
    async (explicitToken?: string | null) => {
      const activeToken = explicitToken === undefined ? token : explicitToken;

      try {
        const payload = await apiRequest<BootstrapPayload>("/api/bootstrap", {
          token: activeToken,
        });

        if (activeToken && !payload.user) {
          clearAuthToken();
          setToken(null);
        }

        applyBootstrap(payload);
      } catch (error) {
        console.error("Bootstrap failed:", error);
        if (!isAuthReady) {
          setUser(null);
          setRole("customer");
        }
      } finally {
        setIsAuthReady(true);
      }
    },
    [applyBootstrap, isAuthReady, token],
  );

  useEffect(() => {
    void refreshBootstrap(getAuthToken());
  }, [refreshBootstrap]);

  useEffect(() => {
    if (!user || role !== "manager") {
      // Manager oturumu kapanınca/rol düşünce eski ağır veriyi temizle.
      // Not: bu blok her bootstrap'ta (user referansı değişir) tekrar çalışır;
      // bu yüzden yalnızca manager'dan çıkıldığındaki geçişi hedefler —
      // müşterinin kendi bakiye geçmişi bootstrap'tan geldiği için korunur.
      if (wasManagerRef.current) {
        wasManagerRef.current = false;
        setUsers([]);
        setRecentChanges([]);
      }
      return;
    }

    wasManagerRef.current = true;
    void refreshAdminOverview();
  }, [refreshAdminOverview, role, user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    // MP-3.1: canlılık iki kanaldan sağlanır — (1) /api/events SSE akışı olay
    // anında refresh tetikler, (2) polling yalnızca SSE düşerse (bağlantı
    // kopması, eski tarayıcı) yedek olarak devreye girer. Bu yüzden
    // aralıklar gevşetildi: SSE aktifken bu sayaç nadiren ateşlenir.
    const intervalMs = role === "manager" ? 60000 : 30000;

    const interval = window.setInterval(() => {
      void refreshBootstrap();
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [refreshBootstrap, role, user]);

  // MP-3.1: SSE (Server-Sent Events) aboneliği — sunucudaki olaylar
  // (sipariş durumu, yeni sipariş, garson çağrısı, sohbet mesajı) bu kanaldan
  // gelir; EventSource header ekleyemediği için token sorgu parametresiyle
  // taşınır. Olay geldiğinde ilgili veri anında yenilenir; bağlantı koparsa
  // tarayıcı otomatik yeniden bağlanır (yukarıdaki polling yedektir).
  useEffect(() => {
    if (!user || !token) {
      return undefined;
    }

    const source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

    const refreshOnEvent = () => {
      void refreshBootstrap();
      if (role === "manager") {
        void refreshAdminOverview();
      }
    };

    // Sipariş durumu değişimleri: müşteri kendi siparişini, personel/yönetici
    // yeni sipariş akışını bu olaylarla alır.
    source.addEventListener("order_preparing", refreshOnEvent);
    source.addEventListener("order_ready", refreshOnEvent);
    source.addEventListener("order_cancelled", refreshOnEvent);
    source.addEventListener("staff_new_order", refreshOnEvent);
    source.addEventListener("waiter_call_new", refreshOnEvent);
    source.addEventListener("chat_message", refreshOnEvent);

    return () => {
      source.close();
    };
  }, [refreshAdminOverview, refreshBootstrap, role, token, user]);

  useEffect(() => {
    if (!user || role !== "manager") {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void refreshAdminOverview();
    }, 15000);

    return () => window.clearInterval(interval);
  }, [refreshAdminOverview, role, user]);

  const syncAfterMutation = useCallback(async () => {
    await refreshBootstrap();
    // MP-0.9: manager'a özgü listeler (kullanıcılar/bakiye hareketleri/loglar)
    // bootstrap dışına taşındı; mutasyon sonrası anında senkron korunması için
    // manager oturumunda overview da yenilenir.
    if (role === "manager") {
      await refreshAdminOverview();
    }
  }, [refreshBootstrap, refreshAdminOverview, role]);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await apiRequest("/api/auth/logout", {
          method: "POST",
          token,
        });
      }
    } catch (error) {
      console.error("Logout sync failed:", error);
    } finally {
      clearAuthToken();
      setToken(null);
      await refreshBootstrap(null);
    }
  }, [refreshBootstrap, token]);

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const response = await apiRequest<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        token: null,
      });

      setAuthToken(response.token);
      setToken(response.token);
      await refreshBootstrap(response.token);
      return response.user;
    },
    [refreshBootstrap],
  );

  const setSessionRole = useCallback(
    async (role: UserRole) => {
      await apiRequest<{ user: User; role: UserRole }>("/api/auth/session-role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const registerWithEmail = useCallback(
    async (
      name: string,
      surname: string,
      username: string,
      gender: "female" | "male",
      phone: string,
      birthDate: string,
      email: string,
      password: string
    ) => {
      const response = await apiRequest<{ token: string; user: User }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, surname, username, gender, phone, birthDate, email, password }),
        token: null,
      });

      setAuthToken(response.token);
      setToken(response.token);
      await refreshBootstrap(response.token);
    },
    [refreshBootstrap],
  );

  const resetPassword = useCallback(
    async (email: string) => {
      await apiRequest("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        token: null,
      });
    },
    [],
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      await apiRequest(`/api/notifications/${id}/read`, {
        method: "PATCH",
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const deleteNotification = useCallback(
    async (id: string) => {
      await apiRequest(`/api/notifications/${id}`, {
        method: "DELETE",
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const clearNotifications = useCallback(async () => {
    if (!user) {
      return;
    }

    await apiRequest("/api/notifications", {
      method: "DELETE",
    });
    await syncAfterMutation();
  }, [syncAfterMutation, user]);

  const updateUser = useCallback(
    async (updates: Partial<User>) => {
      await apiRequest("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  // Guvenlik (MP-0.1): /users/me/balance artik personel/yonetici uclarina
  // ayrilmistir; ciro/bonus degerleri sunucu tarafinda hesaplanir ve istemciden
  // gonderilmez. Mustteri tarafi yukleme akisi odeme entegrasyonu gelene kadar
  // devre disidir (cagri 403 doner).
  const updateBalance = useCallback(
    async (amount: number) => {
      await apiRequest("/api/users/me/balance", {
        method: "POST",
        body: JSON.stringify({ amount }),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const createOrder = useCallback(
    async (order: Omit<Order, "id">, options?: { couponCode?: string }) => {
      const response = await apiRequest<{ couponWarning?: string }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: order.items.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          note: order.note || "",
          tableSessionToken: tableSessionToken || undefined,
          couponCode: options?.couponCode || undefined,
        }),
      });

      // Kupon kosullari tutmadiysa siparis yine de olustu — kullaniciya
      // neden indirimsiz kaldigini bildir.
      if (response?.couponWarning) {
        alert(response.couponWarning);
      }

      await syncAfterMutation();
    },
    [syncAfterMutation, tableSessionToken],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: Order["status"], options?: { cancelReason?: string }) => {
      await apiRequest(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, cancelReason: options?.cancelReason || "" }),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const deleteOrder = useCallback(
    async (orderId: string) => {
      await apiRequest(`/api/orders/${orderId}`, {
        method: "DELETE",
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const addProduct = useCallback(
    async (product: Omit<Product, "id">) => {
      await apiRequest("/api/products", {
        method: "POST",
        body: JSON.stringify(product),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const updateProduct = useCallback(
    async (productId: string, updates: Partial<Product>) => {
      await apiRequest(`/api/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      await apiRequest(`/api/products/${productId}`, {
        method: "DELETE",
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const addCampaign = useCallback(
    async (campaign: Omit<Campaign, "id">) => {
      await apiRequest("/api/campaigns", {
        method: "POST",
        body: JSON.stringify(campaign),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const updateCampaign = useCallback(
    async (campaignId: string, updates: Partial<Campaign>) => {
      await apiRequest(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const deleteCampaign = useCallback(
    async (campaignId: string) => {
      await apiRequest(`/api/campaigns/${campaignId}`, {
        method: "DELETE",
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const addIngredient = useCallback(
    async (ingredient: Omit<Ingredient, "id">) => {
      await apiRequest("/api/ingredients", {
        method: "POST",
        body: JSON.stringify(ingredient),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const updateIngredient = useCallback(
    async (ingredientId: string, updates: Partial<Ingredient>) => {
      await apiRequest(`/api/ingredients/${ingredientId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const deleteIngredient = useCallback(
    async (ingredientId: string) => {
      await apiRequest(`/api/ingredients/${ingredientId}`, {
        method: "DELETE",
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const addCategory = useCallback(
    async (name: string, iconName: string, image = "") => {
      await apiRequest("/api/categories", {
        method: "POST",
        body: JSON.stringify({ name, iconName, image }),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      await apiRequest(`/api/categories/${id}`, {
        method: "DELETE",
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const updateCategory = useCallback(
    async (categoryId: string, name: string, iconName: string, image = "") => {
      await apiRequest(`/api/categories/${categoryId}`, {
        method: "PATCH",
        body: JSON.stringify({ name, iconName, image }),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const logChange = useCallback(
    async (action: string, details: string) => {
      await apiRequest("/api/logs", {
        method: "POST",
        body: JSON.stringify({ action, details }),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const addStaff = useCallback(
    async (staffMember: Omit<StaffMember, "id" | "status">) => {
      await apiRequest("/api/staff", {
        method: "POST",
        body: JSON.stringify(staffMember),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const updateStaffRole = useCallback(
    async (id: string, role: UserRole) => {
      await apiRequest(`/api/staff/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const deleteStaff = useCallback(
    async (id: string) => {
      await apiRequest(`/api/staff/${id}`, {
        method: "DELETE",
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const updateUserRole = useCallback(
    async (id: string, role: UserRole) => {
      await apiRequest(`/api/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const deleteUser = useCallback(
    async (id: string) => {
      await apiRequest(`/api/users/${id}`, {
        method: "DELETE",
      });
      await syncAfterMutation();
    },
    [syncAfterMutation],
  );

  const resetSystem = useCallback(async () => {
    await apiRequest("/api/system/reset", {
      method: "POST",
    });
    await syncAfterMutation();
  }, [syncAfterMutation]);

  // Table Session Methods
  const refreshTableSession = useCallback(async () => {
    if (!tableSessionToken) return;
    try {
      const response = await apiRequest<{ session: any; isHost: boolean; metrics: any; orders?: any[] }>(
        `/api/table-sessions/session/${tableSessionToken}`
      );
      setTableSession(response.session);
      setTableMetrics(response.metrics);
      setTableOrders(response.orders || []);
    } catch (error) {
      console.error("Failed to refresh table session, cleaning up local state:", error);
      setIsTableMode(false);
      setTableNumber("");
      setTableSessionToken("");
      setTableSession(null);
      setTableMetrics(null);
      setTableOrders([]);
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [tableSessionToken]);

  const joinOrCreateTableSession = useCallback(
    async (targetTableNumber: string) => {
      const response = await apiRequest<{ status: "active" | "pending"; sessionToken?: string; hostName?: string; session?: any }>(
        "/api/table-sessions/join-or-create",
        {
          method: "POST",
          body: JSON.stringify({ tableNumber: targetTableNumber }),
        }
      );
      if (response.status === "active" && response.session && !response.sessionToken) {
        response.sessionToken = response.session.sessionToken;
      }
      return response;
    },
    []
  );

  const approveParticipant = useCallback(
    async (sessionToken: string, pendingUserId: string, action: "approve" | "reject") => {
      await apiRequest("/api/table-sessions/approve-participant", {
        method: "POST",
        body: JSON.stringify({ sessionToken, pendingUserId, action }),
      });
      await refreshTableSession();
    },
    []
  );

  const payTableBill = useCallback(
    async (sessionToken: string, paymentType: "self" | "split" | "all") => {
      const response = await apiRequest<{ success: boolean; paidAmount: number; session: any; user: User }>(
        "/api/table-sessions/pay",
        {
          method: "POST",
          body: JSON.stringify({ sessionToken, paymentType }),
        }
      );
      setUser(response.user);
      if (response.session && response.session.status === "closed") {
        setIsTableMode(false);
        setTableNumber("");
        setTableSessionToken("");
        setTableSession(null);
        setTableMetrics(null);
        setTableOrders([]);
        window.history.replaceState(null, "", "/");
        window.dispatchEvent(new PopStateEvent("popstate"));
      } else {
        await refreshTableSession();
      }
    },
    [refreshTableSession]
  );

  const leaveTableSession = useCallback(
    async (sessionToken: string, action: "pay" | "no-pay", paymentType?: "self" | "all") => {
      const response = await apiRequest<{ success: boolean; session?: any; user?: User }>(
        "/api/table-sessions/leave",
        {
          method: "POST",
          body: JSON.stringify({ sessionToken, action, paymentType }),
        }
      );
      if (response.user) {
        setUser(response.user);
      }
      setIsTableMode(false);
      setTableNumber("");
      setTableSessionToken("");
      setTableSession(null);
      setTableMetrics(null);
      setTableOrders([]);
      window.history.replaceState(null, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    },
    []
  );

  useEffect(() => {
    if (!isTableMode || !tableSessionToken || !user) return;

    void refreshTableSession();

    const interval = window.setInterval(() => {
      void refreshTableSession();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [isTableMode, tableSessionToken, refreshTableSession, user]);

  // MP-1.7: value objesi memoize edilmezse 5 sn'lik her bootstrap fetch'inde
  // yeni bir obje referansi olusur ve provider'a abone tum agac yeniden
  // render olur. Tum alanlar zaten useCallback/useMemo ile stabil ya da
  // dogrudan state oldugundan bagimlilik listesi guvenle tam olabilir.
  const value = useMemo<AppContextType>(
    () => ({
      user,
      setUser,
      isAuthReady,
      role,
      setRole,
      products,
      setProducts,
      orders,
      setOrders,
      notifications,
      markNotificationRead,
      deleteNotification,
      syncAfterMutation,
      clearNotifications,
      updateUser,
      balance: user?.balance || 0,
      updateBalance,
      points: user?.points || 0,
      logout,
      loginWithEmail,
      setSessionRole,
      registerWithEmail,
      resetPassword,
      createOrder,
      updateOrderStatus,
      deleteOrder,
      addProduct,
      updateProduct,
      deleteProduct,
      addCampaign,
      updateCampaign,
      deleteCampaign,
      addIngredient,
      updateIngredient,
      deleteIngredient,
      addCategory,
      updateCategory,
      deleteCategory,
      campaigns,
      setCampaigns,
      ingredients,
      setIngredients,
      recentChanges,
      logChange,
      balanceTopUps,
      categories,
      setCategories,
      cart,
      setCart,
      staff,
      addStaff,
      updateStaffRole,
      deleteStaff,
      updateUserRole,
      deleteUser,
      resetSystem,
      users,

      // Table Session exports
      tableSession,
      tableMetrics,
      tableOrders,
      isTableMode,
      tableSessionToken,
      tableNumber,
      joinOrCreateTableSession,
      approveParticipant,
      payTableBill,
      leaveTableSession,
      refreshTableSession,
    }),
    [
      user,
      isAuthReady,
      role,
      products,
      orders,
      notifications,
      markNotificationRead,
      deleteNotification,
      clearNotifications,
      updateUser,
      updateBalance,
      logout,
      loginWithEmail,
      setSessionRole,
      registerWithEmail,
      resetPassword,
      createOrder,
      updateOrderStatus,
      deleteOrder,
      addProduct,
      updateProduct,
      deleteProduct,
      addCampaign,
      updateCampaign,
      deleteCampaign,
      addIngredient,
      updateIngredient,
      deleteIngredient,
      addCategory,
      updateCategory,
      deleteCategory,
      campaigns,
      ingredients,
      recentChanges,
      logChange,
      balanceTopUps,
      categories,
      cart,
      staff,
      addStaff,
      updateStaffRole,
      deleteStaff,
      updateUserRole,
      deleteUser,
      resetSystem,
      users,
      tableSession,
      tableMetrics,
      tableOrders,
      isTableMode,
      tableSessionToken,
      tableNumber,
      joinOrCreateTableSession,
      approveParticipant,
      payTableBill,
      leaveTableSession,
      refreshTableSession,
      syncAfterMutation,
    ],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }

  return context;
};
