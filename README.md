<div id="top"></div>
<div align="center">
  <a href="https://salla.dev">
    <img src="https://salla.dev/wp-content/themes/salla-portal/dist/img/salla-logo.svg" alt="Logo" width="80" height="80">
  </a>

<h1 align="center">Salla OAuth 2.0 - Passport Strategy</h1>
  <p align="center">
    <a href="http://passportjs.org/">Passport</a> strategy is used with <a href="http://salla.sa/">Salla</a> as an authentication middleware module
using the OAuth 2.0 API.
    <br />
    <a href="https://salla.dev/"><strong>Explore our blogs »</strong></a>
    <br />
    <br /><a href="https://github.com/SallaApp/passport-salla/issues/new">Report Bug</a> · <a href="https://github.com/SallaApp/passport-salla/discussions/new">Request Feature</a>
  </p>
</div>

# Overview

This module enables you to implement the authentication process using Salla within your Nodejs applications.
By plugging it into Passport, Salla authentication can be quickly and unobtrusively implemented into any application
or framework that supports [connect-style](http://www.senchalabs.org/connect) middleware, including [Express.js](http://expressjs.com), by plugging it into Passport.

For more information about Salla's OAuth 2.0 implementation, check our
[Web API Authorization Guide](https://salla.dev/blog/oauth-2-0-in-action-with-salla).

## OAuth Workflow

![OAuth Workflow](https://i.ibb.co/xLyn80t/Frame-1236-OAuth-5.png)

## Installation

    $ npm install @salla.sa/passport-strategy

<p align="right">(<a href="#top">back to top</a>)</p>

## Usage

### Configure Strategy

Salla authentication strategy authenticates users using a Salla Merchant Account
and OAuth 2.0 tokens. This strategy requires a `verify` callback, which accepts
these credentials and calls `done` providing a user as well as `options`
specifying a client ID, client secret, and callback URL.

```javascript
const express = require("express");
const passport = require("passport");
const SallaAPIFactory = require("@salla.sa/passport-strategy");
const app = express();

const port = 8081;

// we initialize our Salla API
const SallaAPI = new SallaAPIFactory({
  clientID: "CLIENT_ID", // The client ID assigned to you by Salla in Salla Partner Portal
  clientSecret: "CLIENT_SECRET", // The client password assigned to you by Salla in Salla Partner Portal
  callbackURL: "http://localhost:8081/oauth/callback", // the /oauth/callback in your service
});

// Use the Salla Strategy within Passport.
passport.use(SallaAPI.getPassportStrategy());

// save token and user data to your selected database
SallaAPI.onAuth((accessToken, refreshToken, expires_in, user) => {
  /*
    accessToken
    refreshToken 
    expires_in
    user
  */
});

/*
  when your user login to your application you can retrieve the access token and use
  it to access the Salla APIs from SallaAPI.setAccessToken   .
  
  SallaAPI.setAccessToken(
    ACCESS_TOKEN_FROM_DATABASE,
    REFRESH_TOKEN_FROM_DATABASE,
    EXPIRES_IN_FROM_DATABASE,
    USER_PROFILE_FROM_DATABASE
  );

*/

// we set salla express middleware
app.use((req, res, next) => SallaAPI.setExpressVerify(req, res, next));

// GET /
// render the index page

app.get("/", function (req, res) {
  res.send({ user: req.user });
});

// GET /oauth/redirect
//   Use passport.authenticate() as route middleware to authenticate the
//   request. The first step in salla authentication will involve redirecting
//   the user to accounts.salla.sa. After authorization, salla will redirect the user
//   back to this application at /oauth/callback
app.get("/oauth/redirect", passport.authenticate("salla"));

// GET /oauth/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request. If authentication fails, the user will be redirected back to the
//   login page. Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(
  "/oauth/callback",
  passport.authenticate("salla", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/");
  }
);

app.listen(port, function () {
  console.log("App is listening on port " + port);
});
```

<p align="right">(<a href="#top">back to top</a>)</p>

## Refreshing a Token

Refresh tokens can be received by calling SallaAPI.refreshToken() function, which returns a Promies.

```javascript
const SallaAPI = require("@salla.sa/passport-strategy");

SallaAPI.requestNewAccessToken(SallaAPI.getRefreshToken())
  .then(({ accessToken, newRefreshToken }) => {
    // save new access token and refresh token to your database
  })
  .catch((err) => res.send(err));
```

## Examples

For a complete, working example, refer to the [login example](#Examples), you can get your keys on [Salla Partners > My Applications](https://salla.partners]).

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

<p align="right">(<a href="#top">back to top</a>)</p>

## Tests

    $ npm install --dev
    $ npm test

<p align="right">(<a href="#top">back to top</a>)</p>

## Contributing

Contributions are what make the open-source community such an amazing place to learn, inspire, and create.
Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request.
You can also simply open an issue with the tag "enhancement". Don't forget to give the project a star! Thanks again!

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#top">back to top</a>)</p>

## Security

If you discover any securitys-related issues, please email security@salla.sa instead of using the issue tracker.

## Credits

- [Salla](https://github.com/sallaApp)
- [All Contributors](../../contributors)

## License

The MIT License (MIT). Please see [License File](LICENSE.md) for more information.

<p align="right">(<a href="#top">back to top</a>)</p>
