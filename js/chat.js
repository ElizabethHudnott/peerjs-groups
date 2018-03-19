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
			<p class="system-message">
				Connected to ${event.sessionID}.
			</p>
		`);
	});

	p2p.on('userjoined', function (event) {
		$('#chat').append(`
			<p class="system-message">
				<span class="user-id">${event.userID}</span>
				has joined the conversation.
			</p>
		`);
	});

	p2p.on('message', function (event) {
		var text = escapeHTML(event.message);
		$('#chat').append(`
			<pre><span class="user-id">${event.userID}:</span>${text}</pre>
		`);
	})
});

messageBox.on('keyup', function (event) {
	var textToSend, escapedText;
	if (event.keyCode === 13) {
		textToSend = messageBox.val();
		escapedText = escapeHTML(textToSend);
		$("#chat").append(`
			<pre><span class="user-id">${userID}:</span>${escapedText}</pre>
		`);
		p2p.send(textToSend);
		messageBox.val('');
	}
});
