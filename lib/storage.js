var util = require('util');
var EventEmitter  = require('events').EventEmitter;

var redis = require('redis');
var moment = require('moment');

var constants = {
	REDIS_SECONDS_KEY: 'reddit:seconds',
	REDIS_CLICK_KEY: 'reddit:clicks:',
	REDIS_CLICKS_KEY: 'reddit:clicks'
}

function Storage()
{
	this.client = false;
}

util.inherits(Storage, EventEmitter);


Storage.prototype.initialize = function() {

	console.log('Storage: Initialize Storage...');

	this.initializeRedis();

	this.getBasicDetails();
};

Storage.prototype.initializeRedis = function() {

	this.client = redis.createClient();

	this.client.on('error', function(err) {
		console.log('Storage: Redis Error ' + err);
	});

	this.client.on('connect', function() {
		console.log('Storage: Redis Client Connected...');
	});

	this.client.on('end', function() {
		console.log('Storage: Redis Connection Ended...');

		this.initializeRedis();
	}.bind(this));
};

Storage.prototype.saveClick = function(clickId, click, callback) {

	this.client.set(constants.REDIS_CLICKS_KEY, clickId);
	this.client.set(constants.REDIS_CLICK_KEY + clickId, JSON.stringify(click));

	if (callback) {
		callback();
	}
};

Storage.prototype.setLowestSecond = function(second, payload, callback) {

	this.client.hmset(constants.REDIS_SECONDS_KEY, second, JSON.stringify(payload));

	if (callback) {
		callback();
	}
};

Storage.prototype.getSeconds = function(callback) {

	this.client.hgetall(constants.REDIS_SECONDS_KEY, function(err, obj) {
		var lowest = 60;
		var seconds = {};

		if (obj) {
			for(var i in obj) {
				seconds[i] = JSON.parse(obj[i]);

				if (i < lowest) {
					lowest = i;
				}
			}
		}

		if (callback) {
			callback(lowest, seconds);
		}
	});
};

Storage.prototype.getClicks = function(callback) {

	this.client.get(constants.REDIS_CLICKS_KEY, function(err, reply) {
		if (callback) {
			callback(reply || 0);
		}
	});
};

Storage.prototype.getBasicDetails = function() {

	this.getSeconds(function (lowest, seconds) {
		this.getClicks(function(clicks) {

			var payload = {
				lowest: lowest,
				seconds: seconds,
				clicks: clicks
			};

			this.emit('loaded', payload);
		}.bind(this));
	}.bind(this));
};

Storage.prototype.loadClicks = function(callback) {

	this.client.get(constants.REDIS_CLICKS_KEY, function(err, reply) {
		var callbacks = reply || 0;

		var done = function() {
			callbacks--;

			if (callbacks == 0) {
				callback();
			}
		};

		if (callbacks == 0) {
			callback();
		}

		for (var i = 1; i<= reply; i++) {
			this.loadClick(constants.REDIS_CLICK_KEY + i, (i == 1 ? 'first' : (i == reply ? 'last' : 'next')), done);
		}
	}.bind(this));
};

Storage.prototype.loadClick = function(key, type, callback) {
	this.client.get(key, function(err, reply) {
		var data = JSON.parse(reply);

		this.emit('clickData', data, type);

		callback();
	}.bind(this));
};

module.exports = Storage;
