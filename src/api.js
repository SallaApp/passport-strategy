const oauth2RefreshToken = require("passport-oauth2-refresh");
const Strategy = require("./strategy");
// Salla API endpoint
const _getOrdersURL = "https://api.salla.dev/admin/v2/orders";
const _getCustomersURL = "https://api.salla.dev/admin/v2/customers";
const _getUserURL = "https://accounts.salla.sa/oauth2/user/info";
class API {
  _expires_in = null;
  _refresh_token = null;
  _strategy = null;
  _token = null;
  _onAuthCallback = null;
  _user = null;
  /**
   * `API` constructor.
   *
   * @api public
   */

  constructor({ clientID, clientSecret, callbackURL }) {
    this._strategy = new Strategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      async (accessToken, refreshToken, expires_in, user, done) => {
        this.setAccessToken(accessToken, refreshToken, expires_in);

        if (this._onAuthCallback)
          this._onAuthCallback(accessToken, refreshToken, expires_in, user);
        // asynchronous verification, for effect...
        process.nextTick(() => {
          // To keep the example simple, the user's salla user is returned to
          // represent the logged-in user. In a typical application, you would want
          // to associate the salla account with a user record in your database,
          // and return that user instead.
          this._user = user;
          return done(null, user);
        });
      }
    );
    oauth2RefreshToken.use(this._strategy);
  }
  logout() {
    this.__resetToken();
  }
  __resetToken() {
    this._expires_in = null;
    this._refresh_token = null;
    this._token = null;
    this._user = null;
  }
  getPassportStrategy() {
    return this._strategy;
  }
  /**
   * set the Access Token and Refresh Token for the API to work
   *
   *
   * Examples:
   *
   *     API.setAccessToken(....);
   *
   *
   * @param {String} token
   * @param {String} _refresh_token
   * @param {Number} expires_in
   * @param {Strategy} strategy
   * @return {API} for chaining
   * @api public
   */
  setAccessToken(token, _refresh_token, expires_in, user) {
    this._token = token;
    this._refresh_token = _refresh_token;
    if (expires_in) this._expires_in = expires_in;
    if (user) this._user = user;
    return this;
  }
  /**
   * using setExpressVerify authentication without depending on sessions by passport
   *
   *
   * Examples:
   *
   *     app.use((req, res, next) => API.setExpressVerify(req, res, next));
   *
   * @return null (express chain next)
   * @api public
   */
  setExpressVerify(req, res, next) {
    if (req.originalUrl == "/login" || req.originalUrl.search("/oauth") > -1)
      return next();

    if (typeof this._token == "string" && this._token.length > 0) {
      req.query = {
        code: this._token,
      };
      req.user = this._user;
    }

    next();
  }
  /**
   * get  Access Token
   *
   *
   * Examples:
   *
   *     API.getToken();
   *
   *
   * @return {AccessToken}
   * @api public
   */
  getToken() {
    return this._token;
  }
  /**
   * get Refresh Token
   *
   *
   * Examples:
   *
   *     API.getRefreshToken();
   *
   *
   * @return {RefreshToken}
   * @api public
   */
  getRefreshToken() {
    return this._refresh_token;
  }
  /**
   * get resorce from the API
   *
   *
   * Examples:
   *
   *     API.fetchResource({ method:"GET", url:"https://api.salla.dev/admin/v2/orders", token:API.getToken()});
   *     API.fetchResource({url:"https://api.salla.dev/admin/v2/orders"});
   *
   *
   * @return {Object}
   * @api public
   */
  fetchResource({ method = "GET", url, token = this.getToken() }) {
    var authorization = "Bearer " + (token || this.getToken());
    var headers = {
      Authorization: authorization,
    };
    return new Promise((resolve, reject) => {
      this._strategy._oauth2._request(
        method,
        url,
        headers,
        "",
        "",
        (err, body, res) => {
          if (err) {
            this.__resetToken();
            return reject({ msg: "failed to fetch StoreData", err });
          }

          try {
            var json = JSON.parse(body);

            resolve(json.data);
          } catch (err) {
            reject({ msg: "failed to parse Data", err });
          }
        }
      );
    });
  }
  /**
   * get resorce owner from the API
   *
   *
   * Examples:
   *
   *     API.getResourceOwner(API.getToken());
   *     API.getResourceOwner();
   *     API.getResourceOwner().then(user=>console.log(user.getId()));
   *     API.getResourceOwner().then(user=>console.log(user.getName()));
   *     API.getResourceOwner().then(user=>console.log(user.getStoreID()));
   *     API.getResourceOwner().then(user=>console.log(user.getStoreName()));
   *
   * @return {Object}
   * @api public
   */
  getResourceOwner(token) {
    var authorization = "Bearer " + (token || this.getToken());
    var headers = {
      Authorization: authorization,
    };
    return new Promise((resolve, reject) => {
      this._strategy._oauth2._request(
        "GET",
        _getUserURL,
        headers,
        "",
        "",
        (err, body, res) => {
          if (err) {
            this.__resetToken();
            return reject({ msg: "failed to fetch StoreData", err });
          }

          try {
            var json = JSON.parse(body);

            resolve({
              ...json.data,
              getId: () => {
                return json.data.id;
              },
              getName: () => {
                return json.data.name;
              },
              getStoreID: () => {
                return json.data.store.id;
              },
              getStoreName: () => {
                return json.data.store.name;
              },
            });
          } catch (err) {
            reject({ msg: "failed to parse Data", err });
          }
        }
      );
    });
  }
  /**
   * get all orders from the user store
   *
   *
   * Examples:
   *
   *     API.getAllOrders(API.getToken());
   *     API.getAllOrders();
   *
   *
   * @return {Array}
   * @api public
   */
  getAllOrders(token) {
    var authorization = "Bearer " + (token || this.getToken());
    var headers = {
      Authorization: authorization,
    };
    return new Promise((resolve, reject) => {
      this._strategy._oauth2._request(
        "GET",
        _getOrdersURL,
        headers,
        "",
        "",
        (err, body, res) => {
          if (err) {
            this.__resetToken();
            return reject({ msg: "failed to fetch StoreData ", err });
          }

          try {
            var json = JSON.parse(body);

            resolve(json.data);
          } catch (err) {
            reject({ msg: "failed to parse Data ", err });
          }
        }
      );
    });
  }

  /**
   * Refresh current token and get new token
   *
   *
   * Examples:
   *
   *     API.refreshToken();
   *
   *
   * @return {Promise}
   * @api public
   */
  requestNewAccessToken(refreshToken = this.getRefreshToken()) {
    return new Promise((resolve, reject) => {
      oauth2RefreshToken.requestNewAccessToken(
        "salla",
        refreshToken,
        (err, accessToken, newRefreshToken) => {
          if (err) {
            this.__resetToken();
            return reject({ msg: "Error Refreshing Your Token", err });
          }
          // You have a new access token, store it in the user object, and save it to the database
          this.setAccessToken(accessToken, newRefreshToken);
          return resolve({ msg: "ok", accessToken, newRefreshToken });
        }
      );
    });
  }
  /**
   * get all customers from the user store
   *
   *
   * Examples:
   *
   *     API.getAllCustomers(API.getToken());
   *     API.getAllCustomers();
   *
   *
   * @return {Array}
   * @api public
   */
  getAllCustomers(token) {
    var authorization = "Bearer " + (token || this.getToken());
    var headers = {
      Authorization: authorization,
    };
    return new Promise((resolve, reject) => {
      this._strategy._oauth2._request(
        "GET",
        _getCustomersURL,
        headers,
        "",
        "",
        (err, body, res) => {
          if (err) {
            this.__resetToken();
            return reject(err);
          }

          try {
            var json = JSON.parse(body);

            resolve(json.data);
          } catch (err) {
            reject({ msg: "failed to parse Data ", err });
          }
        }
      );
    });
  }

  onAuth(cb) {
    this._onAuthCallback = cb;
  }
}

module.exports = API;
