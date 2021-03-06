var request = require('request');
var fs = require("fs");
var config = require("./config.json");
var url = config.url;

var Filter = require('bad-words'),
  filter = new Filter();

var validator = require('validator');

var error_count = 0;

var logs_dir = "logs",
error_log_file = "logs/error.log";

//------------------------------Run this shit------------------------------------
setup_all_the_junk();
login_then_run_bot();

var version = '0.2.1',
socket,
csrf,
uid,
balance;

//------------------------------setup--------------------------------------------
function setup_all_the_junk() {
	fs.existsSync(logs_dir) || fs.mkdirSync(logs_dir);
	fs.existsSync(error_log_file) || fs.openSync(error_log_file, "w");
};

//------------------------------Handle chat---------------------------------------
function handle_txt(a, c) { //txt, date
    var d = a.substring(a.indexOf("(") + 1, a.indexOf(")")),
        e = a.substring(a.indexOf("<") + 1, a.indexOf(">"));
		//sender_uid, sender_name, message, date
    switch (a.substring(0, 1)) {
        case "(":
            var b = a.substring(a.indexOf(">") + 2, a.length);
            "*" === a.substring(a.indexOf(")") + 2, a.indexOf(")") + 3) ? (console.log(d, e, b, c + ' ')) : (Process_commands(d, e, b, c));
            break;
        case "[":
            a.substring(a.indexOf("]") + 2, a.length)
				//console.log('PM sender_uid d, sender_name e , message b , date c')
				var b = a.substring(a.indexOf(']') + 2, a.length);
				Process_commands(d, e, b, c, 'pm')
    }
};

function is_master(a) {
    return a == config.masterID ? !0 : !1
};

function Process_commands(senderuid, senderName, txt, date, pm) {
	if(pm){}
	var command = txt.match(/^&/);
	var cleanText = sanitizeString(txt);
	
	if (command) {
		txt = txt.substring(1);
		txt = txt.split(/\s+/);
		console.log(txt[0]);
		if (is_master(senderuid)) {

			try {
				switch (txt[0]) {
				case 'test':
					console.log("masterid TEST WORKS");
					break;
				default:
					//console.log('unknown command;', txt[0]);
					break;
				}
			} catch (err) {
				console.log(err);
				log_error('masterid command err: ' + err);
			}
		}

		try {
			switch (txt[0]) {
			case 'test':
				console.log("TEST WORKS");
				//chat("test works");
				break;
			default:
				console.log('unknown command;', txt[0]);
				break;
			}
		} catch (err) {
			console.log(err);
			log_error('command err: ' + err);
		}
	}
}

function sanitizeString(a) { //Used to clean input
	a = a.replace(/[^a-z0-9\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1\u00fc \.,_-]/gim, "");
	return a.trim()
}

function trim1(a) { // trim empty junk
	return a.replace(/^\s\s*/, "").replace(/\s\s*$/, "")
};

//------------------------------Handle Posting chat-------------------------------

setInterval(function () {
	updateChatCmds()
}, 5E3);

var cmdArray = []; // store all the chats

function chat(a) { // use chat('string')
	cmdArray.push({
		ChatMsgs : a
	})
}

function ExecuteChat(a) { // emit all the chats
    a = filter.clean(a);
	socket.emit("chat", csrf, a);
	console.log("socket sent: " + a)
}

function updateChatCmds() { // call and shift all the chats
	var a;
	0 < cmdArray.length && (a = cmdArray[0].ChatMsgs, ExecuteChat(a), cmdArray.shift())
};

//------------------------------command functions----------------------------------
function send_tip(b, a, c) { // send a tip to uid, amount, message
    a = parseFloat(a).toFixed(8);
    b = "/tip noconf " + b + " " + a + ' "' + c + '"';
    parseFloat(a) < balance ? chat(b) : console.log("Not enough balance")
};

//------------------------------random stuff---------------------------------------
function rollDie(a) { // returns a result from a dice with x sides. if no sides specified defaults to 6
	void 0 == a && (a = 6);
	return Math.floor(Math.random() * a + 1)
};

function randomIntFromInterval(a, b) { // returns a random int between a(low) b(high)
	return Math.floor(Math.random() * (b - a + 1) + a)
};

//------------------------------Logging---------------------------------------------------
function log_error(a) {
    console.log('Logged ERR:' + a);
    fs.appendFileSync(error_log_file, a + "\n")
};

