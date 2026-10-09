// Sync service for the Travel Day Checklist: one Room per shared trailer, joined by a 6-character code.
// Phones keep their own copy and send changes here; the Room applies them in arrival order and sends the
// whole (small) list back to every phone. No accounts, names or emails are stored.
import { DurableObject } from "cloudflare:workers";
import { LIMITS, applyChecked, cleanState } from "./state.js";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
const YEAR = 365 * 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
const RATE = { create: 10, miss: 20 }; // per IP per hour: new trailers, wrong codes

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join("");
}

function allowedOrigin(req, env) {
  const origin = req.headers.get("Origin");
  const list = (env.ALLOWED_ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  return origin && list.includes(origin) ? origin : null;
}

function json(body, status, origin) {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (origin) { headers["Access-Control-Allow-Origin"] = origin; headers["Vary"] = "Origin"; }
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const origin = allowedOrigin(req, env);
    if (req.method === "OPTIONS") {
      if (!origin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET, POST",
        "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" } });
    }
    if (url.pathname === "/") return new Response("Travel Day Checklist sync service\n");
    if (!origin) return json({ error: "origin" }, 403, null);

    const ip = req.headers.get("CF-Connecting-IP") || "local";
    const limiter = env.LIMITER.get(env.LIMITER.idFromName(ip));

    // Share a trailer: make a new code and store this phone's list under it.
    if (url.pathname === "/rooms" && req.method === "POST") {
      if (!(await limiter.take("create", RATE.create))) return json({ error: "busy" }, 429, origin);
      const text = await req.text();
      if (text.length > LIMITS.message) return json({ error: "too big" }, 413, origin);
      let body;
      try { body = JSON.parse(text); } catch { return json({ error: "bad json" }, 400, origin); }
      for (let tries = 0; tries < 5; tries++) {
        const code = newCode();
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (await room.init(body && body.s)) return json({ code }, 200, origin);
      }
      return json({ error: "try again" }, 503, origin);
    }

    // Join check and live connection: /rooms/CODE and /rooms/CODE/ws
    const m = url.pathname.match(/^\/rooms\/([^/]+)(\/ws)?$/);
    if (m && req.method === "GET") {
      const code = m[1].toUpperCase();
      if (await limiter.blocked("miss", RATE.miss)) return json({ error: "busy" }, 429, origin);
      const room = CODE.test(code) ? env.ROOMS.get(env.ROOMS.idFromName(code)) : null;
      if (m[2]) {
        if (req.headers.get("Upgrade") !== "websocket") return json({ error: "websocket only" }, 426, origin);
        const res = room ? await room.fetch(req) : json({ error: "not found" }, 404, origin);
        if (res.status === 404) await limiter.take("miss", Infinity);
        return res;
      }
      if (room && (await room.exists())) return json({ ok: true }, 200, origin);
      await limiter.take("miss", Infinity);
      return json({ error: "not found" }, 404, origin);
    }
    return json({ error: "not found" }, 404, origin);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // Keep-alive pings are answered without waking the room, so they cost nothing.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async load() {
    if (this.s === undefined) {
      const d = await this.ctx.storage.get("d");
      this.s = d ? d.s : null;
    }
    return this.s;
  }

  async persist() {
    await this.ctx.storage.put("d", { s: this.s, t: Date.now() }); // one row per save
  }

  async init(input) {
    if (await this.load()) return false; // code already taken
    this.s = cleanState(input);
    await this.persist();
    await this.ctx.storage.setAlarm(Date.now() + YEAR);
    return true;
  }

  async exists() {
    return !!(await this.load());
  }

  phones(except) {
    return this.ctx.getWebSockets().filter(ws => ws !== except && ws.readyState === WebSocket.OPEN);
  }

  broadcast(msg, except) {
    const text = JSON.stringify(msg);
    for (const ws of this.phones(except)) { try { ws.send(text); } catch {} }
  }

  async fetch(req) {
    if (!(await this.load())) return new Response("not found", { status: 404 });
    if (this.phones().length >= LIMITS.phones) return new Response("full", { status: 429 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const n = this.phones().length;
    server.send(JSON.stringify({ t: "state", s: this.s, n }));
    this.broadcast({ t: "phones", n }, server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) {
    if (typeof data !== "string" || data.length > LIMITS.message) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!(await this.load())) {
      ws.send(JSON.stringify({ t: "gone" }));
      ws.close(1000, "gone");
      return;
    }
    if (msg.t === "ops" && Array.isArray(msg.ops)) {
      let changed = false;
      for (const op of msg.ops.slice(0, LIMITS.ops)) if (applyChecked(this.s, op)) changed = true;
      if (changed) await this.persist();
      const n = this.phones().length;
      ws.send(JSON.stringify({ t: "state", s: this.s, n, ack: msg.ack }));
      if (changed) this.broadcast({ t: "state", s: this.s, n }, ws);
    } else if (msg.t === "retire") {
      // The code was replaced or sharing was ended for everyone: forget this list.
      this.broadcast({ t: "gone" }, ws);
      for (const other of this.phones()) { try { other.close(1000, "gone"); } catch {} }
      await this.ctx.storage.deleteAll();
      this.s = null;
    }
  }

  async webSocketClose(ws) {
    this.broadcast({ t: "phones", n: this.phones(ws).length }, ws);
    try { ws.close(); } catch {}
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }

  // Lists nobody has touched for a year are deleted.
  async alarm() {
    const d = await this.ctx.storage.get("d");
    if (!d) return;
    if (Date.now() - d.t >= YEAR) { await this.ctx.storage.deleteAll(); this.s = null; }
    else await this.ctx.storage.setAlarm(d.t + YEAR);
  }
}

// Per-IP counters kept in memory only (no storage writes); they reset if Cloudflare restarts the object.
export class Limiter extends DurableObject {
  hits = {};

  recent(kind) {
    const cutoff = Date.now() - HOUR;
    const list = (this.hits[kind] || []).filter(t => t > cutoff);
    this.hits[kind] = list;
    return list;
  }

  blocked(kind, max) {
    return this.recent(kind).length >= max;
  }

  take(kind, max) {
    const list = this.recent(kind);
    if (list.length >= max) return false;
    list.push(Date.now());
    return true;
  }
}
