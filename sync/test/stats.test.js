import { test } from "node:test";
import assert from "node:assert/strict";
import { countersFor, keyOk } from "../src/stats.js";

test("only known events are counted, with the phone flags on opens", () => {
  assert.deepEqual(countersFor({ e: "open", new: true, day: true, month: false }), ["open", "phone", "dayPhone"]);
  assert.deepEqual(countersFor({ e: "share", day: true }), ["share"]);
  assert.deepEqual(countersFor({ e: "open", new: "yes" }), ["open"]);
  assert.equal(countersFor({ e: "phone" }), null);
  assert.equal(countersFor(null), null);
  assert.equal(countersFor("open"), null);
});

test("the stats key is checked against its hash", async () => {
  const hash = "f0393febe8baaa55e32f7be2a7cc180bf34e52137d99e056c817a9c07b8f239a"; // sha256("ABCDE")
  assert.equal(await keyOk("ABCDE", hash), true);
  assert.equal(await keyOk(" abcde ", hash), true); // typed in lower case or with spaces still works
  assert.equal(await keyOk("ABCDF", hash), false);
  assert.equal(await keyOk("", hash), false);
  assert.equal(await keyOk(null, hash), false);
});
