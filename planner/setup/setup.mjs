// Creates or updates everything the planner needs on Anthropic's side, then writes their IDs to src/setup-ids.js
// so the Worker deploy picks them up. Safe to run on every deploy: it finds things by name and only changes
// what differs. Needs ANTHROPIC_API_KEY and GOOGLE_PLACES_API_KEY in the environment.
//
//   - Environment "rigkit-planner": a cloud container with open internet (park websites can be anywhere).
//   - Vault "RigKit planner": the Google key as an environment-variable credential. The agent's container
//     only ever sees a placeholder; Anthropic swaps in the real key on requests to Google's hosts.
//   - Files: the scripts in agent/, mounted at /mnt/session/uploads/rigkit/.
//   - Agents: "RigKit Park Reader" (Haiku, reads park websites) and "RigKit Trip Planner" (Opus, runs the job).
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const here = p => fileURLToPath(new URL(p, import.meta.url));
const client = new Anthropic();
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!GOOGLE_KEY) throw new Error("GOOGLE_PLACES_API_KEY is not set");

const ENV_NAME = "rigkit-planner";
const VAULT_NAME = "RigKit planner";
const SCRIPTS = ["discover.py", "getpage.py"];

async function findAll(page, pred) {
  const out = [];
  for await (const x of page) if (pred(x)) out.push(x);
  return out;
}

async function environment() {
  const [found] = await findAll(client.beta.environments.list(), x => x.name === ENV_NAME && !x.archived_at);
  if (found) return found.id;
  const env = await client.beta.environments.create({
    name: ENV_NAME,
    description: "RigKit trip planner: reads RV parks' own websites, so it needs open internet.",
    config: { type: "cloud", networking: { type: "unrestricted" } },
  });
  console.log("created environment", env.id);
  return env.id;
}

async function vault() {
  let [v] = await findAll(client.beta.vaults.list(), x => x.display_name === VAULT_NAME && !x.archived_at);
  if (!v) {
    v = await client.beta.vaults.create({ display_name: VAULT_NAME });
    console.log("created vault", v.id);
  }
  const auth = {
    type: "environment_variable",
    networking: { type: "limited", allowed_hosts: ["places.googleapis.com", "routes.googleapis.com"] },
    injection_location: { header: true, body: false },
  };
  const [cred] = await findAll(client.beta.vaults.credentials.list(v.id),
    c => c.auth && c.auth.secret_name === "GOOGLE_PLACES_API_KEY" && !c.archived_at);
  if (cred) {
    await client.beta.vaults.credentials.update(cred.id, { vault_id: v.id, auth: { ...auth, secret_value: GOOGLE_KEY } });
  } else {
    await client.beta.vaults.credentials.create(v.id, {
      display_name: "Google Maps key (Places + Routes)",
      auth: { ...auth, secret_name: "GOOGLE_PLACES_API_KEY", secret_value: GOOGLE_KEY },
    });
    console.log("added Google key to vault");
  }
  return v.id;
}

async function files() {
  const out = [];
  const existing = await findAll(client.beta.files.list(), () => true);
  for (const name of SCRIPTS) {
    const body = readFileSync(here(`../agent/${name}`));
    const tag = `rigkit-${createHash("sha256").update(body).digest("hex").slice(0, 10)}-${name}`;
    let f = existing.find(x => x.filename === tag);
    if (!f) {
      f = await client.beta.files.upload({ file: new File([body], tag, { type: "text/plain" }) });
      console.log("uploaded", tag, f.id);
    }
    out.push({ file_id: f.id, mount_path: `/rigkit/${name}` });
  }
  return out;
}

const TOOLS = (enabled) => [{
  type: "agent_toolset_20260401",
  default_config: { enabled: false, permission_policy: { type: "always_allow" } },
  configs: enabled.map(name => ({ name, enabled: true })),
}];

async function agent(spec) {
  const [found] = await findAll(client.beta.agents.list(), x => x.name === spec.name && !x.archived_at);
  if (!found) {
    const a = await client.beta.agents.create(spec);
    console.log("created agent", spec.name, a.id);
    return a.id;
  }
  // Re-sent on every deploy so the agent always matches agent/*.md; each update is a new version number.
  const a = await client.beta.agents.update(found.id, spec);
  console.log("updated agent", spec.name, a.id, "version", a.version);
  return a.id;
}

const readerId = await agent({
  name: "RigKit Park Reader",
  description: "Fast, low-cost reader of RV parks' own websites. Give it a park list file, an outfile path, the customer paragraph and the stay dates; it reads each park's site with getpage.py and writes one JSON record per park.",
  model: { id: "claude-haiku-5-5" },
  system: readFileSync(here("../agent/reader-system.md"), "utf8"),
  tools: TOOLS(["bash", "read", "write", "glob", "grep"]),
});

const plannerId = await agent({
  name: "RigKit Trip Planner",
  description: "Builds a RigKit RV trip plan from an order: finds parks with Google, has their websites read, and picks three options per stop.",
  model: { id: "claude-opus-5-5", effort: "high" },
  system: readFileSync(here("../agent/planner-system.md"), "utf8"),
  tools: TOOLS(["bash", "read", "write", "edit", "glob", "grep"]),
  multiagent: { type: "coordinator", agents: [readerId] },
});

const ids = {
  environment_id: await environment(),
  vault_id: await vault(),
  agent_id: plannerId,
  files: await files(),
};
writeFileSync(here("../src/setup-ids.js"),
  `// Written by setup/setup.mjs at deploy time. Do not edit by hand.\nexport default ${JSON.stringify(ids, null, 2)};\n`);
console.log(JSON.stringify(ids));
