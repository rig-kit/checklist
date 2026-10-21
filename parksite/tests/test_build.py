import json, os, subprocess, sys, tempfile, unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import build

PARK = json.load(open(os.path.join(HERE, "..", "parks", "shady-oaks.json")))


class BuildTests(unittest.TestCase):
    def test_mockup_marks_gaps_and_stays_private(self):
        doc, needs = build.render(PARK)
        self.assertIn("Park to confirm", doc)
        self.assertIn('name="robots" content="noindex, nofollow"', doc)
        self.assertIn("Weekly rate", needs)
        self.assertIn("30 and 50 amp", doc)  # known facts still show
        self.assertNotIn("application/ld+json", doc)

    def test_photos_are_linked_not_copied(self):
        doc, _ = build.render(PARK)
        self.assertIn("https://files.cdn-files-a.com/uploads/9808903/2000_67083e6d24dfc.jpg", doc)
        self.assertIn('referrerpolicy="no-referrer"', doc)

    def test_final_is_blocked_until_a_rate_exists(self):
        with self.assertRaises(SystemExit) as cm:
            build.render(PARK, final=True)
        self.assertIn("at least one rate", str(cm.exception))

    def test_final_leaves_out_unknowns_and_adds_markup(self):
        park = json.loads(json.dumps(PARK))
        park["rates"]["nightly"] = 55
        doc, _ = build.render(park, final=True)
        self.assertNotIn("Park to confirm", doc)
        self.assertNotIn("noindex", doc)
        self.assertIn('"@type": "Campground"', doc)
        self.assertIn("$55", doc)

    def test_text_is_escaped(self):
        park = json.loads(json.dumps(PARK))
        park["name"] = 'Bob\'s <script>alert(1)</script> RV'
        doc, _ = build.render(park)
        self.assertNotIn("<script>alert(1)", doc)
        self.assertIn("&lt;script&gt;", doc)

    def test_cli_writes_site_and_needs(self):
        with tempfile.TemporaryDirectory() as out:
            subprocess.run([sys.executable, os.path.join(HERE, "..", "build.py"), os.path.join(HERE, "..", "parks", "shady-oaks.json"), "--out", out], check=True, capture_output=True)
            self.assertTrue(os.path.exists(os.path.join(out, "shady-oaks", "index.html")))
            needs = json.load(open(os.path.join(out, "shady-oaks", "needs.json")))
            self.assertEqual(needs["park"], "Shady Oaks RV Resort")


if __name__ == "__main__":
    unittest.main()
