var authorization_nonces = {};

exports.generateAuthorization = generateAuthorization;
exports.checkAuthorization = checkAuthorization;

function generateAuthorization(res, realm, mech) {
	res.statusCode = 401;

	switch (mech.toLowerCase()) {
		case "basic":
			res.setHeader("WWW-Authenticate", "Basic realm=\"" + realm + "\"");
			break;
		case "digest":
			var nonce = md5("" + (new Date()).getTime() + Math.random()),
			    opaque = md5("hostname or something");

			authorization_nonces[nonce] = {
				"nc" : 1
			};

			res.setHeader("WWW-Authenticate", "Digest realm=\"" + realm + "\", " +
			                                         "qop=\"auth\", " +
			                                         "nonce=\"" + nonce + "\", " +
			                                         "opaque=\"" + opaque + "\"");
			break;
		default:
			throw { "code": "ENOMECH", "message": "Unknown Authorization mech" };
	}
	return res.end();
}

function checkAuthorization(authorization, method, realm, users) {
	var querystring = require("querystring"),
	    m = null,
	    auth = {};

	if ((m = authorization.match(/^\w+\s/)) !== null) {
		auth.mech = m[0].trimRight().toLowerCase();
		auth.data = authorization.substr(auth.mech.length).trimLeft();
		auth.validated = false;

		switch (auth.mech) {
			case "basic":
				var b = (new Buffer(auth.data, "base64")).toString().split(":", 2);

				auth.username = b[0];
				auth.password = b[1];
				auth.validated = users.hasOwnProperty(auth.username) && users[auth.username] === auth.password;
				break;
			case "digest":
				auth.data = querystring.parse(auth.data, ",", "=");
				for (k in auth.data) {
					if (!auth.data.hasOwnProperty(k)) continue;

					if (k.trimLeft() != k) {
						auth.data[k.trimLeft()] = auth.data[k];
						delete auth.data[k];
					}
				}
				for (k in auth.data) {
					if (!auth.data.hasOwnProperty(k)) continue;

					if (auth.data[k].substr(0, 1) == "\"" && auth.data[k].substr(-1) == "\"") {
						auth.data[k] = auth.data[k].substr(1, auth.data[k].length - 2);
					}
				}

				auth.username = auth.data.username;

				if (!users.hasOwnProperty(auth.username)) {
					break;
				}

				if (!authorization_nonces.hasOwnProperty(auth.data.nonce)) {
					break;
				}

				var a1 = [ auth.username, realm, users[auth.username] ].join(":"),
				    a2 = [ method, auth.data.uri ].join(":"),
				    digest = "";
				
				if (auth.data.hasOwnProperty("qop")) {
					if (parseInt(auth.data.nc, 10) < authorization_nonces[auth.data.nonce].nc) {
						break;
					}

					authorization_nonces[auth.data.nonce].nc = auth.data.nc;
					digest = md5([ md5(a1), auth.data.nonce, auth.data.nc, auth.data.cnonce, auth.data.qop, md5(a2) ].join(":"));
				} else {
					digest = md5([ md5(a1), auth.data.nonce, md5(a2) ].join(":"));
				}

				auth.validated = (digest === auth.data.response);
				break;
		}
	}

	return auth;
}

function md5(str) {
	var hash = require("crypto").createHash("MD5");
	hash.update(str);
	return hash.digest("hex");
}