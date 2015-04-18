var Manager = require('./lib/manager');


var options = {
	save_data: false,
	load_data: true
};

var manager = new Manager(options);
manager.initialize();