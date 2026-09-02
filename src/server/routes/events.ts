// MP-3.1: SSE (Server-Sent Events) realtime kanalı — GET /api/events.
// Bearer token EventSource'ın header ekleyememesi nedeniyle ?token= sorgu
// parametresiyle de kabul edilir (attachSseAuth). Bağlantı 25 sn'de bir
// yorum satırı ile canlı tutulur; istemci koptuğunda abonelik kapanır.
import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import UserModel from "../models/User.js";
import { getEffectiveRole } from "../middleware/auth.js";
import { subscribe, subscribeAsManager } from "../services/eventBus.js";

const router = Router();

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice(7);
  }
  const query = (req.query as { token?: string }).token;
  return typeof query === "string" && query.length > 0 ? query : null;
}

async function resolveUser(req: Request) {
  const token = readToken(req);
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ["HS256"],
    }) as { userId: string };
    const user = await UserModel.findById(decoded.userId).lean();
    return user ? { userId: String(user._id), role: getEffectiveRole(user) } : null;
  } catch {
    return null;
  }
}

router.get("/events", async (req: Request, res: Response) => {
  const identity = await resolveUser(req);
  if (!identity) {
    return res.status(401).json({ message: "Yetkilendirme gerekli." });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write(": connected\n\n");

  const send = (event: { type: string; payload: unknown; at: string }) => {
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };

  const unsubscribeUser = subscribe(identity.userId, send);
  const unsubscribeManager =
    identity.role === "manager" ? subscribeAsManager(send) : null;

  const heartbeat = setInterval(() => {
    res.write(": heartbeat\n\n");
  }, 25000);

  const close = () => {
    clearInterval(heartbeat);
    unsubscribeUser();
    unsubscribeManager?.();
  };

  req.on("close", close);
  res.on("close", close);
});

export default router;
