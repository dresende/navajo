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
exports.dropPrivileges = dropPrivileges;
exports.processRequest = processRequest;
exports.stopLogging = function () { print.setLogging(null); };
exports.reopenLogging = function () { print.setLogging(config.log); };

function loadConfig(config_path, cb) {
	fs.readFile(config_path, function (err, data) {
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

		if (typeof config.root == "object") {
			for (vhost in config.root) {
				if (!config.root.hasOwnProperty(vhost)) continue;
				if (config.root[vhost][0] != "/") {
					config.root[vhost] = path.join(path.normalize(__dirname + "/../"), config.root[vhost]);
				}
			}
		}

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

function dropPrivileges() {
	console.log("Dropping privileges...");
	if (config.group) {
		process.setgid(config.group);
	}
	if (config.user) {
		process.setuid(config.user);
	}
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
	if (!isSubpathOf("/fake/", url)) {
		//return replyError(404, req, res);
		url = "/" + path.basename(url);
	}

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

function isSubpathOf(base_path, subpath) {
	return path.normalize(path.join(base_path, subpath)).substr(0, base_path) == base_path;
}

function replyToPath(base_path, url, req, res) {
	url = parse_url(url);
	var real_path = path.normalize(path.join(base_path, url.pathname));

	if (real_path.substr(-1) == "/") {
		return replyWithIndex(real_path, config.index, 0, url, req, res);
	}

	path.exists(real_path, function (exists) {
		if (exists) {
			return streamFile(real_path, url, req, res);
		}
		return replyError(404, req, res);
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
		return replyError(404, req, res);
	});
}

function streamFile(file, url, req, res) {
	var mime_type = mime.lookup(file);

	if (config.plugins.hasOwnProperty(mime_type)) {
		if (!plugins.hasOwnProperty(config.plugins[mime_type])) {
			plugins[config.plugins[mime_type]] = require("./plugins/" + config.plugins[mime_type]);
		}

		return plugins[config.plugins[mime_type]].run(file, url, req, res, function (info) {
			if (typeof info == "number") {
				return replyError(info, req, res);
			}
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

function replyError(number, req, res) {
	var desc, notes;

	switch (number) {
		case 403: desc = "Forbidden"; break;
		case 404: desc = "Not Found"; break;
		case 500: desc = "Internal Server Error"; break;
		default:  desc = "Unknown";
	}

	print.log(req, number);

	res.writeHead(number, desc, {
		"Server": "navajo"
	});

	fs.readFile(__dirname + "/errors/" + number + ".html", function (err, data) {
		if (err) {
			fs.readFile(__dirname + "/errors/default.html", function (err, data) {
				if (err) {
					return res.end();
				}

				switch (number) {
					case 403: notes = "Access to the resource was denied"; break;
					case 404: notes = "The file you're looking for was not found"; break;
					case 500: notes = "Something wrong just happened on server side"; break;
					default:  notes = "Something weird just happened on server side";
				}

				return res.end(String(data).replace(/\{number\}/g, number)
				                           .replace(/\{description\}/g, desc)
				                           .replace(/\{notes\}/g, notes));
			});
			return;
		}
		return res.end(data);
	});
}