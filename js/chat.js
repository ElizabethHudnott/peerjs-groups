"use strict";
const peerAPIKey = 'spknmd8wnib2o6r';

var sessionBadge = $('#session-badge');
var alertArea = $('#alerts');
var connectButton = $('#connect-btn');
var chatWindow = $('#chat');
var userList = $('#user-list');
var messageBox = $('#message');
var joinRequestModal = $('#join-request-dialog');
var confirmationModal = $('#confirmation-dialog');
var confirmationTitle = $('#confirm-action-title');
var confirmationAction = $('#confirm-action-description');

const imageFileExtensions = /\.(bmp|apng|gif|ico|jpg|jpeg|png|svg|webp)$/;
const youTubeURL = /^http(s)?:\/\/www.youtube.com\/watch\?v=([^&]+)(&(.*))?$/;
const slideShareURL = /http(s)?:\/\/www.slideshare.net\/([\w-]+\/[\w-]+)((\/?$)|\?)/

var joinRequests = [];
var connected = false;
var p2p = new P2P(
	function (error) {
		chatWindow.append(`
			<div class="chat system-message">
				Error: ${error.message}
			</div>
		`);
		console.error(error);
		debugger;
	},
	{key: peerAPIKey, debug: 2}
);
var myUserID;

function processJoinRequest() {
	if (joinRequests.length == 0) {
		joinRequestModal.modal('hide');
	} else {
		var userID = joinRequests[0];
		$('.requesting-user-id').html(userID);
		joinRequestModal.modal('show');
	}
}

$('#accept-join').on('click', function (event) {
	var userID = joinRequests.shift();
	p2p.acceptUser(userID);
	processJoinRequest();
});

$('#reject-join').on('click', function (event) {
	var userID = joinRequests.shift();
	p2p.rejectUser(userID);
	processJoinRequest();
});

function disconnected() {
	connected = false;
	sessionBadge.css('visibility', 'hidden');
	connectButton.html('Connect');
	connectButton.addClass('btn-primary');
	connectButton.removeClass('btn-secondary');
	$('.login-detail').slideDown({easing: 'linear', duration: 2000});
	userList.children(':not([value=everyone])').remove();
}

connectButton.on('click', function (event) {
	alertArea.html('');

	if (connected) {
		event.preventDefault();
		p2p.disconnect();
		disconnected();
		chatWindow.append(`
			<div class="chat system-message">
				<span class="user-id">${myUserID}</span>
				has left the conversation.
			</div>
		`);
	} else {
		if (document.getElementById('login-form').checkValidity()) {
			event.preventDefault();
			connected = true;
			$('.login-detail').slideUp();
			connectButton.html('Disconnect');
			connectButton.addClass('btn-secondary');
			connectButton.removeClass('btn-primary');

			myUserID = $('#user-id').val();
			myUserID = myUserID.replace(/\s{2,}/g, ' ').replace(/\s$/, '');
			var sessionID = $('#session-id').val();
			if (sessionID === '') {
				sessionID = undefined;
			}
			p2p.connect(sessionID, myUserID);
		}
	} // end if connected else not connected
});

userList.on('input', function (event) {
	$('#ban-user-btn').prop('disabled', $(this).val() === 'everyone');
});

$('#ban-user-btn').on('click', function (event) {
	var userToBan = userList.val();
	var username = userList.children(`[value=${userToBan}]`).html();
	confirmationTitle.html('Ban ' + username);
	confirmationAction.html(`ban <span class="user-id">${username}</span>`);
	confirmationModal.modal('show');
});

p2p.on('connected', function (event) {
	alertArea.append(`
		<div class="alert alert-info" id="pending-join-alert">
			Connected to ${event.sessionID}. Waiting for permission to join the conversation&hellip;
		</div>
	`);
});

