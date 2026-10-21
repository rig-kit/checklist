"""Build a park's website from its data file.

Usage: python3 build.py parks/shady-oaks.json [--final] [--out dist]

Mockup mode (default): every fact the park hasn't given us shows as a "Park to confirm" tag, the page carries a
private-preview banner and is marked noindex, and dist/<slug>/needs.json lists the gaps (the questions for the
park's intake page). Final mode (--final) leaves unknown facts out, adds search markup, and refuses to build while
the basics (phone, address, at least one rate) are missing.

Photos are linked from the park's own website, never copied; final sites should use originals the park supplies
(set "file": "photos/name.jpg" on a photo and put the file next to the data file).
"""
import html, json, os, shutil, sys
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
e = lambda s: html.escape(str(s), quote=True)
FONTS = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700;9..144,800&family=Source+Sans+3:wght@400;600;700&display=swap"


class Page:
    def __init__(self, park, final):
        self.p, self.final, self.needs = park, final, []

    def val(self, value, what):
        """A fact: its text, or the "Park to confirm" tag in a mockup, or None in a final site."""
        if value not in (None, ""):
            return e(value)
        self.needs.append(what)
        return None if self.final else '<span class="need">Park to confirm</span>'

    def facts(self, items):
        """items: (label, value, what we need). Known facts as rows; gaps as one "Park to confirm" line (mockup only)."""
        rows, gaps = [], []
        for label, value, what in items:
            if value not in (None, ""):
                rows.append(f"<dt>{e(label)}</dt><dd>{e(value)}</dd>")
            else:
                self.needs.append(what or label)
                gaps.append(label)
        out = f'<dl class="facts">{"".join(rows)}</dl>' if rows else ""
        if gaps and not self.final:
            out += f'<p class="gap"><span class="need">Park to confirm</span> {e(", ".join(gaps).lower().capitalize())}</p>'
        return out

    def money(self, v):
        return None if v in (None, "") else (f"${v:,.0f}" if isinstance(v, (int, float)) else v)


