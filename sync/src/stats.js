// Anonymous usage counts for the owner: tallies per day, nothing about who sent them.
// Phones send one word ("open", "start", "share", ...); phones decide for themselves whether they are new
// today, this month or ever, so no IDs, IPs or anything else that could tell people apart is sent or kept.

// What a phone may report. "open" may carry the flags new / day / month (first open ever, today, this month).
export const EVENTS = ["open", "start", "done", "share", "join"];
const FLAGS = { new: "phone", day: "dayPhone", month: "monthPhone" };

// The counter names to add one to for a message from a phone, or null if it isn't one we know.
export function countersFor(msg) {
  if (!msg || typeof msg !== "object" || !EVENTS.includes(msg.e)) return null;
  const names = [msg.e];
  if (msg.e === "open") for (const f in FLAGS) if (msg[f] === true) names.push(FLAGS[f]);
  return names;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}

// The owner's key is never stored; only its SHA-256 (STATS_KEY_HASH in wrangler.jsonc).
export async function keyOk(key, hash) {
  if (!key || !hash || key.length > 100) return false;
  return (await sha256(key.trim().toUpperCase())) === hash;
}
