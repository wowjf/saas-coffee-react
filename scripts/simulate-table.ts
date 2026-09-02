import "dotenv/config";
import readline from "readline";

const APP_URL = process.env.APP_URL || "http://localhost:3000";

// ANSI colors for premium terminal display
const log = {
  info: (msg: string) => console.log(`\x1b[36mℹ ${msg}\x1b[0m`),
  success: (msg: string) => console.log(`\x1b[32m✔ ${msg}\x1b[0m`),
  warn: (msg: string) => console.log(`\x1b[33m⚠ ${msg}\x1b[0m`),
  error: (msg: string) => console.log(`\x1b[31m✖ ${msg}\x1b[0m`),
  header: (msg: string) => console.log(`\n\x1b[35m==================================================\n   ${msg}\n==================================================\x1b[0m`),
  muted: (msg: string) => console.log(`\x1b[90m${msg}\x1b[0m`),
  highlight: (msg: string) => console.log(`\x1b[33;1m${msg}\x1b[0m`),
};

// State for active tokens and simulated users
interface SimulatedUser {
  email: string;
  name: string;
  token: string;
  id: string;
}

const users: Record<string, SimulatedUser> = {
  bir: { email: "bir@bir.com", name: "Bir Kullanıcı", token: "", id: "" },
  iki: { email: "iki@iki.com", name: "İki Kullanıcı", token: "", id: "" },
};

let activeTable: string = "12"; // Default test table
let activeSessionToken: string = "";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

