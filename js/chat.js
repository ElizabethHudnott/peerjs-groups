"use strict";
var p2p;
const peerAPIKey = 'spknmd8wnib2o6r';


function displayMessage() {
	console.log(userID + ": " + text);
}

function displayError(error) {

}



$('#connect-btn').on('click', function (event) {
	$('#connect-btn').prop('disabled', true);

	var userID = $('#user-id').val();
	p2p = new P2P(userID, {key: peerAPIKey});

	var sessionID = $('#session-id').val();
	p2p.connect(sessionID);

	p2p.on('connected', function (event) {
		console.log('Connected to ' + event.sessionID);
	});
	p2p.on('user-joined', function (event) {
		console.log(event.userID + ' has joined.');
	});
});
