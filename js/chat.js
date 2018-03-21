"use strict";
const peerAPIKey = 'spknmd8wnib2o6r';

var messageBox = $('#message');
var p2p, userID;

function escapeHTML(text) {
   return text.replace(/</g, '&lt;');
}

$('#connect-btn').on('click', function (event) {
	$('#connect-btn').prop('disabled', true);

	userID = $('#user-id').val();

	p2p = new P2P(
		userID,
		function (error) {
				debugger;
		},
		{key: peerAPIKey, debug: 2}

	);

	var sessionID = $('#session-id').val();
	p2p.connect(sessionID);

	p2p.on('connected', function (event) {
		$('#chat').append(`
			<div class="chat system-message">
				Connected to ${event.sessionID}.
			</div>
		`);
	});

	p2p.on('userjoined', function (event) {
		$('#chat').append(`
			<div class="chat system-message">
				<span class="user-id">${event.userID}</span>
				has joined the conversation.
			</div>
		`);
	});

	p2p.on('message', function (event) {
		var text = escapeHTML(event.message);
		var cssClass, annotation;
		if (event.isPrivate) {
			cssClass = 'private-msg';
			annotation = ' (Private)';
		} else {
			cssClass = '';
			annotation = '';
		}
		$('#chat').append(`
			<div class="chat ${cssClass}">
				<span class="user-id">${event.userID}${annotation}:</span>
				<pre>${text}</pre>
			</div>
		`);
	})
});

messageBox.on('keyup', function (event) {
	var textToSend, escapedText;
	if (event.keyCode === 13) {
		textToSend = messageBox.val();
		escapedText = escapeHTML(textToSend);
		$("#chat").append(`
			<div class="chat">
				<span class="user-id">${userID}:</span>
				<pre>${escapedText}</pre>
			</div>
		`);
		p2p.send(textToSend);
		messageBox.val('');
	}
});
