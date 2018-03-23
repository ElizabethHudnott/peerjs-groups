"use strict";
const peerAPIKey = 'spknmd8wnib2o6r';

var connectButton = $('#connect-btn');
var messageBox = $('#message');
var joinRequestModal = $('#join-requester');

var joinRequests = [];
var connected = false;
var p2p, myUserID;

const imageFileExtensions = /\.(bmp|apng|gif|ico|jpg|jpeg|png|svg|webp)$/;
const youTubeURL = /^https:\/\/www.youtube.com\/watch\?v=([^&]+)(&(.*))?$/;

function formatURL(url) {
	var match = url.match(youTubeURL);
	if (match !== null) {
		return '<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/' +
			match[1] +
			(match[3] === undefined? '' : '?' + match[3]) +
			'" frameborder="0" allow="encrypted-media" allowfullscreen></iframe>';
	}

	if (imageFileExtensions.test(url)) {
		return `<a href="${url}" target="_blank"><img src="${url}"/></a>`;
	}

	return '<a href="' + 
		url +
		'" target="_blank">' +
		url.replace(/&.*/, '&amp;&hellip;') +
		'</a>';
}

function escapeHTML(text) {
	var escaped;
	escaped = text.replace(/</g, '&lt;');
	escaped = escaped.replace(/http(s)?:\/\/[\S]+/g, formatURL);
	return escaped;
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

connectButton.on('click', function (event) {

	if (connected) {
		p2p.disconnect();
		connected = false;
		connectButton.html('Connect');
		connectButton.addClass('btn-primary');
		connectButton.removeClass('btn-secondary');
		$('.login-detail').slideDown({easing: 'linear', duration: 2000});
	} else {
		connected = true;
		$('.login-detail').slideUp();
		connectButton.html('Disconnect');
		connectButton.addClass('btn-secondary');
		connectButton.removeClass('btn-primary');

		myUserID = $('#user-id').val();

		p2p = new P2P(
			myUserID,
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
	} // end if connected else not connected
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
					<span class="user-id">${myUserID}:</span>
					<pre>${escapedText}</pre>
				</div>
			`);
			messageBox.val('');
			p2p.send(textToSend);
		}
	}
});