p2p.on('joined', function (event) {
	$('#pending-join-alert').remove();
	var alert = $(`
		<div class="alert alert-success alert-dismissible">
			You're now part of the conversation "${event.sessionID}".
			<button type="button" class="close" data-dismiss="alert" aria-label="Close">
				<span aria-hidden="true">&times;</span>
			</button>
  		</div>
	`);
	alertArea.append(alert);
	fadeOutAndRemove(alert);

	chatWindow.append(`
		<div class="chat system-message">
			<span class="user-id">${myUserID}</span> is present.
		</div>
	`);

	sessionBadge.html('<span class="sr-only">The current session name is </span>' + event.sessionID);
	sessionBadge.css('visibility', 'visible');

	if (event.isAdmin) {
		$('#ban-user-btn').show();
	}
});

p2p.on('ejected', function (event) {
	$('#pending-join-alert').remove();
	alertArea.append(`
		<div class="alert alert-warning">
			${event.message}
		</div>
	`);
	disconnected();
});

p2p.on('joinrequest', function (event) {
	if (event.userID === 'everyone') {
		p2p.rejectUser(userID);
	} else {
		joinRequests.push(event.userID);
		if (joinRequests.length == 1) {
			processJoinRequest();
		}
	}
});

p2p.on('userpresent', function (event) {
	var userID = event.userID;
	chatWindow.append(`
		<div class="chat system-message">
			<span class="user-id">${userID}</span> is present.
		</div>
	`);
	var userListOptions = userList.children();
	var newOption = `<option value="${userID}">${userID}</option>`;
	var inserted = false;
	for (let i = 0; i < userListOptions.length; i++) {
		let option = userListOptions.eq(i);
		let value = option.attr('value');
		if (value > userID && value !== 'everyone') {
			$(newOption).insertBefore(option);
			inserted = true;
			break;
		}
	}
	if (!inserted) {
		userList.append(newOption);
	}
});

p2p.on('userleft', function (event) { 
	var userID = event.userID
	chatWindow.append(`
		<div class="chat system-message">
			<span class="user-id">${userID}</span>
			has left the conversation.
		</div>
	`);
	userList.children(`[value=${userID}]`).remove();
});

p2p.on('message', function (event) {
	var text = formatAsHTML(event.message);
	var scrolledToBottom = chatWindow.scrollTop() >= chatWindow[0].scrollHeight - chatWindow.height() - 1;
	var annotation;
	if (event.isPrivate) {
		annotation = ' (Private)';
	} else {
		annotation = '';
	}
	chatWindow.append(`
		<div class="chat">
			<span class="user-id">${event.userID}${annotation}:</span>
			<pre>${text}</pre>
		</div>
	`);
	if (scrolledToBottom) {
		chatWindow.scrollTop(chatWindow[0].scrollHeight);
	}
});

function resizeMessageBox() {
	messageBox.css('min-height', '');
	var height = Math.min(messageBox[0].scrollHeight + 2, 250);
	messageBox.css('min-height', height + 'px');
}

messageBox.on('input', function (event) {
	resizeMessageBox();
});

messageBox.on('keydown', function (event) {
	if (event.key === 'Enter') {
		event.preventDefault();
		if (event.ctrlKey) {
			messageBox.val(messageBox.val() + '\n');
			resizeMessageBox();
		} else {
			let textToSend = messageBox.val();
			let formattedText = formatAsHTML(textToSend);
			let scrolledToBottom = chatWindow.scrollTop() >= chatWindow[0].scrollHeight - chatWindow.height() - 1;
			let destination = escapeHTML(userList.val());
			let annotation;
			if (destination === 'everyone') {
				annotation = '';
			} else {
				annotation = ` (to ${destination})`;
			}
			chatWindow.append(`
				<div class="chat">
					<span class="user-id">${myUserID}${annotation}:</span>
					<pre>${formattedText}</pre>
				</div>
			`);
			messageBox.val('');
			resizeMessageBox();
			if (scrolledToBottom) {
				chatWindow.scrollTop(chatWindow[0].scrollHeight);
			}
			if (destination === 'everyone') {
				p2p.send(textToSend);
			} else {
				p2p.sendPrivate(destination, textToSend);
			}
		}
	}
});

{
	let sessionIDInURL = getParameterByName('room');
	if (sessionIDInURL) {
		$('#session-id').val(sessionIDInURL);
	}
}
