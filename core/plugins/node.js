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

	try {
		fs.readFile(file, function (err, data) {
			if (err) {
				return console.log("ERROR READING NODE FILE");
			}
			var script = vm.createScript(String(data) + "\nexit();\n", file);
			script.runInNewContext(ctx);
		});
	} catch (except) {
		console.log("NODE EXCEPTION");
		console.log(except);
	}
};