"use strict";
/* TODO
 *	* Connections between peers timing out?
 *  * Fix getUserID
 *  * Permit multiple sessions using the same P2P object.
 *	* Add method to disconnect from a session.
 *	* Handle calling connect twice.
 *	* When to disconnect (or destroy?) the peer.
 *	* Handle peer getting disconnected from peer server.
 *  * Handle when the peer named after the session goes down.
 *  * Ask for permission before accepting new peers. 
 */

function P2P(userID, onError, options) {
	var connections = new Map();
	var peer, sessionID;

	const me = this;

	const MsgType = {
		'DATA': 1,
		'PEER_LIST': 2,
	}

	function sessionEntered(id) {
		sessionID = id;
		var event = new jQuery.Event('connected', {
			sessionID: id
		});
		$(me).triggerHandler(event);
	}

	function connectTo(peerName) {
		var connection = peer.connect(peerName, {
			label: userID,
			reliable: true
		});
		connection.on('data', dataReceived);
		connection.on('error', function (error) {
			if (error.type == 'peer-unavailable') {
				// Do nothing.
			} else if (onError) {
				onError(error);
			}
		});
		connection.on('open', function () {
			connections.set(peerName, connection);
		});

	}

	function getUserID(connection) {
		var label = connection.label;
		if (label === userID) {
			return connection.peer;
		} else {
			return label;
		}
	}

	function dataReceived(message) {
		if (message.type === MsgType.PEER_LIST) {
			if (this.peer === sessionID) {
				for (let peerName of message.data) {
					connectTo(peerName);
				}
			}
		} else if (message.type === MsgType.DATA) {
			var event = new jQuery.Event('message', {
				sessionID: sessionID,
				userID: getUserID(this),
				message: message.data
			});
			$(me).triggerHandler(event);			
		}
	}

	function connectionAccepted(connection) {
		connection.on('data', dataReceived);
		connection.on('error', onError);
		connections.set(connection.peer, connection);

		var event = new jQuery.Event('userjoined', {
			sessionID: sessionID,
			userID: connection.label
		});
		$(me).triggerHandler(event);
	}

	function createSession () {
		peer = new Peer(sessionID, options);
		peer.on('error', function(error) {
			if (error.type == 'unavailable-id') {
				me.connect(sessionID);
			} else if (onError) {
				onError(error);
			}
		});

		peer.on('open', sessionEntered);

		peer.on('connection', function (connection) {
			connection.on('open', function () {
				if (connections.size > 0) {
					connection.send({
						type: MsgType.PEER_LIST,
						data: Array.from(connections.keys())
					});
				}
				connectionAccepted(connection);
			});
		});
	}

	function send(message) {
		for (let connection of connections.values()) {
			connection.send(message);
		}
	};

	this.send = function(data) {
		send({
			type: MsgType.DATA,
			data: data
		});
	}

	this.connect = function(sessionIDToJoin) {
		var connection;
		sessionID = sessionIDToJoin;

		if (sessionID) {

			peer = new Peer(options);
			peer.on('error', function (error) {
				if (error.type == 'peer-unavailable') {
					createSession(sessionID, onError);
				} else if (onError) {
					onError(error);
				}
			});

			peer.on('connection', function (connection) {
				connection.on('open', function () {
					connectionAccepted(connection);
				});
			});

			connection = peer.connect(sessionID, {
				label: userID,
				reliable: true
			});

			connection.on('data', dataReceived);
			connection.on('error', onError);

			connection.on('open', function () {
				connections.set(sessionID, connection);
				sessionEntered(sessionID);
			});

		} else {

			createSession();

		}

	}; // end of connect method.

	this.on = function(eventType, handler) {
		$(this).on(eventType, handler);
	}

}; // End of P2P function.
