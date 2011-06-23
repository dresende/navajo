var path = require("path"),
    spawn = require("child_process").spawn;

exports.run = function (file, url, req, res) {
	var php = spawn("php5-cgi", [ "-f", file ], {
	    	"cwd" : path.dirname(file),
	    	"env" : {
	    		"CONTENT_TYPE"      : req.headers["content-type"] || "",
	    		"CONTENT_LENGTH"    : 0,
	    		"GATEWAY_INTERFACE" : "CGI/1.1",
	    		"PATH_INFO"         : file,
	    		"QUERY_STRING"      : url.query,
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
	    headers_sent = false;

	php.stdout.on("data", function (data) {
		if (headers_sent) {
			return res.write(data);
		}
		data = String(data);
		var p = data.indexOf("\r\n\r\n");
		if (p == -1) {
			headers += data;
			return;
		}
		headers += data.substr(0, p);
		headers_sent = true;

		headers = headers.split("\r\n");
		for (var i = 0; i < headers.length; i++) {
			if ((p = headers[i].indexOf(":")) != -1) {
				res.setHeader(headers[i].substr(0, p), headers[i].substr(p + 1));
			}
		}

		return res.write(data.substr(p + 4));
	});
	php.stdout.on("end", function (code) {
		res.end();
	});
	php.stderr.on("data", function (data) {
		console.log("ERROR", String(data));
		res.write(data);
	});
	php.stdin.write("x=2&y=3");
};