"use strict";
const peerAPIKey = 'spknmd8wnib2o6r';

var messageBox = $('#message');
var joinRequestModal = $('#join-requester');
var joinRequests = [];
var p2p, userID;

function escapeHTML(text) {
   return text.replace(/</g, '&lt;');
}

function processJoinRequest() {
	var userID = joinRequests[joinRequests.length - 1];
	$('.requesting-user-id').html(escapeHTML(userID));
	joinRequestModal.modal({});
}

$('#accept-join').on('click', function (event) {
	joinRequestModal.modal('hide');
	var userID = joinRequests.pop();
	p2p.acceptUser(userID);
	if (joinRequests.length > 0) {
		processJoinRequest();
	}
});

$('#reject-join').on('click', function (event) {
	joinRequestModal.modal('hide');
	var userID = joinRequests.pop();
	p2p.rejectUser(userID);
	if (joinRequests.length > 0) {
		processJoinRequest();
	}
});

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

	p2p.on('joinrequest', function (event) {
		joinRequests.push(event.userID);
		processJoinRequest();
	});

	p2p.on('userjoined', function (event) {
		$('#chat').append(`
			<div class="chat system-message">
				<span class="user-id">${event.userID}</span>
				has joined the conversation.
			</div>
		`);
	});

	p2p.on('userleft', function (event) {
		$('#chat').append(`
			<div class="chat system-message">
				<span class="user-id">${event.userID}</span>
				has left the conversation.
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

messageBox.on('input', function (event) {
    $(this).height(0).height(this.scrollHeight);
});

messageBox.on('keyup', function (event) {
	var textToSend, escapedText;
	if (event.key === 'Enter') {
		if (event.ctrlKey) {
			messageBox.val(messageBox.val() + '\n');
			messageBox.height(0).height(this.scrollHeight);
		} else {
			textToSend = messageBox.val();
			escapedText = escapeHTML(textToSend);
			messageBox.css('height', '');
			$("#chat").append(`
				<div class="chat">
					<span class="user-id">${userID}:</span>
					<pre>${escapedText}</pre>
				</div>
			`);
			messageBox.val('');
			p2p.send(textToSend);
		}
	}
});
