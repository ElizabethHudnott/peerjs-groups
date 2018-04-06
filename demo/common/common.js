const URL_PARAMETERS = new URLSearchParams(document.location.search.substring(1));

var alertArea = $('#alerts');
var connectButton = $('#connect-btn');

var connected = false;
var group, myUserID;

function parseSignallingURL(url) {
	//Format: API-key@hostname/path:port, preceded by wss:// for an encrypted connection.
	let match = url.match(/^(ws(?:s)?:\/\/)?(?:([^@]*)@)?([^/:]+)(\/[^:]*)?(?::(\d+))?$/);
	let connectionOptions = {
		secure: match[1] === 'wss://',
		host: match[3],
		path: match[4] || '/',
		port: match[5] || 9000,
		debug: 2
	};
	if (match[2] !== undefined) {
		connectionOptions.key = url[2];
	}
	return connectionOptions;
}

{
	let sessionIDInURL = URL_PARAMETERS.get('room');
	if (sessionIDInURL) {
		$('#session-id').val(sessionIDInURL);
		document.getElementById('user-id').focus();
	} else {
		document.getElementById('session-id').focus();
	}
}
