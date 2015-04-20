// Constructor
function OlTools() {
	this.options = {};
	this.currentRequests = [];
	this.totalRequests = 0;
}

// class variables
var accountsUrl = "https://account.cloud.online.net/organizations";
var serversUrl = "https://api.cloud.online.net/servers";
var baseUrl = "https://api.online.net/api/v1/";

var request = require('request');
var fs = require('fs');
var printf = require('printf');
var path = require('path');

// class methods
OlTools.prototype.store = function(storeFile) {
	this.store = storeFile;
	return this;
};

OlTools.prototype.port = function(portNumber) {
	this.port = portNumber;
	return this;
};

OlTools.prototype.dump = function( resource, scope ) {
	var self = this;
	if ( scope == null )
		scope = "all";
	this.conf = this.readConf(this.store);
	if (this.conf != null && this.conf.tokens) {
		this.currentRequests = 0;
		this.totalRequests = ("all" == scope ? (Object.keys(this.conf.tokens).length) : 1 );
		for ( var t in this.conf.tokens) {
			if ( "all" == scope || t == scope ) {
				var token = this.conf.tokens[t];
				request({
					method : 'GET',
					headers : {
						'Authorization' : 'Bearer ' + t,
						'X-Pretty-JSON' : '1',
						"Content-Type" : "application/json"
					},
					url : baseUrl + resource
				}, function(error, response, body) {
					var u = response.request.getHeader('Authorization');
					if (!error && response.statusCode == 200) {
						var body = JSON.parse(body);
						this.totalRequests = this.totalRequests + body.length;
						for ( var i = 0; i <body.length; i++ ) {
							var server = body[i];
							server = server.substring(server.lastIndexOf('/') + 1,server.length);
							console.log(i + ' -> ' + server);
							self.dumpServer( server, t );
						}
					} else if (error) {
						console.log('Error: ' + error);
					}/* else {
						console.log(body);
					}*/
					self.dumpEnd(u);
				});
			}
		}
	}
};

OlTools.prototype.dumpServer = function(s,t) {
	var self = this;
	request({
		method : 'GET',
		headers : {
			'Authorization' : 'Bearer ' + t,
			'X-Pretty-JSON' : '1',
			"Content-Type" : "application/json"
		},
		url : baseUrl + 'server/' + s
	}, function(error, response, body) {
		var u = response.request.getHeader('Authorization');
		if (!error && response.statusCode == 200) {
			var body = JSON.parse(body);
			console.log(body);
		} else if (error) {
			console.log('Error: ' + error);
		} else {
			console.log(body);
		}
		self.dumpEnd(u);
	});		
};

OlTools.prototype.dumpServerEnd = function(t) {
	this.currentRequests++;
	console.log("Received " + t + " (" + this.currentRequests + "/"
			+ this.totalRequests + ")");
	if (this.currentRequests == this.totalRequests) {
		console.log("Dumped config");
	}
};

OlTools.prototype.dumpEnd = function(t) {
	this.currentRequests++;
	console.log("Received " + t + " (" + this.currentRequests + "/"
			+ this.totalRequests + ")");
	if (this.currentRequests == this.totalRequests) {
		console.log("Dumped config");
	}
};

OlTools.prototype.generate = function(scope, type) {
	console.log('Read conf');
	var conf = this.readConf(this.store);
	for ( var t in conf.tokens) {
		var servers = conf.tokens[t].servers;
		console.log('Servers for ' + t + "/"+servers+'/'+Object.keys(servers).length);
		for (var i = 0; i < Object.keys(servers).length; i++) {
			var server = servers[Object.keys(servers)[i]];
			if ("all" == scope || server.hostname == scope) {
				if ("dns" == type) {
					for ( var j = 0; j < server.network.ip.length; j++ ) {
					console.log(printf("%-23s 28800  %-5s  %s", j==0 ? server.hostname : server.hostname + "_" + j,
						"A", server.network.ip[j]));						
					}
				}
				if ("ansible" == type) {
					console.log("[%s]", server.hostname);
					console.log(printf(
						"%-16s  ansible_connection=%-5s  ansible_ssh_user=%s",
						server.network.ip[0], "ssh", "root"));
				}
			} else {
				console.log('scope is not equal to ' + scope);
			}
		}
	}
};

OlTools.prototype.refresh = function() {
	console.log('Refresh');
	var self = this;
	this.conf = this.readConf(this.store);
	for ( var t in this.conf.tokens) {
		var token = this.conf.tokens[t];
		console.log('Refresh ' + t);
		request({
			method : 'GET',
			headers : {
				'Authorization' : 'Bearer ' + t,
				'X-Pretty-JSON' : '1',
				"Content-Type" : "application/json"
			},
			url : baseUrl + 'server'
		}, function(error, response, body) {
			var u = response.request.getHeader('Authorization');
			if (!error && response.statusCode == 200) {
				var body = JSON.parse(body);
				self.totalRequests = body.length;
				console.log('Set total requests to ' + body.length);
				for ( var i = 0; i <body.length; i++ ) {
					var server = body[i];
					server = server.substring(server.lastIndexOf('/') + 1,server.length);
					console.log(i + ' -> ' + server);
					self.fetchServer( server, t );
				}
			} else if (error) {
				console.log('Error: ' + error);
			} else {
				console.log(body);
			}
		});
	}		
};

