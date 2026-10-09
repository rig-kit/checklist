// Two "phones" against a running service: `npm run dev` in one terminal, `npm test` in another.
// Skipped when nothing is listening at SYNC_TEST_URL.
import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.SYNC_TEST_URL || "http://localhost:8787";
const ORIGIN = process.env.SYNC_TEST_ORIGIN || "http://localhost:8000";
const up = await fetch(BASE + "/").then(r => r.ok, () => false);
const opts = { skip: up ? false : "sync service not running" };

async function create(s) {
  const r = await fetch(BASE + "/rooms", { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify({ s }) });
  assert.equal(r.status, 200);
  return (await r.json()).code;
}

function phone(code) {
  const ws = new WebSocket(BASE.replace(/^http/, "ws") + "/rooms/" + code + "/ws", { headers: { Origin: ORIGIN } });
  const inbox = [];
  const waiters = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    const w = waiters.findIndex(x => x.match(m));
    if (w >= 0) waiters.splice(w, 1)[0].resolve(m); else inbox.push(m);
  };
  const next = (match = () => true) => {
    const i = inbox.findIndex(match);
    if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
    return new Promise((resolve, reject) => { waiters.push({ match, resolve }); setTimeout(() => reject(new Error("timeout")), 4000); });
  };
  const open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  return { ws, next, open, send: m => ws.send(JSON.stringify(m)) };
}

test("a checkmark on one phone shows up on the other", opts, async () => {
  const code = await create({ trip: 1, name: "Houston > Dallas", checked: { h1: true } });
  assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
  const a = phone(code), b = phone(code);
  await Promise.all([a.open, b.open]);
  const first = await b.next(m => m.t === "state");
  assert.equal(first.s.name, "Houston > Dallas");
  assert.deepEqual(first.s.checked, { h1: true });

  a.send({ t: "ops", ack: 1, ops: [{ t: "check", id: "k1", v: true, trip: 1 }] });
  const mine = await a.next(m => m.ack === 1);
  assert.deepEqual(mine.s.checked, { h1: true, k1: true });
  const theirs = await b.next(m => m.t === "state" && m.s.checked.k1);
  assert.equal(theirs.n, 2);

  b.send({ t: "ops", ack: 7, ops: [{ t: "trip", trip: 2, name: "" }, { t: "name", v: "Dallas > Austin", trip: 2 }] });
  const reset = await a.next(m => m.t === "state" && m.s.trip === 2);
  assert.deepEqual(reset.s.checked, {});
  assert.equal(reset.s.name, "Dallas > Austin");
  a.ws.close(); b.ws.close();
});

test("joining checks the code", opts, async () => {
  const code = await create({});
  const ok = await fetch(BASE + "/rooms/" + code.toLowerCase(), { headers: { Origin: ORIGIN } });
  assert.equal(ok.status, 200);
  const missing = await fetch(BASE + "/rooms/ZZZZZ2", { headers: { Origin: ORIGIN } });
  assert.equal(missing.status, 404);
  const otherSite = await fetch(BASE + "/rooms/" + code, { headers: { Origin: "https://example.com" } });
  assert.equal(otherSite.status, 403);
});

test("retiring a code tells the other phone and forgets the list", opts, async () => {
  const code = await create({});
  const a = phone(code), b = phone(code);
  await Promise.all([a.open, b.open]);
  a.send({ t: "retire" });
  const gone = await b.next(m => m.t === "gone");
  assert.equal(gone.t, "gone");
  const after = await fetch(BASE + "/rooms/" + code, { headers: { Origin: ORIGIN } });
  assert.equal(after.status, 404);
});
