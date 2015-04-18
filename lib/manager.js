var util = require('util');
var EventEmitter  = require('events').EventEmitter;
var moment = require('moment');

var Core = require('./core');
var Storage = require('./storage');

var colors = {
    purple: '\033[0;35m',
    blue: '\033[1;34m',
    green: '\033[0;32m',
    yellow: '\033[1;33m',
    orange: '\033[0;33m',
    red: '\033[0;31m',

	bold: '\033[1m',
    reset: '\033[0m'
}

var constants = {
	COLS_LENGTH: 13,
	TOTAL_ROWS: 63,
	LATEST_CLICKS: 40
};

function Manager()
{
	this.fullyInitialized = false;
	
	this.core = new Core();
	this.storage = new Storage();
	
	this.seconds = [];
	this.lowestSecond = 60;
	this.lastTick = false;
	this.firstClick = false;
	this.lastClick = false;
	this.clicks = 0;
	
	this.totalClicks = 0;
	this.lastAddedClicks = 0;
	this.clicksPerDay = {};
	this.clicksPerSecond = [];
	this.latestClicks = [];
	this.clicksPerColumn = [];
	
	this.headerLine = [
		{text: 'Purples', color: colors.purple}, 
		{text: 'Blues', color: colors.blue},
		{text: 'Greens', color: colors.green},
		{text: 'Yellows', color: colors.yellow},
		{text: 'Oranges', color: colors.orange},
		{text: 'Reds', color: colors.red}
	];
	
	this.text = '';
}

util.inherits(Manager, EventEmitter);


Manager.prototype.initialize = function() {
	console.log('Manager: Initializing...');
	
	for (var i=0; i<=60; i++) {
		this.seconds[i] = false;
		this.clicksPerSecond[i] = 0;
	}
	
	this.listen();
	this.storage.initialize();
};

Manager.prototype.checkLowestSecond = function (tick) {
	if (!this.seconds[tick.second]) {
		this.seconds[tick.second] = tick;
		
		this.storage.setLowestSecond(tick.second, tick);
	}
};

Manager.prototype.listen = function() {
	this.storage.once('loaded', function(payload) {
		/*{lowest: int, seconds: object, clicks: int};*/
		
		console.log(colors.green + 'Manager: Storage Loaded!' + colors.reset);
		
		this.lowestSecond = payload.lowest;
		this.clicks = payload.clicks;
		
		for (var i in payload.seconds) {
			this.seconds[i] = payload.seconds[i];
		}
		
		this.core.initialize();
	}.bind(this));
	
	this.storage.on('clickData', this.onClickData.bind(this));
	
	this.core.once('loaded', function() {
	
		console.log(colors.green + 'Manager: Core Loaded!' + colors.reset);
		
		this.storage.loadClicks(function() {
			this.redraw();
			this.fullyInitialized = true;
		}.bind(this));
	
	}.bind(this));

	this.core.on('tick', this.onTick.bind(this));
	this.core.on('click', this.onClick.bind(this));
};

Manager.prototype.onClick = function(click) {
	/*{systemTime: int, clickTime: int, second: int, clicks: int}*/

	this.clicks++;
	this.storage.saveClick(this.clicks, click);
	
	this.onClickData(click, 'last');
	
	if (this.fullyInitialized) {
		this.redraw();
	}
};

Manager.prototype.onClickData = function(data, type) {
	var day = moment(data.tickTime).format('YYYY-MM-DD');
	
	this.lastClick = data;
	
	this.totalClicks += data.clicks;
	this.clicksPerSecond[data.second] += data.clicks;
	
	switch(type) {
		case 'first':
			this.firstClick = data;
			break;
	}
	
	if (!this.clicksPerDay[day]) {
		this.clicksPerDay[day] = 0;
	}
	
	this.clicksPerDay[day] += data.clicks;
	
	this.addLatestClick(data);
};

