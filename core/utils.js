var path = require("path"),
    fs = require("fs"),
    parse_url = require("url").parse,
    mime = require("mime"),
    print = require("./print"),
    config = {
        "bind"  : "0.0.0.0:80",
        "root"  : "www/",
        "log"   : null,
        "index" : null
    },
    plugins = {};

exports.loadConfig = loadConfig;
exports.processRequest = processRequest;
exports.stopLogging = function () { print.setLogging(null); };
exports.reopenLogging = function () { print.setLogging(config.log); };

function loadConfig(path, cb) {
	fs.readFile(path, function (err, data) {
		if (err) {
			return cb(err);
		}
		try {
			data = JSON.parse(data);
		} catch (e) {
			return cb(e);
		}

		for (k in data) {
			if (data.hasOwnProperty(k)) config[k] = data[k];
		}

		config.bind = parseHostPort(config.bind, { "host": "0.0.0.0", "port": 80 });
		if (typeof config.plugins != "object") {
			config.plugins = {};
		}

		print.setLogging(config.log);

		if (typeof config.mime == "object") {
			for (k in config.mime) {
				if (!config.mime.hasOwnProperty(k)) continue;
				if (typeof config.mime[k] == "string") {
					config.mime[k] = [ config.mime[k] ];
				}
			}
			mime.define(config.mime);
		}

		return cb(null, config);
	});
}

function parseHostPort(hostport, def) {
	// parse bind (can be host, port or host:port)
	if (hostport.indexOf(":") != -1) {
		def.host = hostport.substr(0, hostport.indexOf(":"));
		def.port = parseInt(hostport.substr(hostport.indexOf(":") + 1), 10);
	} else if (hostport.match(/\d+\.\d+\.\d+\.\d+/)) {
		def.host = hostport;
	} else if (hostport.length > 0) {
		def.port = parseInt(hostport, 10);
	}
	return def;
}

function processRequest(req, res) {
	replyTo(req.url, req, res);
}

function replyTo(url, req, res) {
	if (typeof config.root == "string") {
		return replyToPath(config.root, url, req, res);
	}
	var host = req.headers.host || "localhost";

	for (vhost in config.root) {
		if (!config.root.hasOwnProperty(vhost)) continue;

		// expression
		if (vhost.indexOf("*") != -1) {
			var re = new RegExp("^" + vhost.replace("*", "(.+)") + "$"),
			    m = re.exec(host);

			if (!m) continue;

			var vhost_path = config.root[vhost];
			for (var i = 1; i <= m.length; i++) {
				vhost_path = vhost_path.replace("*", m[i]);
			}

			return replyToPath(vhost_path, url, req, res);
		}

		// simple
		if (host.substr(-vhost.length) != vhost) continue;

		return replyToPath(config.root[vhost], url, req, res);
	}

	if (config.root.hasOwnProperty("default")) {
		return replyToPath(config.root["default"], url, req, res);
	}
}

function replyToPath(base_path, url, req, res) {
	url = parse_url(url);
	var real_path = path.normalize(path.join(base_path, url.pathname));

	if (real_path[0] != "/") {
		real_path = path.normalize(path.join(__dirname + "/../", real_path));
	}
	if (real_path.substr(-1) == "/") {
		return replyWithIndex(real_path, config.index, 0, url, req, res);
	}

	path.exists(real_path, function (exists) {
		if (exists) {
			return streamFile(real_path, url, req, res);
		}
		return replyNotFound(req, res);
	});
}

function replyWithIndex(base_path, files, index, url, req, res) {
	path.exists(base_path + files[index], function (exists) {
		if (exists) {
			return streamFile(base_path + files[index], url, req, res);
		}
		if (files.length > index + 1) {
			return replyWithIndex(base_path, files, index + 1, url, req, res);
		}
		return replyNotFound(req, res);
	});
}

function streamFile(file, url, req, res) {
	var mime_type = mime.lookup(file);

	if (config.plugins.hasOwnProperty(mime_type)) {
		if (!plugins.hasOwnProperty(config.plugins[mime_type])) {
			plugins[config.plugins[mime_type]] = require("./plugins/" + config.plugins[mime_type]);
		}

		return plugins[config.plugins[mime_type]].run(file, url, req, res, function (info) {
			print.log(req, 200, file, info.size);
		});
	}

	var fd = fs.createReadStream(file);

	fs.stat(file, function (err, stat) {
		res.statusCode = 200;
		res.setHeader("Server", "navajo");
		res.setHeader("Content-Type", mime_type);

		if (!err) {
			res.setHeader("Content-Length", stat.size);
		}

		fd.on("data", function (chunk) {
			res.write(chunk);
		});
		fd.on("end", function() {
			res.end();

			if (err) {
				print.log(req, 200, file);
			} else {
				print.log(req, 200, file, stat.size);
			}
		});
	});
}

function replyNotFound(req, res) {
	print.log(req, 404);

	res.writeHead(404, "Not Found", {
		"Server": "navajo"
	});
	fs.readFile(__dirname + "/errors/404.html", function (err, data) {
		if (err) {
			return red.end("Not Found");
		}
		return res.end(data);
	});
}

function replyInternalError(req, res) {
	print.log(req, 500);

	res.writeHead(500, "Internal Server Error", {
		"Server": "navajo"
	});
	fs.readFile(__dirname + "/errors/500.html", function (err, data) {
		if (err) {
			return red.end("Internal Server Error");
		}
		return res.end(data);
	});
}