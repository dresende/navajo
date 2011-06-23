/**
 * Navajo - NodeJS HTTP Server
 **/
var utils = require("./core/utils");

process.chdir(__dirname);

// load configuration
utils.loadConfig("./navajo.conf", function (err, config) {
	if (err) {
		console.log("ERROR");
		console.log(err);
		return;
	}

	var http = require("http"),
	    server = http.createServer(utils.processRequest);

	// start server
	try {
		server.listen(config.bind.port, config.bind.host, function () {
			console.log("Server started on %s:%d", config.bind.host, config.bind.port);
		});
	} catch (except) {
		if (except.errno == 13) {
			console.log("Cannot start on %s:%d - Permission denied. Are you root?", config.bind.host, config.bind.port);
		} else {
			console.log("Cannot start on %s:%d - %s", config.bind.host, config.bind.port, except.message);
		}
		process.exit(1);
	}

	process.on("SIGINT", function () {
		console.log("Server stopping..");
		utils.stopLogging();
		process.exit(0);
	});

	process.on("SIGUSR1", function () {
		console.log("Reopening logs..");
		utils.reopenLogging();
	});
});