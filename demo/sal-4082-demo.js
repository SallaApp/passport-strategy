/**
 * SAL-4082 / PR #115 demo — real express + express-session + passport 0.7.
 * Only Salla's HTTP endpoints (token, profile, orders) are stubbed.
 *
 *   FLOW 1: PR #115 as written      -> callback route has no keepSessionInfo
 *   FLOW 2: PR #115 + proposed fix  -> callback route uses keepSessionInfo: true
 *
 * Run (on the PR #115 branch, so src/ contains the 2.0.0 code):
 *   git checkout bugfix/SAL-4082-passport-strategy-isolate-authentication-state-per-request
 *   npm i --no-save express@4 express-session@1 passport@0.7 supertest@7
 *   node demo/sal-4082-demo.js
 */
const path = require("path");
const express = require("express");
const session = require("express-session");
const { Passport } = require("passport");
const request = require("supertest");

const API = require(path.join(__dirname, "../src/api")); // PR #115 code (run on the PR branch)
const passportVersion = require("passport/package.json").version;

const c = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", b: "\x1b[1m", d: "\x1b[2m", x: "\x1b[0m" };
const log = (...a) => console.log(...a);
const pass = (m) => { log(`   ${c.g}✔ PASS${c.x} ${m}`); return true; };
const fail = (m) => { log(`   ${c.r}✘ FAIL${c.x} ${m}`); return false; };

function buildApp({ keepSessionInfo }) {
  const passport = new Passport();
  const api = new API({ clientID: "c", clientSecret: "s", callbackURL: "http://localhost/oauth/callback" });
  const strat = api.getPassportStrategy();

  // --- stub Salla endpoints ------------------------------------------------
  strat._oauth2.getOAuthAccessToken = (code, p, cb) =>
    cb(null, `access-${code}`, `refresh-${code}`, 3600, {});
  strat.userProfile = (token, done) => done(null, { id: token.replace("access-", "") });
  strat._oauth2._request = (method, url, headers, body, at, cb) => {
    const owner = (headers.Authorization || "").replace("Bearer access-", "");
    cb(null, JSON.stringify({ data: [{ order: `#1001`, store: owner }] }));
  };

  passport.use(strat);
  passport.serializeUser((u, d) => d(null, u));
  passport.deserializeUser((u, d) => d(null, u));

  const app = express();
  app.use(session({ secret: "demo", resave: false, saveUninitialized: true }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use((req, res, next) => api.setExpressVerify(req, res, next));

  const authOpts = { failureRedirect: "/login" };
  if (keepSessionInfo) authOpts.keepSessionInfo = true;
  app.get(["/login", "/oauth/callback"], passport.authenticate("salla", authOpts), (req, res) => res.send("logged in"));

  const ensureAuth = (req, res, next) => (req.isAuthenticated() ? next() : res.status(401).json({ error: "not logged in" }));
  app.get("/orders", ensureAuth, async (req, res) => {
    try {
      res.json({ user: req.user.id, orders: await api.getAllOrders(api.getToken(req)) });
    } catch (e) {
      res.status(500).json({ user: req.user.id, error: e.msg });
    }
  });
  return app;
}

async function loginAs(app, name) {
  const agent = request.agent(app);
  const r0 = await agent.get("/login"); // redirect to Salla, sets OAuth state in session
  const state = new URL(r0.headers.location).searchParams.get("state");
  const r1 = await agent.get(`/oauth/callback?code=${name}&state=${state}`);
  log(`   ${c.d}→ ${name} logs in via Salla OAuth ... HTTP ${r1.status} "${r1.text}"${c.x}`);
  return agent;
}

async function show(agent, who) {
  const r = await agent.get("/orders");
  log(`   ${c.d}→ GET /orders as ${who.padEnd(5)} ... HTTP ${r.status} ${JSON.stringify(r.body)}${c.x}`);
  return r;
}

async function flow(title, keepSessionInfo) {
  log(`\n${c.b}${title}${c.x}`);
  log(`${c.d}   callback route: passport.authenticate("salla", ${JSON.stringify(keepSessionInfo ? { failureRedirect: "/login", keepSessionInfo: true } : { failureRedirect: "/login" })})${c.x}\n`);
  const app = buildApp({ keepSessionInfo });
  const results = [];

  const alice = await loginAs(app, "alice");
  const bob = await loginAs(app, "bob");
  const anon = request.agent(app);
  log("");

  const ra = await show(alice, "alice");
  const rb = await show(bob, "bob");
  const rn = await show(anon, "anon");
  log("");

  results.push(ra.status === 200 && ra.body.orders?.[0]?.store === "alice"
    ? pass("alice gets HER OWN orders")
    : fail(`alice cannot fetch her orders -> ${ra.body.error || ra.status}`));
  results.push(rb.status === 200 && rb.body.orders?.[0]?.store === "bob"
    ? pass("bob gets HIS OWN orders")
    : fail(`bob cannot fetch his orders -> ${rb.body.error || rb.status}`));
  results.push(rn.status === 401
    ? pass("anonymous visitor is rejected (no leaked identity/token)")
    : fail("anonymous visitor got access"));

  const ok = results.every(Boolean);
  log(`\n   RESULT: ${ok ? c.g + "WORKS" : c.r + "BROKEN"}${c.x}`);
  return ok;
}

(async () => {
  log(`${c.b}SAL-4082 / PR #115 — end-to-end demo${c.x}  (passport ${passportVersion}, express-session, Salla endpoints stubbed)`);
  const f1 = await flow("FLOW 1 — PR #115 as written", false);
  const f2 = await flow("FLOW 2 — PR #115 + proposed fix (keepSessionInfo: true)", true);
  log(`\n${c.b}SUMMARY${c.x}`);
  log(`   Flow 1  PR #115 as written      : ${f1 ? c.g + "WORKS" : c.r + "BROKEN — users log in but their Salla token is lost"}${c.x}`);
  log(`   Flow 2  PR #115 + proposed fix  : ${f2 ? c.g + "WORKS — each user isolated, anon rejected" : c.r + "BROKEN"}${c.x}\n`);
})();
