var path = require("path"),
    fs = require("fs"),
    print = require("./print"),
    config = {};

exports.loadConfig = loadConfig;
exports.processRequest = processRequest;
exports.setConfig = function (conf) {
	config = conf;
}

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

		return cb(null, data);
	});
}

function processRequest(req, res) {
	replyTo(req.url, req, res);
}

function replyTo(url, req, res) {
	var real_path = path.normalize(path.join(config.root, url));

	if (real_path.substr(-1) == "/") {
		return replyWithIndex(real_path, config.index, 0, req, res);
	}

	path.exists(real_path, function (exists) {
		if (exists) {
			return streamFile(real_path, req, res);
		}
		return replyNotFound(req, res);
	})
}

function replyWithIndex(base_path, files, index, req, res) {
	path.exists(base_path + files[index], function (exists) {
		if (exists) {
			return streamFile(base_path + files[index], req, res);
		}
		if (files.length > index + 1) {
			return replyWithIndex(base_path, files, index + 1, req, res);
		}
		return replyNotFound(req, res);
	});
}

function streamFile(file, req, res) {
	var fd = fs.createReadStream(file);

	fs.stat(file, function (err, stat) {
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
		"Server": "nody"
	});
	res.end("404 - Not Found");
}

function replyInternalError(req, res) {
	print.log(req, 500);

	res.writeHead(500, "Internal Server Error", {
		"Server": "nody"
	});
	res.end("500 - Internal Server Error");
}