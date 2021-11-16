var should = require("should");
var sinon = require("sinon");
const SallaStrategy = require('../src/strategy');

describe("test Salla Strategy", function () {
  var strategy = new SallaStrategy(
    {
      clientID: "ABC123",
      clientSecret: "secret",
    },
    function () {}
  );

  var it_should_handle_errors = function () {
    it("should error", function (done) {
      strategy.userProfile("something", function (err, profile) {
        should.exist(err);
        done();
      });
    });

    it("should not load profile", function (done) {
      strategy.userProfile("something", function (err, profile) {
        should.not.exist(profile);
        done();
      });
    });
  };

  it("should be named salla", function () {
    strategy.name.should.equal("salla");
  });

  it("should not request use of auth header for GET requests", function () {
    strategy._oauth2._useAuthorizationHeaderForGET.should.equal(false);
  });

  describe("scope", function () {
    it("should not specify scopes by default", function () {
      var scope = new SallaStrategy(
        {
          clientID: "ABC123",
          clientSecret: "secret",
        },
        function () {}
      )._scope;
      should.not.exist(scope);
    });

    describe("array option", function () {
      var strategy,
        options = {
          clientID: "ABC123",
          clientSecret: "secret",
          scope: ["one", "two", "five"],
          showDialog: true,
        };

      before(function () {
        strategy = new SallaStrategy(options, function () {});
      });

      it("should enforce user-read-private scope presence", function () {
        strategy._scope.should.containEql("one");
        strategy._scope.should.containEql("two");
        strategy._scope.should.containEql("five");
      });

      it("should enforce whitespace separator", function () {
        strategy._scopeSeparator.should.equal(" ");
      });

      it("should add extra options if any", function () {
        strategy.authorizationParams(options).should.eql({ show_dialog: true });
      });
    });
  });

  describe("token endpoint interaction", function () {
    describe("authorization", function () {
      before(function () {
        sinon.stub(strategy._oauth2, "_request");
      });

      after(function () {
        strategy._oauth2._request.restore();
      });

      it("should authenticate using client id and client secret pair", function () {
        strategy._oauth2.getOAuthAccessToken("code", {}, undefined);

        function parseQueryString(query) {
          var returnObject = {};
          var vars = query.split("&");
          vars.forEach(function (variable) {
            var parts = variable.split("=");
            returnObject[parts[0]] = parts[1];
          });
          return returnObject;
        }

        var data = {
          code: "code",
          client_id: "ABC123",
          client_secret: "secret",
        };

        data.should.eql(
          parseQueryString(strategy._oauth2._request.firstCall.args[3])
        );
      });
    });

    describe("on success", function () {
      before(function () {
        sinon
          .stub(strategy._oauth2, "_request")
          .callsFake(function (
            method,
            url,
            headers,
            post_body,
            access_token,
            callback
          ) {
            headers.should.eql({
              "Content-Type": "application/x-www-form-urlencoded",
            });
            var data = JSON.stringify({
              access_token: "access_token",
              refresh_token: "refresh_token",
              expires_in: "expires_in",
              client_id: "ABC123",
              client_secret: "secret",
              something_random: "randomness",
            });

            callback(null, data, null);
          });
      });

      after(function () {
        strategy._oauth2._request.restore();
      });

      it("should pass the data back", function (done) {
        strategy._oauth2.getOAuthAccessToken(
          "code",
          {},
          function (err, accessToken, refreshToken, expires_in, params) {
            should.not.exist(err);
            accessToken.should.equal("access_token");
            refreshToken.should.equal("refresh_token");
            expires_in.should.equal("expires_in");
            done();
          }
        );
      });
    });

    describe("on error", function () {
      before(function () {
        sinon
          .stub(strategy._oauth2, "_request")
          .callsFake(function (
            method,
            url,
            headers,
            post_body,
            access_token,
            callback
          ) {
            headers.should.eql({
              "Content-Type": "application/x-www-form-urlencoded",
            });
            callback("something bad has happened");
          });
      });

      after(function () {
        strategy._oauth2._request.restore();
      });

      it("should pass callback an error", function (done) {
        strategy._oauth2.getOAuthAccessToken("code", {}, function (err) {
          err.should.equal("something bad has happened");
          done();
        });
      });
    });
  });

  describe("when told to load user profile", function () {
    describe("on success", function () {
      before(function () {
        sinon
          .stub(strategy._oauth2, "_request")
          .callsFake(function (
            method,
            url,
            headers,
            post_body,
            access_token,
            callback
          ) {
            headers.should.eql({ Authorization: "Bearer something" });
            var body = JSON.stringify({
              id: "salla-id",
              username: "testname",
              display_name: "TEST NAME",
              external_urls: {
                salla: "https://accounts.salla.sa/oauth2/user/info",
              },
              email: "example@mail.com",
              type: "user",
              uri: "salla:user:salla",
              images: [
                {
                  url: "http://profile-images.scdn.co/images/userprofile/default/d14sd",
                  width: null,
                  height: null,
                },
              ],
            });

            callback(null, body, undefined);
          });
      });

      after(function () {
        strategy._oauth2._request.restore();
      });

      it("should not error", function (done) {
        strategy.userProfile("something", function (err, profile) {
          should.not.exist(err);
          done();
        });
      });

      // TODO :: support it
      // it("should load profile", function (done) {
      //   strategy.userProfile("something", function (err, profile) {
      //     profile.id.should.equal("salla-id");
      //     profile.name.should.equal("testname");
      //     profile.email.should.equal("TEST NAME");
      //     should.not.exist(err);
      //     done();
      //   });
      // });
    });

    describe("on incorrect JSON answer", function () {
      before(function () {
        sinon
          .stub(strategy._oauth2, "_request")
          .callsFake(function (
            method,
            url,
            headers,
            post_body,
            access_token,
            callback
          ) {
            headers.should.eql({ Authorization: "Bearer something" });
            var body = "I'm not a JSON, really!";

            callback(null, body, undefined);
          });
      });

      after(function () {
        strategy._oauth2._request.restore();
      });

      it_should_handle_errors();
    });

    describe("on API GET error", function () {
      before(function () {
        sinon
          .stub(strategy._oauth2, "_request")
          .callsFake(function (
            method,
            url,
            headers,
            post_body,
            access_token,
            callback
          ) {
            headers.should.eql({ Authorization: "Bearer something" });
            callback(new Error("something-went-wrong"));
          });
      });

      after(function () {
        strategy._oauth2._request.restore();
      });

      it_should_handle_errors();

      it("should wrap error in InternalOAuthError", function (done) {
        strategy.userProfile("something", function (err, profile) {
          err.constructor.name.should.equal("InternalOAuthError");
          done();
        });
      });
    });
  });
});