Manager.prototype.onTick = function(tick) {
	/*{systemTime: int, tickTime: int, participants: int, second: int}*/
		
	this.checkLowestSecond(tick);
	
	var text = '[' + tick.tickTime.format('YYYY-MM-DD HH:mm:ss.SSS') + '] ' + tick.second + '.00 seconds ';
	text += this.getSecondsBar(tick.second);
	
	if (this.fullyInitialized) {
		process.stdout.write(this.colorTextBySecond(tick.second, text) + '\r');
	}
	
	this.lastTick = tick;
};

Manager.prototype.redraw = function() {
	this.text = ''; // our text body for everything
	this.rowsLeft = constants.TOTAL_ROWS;
	this.clicksPerColumn = [];
	
	this.drawHeader();
	
	this.drawTableHead();
	this.drawTableBody();
	this.drawTableFooter();
	
	this.drawLatest();
	
	while(this.rowsLeft > 1) {
		this.addRow();
	}
	
	console.log('\033[2J');
	process.stdout.write(this.text);
};

Manager.prototype.drawHeader = function() {
	var sum = 0;
	var days = 0;
	
	for (var i in this.clicksPerDay) {
		days++;
		sum += parseInt(this.clicksPerDay[i]);
	}
	
	// Header
	this.text +=         colors.bold + 'First Click: ' + colors.reset + moment(this.firstClick.tickTime).format('YYYY-MM-DD HH:mm:ss');
	this.text += '    ' + colors.bold + 'Last Click: ' + colors.reset + moment(this.lastClick.tickTime).format('YYYY-MM-DD HH:mm:ss');
	this.text += '    ' + colors.bold + 'Days Elapsed: ' + colors.reset + days;
	
	this.addRow();
	
	this.text +=          colors.bold + 'Total Clicks: ' + colors.reset + this.totalClicks + ' (+' + this.lastAddedClicks + ')';
	this.text += '    ' + colors.bold + 'Clicks / Day: ' + colors.reset + (Math.round(sum / days * 100) / 100).toFixed(2);
	
	this.addRow();
	this.addRow();
};

Manager.prototype.drawTableHead = function() {

	for (var i in this.headerLine) {
		var header = this.headerLine[i];
		
		var unitText = header.text;
		this.text += colors.bold + this.colorText(header.color, unitText);
		
		if (unitText.length < constants.COLS_LENGTH) {
			for (var i=unitText.length; i<constants.COLS_LENGTH; i++) {
				this.text += ' ';
			}
		}
	}
	this.addRow();
	
	for (var i in this.headerLine) {
		var header = this.headerLine[i];
		var unitText = '';
		for (var i = 0; i<(constants.COLS_LENGTH-1); i++) {
			unitText += '-';
		}
		unitText += ' ';
		
		this.text += colors.bold + this.colorText(header.color, unitText);
	}
	this.addRow();
};

Manager.prototype.drawTableBody = function() {
	// Body rows
	var lines = [
		[60,51,41,31,21,11],
		[59,50,40,30,20,10],
		[58,49,39,29,19,09],
		[57,48,38,28,18,08],
		[56,47,37,27,17,07],
		[55,46,36,26,16,06],
		[54,45,35,25,15,05],
		[53,44,34,24,14,04],
		[52,43,33,23,13,03],
		[00,42,32,22,12,02],
		[00,00,00,00,00,01]
	];
	
	for (var l in lines) {
	
		for (var s in lines[l]) {
			
			var second = lines[l][s];
			var isCurrent = (this.lastClick.second == second);
			
			var secondText = !second ? '' : (second < 10 ? ' ' : '') + second + ': ';
			var unitText = !second ? '' : this.clicksPerSecond[second].toString();
			
			var prefix = !second ? '' : 
				(isCurrent 
					? colors.bold + secondText + colors.reset 
					: this.colorTextBySecond(second, secondText));
					
			this.text += prefix;
			
			for (var i=(secondText.length + unitText.length); i<(constants.COLS_LENGTH-1); i++) {
				this.text += ' ';
			}
			
			this.text += (isCurrent 
				? colors.bold + unitText + colors.reset
				: this.colorTextBySecond(second, unitText)) + ' ';
			
			if (!this.clicksPerColumn[s]) {
				this.clicksPerColumn[s] = 0;
			}
			
			this.clicksPerColumn[s] += this.clicksPerSecond[second];
		}
		this.addRow();
	}
};

