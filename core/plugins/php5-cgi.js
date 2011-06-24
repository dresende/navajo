var path = require("path"),
    spawn = require("child_process").spawn;

exports.run = function (file, url, req, res, cb) {
	var php = spawn("php5-cgi", [ "-f", file ], {
	    	"cwd" : path.dirname(file),
	    	"env" : {
	    		"CONTENT_TYPE"      : req.headers["content-type"] || "",
	    		"CONTENT_LENGTH"    : 0,
	    		"GATEWAY_INTERFACE" : "CGI/1.1",
	    		"PATH_INFO"         : file,
	    		"QUERY_STRING"      : url.query || "",
	    		"REMOTE_ADDR"       : req.connection.remoteAddress,
	    		"REDIRECT_STATUS"   : 200,
	    		"REQUEST_METHOD"    : req.method,
	    		"REQUEST_URI"       : url.pathname,
	    		"SCRIPT_FILENAME"   : file,
	    		"SCRIPT_NAME"       : url.pathname,
	    		"SERVER_PROTOCOL"   : "HTTP/" + req.httpVersion,
	    		"SERVER_SOFTWARE"   : "navajo"
	    	}
	    }),
	    headers = "",
	    headers_sent = false,
	    info = {
	    	"size": 0
	    };

	php.stdout.on("data", function (data) {
		if (headers_sent) {
			info.size += data.length;
			return res.write(data);
		}
		data = String(data);
		var p = data.indexOf("\r\n\r\n"), q;
		if (p == -1) {
			headers += data;
			return;
		}
		headers += data.substr(0, p);
		headers_sent = true;

		headers = headers.split("\r\n");
		for (var i = 0; i < headers.length; i++) {
			if ((q = headers[i].indexOf(":")) != -1) {
				res.setHeader(headers[i].substr(0, q), headers[i].substr(q + 1));
			}
		}

		info.size += data.length - p - 4;

		return res.write(data.substr(p + 4));
	});
	php.stdout.on("end", function (code) {
		res.end();
		return cb(info);
	});
	php.stderr.on("data", function (data) {
		console.log("ERROR", String(data));
		res.write(data);
	});
	php.stdin.end();
	//php.stdin.write("x=2&y=3");
};