// Helper: Make authenticated POST/GET request
async function apiCall(path: string, method: "GET" | "POST", body?: any, userKey?: "bir" | "iki") {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (userKey && users[userKey].token) {
    headers["Authorization"] = `Bearer ${users[userKey].token}`;
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(`${APP_URL}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }
    return data;
  } catch (err: any) {
    throw new Error(err.message);
  }
}

// Log in mock users
async function loginUsers() {
  log.info("Simülasyon kullanıcıları sisteme giriş yapıyor...");
  for (const key of ["bir", "iki"]) {
    try {
      const res = await apiCall("/api/auth/login", "POST", {
        email: users[key].email,
        password: "123456",
      });
      users[key].token = res.token;
      users[key].id = res.user.id;
      log.success(`${users[key].name} (${users[key].email}) giriş başarılı.`);
    } catch (err: any) {
      log.error(`${users[key].name} girişi başarısız: ${err.message}`);
      log.warn("Lütfen veritabanının çalıştığından emin olun.");
      process.exit(1);
    }
  }
}

// Format currency
function formatPrice(val: number) {
  return `₺${Number(val || 0).toFixed(2)}`;
}

// Print Table details
async function printTableStatus() {
  if (!activeSessionToken) {
    log.warn(`Seçili masada (Masa ${activeTable}) aktif bir oturum yok.`);
    return;
  }

  try {
    // Session status can be fetched using one of the logged-in users who is part of the table
    const data = await apiCall(`/api/table-sessions/session/${activeSessionToken}`, "GET", null, "bir");
    log.header(`MASA ${activeTable} OTURUM ÖZETİ`);
    log.highlight(`Oturum Token: ${data.sessionToken}`);
    log.info(`Durum: ${data.status.toUpperCase()}`);
    console.log("--------------------------------------------------");
    
    console.log("\nAktif Katılımcılar:");
    data.participants.forEach((p: any) => {
      const isHost = p.role === "host" ? "👑 HOST" : "👤 MİSAFİR";
      const status = p.status === "approved" ? "Aktif" : "Bekliyor";
      console.log(`  - ${p.userName} (${isHost}) | Durum: ${status}`);
      console.log(`    Bireysel Hesap: ${formatPrice(p.totalAmount)} | Ödenen: ${formatPrice(p.paidAmount)} | Kalan Borç: ${formatPrice(p.totalAmount - p.paidAmount)}`);
    });

    if (data.leftParticipants && data.leftParticipants.length > 0) {
      console.log("\nMasadan Ayrılanlar:");
      data.leftParticipants.forEach((p: any) => {
        console.log(`  - ${p.userName} | Statü: ${p.status.toUpperCase()}`);
        console.log(`    Ödediği Tutar: ${formatPrice(p.paidAmount)} | Kalan Aktarılan Borç: ${formatPrice(p.transferredDebt)}`);
      });
    }

    console.log("--------------------------------------------------");
    console.log(`Masa Toplam Hesabı : ${formatPrice(data.totals.totalBill)}`);
    console.log(`Toplam Ödenen Tutar: ${formatPrice(data.totals.totalPaid)}`);
    console.log(`Aktarılan Borçlar  : ${formatPrice(data.totals.transferredDebt)}`);
    log.highlight(`Masada Kalan Net Borç: ${formatPrice(data.totals.remainingBill)}`);
    console.log("--------------------------------------------------");
  } catch (err: any) {
    log.error(`Masa detayları alınamadı: ${err.message}`);
  }
}

// Fetch available products to let user select easily
let cachedProducts: any[] = [];
async function fetchProducts() {
  try {
    const res = await apiCall("/api/products", "GET", null, "bir");
    cachedProducts = res;
  } catch (err: any) {
    log.error("Ürün listesi alınamadı.");
  }
}

// Main Interactive Loop
async function showMenu() {
  while (true) {
    console.log(`\n\x1b[34m[MASA ${activeTable}] SİMÜLASYON SEÇENEKLERİ:\x1b[0m`);
    console.log("1. Masa Oturumuna Katıl / QR Okut (User 1 - host olarak başlatır/katılır)");
    console.log("2. Masa Oturumuna Katıl / QR Okut (User 2 - misafir olarak katılım talebi gönderir)");
    console.log("3. Bekleyen Katılımcı Onaylama (Host - User 1 bekleyen User 2'yi onaylar)");
    console.log("4. Ürün Siparişi Simüle Et (User 1 veya User 2 için sipariş girer)");
    console.log("5. Masa Hesap Durumunu Yazdır (Güncel masa durumu ve borç detayı)");
    console.log("6. Masadan Ayrıl / Öde ve Ayrıl (Kendi yediğini ödeyerek ayrılma)");
    console.log("7. Masadan Ayrıl / Ödemeden Ayrıl (Borcunu masaya aktararak ayrılma)");
    console.log("8. Masanın Kalan Tüm Borcunu Kapat");
    console.log("9. Simüle Edilecek Masa Numarasını Değiştir");
    console.log("0. Çıkış");

    const choice = await askQuestion("\nSeçiminiz: ");
    switch (choice.trim()) {
      case "1": {
        log.info(`User 1 (bir@bir.com) Masa ${activeTable} için QR okutuyor...`);
        try {
          const res = await apiCall("/api/table-sessions/join-or-create", "POST", { tableNumber: activeTable }, "bir");
          activeSessionToken = res.sessionToken;
          log.success(`User 1 Masa ${activeTable} oturumuna bağlandı.`);
          log.highlight(`Rol: ${res.status.toUpperCase()} (Session Token: ${res.sessionToken})`);
          await printTableStatus();
        } catch (err: any) {
          log.error(`Hata: ${err.message}`);
        }
        break;
      }
      case "2": {
        log.info(`User 2 (iki@iki.com) Masa ${activeTable} için QR okutuyor...`);
        try {
          const res = await apiCall("/api/table-sessions/join-or-create", "POST", { tableNumber: activeTable }, "iki");
          activeSessionToken = res.sessionToken;
          log.success(`User 2 Masa ${activeTable} oturumu katılım talebi gönderdi.`);
          log.highlight(`Durum: ${res.status.toUpperCase()}`);
          await printTableStatus();
        } catch (err: any) {
          log.error(`Hata: ${err.message}`);
        }
        break;
      }
      case "3": {
        if (!activeSessionToken) {
          log.warn("Lütfen önce aktif bir oturum başlatın (1. veya 2. seçeneği kullanın).");
          break;
        }
        log.info("Host (User 1) bekleyen katılımcıları onaylıyor...");
        try {
          // Get session details first to find pending participant id
          const data = await apiCall(`/api/table-sessions/session/${activeSessionToken}`, "GET", null, "bir");
          const pending = data.participants.find((p: any) => p.status === "pending");
          if (!pending) {
            log.warn("Onay bekleyen katılımcı bulunamadı.");
            break;
          }

          const res = await apiCall("/api/table-sessions/approve-participant", "POST", {
            sessionToken: activeSessionToken,
            participantId: pending.userId,
            status: "approved",
          }, "bir");
          log.success(`${pending.userName} masaya başarıyla onaylandı.`);
          await printTableStatus();
        } catch (err: any) {
          log.error(`Hata: ${err.message}`);
        }
        break;
      }
      case "4": {
        if (!activeSessionToken) {
          log.warn("Aktif oturum bulunamadı.");
          break;
        }
        if (cachedProducts.length === 0) {
          await fetchProducts();
        }

        console.log("\nSipariş verecek kullanıcıyı seçin:");
        console.log("1. User 1 (bir@bir.com)");
        console.log("2. User 2 (iki@iki.com)");
        const uChoice = await askQuestion("Kullanıcı: ");
        const userKey = uChoice === "2" ? "iki" : "bir";

        console.log("\nPopüler Menü Ürünleri:");
        const displayed = cachedProducts.slice(0, 10);
        displayed.forEach((p, idx) => {
          console.log(`${idx + 1}. ${p.name} - ${formatPrice(p.price)}`);
        });

        const pIdxStr = await askQuestion("Ürün seçin (no): ");
        const pIdx = parseInt(pIdxStr.trim()) - 1;
        if (isNaN(pIdx) || pIdx < 0 || pIdx >= displayed.length) {
          log.error("Geçersiz ürün seçimi.");
          break;
        }

        const qtyStr = await askQuestion("Adet (varsayılan 1): ");
        const qty = parseInt(qtyStr.trim()) || 1;

        const selectedProduct = displayed[pIdx];
        log.info(`${users[userKey].name} için ${qty} adet ${selectedProduct.name} siparişi veriliyor...`);

        try {
          await apiCall("/api/orders", "POST", {
            items: [{ productId: selectedProduct._id, quantity: qty }],
            orderType: "table",
            tableNumber: activeTable,
            tableSessionToken: activeSessionToken,
          }, userKey);
          log.success("Sipariş başarıyla masaya iletildi!");
          await printTableStatus();
        } catch (err: any) {
          log.error(`Hata: ${err.message}`);
        }
        break;
      }
      case "5": {
        await printTableStatus();
        break;
      }
      case "6": {
        if (!activeSessionToken) {
          log.warn("Aktif oturum bulunamadı.");
          break;
        }
        console.log("\nAyrılacak kullanıcıyı seçin:");
        console.log("1. User 1 (bir@bir.com)");
        console.log("2. User 2 (iki@iki.com)");
        const uChoice = await askQuestion("Kullanıcı: ");
        const userKey = uChoice === "2" ? "iki" : "bir";

        log.info(`${users[userKey].name} kendi yediklerini ödeyerek masadan ayrılıyor...`);
        try {
          const res = await apiCall("/api/table-sessions/leave", "POST", {
            sessionToken: activeSessionToken,
            action: "pay",
            paymentType: "self",
          }, userKey);
          log.success(`${users[userKey].name} başarıyla ayrıldı. Ödeme alındı.`);
          if (res.sessionClosed) {
            log.highlight("Masa hesabı tamamen sıfırlandığı için masa oturumu kapatıldı ve boşa çıktı!");
            activeSessionToken = "";
          } else {
            await printTableStatus();
          }
        } catch (err: any) {
          log.error(`Hata: ${err.message}`);
        }
        break;
      }
      case "7": {
        if (!activeSessionToken) {
          log.warn("Aktif oturum bulunamadı.");
          break;
        }
        console.log("\nAyrılacak kullanıcıyı seçin:");
        console.log("1. User 1 (bir@bir.com)");
        console.log("2. User 2 (iki@iki.com)");
        const uChoice = await askQuestion("Kullanıcı: ");
        const userKey = uChoice === "2" ? "iki" : "bir";

        log.warn(`${users[userKey].name} borcunu masaya aktararak (Ödemeden) ayrılıyor...`);
        try {
          const res = await apiCall("/api/table-sessions/leave", "POST", {
            sessionToken: activeSessionToken,
            action: "no-pay",
          }, userKey);
          log.success(`${users[userKey].name} masadan ayrıldı. Borç masanın ortak kalan hesabına aktarıldı.`);
          if (res.sessionClosed) {
            log.highlight("Masa oturumu kapatıldı.");
            activeSessionToken = "";
          } else {
            await printTableStatus();
          }
        } catch (err: any) {
          log.error(`Hata: ${err.message}`);
        }
        break;
      }
      case "8": {
        if (!activeSessionToken) {
          log.warn("Aktif oturum bulunamadı.");
          break;
        }
        console.log("\nÖdeyecek kullanıcıyı seçin:");
        console.log("1. User 1 (bir@bir.com)");
        console.log("2. User 2 (iki@iki.com)");
        const uChoice = await askQuestion("Kullanıcı: ");
        const userKey = uChoice === "2" ? "iki" : "bir";

        log.info(`${users[userKey].name} masanın kalan tüm borcunu ödüyor...`);
        try {
          const res = await apiCall("/api/table-sessions/pay", "POST", {
            sessionToken: activeSessionToken,
            paymentMethod: "card",
            mode: "all",
          }, userKey);
          log.success("Ödeme yapıldı!");
          if (res.sessionClosed) {
            log.highlight("Masa hesabı kapandı, oturum kapatıldı ve masa boşa çıktı!");
            activeSessionToken = "";
          } else {
            await printTableStatus();
          }
        } catch (err: any) {
          log.error(`Hata: ${err.message}`);
        }
        break;
      }
      case "9": {
        const tableNum = await askQuestion("Yeni masa numarası (1-60): ");
        const parsed = parseInt(tableNum.trim());
        if (isNaN(parsed) || parsed < 1 || parsed > 60) {
          log.error("Geçersiz masa numarası.");
        } else {
          activeTable = String(parsed);
          activeSessionToken = "";
          log.success(`Hedef masa Masa ${activeTable} olarak güncellendi.`);
        }
        break;
      }
      case "0": {
        log.info("Simülatör kapatılıyor. İyi çalışmalar!");
        rl.close();
        return;
      }
      default: {
        log.warn("Geçersiz seçim. Lütfen menüdeki numaralardan birini tuşlayın.");
      }
    }
  }
}

// Start simulation
async function run() {
  log.header("BANCHO CAFE - MASA OTURUM SİMÜLATÖRÜ");
  log.muted(`Uygulama Adresi: ${APP_URL}`);
  await loginUsers();
  await fetchProducts();
  await showMenu();
}

run().catch((err) => {
  log.error(`Simülasyon hatası: ${err.message}`);
  process.exit(1);
});
