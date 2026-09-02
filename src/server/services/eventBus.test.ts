import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  subscribe,
  publishToUser,
  publishToUsers,
  publishToManagers,
  subscribeAsManager,
  sseConnectionCount,
} from "./eventBus.js";

describe("eventBus (MP-3.1)", () => {
  beforeEach(() => {
    // abonelikler testler arasında sızarsa sayaca yansır; her testte
    // unsubscribe edilen handle'larla tutulur.
  });

  it("kullanıcıya yayın aboneye ulaşır, diğerine ulaşmaz", () => {
    const a = vi.fn();
    const b = vi.fn();
    const un1 = subscribe("u1", a);
    const un2 = subscribe("u2", b);

    publishToUser("u1", "order:created", { orderId: "o1" });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
    un1();
    un2();
  });

  it("abonelik kapatınca yayın alınmaz", () => {
    const a = vi.fn();
    const un = subscribe("u1", a);
    un();
    publishToUser("u1", "ping", {});
    expect(a).not.toHaveBeenCalled();
  });

  it("publishToUsers yinelenen kullanıcıları tek sefer yazar", () => {
    const a = vi.fn();
    const un = subscribe("u1", a);
    publishToUsers(["u1", "u1", "u2"], "n", 1);
    expect(a).toHaveBeenCalledTimes(1);
    un();
  });

  it("yönetici kanalı yalnız manager aboneye yazar", () => {
    const mgr = vi.fn();
    const un = subscribeAsManager(mgr);
    publishToManagers("waiter:called", { table: 5 });
    expect(mgr).toHaveBeenCalledTimes(1);
    un();
  });

  it("bozuk abone diğer dağıtımı bozmaz", () => {
    const bad = () => {
      throw new Error("boom");
    };
    const good = vi.fn();
    const un1 = subscribe("u1", bad);
    const un2 = subscribe("u1", good);
    publishToUser("u1", "t", {});
    expect(good).toHaveBeenCalledTimes(1);
    un1();
    un2();
  });

  it("sseConnectionCount açık abonelik sayısını döner", () => {
    const before = sseConnectionCount();
    const un = subscribe("u-count", () => {});
    expect(sseConnectionCount()).toBe(before + 1);
    un();
    expect(sseConnectionCount()).toBe(before);
  });
});
