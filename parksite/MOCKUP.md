# "Mock up this park"

The steps Claude follows when asked to mock up a park. Nothing is sent to the park; EL reviews every mockup first.

1. **Find the park.** From a lead on the admin page (name, website) or a website EL gives.
2. **Harvest.** `python3 -I harvest.py URL /tmp/harvest.json` reads the park's own website (robots.txt respected) and saves its text, photo links, booking links and site signals. If it says `blocked` or `error`, use placeholder photos and only what is known; tell EL.
3. **Fill the data file.** Write `parks/<slug>.json` using only what the pages say (see `parks/shady-oaks.json`). Unknown stays `null`. Record where each fact came from in `source_notes`. Never use Google, review-site or Facebook content. Fill `booking_url` and `booking_system` when the site links a booking page (Firefly, Campspot, RoverPass and so on).
4. **Choose photos.** Pick 3 to 6 of the harvested photo links, hero first, and look at each before using it. Photos are linked from the park's site, never copied. Skip people's faces, license plates, and anything stock-looking or clearly not the park.
5. **Build.** `python3 build.py parks/<slug>.json --out dist` writes `dist/<slug>/index.html` and `needs.json` (the park's intake questions).
6. **Look at it.** `node shoot.mjs dist/<slug>/index.html OUT_DIR` makes phone and desktop screenshots and a PDF. Check the phone view before sharing.
7. **Hand to EL** with the three files and the list of gaps. EL decides whether and how to contact the park.
8. **After a "yes"**: send the park the `needs.json` questions as an intake page, rebuild with `--final` once phone, address and a rate are known, and replace linked photos with originals the park supplies.
