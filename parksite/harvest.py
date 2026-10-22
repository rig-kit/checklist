"""Collect what a park's own website says, as raw material for its data file.

Usage: python3 harvest.py URL OUT.json [max_pages]

Honors robots.txt (a blocked or unreachable site writes {"status": "blocked"|"error"} and nothing else). Reads the home
page plus up to max_pages (default 6) same-site pages and saves each page's text, the photo URLs it links (not the photos),
booking-software links, the site's SITE SIGNALS, and any email addresses and phone numbers shown. Claude then fills
parks/<slug>.json from this, recording only what the pages say.
"""
import datetime, html, json, re, sys, urllib.parse, urllib.request, urllib.robotparser

UA = "RigKitPlannerBot/0.1 (+mailto:rigkit31@gmail.com)"
BOOKING = ("campspot", "roverpass", "fireflyreservations", "newbook", "rmscloud", "resnexus", "campground-commander", "camplife",
           "checkfront", "bookingcenter", "reserveamerica", "recreation.gov", "staylist", "campsitebooking", "thousandtrails", "sitelink", "xola")
SKIP_IMG = re.compile(r"icon|logo|favicon|sprite|pwa|badge|avatar|pixel|spacer|\bwidth=\d{1,2}\b|[?&]w=\d{1,2}(&|$)", re.I)
PHOTO = re.compile(r"\.(?:jpe?g|png|webp)(?:[?#][^\s\"'<>)]*)?$", re.I)


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read(3_000_000).decode("utf-8", "replace"), r.geturl()


def text_of(raw):
    t = re.sub(r"(?is)<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", raw)
    t = re.sub(r"(?i)<br\s*/?>|</(p|div|li|tr|h\d)>", "\n", t)
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    lines, seen = [], set()
    for line in (re.sub(r"[ \t]+", " ", l).strip() for l in t.splitlines()):
        if line and (line not in seen or len(line) > 60):
            seen.add(line); lines.append(line)
    return "\n".join(lines)


def signals(raw, final):
    years = [int(y) for y in re.findall(r"(?:©|&copy;|copyright)\D{0,12}(?:(?:19|20)\d\d\s*[-–]\s*)?((?:19|20)\d\d)", raw, re.I)
             if 1995 <= int(y) <= datetime.date.today().year]
    gen = re.search(r'<meta[^>]+name=["\']generator["\'][^>]+content=["\']([^"\']{1,60})', raw, re.I)
    return {"https": final.startswith("https://"), "mobile_viewport": bool(re.search(r'<meta[^>]+name=["\']viewport', raw, re.I)),
            "copyright_year": max(years) if years else None, "generator": gen.group(1) if gen else None}


def main(url, out, max_pages=6):
    url = url.replace("http://", "https://", 1)
    u = urllib.parse.urlparse(url)
    rp = urllib.robotparser.RobotFileParser()
    try:
        rp.parse(fetch(f"{u.scheme}://{u.netloc}/robots.txt")[0].splitlines())
    except Exception:
        pass
    if rp.default_entry is not None or rp.entries:
        if not rp.can_fetch(UA, url):
            json.dump({"status": "blocked", "url": url}, open(out, "w")); print("ROBOTS_BLOCKED", url); return
    host = u.netloc.replace("www.", "")
    queue, seen, pages, images, booking = [url], set(), [], [], set()
    emails, phones, sig = set(), set(), None
    while queue and len(pages) < max_pages:
        page = queue.pop(0)
        if page in seen or not rp.can_fetch(UA, page):
            continue
        seen.add(page)
        try:
            raw, final = fetch(page)
        except Exception as ex:
            if not pages:
                json.dump({"status": "error", "url": url, "detail": str(ex)[:200]}, open(out, "w")); print("FETCH_ERROR", ex); return
            continue
        sig = sig or signals(raw, final)
        pages.append({"url": final, "text": text_of(raw)[:9000]})
        emails |= {m for m in re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+[a-z]", raw, re.I) if not re.search(r"\.(png|jpe?g|webp|gif|svg)$", m, re.I)}
        phones |= set(re.findall(r"(?:\+1[ -]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]\d{4}", text_of(raw)))
        for src in re.findall(r'(?:src|data-src|content|href|data-lazy-src)=["\'](https?://[^"\']+|/[^"\']+)', raw, re.I) + \
                   re.findall(r'url\(["\']?([^)"\']+)', raw, re.I) + [s.split()[0] for g in re.findall(r'srcset=["\']([^"\']+)', raw, re.I) for s in g.split(",") if s.strip()]:
            full = urllib.parse.urljoin(final, html.unescape(src))
            if PHOTO.search(full) and not SKIP_IMG.search(full) and full not in images:
                images.append(full)
            if any(b in full.lower() for b in BOOKING):
                booking.add(full)
        for h in re.findall(r'href=["\']([^"\'#]+)', raw, re.I):
            full = urllib.parse.urljoin(final, html.unescape(h)).split("#")[0]
            pu = urllib.parse.urlparse(full)
            if any(b in full.lower() for b in BOOKING):
                booking.add(full)
            elif pu.netloc.replace("www.", "") == host and not PHOTO.search(full) and not re.search(r"\.(pdf|css|js|ico|svg|xml)$", full, re.I) and full not in seen:
                queue.append(full)
    json.dump({"status": "ok", "url": url, "read_on": datetime.date.today().isoformat(), "signals": sig, "pages": pages,
               "photos": images[:40], "booking_links": sorted(booking)[:10], "emails": sorted(emails)[:6], "phones": sorted(phones)[:6]},
              open(out, "w"), indent=1)
    print(f"ok: {len(pages)} pages, {len(images)} photo links, booking links: {len(booking)}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 6)
