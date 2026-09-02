// MP-3.1: süreç-içi olay yayını (pub/sub) — SSE kanalı (/api/events) için
// temel. Kullanıcı bazlı ve rol bazlı kanallar ayrı tutulur; yönetim
// panelleri gerçek zamanlı bildirim alır, müşteri paneli kendi akışını.
// Dağıtık dağıtım (Redis pub/sub vb.) MVP kapsamında değildir — tek süreç
// mimarisiyle (server.ts) uyumludur.

type ServerEvent = {
  type: string;
  payload: unknown;
  at: string;
};

type Listener = (event: ServerEvent) => void;

type ListenerHandle = {
  userId: string;
  listener: Listener;
};

const listeners = new Map<string, Set<Listener>>();

function getChannel(userId: string): Set<Listener> {
  let set = listeners.get(userId);
  if (!set) {
    set = new Set();
    listeners.set(userId, set);
  }
  return set;
}

export function subscribe(userId: string, listener: Listener): () => void {
  getChannel(userId).add(listener);
  return () => {
    const set = listeners.get(userId);
    if (set) {
      set.delete(listener);
      if (set.size === 0) {
        listeners.delete(userId);
      }
    }
  };
}

export function publishToUser(userId: string, type: string, payload: unknown): void {
  const event: ServerEvent = { type, payload, at: new Date().toISOString() };
  const set = listeners.get(userId);
  if (!set) {
    return;
  }
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      // tek bir bozuk abonenin kalan dağıtımı bozmasına izin verilmez
    }
  }
}

export function publishToUsers(userIds: string[], type: string, payload: unknown): void {
  for (const userId of new Set(userIds)) {
    publishToUser(userId, type, payload);
  }
}

export function publishToManagers(type: string, payload: unknown): void {
  // "managers" sanal kanalı: tüm yönetici oturumlarına yayın yapar.
  publishToUser("role:manager", type, payload);
}

export function subscribeAsManager(listener: Listener): () => void {
  return subscribe("role:manager", listener);
}

export function sseConnectionCount(): number {
  let total = 0;
  for (const set of listeners.values()) {
    total += set.size;
  }
  return total;
}

export type { ServerEvent, Listener };
