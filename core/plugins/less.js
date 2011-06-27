var fs = require("fs"),
    path = require("path"),
    less = require("less");

exports.run = function (file, url, req, res, cb) {
	fs.readFile(file, function (err, data) {
		if (err) {
			return cb(403);
		}

		try {
			less.render(String(data), {
				"paths"	: [ path.dirname(file) ]
			}, function (e, css) {
				res.setHeader("Content-Type", "text/css");
				res.setHeader("Content-Length", css.length);

				return res.end(css);
			});
		} catch (e) {
			return cb(403);
		}
	});
};