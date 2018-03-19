"use strict";

function P2P(userID, options) {
	var me = this;

	const MsgType = {
		'DATA': 0,
	}

	class Message {
		constructor(type, data) {
			this.typeCode = type;
			this.data = data;
		}

		get type() {
			return MsgType[this.typeCode];
		}
	}

	var connections = new Map();
	var peer;

	this.connect = function(sessionID, onError) {

		var connection;

		function errorHandler(error) {
			if (error.type === 'peer-unavailable') {
				if (connection.peer == sessionID) {
					createSession(sessionID, onError);
				} else if (onError) {
					onError(error);
				}
			} else if (error.type == 'unavailable-id') {
				me.connect(sessionID, onError)
			} else if (onError) {
				onError(error);
			}
		}

		function connectedHandler(id) {
			sessionID = id;
			var event = new jQuery.Event('connected', {
				sessionID: id
			});
			$(me).triggerHandler(event);
		}


		function createSession () {
			peer = new Peer(sessionID, options);
			peer.on('error', errorHandler);
			peer.on('open', connectedHandler);

			peer.on('connection', function (connection) {
				var peerName = connection.peer;
				connections.set(peerName, connection);

				var event = new jQuery.Event('user-joined', {
					sessionID: sessionID,
					userID: connection.label
				});
				$(me).triggerHandler(event);
			});

		}

		if (sessionID) {

			if (peer === undefined) {
				peer = new Peer(options);
				peer.on('error', errorHandler);
			}
			connection = peer.connect(sessionID, {
				label: userID,
				reliable: true
			});
			connection.on('open', function () {
				connectedHandler(this.peer);
			});
			connections.set(sessionID, connection);

		} else {

			createSession();

		}

	}; // end of connect method.

	function send(message) {

	};

	this.send = function(data) {
		send(new Message(MsgType.DATA, data));
	}

	this.on = function(eventType, handler) {
		$(this).on(eventType, handler);
	}

}; // End of P2P function.