def render(park, final=False):
    pg, p = Page(park, final), park
    addr = p["address"]
    one_line = f'{addr["street"]}, {addr["city"]}, {addr["state"]} {addr["zip"]}'
    maps = "https://www.google.com/maps/search/?api=1&query=" + quote(f'{p["name"]} {one_line}')
    tel = "tel:" + "".join(c for c in p["phone"] if c.isdigit() or c == "+")
    book = p.get("booking_url")
    request = f'mailto:{p["email"]}?subject={quote("Stay request: " + p["name"])}&body=' + quote(
        "Hello,\n\nI'd like to ask about a stay.\n\nArrival date:\nDeparture date:\nRig type and length:\nHookups needed (30 or 50 amp):\nPets:\n\nThank you,\n")
    book_href, book_label = (book, "Book online") if book else (request, "Request a stay")

    def img(photo, **attrs):
        src = photo.get("file") or photo["url"]
        extra = "".join(f' {k}="{e(v)}"' for k, v in attrs.items())
        return f'<img src="{e(src)}" alt="{e(photo["alt"])}" referrerpolicy="no-referrer"{extra}>'

    # Rates
    r = p["rates"]
    known, gaps = [], []
    for key, label in (("nightly", "Nightly"), ("weekly", "Weekly"), ("monthly", "Monthly")):
        v = pg.money(r.get(key))
        if v:
            note = f'<div class="n">{e(r["monthly_min_nights"])} night minimum</div>' if key == "monthly" and r.get("monthly_min_nights") else ""
            known.append(f'<div class="card"><div class="k">{label}</div><div class="v">{e(v)}</div>{note}</div>')
        else:
            pg.needs.append(f"{label} rate")
            gaps.append(label)
    if not r.get("electric"):
        pg.needs.append("Electric: included or metered")
        gaps.append("Electric")
    rates_html = f'<div class="cards">{"".join(known)}</div>' if known else ""
    if r.get("electric"):
        rates_html += f'<p class="lead" style="margin:14px 0 0">Electric: {e(r["electric"])}</p>'
    if gaps and not pg.final:
        rates_html += (f'<div class="card wide"><div class="k">Rates</div><p class="gap" style="margin:8px 0 0"><span class="need">Park to confirm</span> '
                       f'{e(", ".join(gaps).capitalize())}</p></div>')

    # Sites
    sites = []
    for s in p["sites"]:
        body = pg.facts([
            ("Pad surface", s.get("surface"), f'{s["name"]}: pad surface'),
            ("Length", f'{s["length_ft"]} ft' if s.get("length_ft") else None, f'{s["name"]}: length'),
            ("Width", f'{s["width_ft"]} ft' if s.get("width_ft") else None, f'{s["name"]}: width'),
            ("Power", s.get("amps") and f'{s["amps"]} amp', f'{s["name"]}: amps'),
            ("Hookups", s.get("hookups"), f'{s["name"]}: hookups'),
        ])
        sites.append(f'<div class="site"><h3>{e(s["name"])}</h3>{body}</div>')

    # Long stays and rules
    ru = p["rules"]
    long_block = pg.facts([
        ("Monthly rate", pg.money(r.get("monthly")), "Monthly rate"),
        ("Minimum nights for monthly", r.get("monthly_min_nights"), "Monthly minimum nights"),
        ("Electric billing", r.get("electric"), "Electric billing for long stays"),
    ])
    rule_block = pg.facts([
        ("Longest rig we take", ru.get("max_rig_length"), "Maximum rig length"),
        ("Rig age rules", ru.get("age_rule"), "Rig age rules"),
        ("Getting a big rig in", ru.get("big_rig_access"), "Big-rig access (entrance, turns)"),
        ("Open sky for satellite internet", ru.get("open_sky"), "Open sky / Starlink"),
        ("Pets", ru.get("pets"), "Pet policy"),
        ("Quiet hours", ru.get("quiet_hours"), "Quiet hours"),
        ("Check-in and check-out", ru.get("check_in"), "Check-in and check-out times"),
    ])

    amen = "".join(f"<li>{e(a)}</li>" for a in p["amenities"])
    gallery = "".join(f'<figure>{img(ph, loading="lazy")}<figcaption>{e(ph["caption"])}</figcaption></figure>' for ph in p["photos"])
    chips = "".join(f"<li>{e(c)}</li>" for c in p["chips"])
    hours = f'<dt>Office hours</dt><dd>{e(p["hours"])}</dd>' if p.get("hours") else ""
    if not p.get("hours"):
        pg.needs.append("Office hours")

    banner = "" if final else (
        f'<div class="preview"><b>Preview made for {e(p["name"])} by RigKit.</b> Not live. Photos are from your current website, '
        "and anything marked \"Park to confirm\" is a fact we couldn't find.</div>")
    head_extra = ""
    if not final:
        head_extra = '<meta name="robots" content="noindex, nofollow">'
    else:
        ld = {"@context": "https://schema.org", "@type": "Campground", "name": p["name"], "telephone": p["phone"],
              "address": {"@type": "PostalAddress", "streetAddress": addr["street"], "addressLocality": addr["city"],
                          "addressRegion": addr["state"], "postalCode": addr["zip"], "addressCountry": "US"},
              "image": [ph.get("url") for ph in p["photos"] if ph.get("url")]}
        head_extra = f'<script type="application/ld+json">{json.dumps(ld)}</script>'

    if final:
        missing = [w for w in ("phone", "address") if not p.get(w)]
        if not any(r.get(k) for k in ("nightly", "weekly", "monthly")):
            missing.append("at least one rate")
        if missing:
            raise SystemExit("Final build blocked, still needed from the park: " + ", ".join(missing))

    doc = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(p["name"])} | RV park in {e(p["region"])}</title>
<meta name="description" content="{e(p["lede"])}">{head_extra}
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{FONTS}">
<style>{open(os.path.join(HERE, "site.css")).read()}</style></head>
<body>
{banner}
<header class="top"><div class="wrap"><a class="brand" href="#top">{e(p["name"])}</a>
<nav class="navlinks" aria-label="Sections"><a href="#sites">Sites and rates</a><a href="#long">Long stays</a><a href="#rules">Rig fit</a><a href="#photos">Photos</a><a href="#visit">Find us</a></nav>
<a class="btn small" href="{e(tel)}">Call<span class="num"> {e(p["phone"])}</span></a></div></header>

