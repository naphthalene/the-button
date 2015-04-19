var Manager = require('./lib/manager');


var options = {
	save_data: true,
	load_data: true
};

var manager = new Manager(options);
manager.initialize();