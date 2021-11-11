# Passport-Salla

[Passport](http://passportjs.org/) strategy for authenticating with [Salla](https://salla.sa/)
using the OAuth 2.0 API.

This module lets you authenticate using Salla in your Node.js applications.
By plugging into Passport, Salla authentication can be easily and
unobtrusively integrated into any application or framework that supports
[Connect](http://www.senchalabs.org/connect/)-style middleware, including
[Express](http://expressjs.com/).

For more information about Salla's OAuth 2.0 implementation, check our
[Web API Authorization Guide](https://salla.dev/blog/oauth-2-0-in-action-with-salla).

## OAuth Workflow

![OAuth Workflow](https://i.ibb.co/xLyn80t/Frame-1236-OAuth-5.png)

## Installation

    $ npm install passport-salla

## Usage

### Configure Strategy

The Salla authentication strategy authenticates users using a Salla Merchant Account
and OAuth 2.0 tokens. The strategy requires a `verify` callback, which accepts
these credentials and calls `done` providing a user, as well as `options`
specifying a client ID, client secret, and callback URL.

```javascript
const express = require("express");
const passport = require("passport");
const SallaAPIFactory = require("passport-salla");
const app = express();

// Salla don't allow ports in redirect url ... make sure the redirect url is on port 80
const port = 80;

// we initialize our Salla API
const SallaAPI = new SallaAPIFactory({
  clientID: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  // Salla don't allow ports in redirect url ... make sure the redirect url is on port 80
  callbackURL: "http://localhost/auth/salla/callback",
});

//   Use the Salla Strategy within Passport.
passport.use(SallaAPI.getPassportStrategy());

// GET /
// render the index page

app.get("/", function (req, res) {
  res.send({ user: req.user });
});

// GET /login
//   Use passport.authenticate() as route middleware to authenticate the
//   request. The first step in salla authentication will involve redirecting
//   the user to accounts.salla.sa. After authorization, salla will redirect the user
//   back to this application at /auth/salla/callback
app.get("/auth/salla", passport.authenticate("salla"));

// GET /auth/salla/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request. If authentication fails, the user will be redirected back to the
//   login page. Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(
  "/auth/salla/callback",
  passport.authenticate("salla", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/");
  }
);
app.listen(port, function () {
  console.log("App is listening on port " + port);
});
```

## Refreshing a Token

Refresh tokens by calling API.refreshToken() function it return a Promies

```javascript
const SallaAPI = require("passport-salla");

SallaAPI.requestNewAccessToken(SallaAPI.getRefreshToken())
  .then((token) => {
    // save new token
  })
  .catch((err) => res.send(err));
```

For a complete, working example, refer to the [login example]

You can get your keys on [Salla Partner - My Applications](https://salla.partners/apps/[APP_ID]).

## Examples

Getting All Orders from the store

```javascript
app.get("/orders", ensureAuthenticated, async function (req, res) {
  res.render("orders.html", {
    orders: await SallaAPI.getAllOrders(),
  });
});
```

Fetching Resources dynamic url

```javascript
app.get("/customers", ensureAuthenticated, async function (req, res) {
  res.render("orders.html", {
    customers: await SallaAPI.fetchResource({
      url: "https://api.salla.dev/admin/v2/customers",
    }),
  });
});
```

## Tests

    $ npm install --dev
    $ npm test

## Contributing

Please see [CONTRIBUTING](CONTRIBUTING.md) for details.

### Security

If you discover any security related issues, please email security@salla.sa instead of using the issue tracker.

## Credits

- [Salla](https://github.com/sallaApp)
- [All Contributors](../../contributors)

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.