OlTools.prototype.fetchServer = function(s,t) {
	console.log('Fetch server at ' + baseUrl + 'server/' + s);
	var self = this;
	request({
		method : 'GET',
		headers : {
			'Authorization' : 'Bearer ' + t,
			'X-Pretty-JSON' : '1',
			"Content-Type" : "application/json"
		},
		url : baseUrl + 'server/' + s
	}, function(error, response, body) {
		var u = response.request.getHeader('Authorization');
		u = u.substring(7,u.length);
		console.log(u);
		if (!error && response.statusCode == 200) {
			var body = JSON.parse(body);
			console.log(body);
			if ( !self.conf.tokens[u]['servers'] ) {
				self.conf.tokens[u]['servers'] = {};
			}
			var servers = self.conf.tokens[u]['servers'];
			servers[s] = body;			
		} else if (error) {
			console.log('Error: ' + error);
		} else {
			console.log(body);
		}
		self.fetchEnd(u);
	});		
};

OlTools.prototype.fetchEnd = function(t) {
	this.currentRequests++;
	console.log("Received " + t + " (" + this.currentRequests + "/"
			+ this.totalRequests + ")");
	if (this.currentRequests == this.totalRequests) {
		console.log("Write config at " + this.store);
		this.writeConf(this.conf, this.store);
	}
};

OlTools.prototype.refreshEnd = function(t) {
	this.currentRequests++;
	console.log("Received " + t + " (" + this.currentRequests + "/"
			+ this.totalRequests + ")");
	if (this.currentRequests == this.totalRequests) {
		console.log("Write config at " + this.store);
		this.writeConf(this.conf, this.store);
	}
};

OlTools.prototype.addToken = function(token) {
	var conf = this.readConf(this.store);
	if (conf == null) {
		console.log("Create new config ( %s didn't exist)", this.store);
		conf = {};
	}
	if (!conf.tokens) {
		conf.tokens = {};
	}
	if (!conf.tokens[token]) {
		conf.tokens[token] = {};
	}
	this.writeConf(conf, this.store);
};

OlTools.prototype.removeToken = function(token) {
	var conf = this.readConf(this.store);
	if (conf != null && conf.tokens[token]) {
		delete conf.tokens[token];
	}
	this.writeConf(conf, this.store);
};

OlTools.prototype.tokens = function() {
	var conf = this.readConf(this.store);
	if (conf != null) {
		for ( var t in conf.tokens) {
			console.log(t);
		}
	}
};

OlTools.prototype.get = function(scope,type) {
	var conf = this.readConf(this.store);
	if (conf != null) {
		for ( var t in conf.tokens) {
			var token = conf.tokens[t];
			if ( type == null || type == "org" ) {
				for ( var o in token.organizations) {
					var org = token.organizations[o];
					if ("all" == scope || org.name == scope)
						console.log(JSON.stringify(org, null, 2));
				}
			}
			if ( type == null || type == "server" ) {
				for ( var s in token.servers) {
					var server = token.servers[s];
					if ("all" == scope || server.hostname == scope)
						console.log(JSON.stringify(server, null, 2));
				}
			}
		}
	}
};

OlTools.prototype.writeConf = function(confObj, confPath) {
	var data = JSON.stringify(confObj, null, 2);
	if (!fs.existsSync(confPath)) {
		var confDir = path.dirname(confPath);
		if (!fs.existsSync(confDir)) {
			fs.mkdirSync(confDir, "0700");
		}
	}
	fs
			.writeFile(
					confPath,
					data,
					function(err) {
						if (err) {
							console
									.log('There has been an error saving your configuration data.');
							console.log(err.message);
							return;
						}
						console.log('Configuration saved successfully.');
					});
};

OlTools.prototype.readConf = function(confPath) {
	var exist = fs.existsSync(confPath);
	if (exist) {
		var data = fs.readFileSync(confPath), conf;
		try {
			conf = JSON.parse(data);
		} catch (err) {
			console.log('There has been an error parsing your JSON.');
			console.log(err);
		}
		return conf;
	}
	return null;
};

// server

OlTools.prototype.start = function() {
	//
};

OlTools.prototype.stop = function() {
	//
};

OlTools.prototype.run = function() {
	//
};

OlTools.prototype.status = function() {
	//
};
// export the class
module.exports = OlTools;