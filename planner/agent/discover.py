"""Find RV parks for every stop in an order (Google Places Text Search, New API).

Usage: python3 -I discover.py ORDER.json RUN_DIR

- Search area per stop is sized from the customer's drive-time answer
  (max_drive_min): a box of half-width 0.55 x minutes miles, cut into tiles about
  20 mi wide; a tile that hits Google's 60-result cap is searched again in quarters.
- Two phrases ("RV park", "campground") plus one wider "state park camping"
  search. "RV resort" was dropped: on the Texas test it found nothing the other
  two missed.
- Field mask stays in Text Search Enterprise ($35/1k, 1,000 free a month). Drive
  time is NOT asked inside the search (routingSummaries moves every search to
  Enterprise + Atmosphere, $40/1k); it comes from the Routes matrix instead.
- Filters: closed, mobile home / storage / winery etc., day-use parks, link-only
  listings (Hipcamp, Campendium, RVezy, Facebook), tiny listings, then a free
  straight-line cut (0.7 x minutes miles), then real drive time for the
  survivors (Google Routes; falls back to a straight-line estimate if the key
  can't call Routes).

Writes RUN_DIR/discovery.json (Google content: scratch only, never the shared
folder) and RUN_DIR/run-state.json (place IDs and cut reasons only, safe to
copy to the shared folder).
"""
import json, math, os, sys, time, urllib.error, urllib.request

KEY = os.environ["GOOGLE_PLACES_API_KEY"]
SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
MATRIX_URL = "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix"
FIELDS = ",".join([
    "places.id", "places.displayName", "places.formattedAddress", "places.location",
    "places.types", "places.primaryType", "places.businessStatus", "places.googleMapsUri",
    "places.rating", "places.userRatingCount", "places.websiteUri", "places.nationalPhoneNumber",
    "nextPageToken",
])
QUERIES = ["RV park", "campground"]
JUNK = ["mobile home", "manufactured", " mhp", "apartments", "storage", "winery", "vineyard", "cabin rental", "self storage"]
LINK_ONLY = ("hipcamp.com", "campendium", "rvezy", "facebook.com")
STRAIGHT_K = 0.7      # straight-line miles allowed per drive minute (calibrated on Texas)
MAX_ROUTED = 40       # survivors per stop sent to the Routes matrix, most-reviewed first

calls = {"text_search": 0, "geocode": 0, "route_elements": 0}
log = []


def post(url, body, mask):
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers={
        "Content-Type": "application/json", "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": mask})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def search(query, rect):
    out, token, pages = [], None, 0
    while pages < 3:
        body = {"textQuery": query, "pageSize": 20, "locationRestriction": {"rectangle": rect}}
        if token:
            body["pageToken"] = token
        calls["text_search"] += 1
        d = post(SEARCH_URL, body, FIELDS)
        pages += 1
        out += d.get("places", [])
        token = d.get("nextPageToken")
        if not token:
            break
        time.sleep(2)
    return out, pages


def geocode(town):
    calls["geocode"] += 1
    d = post(SEARCH_URL, {"textQuery": town, "pageSize": 1}, "places.location,places.displayName")
    loc = d["places"][0]["location"]
    return loc["latitude"], loc["longitude"]


def box(lat, lng, half_mi):
    dlat = half_mi / 69.0
    dlng = half_mi / (69.0 * math.cos(math.radians(lat)))
    return lat - dlat, lng - dlng, lat + dlat, lng + dlng


def grid(lat, lng, half_mi):
    n = max(1, math.ceil(2 * half_mi / 20))  # tiles about 20 mi wide; capped ones get split
    s, w, nn, e = box(lat, lng, half_mi)
    for i in range(n):
        for j in range(n):
            yield {"low": {"latitude": s + (nn - s) * i / n, "longitude": w + (e - w) * j / n},
                   "high": {"latitude": s + (nn - s) * (i + 1) / n, "longitude": w + (e - w) * (j + 1) / n}}


def split(r):
    lo, hi = r["low"], r["high"]
    mlat, mlng = (lo["latitude"] + hi["latitude"]) / 2, (lo["longitude"] + hi["longitude"]) / 2
    return [{"low": {"latitude": a, "longitude": c}, "high": {"latitude": b, "longitude": d}}
            for a, b in ((lo["latitude"], mlat), (mlat, hi["latitude"])) for c, d in ((lo["longitude"], mlng), (mlng, hi["longitude"]))]


def rect(lat, lng, half_mi):
    s, w, nn, e = box(lat, lng, half_mi)
    return {"low": {"latitude": s, "longitude": w}, "high": {"latitude": nn, "longitude": e}}


def miles(a, b):
    return math.hypot((a[0] - b[0]) * 69, (a[1] - b[1]) * 69 * math.cos(math.radians(a[0])))


def classify(p):
    name = p.get("displayName", {}).get("text", "").lower()
    types = set(p.get("types", []))
    if p.get("businessStatus") not in (None, "OPERATIONAL"):
        return "closed on Google"
    if any(k in name for k in JUNK):
        return "not an RV park (mobile home, storage, winery, etc.)"
    if not types & {"rv_park", "campground", "state_park", "park"}:
        return "not listed as a campground or RV park"
    if p.get("primaryType") == "mobile_home_park":
        return "mobile home park"
    if "state_park" in types or "state park" in name:
        return None
    if not types & {"rv_park", "campground"} and not any(k in name for k in ("rv", "camp")):
        return "day-use park, no camping"
    if any(h in (p.get("websiteUri") or "") for h in LINK_ONLY):
        return "only listed on a link-only site, can't read"
    if (p.get("userRatingCount") or 0) < 3 and "rv_park" not in types:
        return "single site or tiny listing"
    return None


