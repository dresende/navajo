/**
 * Navajo - NodeJS HTTP Server
 **/
var utils = require("./core/utils"),
    config;

// default configuration
config = {
	"bind"  : "0.0.0.0:80",
	"root"  : __dirname + "/www/",
	"index" : null
};

// load configuration
utils.loadConfig("./navajo.conf", function (err, conf) {
	if (err) {
		console.log("ERROR");
		console.log(err);
		return;
	}
	for (k in conf) {
		if (conf.hasOwnProperty(k)) config[k] = conf[k];
	}

	utils.setConfig(config);

	var http = require("http"),
	    server = http.createServer(utils.processRequest),
	    host = "0.0.0.0",
	    port = 80;

	// parse bind (can be host, port or host:port)
	if (config.bind.indexOf(":") != -1) {
		host = config.bind.substr(0, config.bind.indexOf(":"));
		port = parseInt(config.bind.substr(config.bind.indexOf(":") + 1), 10);
	} else if (config.bind.match(/\d+\.\d+\.\d+\.\d+/)) {
		host = config.bind;
	} else if (config.bind.length > 0) {
		port = parseInt(config.bind, 10);
	}

	// start server
	server.listen(port, host, function () {
		console.log("Server started on %s:%d", host, port);
	});
});