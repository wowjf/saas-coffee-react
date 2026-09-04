// SİMÜLASYON: Masa oturumu kilit ihlali denetimi (madde 1).
// Senaryo: müşteri masa oturumuna katılır, ardından (1) oturum token'ı
// OLMADAN normal sipariş, (2) kendi olmadığı başka oturumun token'ı ile
// sipariş, (3) oturumdan ayrıldıktan sonra token'la sipariş dener.
// Beklenti: aktif oturum katılımcısıyken (1) ve (2) reddedilmeli; (3) zaten
// reddediliyor (katılımcılık kontrolü). Kalıcı 403 gelene dek betik "AÇIK"
// raporlar.
// Kullanım: npx tsx scripts/simulate-table-lock.ts  (sim-server.ts :3999 açık)
const BASE = "http://localhost:3999";

interface SeedInfo {
  ids: { managerId: string; staffId: string; espressoId: string; latteId: string };
  creds: { manager: { email: string; password: string }; staff: { email: string; password: string } };
}

interface RegisterResponse {
  token: string;
  user: { id?: string; _id?: string };
}

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

async function registerCustomer(email: string, phone: string): Promise<{ token: string; userId: string }> {
  const r = await api("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: "Sim", surname: "Musteri", username: email.split("@")[0].replace(/[^a-z0-9_]/g, ""),
      gender: "female", email, password: "Musteri123!", phone,
      birthDate: "1995-01-01",
    }),
  });
  if (r.status !== 200 && r.status !== 201) throw new Error(`register failed (${email}): ${r.status} ${JSON.stringify(r.body)}`);
  const resp = r.body as RegisterResponse;
  return { token: resp.token, userId: (resp.user?.id ?? resp.user?._id ?? "").toString() };
}

async function main() {
  console.log("[table-lock] sim sunucusuna bağlanılıyor…");
  await api("/__sim/reset", { method: "POST" });
  const seedResp = await api("/__sim/seed", { method: "POST" });
  if (!seedResp.body?.ids) throw new Error(`seed failed: ${seedResp.status} ${JSON.stringify(seedResp.body)}`);
  const seed = seedResp.body as SeedInfo;

  // İki müşteri: biri masa sahibi, biri dışarıdan
  const host = await registerCustomer("host@sim.test", "05001110001");
  const outsider = await registerCustomer("outsider@sim.test", "05001110002");
  const hostToken = host.token;
  const outsiderToken = outsider.token;

  // Manager girişi → host'a bakiye yükle (sipariş bakiye kontrolüne takılmasın)
  const managerLogin = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(seed.creds.manager),
  });
  if (managerLogin.status !== 200) throw new Error(`manager login failed: ${managerLogin.status}`);
  // Login sonrası manager sessionRole=null başlar; manager'a yükselt
  const roleElevate = await api("/api/auth/session-role", {
    method: "POST",
    body: JSON.stringify({ role: "manager" }),
    headers: { Authorization: `Bearer ${managerLogin.body.token}` },
  });
  if (roleElevate.status !== 200) throw new Error(`manager role elevate failed: ${roleElevate.status} ${JSON.stringify(roleElevate.body)}`);
  const topUp = await api(`/api/users/${host.userId}/balance`, {
    method: "POST",
    body: JSON.stringify({ amount: 500 }),
    headers: { Authorization: `Bearer ${managerLogin.body.token}` },
  });
  if (topUp.status !== 200) throw new Error(`host balance top-up failed: ${topUp.status} ${JSON.stringify(topUp.body)}`);

  const findings: { name: string; ok: boolean; detail: string }[] = [];
  const record = (name: string, ok: boolean, detail: string) => {
    findings.push({ name, ok, detail });
    console.log(`${ok ? "✓" : "✗ AÇIK"}  ${name} — ${detail}`);
  };

  // Host 1 numaralı masaya katılır
  const join = await api("/api/table-sessions/join-or-create", {
    method: "POST",
    body: JSON.stringify({ tableNumber: "1" }),
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  if ((join.status !== 200 && join.status !== 201) || !join.body?.session?.sessionToken) {
    throw new Error(`join failed: ${join.status} ${JSON.stringify(join.body)}`);
  }
  const sessionToken: string = join.body.session.sessionToken;

  // Saldırı 1: aktif oturum katılımcısı token'sız normal sipariş verir
  const bare = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({ items: [{ productId: seed.ids.espressoId, quantity: 1 }], total: 40 }),
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  record(
    "aktif oturumda token'sız sipariş reddi",
    bare.status === 403 || bare.status === 400,
    `beklenen 403/400, alınan ${bare.status} ${bare.body?.message ?? ""}`,
  );

  // Saldırı 2: outsider kendi oturumu yokken masa oturumunun token'ıyla
  // sipariş verir (katılımcı değil)
  const hijack = await api("/api/orders", {
    method: "POST",
    body: JSON.stringify({
      items: [{ productId: seed.ids.espressoId, quantity: 1 }],
      total: 40,
      tableSessionToken: sessionToken,
    }),
    headers: { Authorization: `Bearer ${outsiderToken}` },
  });
  record(
    "katılımcı olmayanın oturum token'ı ile siparişi reddi",
    hijack.status === 403 || hijack.status === 400,
    `beklenen 403/400, alınan ${hijack.status} ${hijack.body?.message ?? ""}`,
  );

  // Kontrol 3: host ayrıldıktan sonra token'la sipariş (mevcut koruma)
  const leave = await api("/api/table-sessions/leave", {
    method: "POST",
    body: JSON.stringify({ sessionToken, action: "no-pay" }),
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  if (leave.status === 200) {
    const after = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        items: [{ productId: seed.ids.espressoId, quantity: 1 }],
        total: 40,
        tableSessionToken: sessionToken,
      }),
      headers: { Authorization: `Bearer ${hostToken}` },
    });
    record(
      "ayrılan katılımcının token'la siparişi reddi (mevcut koruma)",
      after.status === 403 || after.status === 400 || after.status === 404,
      `beklenen 403/400/404, alınan ${after.status} ${after.body?.message ?? ""}`,
    );
  } else {
    record("oturumdan çıkış akışı", false, `leave ${leave.status}: ${leave.body?.message ?? ""}`);
  }

  const holes = findings.filter((f) => !f.ok);
  console.log(`\n[table-lock] sonuç: ${findings.length - holes.length}/${findings.length} koruma sağlam`);
  if (holes.length > 0) {
    console.log("[table-lock] DÜZELTİLMESİ GEREKEN AÇIKLAR YUKARIDA '✗ AÇIK' ile işaretli.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[table-lock] fatal:", err.message);
  console.error("[table-lock] önce `npx tsx scripts/sim-server.ts` çalıştırın.");
  process.exit(2);
});
