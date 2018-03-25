"use strict";
const peerAPIKey = 'spknmd8wnib2o6r';

var connectButton = $('#connect-btn');
var chatWindow = $('#chat');
var userList = $('#user-list');
var messageBox = $('#message');
var joinRequestModal = $('#join-requester');

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

function formatAsHTML(text) {
	var formatted;
	formatted = escapeHTML(text);
	// *emphasis*
	formatted = formatted.replace(/(^|\s)\*([^\s*][^*]*)\*/g, '$1<strong>$2</strong>');
	// hyperlinks
	formatted = formatted.replace(/http(s)?:\/\/[\w$\-.+!*(),;/?=&%~\[\]]+/g, formatURL);
	// hashtags
	formatted = formatted.replace(
		/(^|\s)#(\w{3,})/g,
		'$1<a href="https://twitter.com/search?src=typd&q=%23$2" target="_blank">#$2</a>'
	);
	return formatted;
}

function formatURL(url) {
	var punctuation, essentialPunctuation, match, url2, maxWidth;
	punctuation = url.match(/([,;.?!)]*)$/)[1];
	if (punctuation === '') {
		essentialPunctuation = '';
	} else {
		url = url.slice(0, -(punctuation.length));
		essentialPunctuation = punctuation.match(/([?!)].*)?/)[1];
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
	connectButton.html('Connect');
	connectButton.addClass('btn-primary');
	connectButton.removeClass('btn-secondary');
	$('.login-detail').slideDown({easing: 'linear', duration: 2000});
	userList.children(':not([value=everyone])').remove();
}

connectButton.on('click', function (event) {
	if (connected) {
		p2p.disconnect();
		disconnected();
		chatWindow.append(`
			<div class="chat system-message">
				<span class="user-id">${myUserID}</span>
				has left the conversation.
			</div>
		`);
	} else {
		connected = true;
		$('.login-detail').slideUp();
		connectButton.html('Disconnect');
		connectButton.addClass('btn-secondary');
		connectButton.removeClass('btn-primary');

		myUserID = $('#user-id').val();
		var sessionID = $('#session-id').val();
		p2p.connect(sessionID, myUserID);

	} // end if connected else not connected
});

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
			You are now part of the conversation "${event.sessionID}".
		</div>
	`);
});

p2p.on('rejected', function (event) {
	chatWindow.append(`
		<div class="chat system-message">
			${event.message}
		</div>
	`);
	disconnected();
});

p2p.on('joinrequest', function (event) {
	joinRequests.push(event.userID);
	if (joinRequests.length == 1) {
		processJoinRequest();
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
