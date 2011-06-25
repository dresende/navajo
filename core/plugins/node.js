var fs = require("fs"),
    vm = require("vm");

exports.run = function (file, url, req, res, cb) {
	var info = {
		"size": 0
	}, ctx = {
		"http"      : {
			"headers"      : req.headers,
			"method"       : req.method,
			"url"          : url,
			"remoteAddress": req.connection.remoteAddress
		},
		"setHeader" : function (k, v) {
			return res.setHeader(k, v);
		},
		"print"     : function (data) {
			res.write(data);

			info.size += data.length;
		},
		"exit"      : function () {
			res.end();

			return cb(info);
		}
	};

	fs.readFile(file, function (err, data) {
		if (err) {
			return cb(403);
		}

		try {
			var script = vm.createScript(String(data) + "\nexit();\n", file);
			script.runInNewContext(ctx);
		} catch (except) {
			var stack = except.stack.split("\n");
			var m = stack[1].match(/^(.+):([0-9]+):([0-9]+)$/);

			if (m) {
				return res.end("\n" + stack[0] + " " + m[1].trim() + " on line " + m[2]);
			} else {
				return res.end("\n" + stack[0] + stack[1]);
			}
		}
	});
};