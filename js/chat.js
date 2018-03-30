"use strict";
var sessionBadge = $('#session-badge');
var alertArea = $('#alerts');
var connectButton = $('#connect-btn');
var chatWindow = $('#chat');
var userList = $('#user-list');
var messageBox = $('#message');
var modalDisplayed = false;
var joinRequestModal = $('#join-request-modal');
var confirmationModal = $('#confirmation-modal');
var confirmationTitle = $('#confirm-action-title');
var confirmationActionText = $('#confirm-action-description');
var confirmationAction;

const imageFileExtensions = /\.(bmp|apng|gif|ico|jpg|jpeg|png|svg|webp)$/;
const youTubeURL = /^http(s)?:\/\/www.youtube.com\/watch\?v=([^&]+)(&(.*))?$/;
const slideShareURL = /http(s)?:\/\/www.slideshare.net\/([\w-]+\/[\w-]+)((\/?$)|\?)/

var joinRequests = [];
var connected = false;
var p2p, myUserID;

function processJoinRequest() {
	if (modalDisplayed) {
		return;
	}

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
			initializeNetworking();
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
	confirmationActionText.html(`ban <span class="user-id">${username}</span>`);
	confirmationAction = 'ban-user';
	confirmationModal.modal('show');
});

$('#confirm-action-btn').on('click', function (event) {
	switch (confirmationAction) {
	case 'ban-user':
		let userToBan = userList.val();
		p2p.rejectUser(userToBan);
		break;
	}
	confirmationModal.modal('hide');
});

function initializeNetworking() {
	//Format: API-key@hostname/path:port, preceded by wss:// for an encrypted connection.
	let url = $('#server-url').val().match(/^(ws(?:s)?:\/\/)?(?:([^@]*)@)?([^/:]+)(\/[^:]*)?(?::(\d+))?$/);
	let connectionOptions = {
		secure: url[1] === 'wss://',
		host: url[3],
		path: url[4] || '/',
		port: url[5] || 80,
		debug: 2
	};
	if (url[2] !== undefined) {
		connectionOptions.key = url[2];
	}
	p2p = new P2P(
		function (error) {
			chatWindow.append(`
				<div class="chat system-message">
					Error: ${error.message}
				</div>
			`);
			console.error(error);
			debugger;
		},
		connectionOptions
	);

	p2p.on('connected', function (event) {
		alertArea.append(`
			<div class="alert alert-info" id="pending-join-alert">
				Connected to ${event.sessionID}. Waiting for permission to join the conversation&hellip;
			</div>
		`);
	});

	p2p.on('joined', function (event) {
		messageBox[0].focus();

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
}

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
	} else if (event.key === 'Tab') {
		let start = messageBox[0].selectionStart;
		let end = messageBox[0].selectionEnd;
		let currentValue = messageBox.val();
		let before = currentValue.slice(0, start);
		let after = currentValue.slice(end);
		if (start === end) {
			if (!event.shiftKey) {
				event.preventDefault();
				messageBox.val(before + '\t' + after);
				messageBox[0].selectionStart = start + 1;
				messageBox[0].selectionEnd = start + 1;				
			}
		} else {
			event.preventDefault();
			let selection = currentValue.slice(start, end + 1);
			let lines = selection.split('\n');
			let newValue;
			if (event.shiftKey) {
				let allLinesTabbed = lines.every(function (line) {
					return line[0] === '\t' || line === '';
				});
				if (allLinesTabbed) {
					let newLines = lines.map(function (line) {
						return line.slice(1);
					});
					newValue = before + newLines.join('\n') + after;
				} else {
					return;
				}
			} else {
				newValue = before + '\t' + lines.join('\n\t') + after;
			}
			messageBox.val(newValue);
			messageBox[0].selectionStart = start;
			messageBox[0].selectionEnd = start + newValue.length;
		}
	}
});

$('.modal:not(#join-request-modal)').on('show.bs.modal', function (event) {
	modalDisplayed = true;
});

$('.modal:not(#join-request-modal)').on('hidden.bs.modal', function (event) {
	modalDisplayed = false;
	processJoinRequest();
});

{
	let sessionIDInURL = getParameterByName('room');
	if (sessionIDInURL) {
		$('#session-id').val(sessionIDInURL);
		document.getElementById('user-id').focus();
	} else {
		document.getElementById('session-id').focus();		
	}
}
