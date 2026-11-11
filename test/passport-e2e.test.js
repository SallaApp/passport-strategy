/**
 * End-to-end: full OAuth login through real express + express-session +
 * passport (>= 0.6). Only Salla's HTTP endpoints are stubbed.
 *
 * passport >= 0.6 regenerates the session in req.logIn(); the Salla tokens
 * written to req.session.salla by the verify callback only survive when the
 * callback route uses `keepSessionInfo: true`.
 */
const should = require("should");
const express = require("express");
const session = require("express-session");
const { Passport } = require("passport");
const request = require("supertest");
const API = require("../src/api");

function buildApp({ keepSessionInfo }) {
  const passport = new Passport();
  const api = new API({
    clientID: "client",
    clientSecret: "secret",
    callbackURL: "http://localhost/oauth/callback",
  });
  const strategy = api.getPassportStrategy();

  // stub Salla: token endpoint, user profile, resource API (echoes the bearer)
  strategy._oauth2.getOAuthAccessToken = (code, params, cb) =>
    cb(null, `access-${code}`, `refresh-${code}`, 3600, {});
  strategy.userProfile = (token, done) =>
    done(null, { id: token.replace("access-", "") });
  strategy._oauth2._request = (method, url, headers, body, accessToken, cb) =>
    cb(null, JSON.stringify({ data: [{ authorization: headers.Authorization }] }));

  passport.use(strategy);
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));

  const app = express();
  app.use(session({ secret: "test", resave: false, saveUninitialized: true }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use((req, res, next) => api.setExpressVerify(req, res, next));

  const authOptions = { failureRedirect: "/login" };
  if (keepSessionInfo) authOptions.keepSessionInfo = true;
  app.get(["/login", "/oauth/callback"], passport.authenticate("salla", authOptions), (req, res) =>
    res.send("ok")
  );

  const ensureAuthenticated = (req, res, next) =>
    req.isAuthenticated() ? next() : res.sendStatus(401);
  app.get("/orders", ensureAuthenticated, async (req, res) => {
    try {
      res.json(await api.getAllOrders(api.getToken(req)));
    } catch (err) {
      res.status(500).json(err);
    }
  });

  return app;
}

async function loginAs(app, name) {
  const agent = request.agent(app);
  const redirect = await agent.get("/login").expect(302);
  const state = new URL(redirect.headers.location).searchParams.get("state");
  await agent.get(`/oauth/callback?code=${name}&state=${state}`).expect(200);
  return agent;
}

describe("end-to-end login with real passport (>= 0.6)", function () {
  describe("callback route with keepSessionInfo: true", function () {
    let app, alice, bob;
    beforeEach(async function () {
      app = buildApp({ keepSessionInfo: true });
      alice = await loginAs(app, "alice");
      bob = await loginAs(app, "bob");
    });

    it("each user calls the API with their own token", async function () {
      const a = await alice.get("/orders").expect(200);
      const b = await bob.get("/orders").expect(200);
      a.body[0].authorization.should.equal("Bearer access-alice");
      b.body[0].authorization.should.equal("Bearer access-bob");
    });

    it("an anonymous request is rejected and gets no token", async function () {
      await request(app).get("/orders").expect(401);
    });

    it("logging in again as another user does not affect the first", async function () {
      await loginAs(app, "carol");
      const a = await alice.get("/orders").expect(200);
      a.body[0].authorization.should.equal("Bearer access-alice");
    });
  });

  describe("callback route without keepSessionInfo", function () {
    it("loses the Salla tokens at login (passport >= 0.6 session regeneration)", async function () {
      const app = buildApp({ keepSessionInfo: false });
      const alice = await loginAs(app, "alice");
      const res = await alice.get("/orders").expect(500);
      res.body.msg.should.equal("access token is required");
    });
  });
});
