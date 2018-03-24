"use strict";
const peerAPIKey = 'spknmd8wnib2o6r';

var connectButton = $('#connect-btn');
var chatWindow = $('#chat');
var messageBox = $('#message');
var joinRequestModal = $('#join-requester');

var joinRequests = [];
var connected = false;
var p2p, myUserID;

const imageFileExtensions = /\.(bmp|apng|gif|ico|jpg|jpeg|png|svg|webp)$/;
const youTubeURL = /^http(s)?:\/\/www.youtube.com\/watch\?v=([^&]+)(&(.*))?$/;
const slideShareURL = /http(s)?:\/\/www.slideshare.net\/([\w-]+\/[\w-]+)((\/?$)|\?)/

function getParameterByName(name) {
	name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
	var regexS = "[\\?&;]"+name+"=([^&;#]*)";
	var regex = new RegExp(regexS);
	var url = window.location.href;
	var result = regex.exec(url);
	if (result === null) {
		return "";
	} else {
		return decodeURIComponent(result[1].replace(/\+/g, " "));
	}
}

function escapeHTML(text) {
	var escaped;
	escaped = text.replace(/</g, '&lt;');
	escaped = escaped.replace(/(^|\s)\*([^\s*][^*]*)\*/, '$1<strong>$2</strong>');
	escaped = escaped.replace(/http(s)?:\/\/[\w$\-.+!*'(),;/?=&%~\[\]]+/g, formatURL);
	escaped = escaped.replace(
		/(^|\s)#(\w{3,})/g,
		'$1<a href="https://twitter.com/search?src=typd&q=%23$2" target="_blank">#$2</a>'
	);
	return escaped;
}

function formatURL(url) {
	var punctuation, essentialPunctuation, match, url2, maxWidth;
	punctuation = url.match(/([,;.?!')]+)$/)[1];
	if (punctuation === undefined) {
		punctuation = '';
		essentialPunctuation = '';
	} else {
		url = url.slice(0, -(punctuation.length));
		essentialPunctuation = punctuation.match(/([?!')].*)?/)[1];
		if (essentialPunctuation === undefined) {
			essentialPunctuation = '';
		}
	}

	match = url.match(youTubeURL);
	if (match !== null) {
		return '<div class="iframe-container">' +
			'<iframe width="640" height="360" src="https://www.youtube-nocookie.com/embed/' +
			match[2] +
			(match[4] === undefined? '' : '?' + match[4]) +
			'" allow="encrypted-media" allowfullscreen="true"></iframe></div>' +
			essentialPunctuation;
	}

	match = url.match(slideShareURL);
	if (match !== null) {
		url2 = 'https://www.slideshare.net/' + match[2];
		maxWidth = Math.floor(chatWindow.width());
		$.ajax({
			url:
				'http://www.slideshare.net/api/oembed/2?url=' + 
				encodeURIComponent(url2) + 
				'&maxwidth=' + maxWidth + 
				'&format=json',
			dataType: 'jsonp',
			success: function (data) {
				var width = Math.min(maxWidth, Math.max(629, data.width));
				var height = Math.round(width * data.height / data.width);
				var match = data.html.match(/\ssrc=["']?([^"'>\s]*)/);
				$('.iframe-container[data-oembed="' + url2 + '"]').html(`
					<iframe
						src="${match[1]}"
						width="${width}"
						height="${height}"
						allowfullscreen="true"
					>
					</iframe>
					<figcaption>
						<a href="${url2}" target="_blank">${data.title}</a>
					</figcaption>
				`);
			}
		});
		return '<figure class="iframe-container" data-oembed="' +
			url2 +
			'"></figure>' +
			essentialPunctuation;
	}

	if (imageFileExtensions.test(url)) {
		return `<a href="${url}" target="_blank"><img src="${url}"/></a>${essentialPunctuation}`;
	}

	return '<a href="' + 
		url +
		'" target="_blank">' +
		url.replace(/[&;].*/, '&amp;&hellip;') +
		'</a>' +
		punctuation;
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
			chatWindow.append(`
				<div class="chat system-message">
					Connected to ${event.sessionID}. Waiting for permission to join the conversation.
				</div>
			`);
		});

		p2p.on('joined', function (event) {
			chatWindow.append(`
				<div class="chat system-message">
					You're now part of the conversation ${event.sessionID}.
				</div>
			`);
		});

		p2p.on('joinrequest', function (event) {
			joinRequests.push(event.userID);
			processJoinRequest();
		});

		p2p.on('userjoined', function (event) {
			chatWindow.append(`
				<div class="chat system-message">
					<span class="user-id">${event.userID}</span>
					has joined the conversation.
				</div>
			`);
		});

		p2p.on('userleft', function (event) {
			chatWindow.append(`
				<div class="chat system-message">
					<span class="user-id">${event.userID}</span>
					has left the conversation.
				</div>
			`);
		});

		p2p.on('message', function (event) {
			var text = escapeHTML(event.message);
			var scrolledToBottom = chatWindow.scrollTop() >= chatWindow[0].scrollHeight - chatWindow.height() - 1;
			var cssClass, annotation;
			if (event.isPrivate) {
				cssClass = 'private-msg';
				annotation = ' (Private)';
			} else {
				cssClass = '';
				annotation = '';
			}
			chatWindow.append(`
				<div class="chat ${cssClass}">
					<span class="user-id">${event.userID}${annotation}:</span>
					<pre>${text}</pre>
				</div>
			`);
			if (scrolledToBottom) {
				chatWindow.scrollTop(chatWindow[0].scrollHeight);
			}
		})
	} // end if connected else not connected
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
			let escapedText = escapeHTML(textToSend);
			let scrolledToBottom = chatWindow.scrollTop() >= chatWindow[0].scrollHeight - chatWindow.height() - 1;
			chatWindow.append(`
				<div class="chat">
					<span class="user-id">${myUserID}:</span>
					<pre>${escapedText}</pre>
				</div>
			`);
			messageBox.val('');
			resizeMessageBox();
			if (scrolledToBottom) {
				chatWindow.scrollTop(chatWindow[0].scrollHeight);
			}
			p2p.send(textToSend);
		}
	}
});

{
	let sessionIDInURL = getParameterByName('room');
	if (sessionIDInURL) {
		$('#session-id').val(sessionIDInURL);
	}
}
