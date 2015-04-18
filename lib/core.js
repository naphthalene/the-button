var util = require('util');
var EventEmitter  = require('events').EventEmitter;

var Request = require('request');
var WebSocket = require('ws');
var moment = require('moment');

function Core()
{
	this.opts = {
		webSocketUrlRegex: /wss.[^\"]+/gmi,
		buttonUrl: 'http://www.reddit.com/r/thebutton/'
	};
	
	this.socket = false;
	this.socketUrl = false;
	
	this.previousTick = {};
}

util.inherits(Core, EventEmitter);


Core.prototype.getOption = function(name, def) {
	return this.opts[name] || def;
};

Core.prototype.initialize = function() {
	console.log('Core: Initializing the core...');
	
	this.getWebSocketUrl();
	
};

Core.prototype.getWebSocketUrl = function() {
	console.log('Core: Get the WebSocket Url...');
	
	Request(this.getOption('buttonUrl'), function (err, response, body) {
		if (!err && response.statusCode == 200) {
			this.socketUrl = body.match(this.getOption('webSocketUrlRegex'))[0];
			this.initializeWebSocket();
		}
	}.bind(this));
};

Core.prototype.initializeWebSocket = function() {
	console.log('Core: Initializing the Web Socket...');
	
	this.socket = new WebSocket(this.socketUrl);
	
	this.socket.on('open', function () {
		console.log('Core: WebSocket Connected!');
		
		this.emit('loaded');
	}.bind(this));
	
	this.socket.on('message', function (data, flags) {		
		var o = JSON.parse(data);
	    var p = o.payload;
		
		switch (o.type) {
			case 'ticking':
				
				if (this.previousTick.second <= p.seconds_left) {
					
					var click = {
						systemTime: this.previousTick.sysTime,
						clicktime: this.previousTick.tickTime,
						second: this.previousTick.second,
						clicks: p.participants_text.replace(',', '') - this.previousTick.participants
					};
					
					this.emit('click', click);
				}
				
				var tick = {
					systemTime: moment(),
					tickTime: moment(p.now_str, "YYYY-MM-DD-HH-mm-ss Z"),
					participants: p.participants_text.replace(',', ''),
					second: p.seconds_left
				}
				
				this.previousTick = tick;
				
				this.emit('tick', tick);
				
				break;
			default:
				console.log(o);
				break;

		}
	}.bind(this));
	
	this.socket.on('close', function () {
		console.log('Core: WebSocket Closed!');
		this.getWebSocketUrl();
	}.bind(this));
};


module.exports = Core;