//------------------------------Login stuff---------------------------------------
//--------------------------------------------------------------------------------
function login_then_run_bot() {

	var credentials = {
		hash : '',
		username : config.nick,
		password : config.pass,
		code : ''
	};

	login(credentials, function (err, cookie) {
		if (err) {
			console.log('ERROR:', err);
			return;
		}

		console.log('logged in; got cookie (secret - do not share!):');
		run_bot(cookie);
	});
}

function login(credentials, cb) {
	var jar = request.jar();

	req = {
		url : url,
		jar : jar,
		form : {}
	}

	if (credentials.hash) {
		if (credentials.username || credentials.password)
			return cb('either specify a hash or a username and password');
		jar.setCookie(request.cookie('hash=' + credentials.hash), url);
	}

	if (credentials.username)
		req.form.username = credentials.username;
	if (credentials.password)
		req.form.password = credentials.password;
	if (credentials.code)
		req.form.code = credentials.code;

	request.post(req, function (err, res, body) {
		if (err)
			return cb(err);

		if (body.match(/Please enter your 6 digit google authentification number/))
			return cb('that account requires a correct 2FA code and hash to log in; 2FA codes can only be used once each');

		if (body.match(/Your account is set up to require a google authentification code for this action/))
			return cb('that account requires a 2FA code in addition to the username and password to log in');

		if (body.match(/Please enter your username/))
			return cb('that account requires a correct username and password, and possibly 2FA code; 2FA codes can only be used once each');

		var cookie = jar.getCookieString(url);

		if (!cookie.match(/hash=/))
			return cb('bad hash');

		return cb(null, cookie);
	});
}

var first_login = true;

function run_bot(cookie) {
	if (first_login) {
		first_login = false;
	}

	var transport = 'websocket';
	// var transport = 'polling';

	var inits = 0;

	socket = require("socket.io-client")(url, {
			transports : [transport],
			extraHeaders : {
				origin : url,
				cookie : cookie
			}
		});

	socket.on('getver', function (key) {
		socket.emit('version', csrf, key, "RPI-alertbot-LED:" + version);
	});

	socket.on('error', function (err) {
		console.log('caught error:', err);
		console.log('logging in again');
		login_then_run_bot();

		if (JSON.stringify(err).indexOf("can not find session") > -1) {
			error_count += 1;
			if (error_count > 1) {
				login_then_run_bot();
				error_count = 0;
			}
		}

		// ### DISCONNECTED ###
		// caught error:   can not find session
		log_error(JSON.stringify(err));
	});

	socket.on('init', function (data) {
		uid = data.uid;
		if (!inits++) {
			csrf = data.csrf;
			balance = data.balance;
			console.log(' ### CONNECTED as (' + uid + ') <' + data.name + '>');
		} else {
			console.log('### RECONNECTED ###');
			csrf = data.csrf;
			error_count = 0;
		}
	});

	socket.on('set_hash', function (hash) {
		console.log('INFO:', 'server requested that we reconnect...');
		socket.close();
		run_bot(cookie);
	});

	socket.on('chat', function (txt, date) {
		handle_txt(txt, date);
	});

	socket.on('tip', function (sender_uid, sender_name, amount, r, i) {
		console.log(sender_uid, sender_name, amount)
	});

	socket.on('staked', function (data) {});

	socket.on('result', function (data) {});

	socket.on('address', function (addr, img, confs) {
		console.log('DEPOSIT:', addr);
	});

	socket.on('invest_error', function (txt) {
		console.log('invest_error:', txt);
		log_error('invest_error:' + txt);
	});

	socket.on('divest_error', function (txt) {
		console.log('divest_error:', txt);
		log_error('divest_error:' + txt);
	});

	socket.on('jderror', function (txt) {
		console.log('jderror:',txt);
		log_error('jderror:' + txt);
	});

	socket.on('jdmsg', function (txt) {
		console.log('INFO:', txt);
	});

	socket.on('form_error', function (txt) {
		console.log('FORM ERROR:', txt);
		log_error('FORM ERROR:' + txt);
	});

	socket.on('login_error', function (txt) {
		console.log('LOGIN ERROR:', txt);
		log_error('LOGIN ERROR:' + txt);
	});

	socket.on('balance', function (data) {
		if (data) {
			console.log('Current balance ' + data)
		}
	});

	socket.on('disconnect', function () {
		console.log('### DISCONNECTED ###');
	});
}