Manager.prototype.drawTableFooter = function() {
	// Footer rows	
	for (var i in this.headerLine) {
		var header = this.headerLine[i];
		var unitText = '';
		for (var i = 0; i<(constants.COLS_LENGTH-1); i++) {
			unitText += '-';
		}
		unitText += ' ';
		
		this.text += colors.bold + this.colorText(header.color, unitText);
	}
	this.addRow();
	
	for (var c in this.clicksPerColumn) {
		var color = this.headerLine[c].color;
		var unitText = this.clicksPerColumn[c].toString();
		
		for (var i=unitText.length; i<(constants.COLS_LENGTH-1); i++) {
			this.text += ' ';
		}
		
		this.text += this.colorText(color, unitText) + ' ';
	}
	this.addRow();
	
	for (var c in this.clicksPerColumn) {
		var color = this.headerLine[c].color;
		var percent = (Math.round((this.clicksPerColumn[c] / this.totalClicks) * 100 * 10000) / 10000).toFixed(4);
		var unitText = "(" + percent.toString()  + "%)";

		for (var i=unitText.length; i<(constants.COLS_LENGTH-1); i++) {
			this.text += ' ';
		}

		this.text += this.colorText(color, unitText) + ' ';
	}
	this.addRow();
	this.addRow();
};

Manager.prototype.drawLatest = function() {
	// Latest Clicks
	this.text += colors.bold + 'Latest ' + this.latestClicks.length + ' clicks:' + colors.reset;
	this.addRow();
	
	for (var i in this.latestClicks) {
		var click = this.latestClicks[i];
		
		var diff = 60 - click.second;
		
		var unitText = '[' + moment(click.tickTime).format('YYYY-MM-DD HH:mm:ss.SSS') + '] ' + click.second + '.00 seconds ';
		while (diff > 0) {
			unitText += '#';
			diff--;
		}
		
		unitText += click.clicks > 1 ? ' (' + click.clicks + ' clicks)' : '';
		
		this.text += this.colorTextBySecond(click.second, unitText);
		this.addRow();
	}
}

Manager.prototype.addRow = function() {
	this.text += '\n';
	this.rowsLeft--;
};

Manager.prototype.addLatestClick = function(data) {
	var count = this.latestClicks.push(data);
	if (count > constants.LATEST_CLICKS) {
		this.latestClicks.splice(0,1);
	}
};

Manager.prototype.getSecondsBar = function(second) {
	var bar = '';
	for (var i = 60; i > second; i--) {
		bar += '#';
	}
	
	return bar;
}

Manager.prototype.colorTextBySecond = function(second, text) {
	var color = this.getColor(second);
	
	return this.colorText(color, text);
};

Manager.prototype.colorText = function(color, text) {
	return color + text + colors.reset;
};

Manager.prototype.getColor = function(second) {
	if (this.inRange(second, 52, 60)) {
        return colors.purple;
    }
	
	if (this.inRange(second, 42, 51)) {
        return colors.blue;
    }
	
	if (this.inRange(second, 32, 41)) {
        return colors.green;
    }
	
	if (this.inRange(second, 22, 31)) {
        return colors.yellow;
    }
	
	if (this.inRange(second, 12, 21)) {
        return colors.orange;
    }
	
	if (this.inRange(second, 0, 11)) {
        return colors.red;
    }
	
	return '';
};

Manager.prototype.inRange = function(needle, min, max) {
	return needle >= min && needle <= max;
};

module.exports = Manager;