<main id="top">
<div class="hero">{img(p["photos"][0], fetchpriority="high")}
<div class="hero-in"><div class="wrap">
<p class="eyebrow">{e(p["region"])}</p>
<h1>{e(p["name"])}</h1>
<p class="lede">{e(p["lede"])}</p>
<div class="cta"><a class="btn warm" href="{e(book_href)}">{book_label}</a><a class="btn ghost" href="{e(tel)}">Call {e(p["phone"])}</a></div>
<ul class="chips">{chips}</ul></div></div></div>

<section id="sites"><div class="wrap">
<p class="eyebrow">Sites and rates</p><h2>What it costs and what fits</h2>
<p class="lead">Rates and site details, so you know before you call.</p>
{rates_html}
<div class="sitegrid" style="margin-top:16px">{"".join(sites)}</div>
</div></section>

{'<section id="long"><div class="wrap"><p class="eyebrow">Long stays</p><h2>Staying a month or more</h2><p class="lead">Monthly stays, minimums and how electric is billed.</p><div class="panel">' + long_block + '</div></div></section>' if long_block else ""}

{'<section id="rules"><div class="wrap"><p class="eyebrow">Rig fit and rules</p><h2>Will my rig fit?</h2><p class="lead">The things RVers usually call to ask.</p><div class="panel">' + rule_block + '</div></div></section>' if rule_block else ""}

<section id="photos"><div class="wrap">
<p class="eyebrow">Amenities and photos</p><h2>Around the park</h2>
<p class="lead" style="margin-bottom:14px">On site:</p><ul class="amen">{amen}</ul>
<div class="gallery">{gallery}</div>
</div></section>

<section id="visit"><div class="wrap"><div class="visit">
<div><p class="eyebrow">Find us</p><h2>Come spend time with us</h2>
<address style="margin-top:14px">{e(addr["street"])}<br>{e(addr["city"])}, {e(addr["state"])} {e(addr["zip"])}</address>
<dl class="facts" style="margin-top:14px">{hours}<dt>Phone</dt><dd><a href="{e(tel)}">{e(p["phone"])}</a></dd><dt>Email</dt><dd><a href="mailto:{e(p["email"])}">{e(p["email"])}</a></dd></dl>
<div class="row"><a class="btn" href="{e(book_href)}">{book_label}</a><a class="btn dark" href="{e(maps)}">Get directions</a></div></div>
<div class="panel"><h3>Planning a stay?</h3><p class="lead" style="margin:8px 0 0">Tell us your dates, your rig and your pets, and the office will get back to you.{'' if book else ' Tap Request a stay and your email app opens with the questions filled in.'}</p></div>
</div></div></section>
</main>

<footer><div class="wrap">&copy; {e(p["name"])}. {e(one_line)}.{'' if final else ' Preview mockup by <a href="https://rig-kit.github.io/checklist/">RigKit</a>, a full-time RVer.'}</div></footer>

<nav class="bar" aria-label="Quick actions"><a href="{e(tel)}">Call</a><a class="main" href="{e(book_href)}">{book_label}</a><a href="{e(maps)}">Directions</a></nav>
</body></html>
"""
    return doc, sorted(set(pg.needs), key=pg.needs.index)


def main(argv):
    args = [a for a in argv if not a.startswith("--")]
    final = "--final" in argv
    out = argv[argv.index("--out") + 1] if "--out" in argv else "dist"
    if "--out" in argv:
        args.remove(out)
    park = json.load(open(args[0]))
    doc, needs = render(park, final)
    dest = os.path.join(out, park["slug"])
    os.makedirs(dest, exist_ok=True)
    open(os.path.join(dest, "index.html"), "w").write(doc)
    json.dump({"park": park["name"], "needs": needs}, open(os.path.join(dest, "needs.json"), "w"), indent=1)
    for ph in park["photos"]:  # photos supplied by the park live beside the data file
        if ph.get("file"):
            target = os.path.join(dest, ph["file"])
            os.makedirs(os.path.dirname(target), exist_ok=True)
            shutil.copy(os.path.join(os.path.dirname(args[0]), ph["file"]), target)
    print(f"{dest}/index.html built ({'final' if final else 'mockup'}); {len(needs)} facts still needed from the park")


if __name__ == "__main__":
    main(sys.argv[1:])
