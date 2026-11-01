const should = require("should");
const sinon = require("sinon");
const API = require("../src/api");

const mk = () => new API({ clientID: "a", clientSecret: "b", callbackURL: "http://x/cb" });
const verify = (api) => api._strategy._verify;
const login = (api, req, token, refresh, user) =>
  new Promise((resolve) =>
    verify(api)(req, token, refresh, 3600, user, (e, u) => resolve(u))
  );
const run = (api, req) => new Promise((r) => api.setExpressVerify(req, {}, r));

describe("API per-request auth isolation", function () {
  let api, alice, bob, anon;
  beforeEach(async function () {
    api = mk();
    alice = { originalUrl: "/", query: {}, session: {} };
    bob = { originalUrl: "/", query: {}, session: {} };
    anon = { originalUrl: "/", query: {}, session: {} };
    // interleaved logins on the same shared instance
    await Promise.all([
      login(api, alice, "tA", "rA", { id: "alice" }),
      login(api, bob, "tB", "rB", { id: "bob" }),
    ]);
  });

  it("keeps each session's user and tokens separate", async function () {
    await run(api, alice);
    await run(api, bob);
    alice.user.id.should.equal("alice");
    alice.salla.token.should.equal("tA");
    alice.salla.refreshToken.should.equal("rA");
    bob.user.id.should.equal("bob");
    bob.salla.token.should.equal("tB");
    bob.salla.refreshToken.should.equal("rB");
  });

  it("leaves a request without a session unauthenticated", async function () {
    await run(api, anon);
    should.not.exist(anon.user);
    should.not.exist(anon.salla);
    should.not.exist(api.getToken(anon));
    should.not.exist(api.getToken({ originalUrl: "/" }));
    await run(api, { originalUrl: "/" }); // no session middleware at all
  });

  it("skips login and oauth routes", async function () {
    const req = { originalUrl: "/oauth/callback", session: alice.session };
    await run(api, req);
    should.not.exist(req.user);
  });

  it("rejects resource calls without an explicit token", async function () {
    const stub = sinon.stub(api._strategy._oauth2, "_request");
    for (const call of [
      () => api.getAllOrders(),
      () => api.getAllCustomers(),
      () => api.getResourceOwner(),
      () => api.fetchResource({ url: "u" }),
      () => api.requestNewAccessToken(),
    ]) {
      let err;
      await call().catch((e) => (err = e));
      should.exist(err);
    }
    stub.called.should.equal(false);
  });

  it("sends only the given token as Authorization header", async function () {
    const stub = sinon
      .stub(api._strategy._oauth2, "_request")
      .callsFake((m, u, h, a, b, cb) => cb(null, JSON.stringify({ data: [h.Authorization] })));
    (await api.getAllOrders(api.getToken(alice)))[0].should.equal("Bearer tA");
    (await api.getAllCustomers(api.getToken(bob)))[0].should.equal("Bearer tB");
    (await api.fetchResource({ url: "u", token: "tA" }))[0].should.equal("Bearer tA");
    stub.restore();
  });

  it("upstream error does not clear any session", async function () {
    const stub = sinon
      .stub(api._strategy._oauth2, "_request")
      .callsFake((m, u, h, a, b, cb) => cb(new Error("boom")));
    await api.getAllOrders("tA").catch(() => {});
    await api.getResourceOwner("tA").catch(() => {});
    await api.fetchResource({ url: "u", token: "tA" }).catch(() => {});
    await api.getAllCustomers("tA").catch(() => {});
    stub.restore();
    api.getToken(alice).should.equal("tA");
    api.getToken(bob).should.equal("tB");
  });

  it("logout only clears the owning session", function () {
    api.logout(alice);
    should.not.exist(api.getToken(alice));
    api.getToken(bob).should.equal("tB");
    api.logout(); // no req is a no-op
  });

  it("refresh only updates the owning session", async function () {
    const refresh = require("passport-oauth2-refresh");
    const stub = sinon
      .stub(refresh, "requestNewAccessToken")
      .callsFake((n, rt, cb) => cb(null, "tA2", "rA2"));
    await api.requestNewAccessToken(api.getRefreshToken(alice), alice);
    stub.restore();
    api.getToken(alice).should.equal("tA2");
    api.getRefreshToken(alice).should.equal("rA2");
    api.getToken(bob).should.equal("tB");
    api.getRefreshToken(bob).should.equal("rB");
  });

  it("refresh failure leaves sessions intact", async function () {
    const refresh = require("passport-oauth2-refresh");
    const stub = sinon
      .stub(refresh, "requestNewAccessToken")
      .callsFake((n, rt, cb) => cb(new Error("x")));
    let err;
    await api.requestNewAccessToken("rA", alice).catch((e) => (err = e));
    stub.restore();
    should.exist(err);
    api.getToken(alice).should.equal("tA");
  });

  it("onAuth callback still fires; setAccessToken without session is a no-op", async function () {
    const cb = sinon.spy();
    api.onAuth(cb);
    const r = { session: {} };
    await login(api, r, "t", "r", { id: 1 });
    cb.calledOnce.should.equal(true);
    api.setAccessToken({}, "t", "r").should.equal(api);
  });
});