def drive_minutes(origin, places):
    """{place id: (minutes, miles)} from origin via the Routes matrix, or None if Routes is unavailable."""
    out = {}
    for i in range(0, len(places), 100):
        chunk = places[i:i + 100]
        body = {"origins": [{"waypoint": {"location": {"latLng": {"latitude": origin[0], "longitude": origin[1]}}}}],
                "destinations": [{"waypoint": {"location": {"latLng": p["location"]}}} for p in chunk],
                "travelMode": "DRIVE"}
        try:
            rows = post(MATRIX_URL, body, "originIndex,destinationIndex,duration,distanceMeters,condition")
        except urllib.error.HTTPError as ex:
            print(f"Routes matrix unavailable (HTTP {ex.code}); using straight-line estimates", file=sys.stderr)
            return None
        calls["route_elements"] += len(chunk)
        for r in rows:
            if r.get("condition") == "ROUTE_EXISTS" and r.get("duration"):
                p = chunk[r["destinationIndex"]]
                out[p["id"]] = (round(int(r["duration"].rstrip("s")) / 60), round(r.get("distanceMeters", 0) / 1609.34, 1))
    return out


def main(order_path, run_dir):
    order = json.load(open(order_path))
    os.makedirs(run_dir, exist_ok=True)
    found, state = {}, {"trip": order.get("trip_name"), "stops": {}}
    for st in order["stops"]:
        key, max_min = st["key"], st["max_drive_min"]
        origins = [geocode(t) for t in (st.get("origins") or [st["town"]])]
        lat = sum(o[0] for o in origins) / len(origins)
        lng = sum(o[1] for o in origins) / len(origins)
        half = max(6, 0.55 * max_min)
        if st.get("center"):  # optional hand-placed area, e.g. to keep a dense city out of the box
            (lat, lng), half = st["center"], st.get("half_mi", half)
        per, start = {}, calls["text_search"]
        for q in QUERIES:
            tiles = list(grid(lat, lng, half))
            while tiles:
                t = tiles.pop()
                res, pages = search(q, t)
                log.append({"stop": key, "query": q, "results": len(res), "pages": pages})
                if len(res) >= 60:  # hit Google's cap: search this tile again in quarters
                    tiles += split(t)
                for p in res:
                    per.setdefault(p["id"], dict(p, _queries=[]))
                    if q not in per[p["id"]]["_queries"]:
                        per[p["id"]]["_queries"].append(q)
        res, pages = search("state park camping", rect(lat, lng, half + 10))
        log.append({"stop": key, "query": "state park camping", "results": len(res), "pages": pages})
        for p in res:
            per.setdefault(p["id"], dict(p, _queries=[]))
            per[p["id"]]["_queries"].append("state park camping")

        survivors = []
        for p in per.values():
            loc = (p["location"]["latitude"], p["location"]["longitude"])
            p["_straight_mi"] = round(min(miles(loc, o) for o in origins), 1)
            p["_cut"] = classify(p) or (f"over {max_min} min drive from town" if p["_straight_mi"] > STRAIGHT_K * max_min else None)
            if not p["_cut"]:
                survivors.append(p)
        survivors.sort(key=lambda p: ("rv_park" not in p.get("types", []), -(p.get("userRatingCount") or 0)))
        routed, extra = survivors[:MAX_ROUTED], survivors[MAX_ROUTED:]
        best, est = {}, False
        for o in origins:
            got = drive_minutes(o, routed)
            if got is None:
                est = True
                break
            for pid, (m, mi) in got.items():
                if pid not in best or m < best[pid][0]:
                    best[pid] = (m, mi)
        for p in routed:
            if est:
                p["_drive_min"], p["_drive_est"] = round(p["_straight_mi"] / STRAIGHT_K), True
            elif p["id"] in best:
                p["_drive_min"], p["_drive_mi"] = best[p["id"]]
            if p.get("_drive_min") is not None and p["_drive_min"] > max_min:
                p["_cut"] = f"over {max_min} min drive from town"
        for p in extra:
            p["_note"] = "smaller listing, drive time not checked"
        found[key] = per
        kept = [pid for pid, p in per.items() if not p["_cut"]]
        state["stops"][key] = {"kept": kept, "to_check": [], "cut": {pid: p["_cut"] for pid, p in per.items() if p["_cut"]},
                               "drive_time_estimated": est}
        print(f"{key}: {len(per)} found, {len(kept)} kept, {calls['text_search'] - start} searches", file=sys.stderr)

    json.dump({"found": found, "log": log, "calls": calls}, open(os.path.join(run_dir, "discovery.json"), "w"), indent=1)
    json.dump(state, open(os.path.join(run_dir, "run-state.json"), "w"), indent=1)
    list_price = calls["text_search"] * 0.035 + calls["geocode"] * 0.032 + calls["route_elements"] * 0.005
    print(json.dumps({**calls, "list_price_usd": round(list_price, 2)}))


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
