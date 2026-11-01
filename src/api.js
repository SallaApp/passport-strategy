const oauth2RefreshToken = require("passport-oauth2-refresh");
const Strategy = require("./strategy");
// Salla API endpoint
const _getOrdersURL = "https://api.salla.dev/admin/v2/orders";
const _getCustomersURL = "https://api.salla.dev/admin/v2/customers";
const _getUserURL = "https://accounts.salla.sa/oauth2/user/info";
const MISSING_TOKEN = { msg: "access token is required" };

class API {
    _strategy = null;
    _onAuthCallback = null;
    /**
     * `API` constructor.
     *
     * No authentication state is stored on the instance: tokens and user live
     * in the request's own session (`req.session.salla`) or are passed
     * explicitly on every call, so one instance is safe to share across users.
     *
     * @api public
     */

    constructor({ clientID, clientSecret, callbackURL }) {
        this._strategy = new Strategy(
            {
                clientID,
                clientSecret,
                callbackURL,
                passReqToCallback: true,
            },
            async (req, accessToken, refreshToken, expires_in, user, done) => {
                this.setAccessToken(req, accessToken, refreshToken, expires_in, user);

                if (this._onAuthCallback)
                    this._onAuthCallback(accessToken, refreshToken, expires_in, user);
                // asynchronous verification, for effect...
                process.nextTick(() => {
                    // In a typical application, you would want to associate the
                    // salla account with a user record in your database, and
                    // return that user instead.
                    return done(null, user);
                });
            }
        );
        oauth2RefreshToken.use(this._strategy);
    }
    /**
     * Clear the Salla session data of the request's own session only.
     *
     * @param {Object} req express request
     * @api public
     */
    logout(req) {
        if (req && req.session) delete req.session.salla;
    }
    getPassportStrategy() {
        return this._strategy;
    }
    /**
     * Store the Access Token, Refresh Token and user in the session of `req`.
     *
     * Examples:
     *
     *     API.setAccessToken(req, token, refreshToken, expires_in, user);
     *
     * @return {API} for chaining
     * @api public
     */
    setAccessToken(req, token, refreshToken, expires_in, user) {
        if (req && req.session) {
            req.session.salla = {
                token,
                refreshToken,
                expires_in: expires_in || null,
                user: user || null,
            };
        }
        return this;
    }
    /**
     * Express middleware: restores `req.user` and `req.salla` from the current
     * request's own session. Requests without a Salla session stay
     * unauthenticated. Requires a session middleware (e.g. express-session).
     *
     * Examples:
     *
     *     app.use(session({ ... }));
     *     app.use((req, res, next) => API.setExpressVerify(req, res, next));
     *
     * @return null (express chain next)
     * @api public
     */
    setExpressVerify(req, res, next) {
        if (req.originalUrl == "/login" || req.originalUrl.search("/oauth") > -1)
            return next();

        const salla = req.session && req.session.salla;
        if (salla && typeof salla.token == "string" && salla.token.length > 0) {
            req.salla = {
                token: salla.token,
                refreshToken: salla.refreshToken,
                expires_in: salla.expires_in,
            };
            req.user = salla.user;
        }

        next();
    }
    /**
     * get the Access Token of the request's session
     *
     * Examples:
     *
     *     API.getToken(req);
     *
     * @return {AccessToken|null}
     * @api public
     */
    getToken(req) {
        return (req && req.session && req.session.salla && req.session.salla.token) || null;
    }
    /**
     * get the Refresh Token of the request's session
     *
     * Examples:
     *
     *     API.getRefreshToken(req);
     *
     * @return {RefreshToken|null}
     * @api public
     */
    getRefreshToken(req) {
        return (req && req.session && req.session.salla && req.session.salla.refreshToken) || null;
    }
    /**
     * get resorce from the API. `token` is required.
     *
     * Examples:
     *
     *     API.fetchResource({ method:"GET", url:"https://api.salla.dev/admin/v2/orders", token:API.getToken(req)});
     *
     * @return {Object}
     * @api public
     */
    fetchResource({ method = "GET", url, token }) {
        if (!token) return Promise.reject(MISSING_TOKEN);
        var headers = {
            Authorization: "Bearer " + token,
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
                        return reject({ msg: "failed to fetch Data", err });
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
     * get resorce owner from the API. `token` is required.
     *
     * Examples:
     *
     *     API.getResourceOwner(API.getToken(req));
     *     API.getResourceOwner(token).then(user=>console.log(user.getId()));
     *     API.getResourceOwner(token).then(user=>console.log(user.getName()));
     *     API.getResourceOwner(token).then(user=>console.log(user.getMerchantID()));
     *     API.getResourceOwner(token).then(user=>console.log(user.getMerchantName()));
     *
     * @return {Object}
     * @api public
     */
    getResourceOwner(token) {
        if (!token) return Promise.reject(MISSING_TOKEN);
        var headers = {
            Authorization: "Bearer " + token,
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
                        return reject({ msg: "failed to fetch MerchantData", err });
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
                            /**
                             * @deprecated use getMerchantID instead
                             * @returns {*}
                             */
                            getStoreID: () => {
                                return json.data.store.id;
                            },
                            /**
                             * @deprecated use getMerchantName instead
                             * @returns {*}
                             */
                            getStoreName: () => {
                                return json.data.store.name;
                            },
                            getMerchantID: () => {
                                return json.data.merchant.id;
                            },
                            getMerchantName: () => {
                                return json.data.merchant.name;
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
     * get all orders from the user store. `token` is required.
     *
     * Examples:
     *
     *     API.getAllOrders(API.getToken(req));
     *
     * @return {Array}
     * @api public
     */
    getAllOrders(token) {
        if (!token) return Promise.reject(MISSING_TOKEN);
        var headers = {
            Authorization: "Bearer " + token,
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
                        return reject({ msg: "failed to fetch Data ", err });
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
     * Refresh a token and get a new one. `refreshToken` is required; pass
     * `req` to also update that request's own session.
     *
     * Examples:
     *
     *     API.requestNewAccessToken(API.getRefreshToken(req), req);
     *
     * @return {Promise}
     * @api public
     */
    requestNewAccessToken(refreshToken, req) {
        if (!refreshToken)
            return Promise.reject({ msg: "refresh token is required" });
        return new Promise((resolve, reject) => {
            oauth2RefreshToken.requestNewAccessToken(
                "salla",
                refreshToken,
                (err, accessToken, newRefreshToken) => {
                    if (err) {
                        return reject({ msg: "Error Refreshing Your Token", err });
                    }
                    if (req && req.session && req.session.salla) {
                        req.session.salla.token = accessToken;
                        req.session.salla.refreshToken = newRefreshToken;
                    }
                    return resolve({ msg: "ok", accessToken, newRefreshToken });
                }
            );
        });
    }
    /**
     * get all customers from the user store. `token` is required.
     *
     * Examples:
     *
     *     API.getAllCustomers(API.getToken(req));
     *
     * @return {Array}
     * @api public
     */
    getAllCustomers(token) {
        if (!token) return Promise.reject(MISSING_TOKEN);
        var headers = {
            Authorization: "Bearer " + token,
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
