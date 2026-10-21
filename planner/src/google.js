// Google Places content for the plan page. Google's terms let us store place IDs only, so ratings,
// reviews and photos are fetched live each time a plan page is opened, and shown with their authors' credit.

const FIELDS = "id,displayName,rating,userRatingCount,googleMapsUri,reviews,reviewSummary,photos";
const PHOTO_NAME = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

export async function placeDetails(ids, key) {
  const out = {};
  await Promise.all([...new Set(ids)].map(async id => {
    if (!/^[A-Za-z0-9_-]{10,300}$/.test(id)) return;
    try {
      const r = await fetch(`https://places.googleapis.com/v1/places/${id}`, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
      });
      if (r.ok) out[id] = await r.json();
    } catch {}
  }));
  return out;
}

async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig).slice(0, 12))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Photo links on our pages are signed so nobody can use this service to spend our Google allowance.
export async function photoUrl(name, width, secret) {
  return `/photo?n=${encodeURIComponent(name)}&w=${width}&s=${await hmac(secret, `${name}|${width}`)}`;
}

export async function photoRedirect(url, key) {
  if (!key) return new Response("photos are off", { status: 503 });
  const name = url.searchParams.get("n") || "";
  const width = parseInt(url.searchParams.get("w"), 10);
  if (!PHOTO_NAME.test(name) || !(width > 0 && width <= 1600)) return new Response("bad photo", { status: 400 });
  if (url.searchParams.get("s") !== (await hmac(key, `${name}|${width}`))) return new Response("bad signature", { status: 403 });
  const r = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=${width}&skipHttpRedirect=true`, {
    headers: { "X-Goog-Api-Key": key },
  });
  if (!r.ok) return new Response("photo unavailable", { status: 502 });
  const { photoUri } = await r.json();
  if (!photoUri) return new Response("photo unavailable", { status: 502 });
  // The browser loads the image from Google itself; we never store it.
  return new Response(null, { status: 302, headers: { Location: photoUri, "Cache-Control": "private, max-age=300" } });
}
