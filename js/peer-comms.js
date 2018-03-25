"use strict";
/* TODO
 *	* Buffer messages when not connected to any other peers.
 *	* Optionally replay the entire session history to late entrants?
 *	* Disconnect peers who send malformed messages.
 *	* Add method to get the userIDs present in the session.
 *	* Document code.
 *	* Add method to disconnect from a particular peer. (Decide individually? Vote?)
 *	* Handle calling connect twice.
 *	* Handle peer getting disconnected from peer server.
 *  * Handle when the peer named after the session goes down.
 *	* Mask sessionID with one time password.
 *	* Verify users' identities somehow. 
 *  * Anonymize connection labels.
 *	* Add voice and video.
 */

const ESCAPE_MAP = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

function escapeHTML(input) {
	if (input) {
		return input.replace(/[&<>"']/g, function (match) {
			return ESCAPE_MAP[match];
		});
	} else {
		return input;
	}
}

function P2P(onError, options) {
	var userID;
	var connections = new Map();
	var pending = new Map();
	var peersToUsers = new Map();
	var usersToPeers = new Map(); //user IDs are HTML escaped.
	var acceptedUsers = new Set();
	var rejectedUsers = new Set();
	var peer, sessionID;

	const me = this;

	const MsgType = {
		DATA: 1,
		IDENTIFY: 2,
		PEER_LIST: 3,
		PRIVATE_MSG: 4,
		CONNECT_ERROR: 5,
	};

	const ErrorType = {
		DUPLICATE_USER_ID: 1,
		PROHIBITED: 2
	};

	function connected(id) {
		sessionID = id;
		var event = new jQuery.Event('connected', {
			sessionID: id,
			userID: escapeHTML(userID)
		});
		$(me).triggerHandler(event);
	}

	function sessionEntered() {
		var event = new jQuery.Event('joined', {
			sessionID: sessionID,
			userID: escapeHTML(userID),
			isAdmin: peer.id === sessionID
		});
		$(me).triggerHandler(event);
	}

	function getUserID(connection) {
		var label = connection.label;
		if (label === userID) {
			return peersToUsers.get(connection.peer);
		} else {
			return label;
		}
	}

	function send(message) {
		for (let connection of connections.values()) {
			connection.send(message);
		}
	};

	function sendIdentity(connection) {
		connection.send({
			type: MsgType.IDENTIFY,
			data: userID
		})
	}

	function dataReceived(message) {
		var event;
		switch (message.type) {
		case MsgType.PEER_LIST:
			if (this.peer === sessionID) {
				for (let peerName of message.data) {
					connectTo(peerName);
				}
				sessionEntered();
			}
			break;
		case MsgType.IDENTIFY:
			var remoteUserID = message.data;
			var escapedUserID = escapeHTML(remoteUserID);
			peersToUsers.set(this.peer, remoteUserID);
			usersToPeers.set(escapedUserID, this.peer);
			var event = new jQuery.Event('userpresent', {
				sessionID: sessionID,
				userID: escapedUserID
			});
			$(me).triggerHandler(event);
			break;
		case MsgType.CONNECT_ERROR:
			event = new jQuery.Event('ejected', {
				sessionID: sessionID,
				errorType: message.errorType,
				message: message.data
			});
			$(me).triggerHandler(event);
			break;
		case MsgType.DATA:
		case MsgType.PRIVATE_MSG:
			event = new jQuery.Event('message', {
				sessionID: sessionID,
				userID: escapeHTML(getUserID(this)),
				isPrivate: message.type === MsgType.PRIVATE_MSG,
				message: message.data
			});
			$(me).triggerHandler(event);
		}
	}

	function connectionClosed() {
		var label = this.label;
		var peerName = this.peer;
		var disconnectedUser, event;
		if (label === userID) {
			disconnectedUser = peersToUsers.get(peerName);
		} else {
			disconnectedUser = label;
		}
		connections.delete(peerName);

		if (disconnectedUser !== undefined) {
			event = new jQuery.Event('userleft', {
				sessionID: sessionID,
				userID: escapeHTML(disconnectedUser)
			});
			$(me).triggerHandler(event);
		}
	}

	function disconnect() {
		for (let connection of connections.values()) {
			connection.off('close', connectionClosed);
		}
		peer.destroy();
		peersToUsers.clear();
		usersToPeers.clear();
		acceptedUsers.clear();
		rejectedUsers.clear();
	}

	function connectTo(peerName) {
		var connection = peer.connect(peerName, {
			label: userID,
			metadata: {sessionID: sessionID},
			reliable: true
		});
		connection.on('data', dataReceived);
		connection.on('error', function (error) {
			if (error.type == 'peer-unavailable') {
				/*Do nothing. Assume peer has lost connection to the broker and will
				  reconnect to it and then us. */
			} else if (onError) {
				onError(error);
			} else {
				throw error;
			}
		});
		connection.on('open', function () {
			connections.set(peerName, connection);
		});
		connection.on('close', connectionClosed);
	}

	function rejectConnection(connection, reason, message) {
		connection.send({
			type: MsgType.CONNECT_ERROR,
			errorType: reason,
			data: message
		});
		setTimeout(function () {
			connection.close();
		}, 1000);
	}

	function createSession () {
		peer = new Peer(sessionID, options);
		peer.on('error', function(error) {
			if (error.type == 'unavailable-id') {
				me.connect(sessionID);
			} else if (onError) {
				onError(error);
			} else {
				throw error;
			}
		});

		peer.on('open', function () {
			connected(peer.id);
			sessionEntered();
		});

		peer.on('connection', function (connection) {
			connection.on('open', function () {
				//Rejected users are not welcome.
				var newUserID = connection.label;
				if (rejectedUsers.has(newUserID)) {
					rejectConnection(
						connection,
						ErrorType.PROHIBITED,
						'You are banned from this conversation.'
					);
					return;
				}

				//No support currently for the same user being logged in from more than one place.
				var existingPeerName = usersToPeers.get(newUserID);
				if (newUserID === userID ||
					connections.has(existingPeerName) ||
					pending.has(existingPeerName)
				) {
					rejectConnection(
						connection,
						ErrorType.DUPLICATE_USER_ID,
						`User ID "${newUserID}" has already been taken.`
					);
					return;
				}

				var peerName = connection.peer;

				//An existing peer might change it's user ID.
				var existingUserID = peersToUsers.get(peerName);
				if (existingUserID !== undefined) {
					usersToPeers.delete(existingUserID);
				}

				//Respond to the connection request.
				peersToUsers.set(peerName, newUserID);
				usersToPeers.set(escapeHTML(newUserID), peerName);

				pending.set(peerName, connection);
				connection.on('error', onError);

				if (acceptedUsers.has(newUserID)) {
					me.acceptUser(newUserID);
				} else {
					connection.on('close', function () {
						pending.delete(this.peer);
						peersToUsers.delete(this.peer);
						usersToPeers.delete(escapeHTML(this.label));
					});

					var event = new jQuery.Event('joinrequest', {
						sessionID: sessionID,
						userID: escapeHTML(connection.label)
					});
					$(me).triggerHandler(event);
				}
			});
		});
	}

	this.connect = function(sessionIDToJoin, myUserID) {
		var firstConnection;
		sessionID = escapeHTML(sessionIDToJoin);
		userID = myUserID;
		var newPeerNeeded = (peer === undefined || peer.disconnected);

		if (sessionID !== undefined && (newPeerNeeded || peer.id !== sessionID)) {

			if (newPeerNeeded) {
				if (peer !== undefined) {
					disconnect();
				}
				peer = new Peer(options);
				peer.on('error', function (error) {
					if (error.type == 'peer-unavailable') {
						if (error.message.slice(-sessionID.length) === sessionID) {
							createSession(sessionID, onError);
						} else {
							/*Ignore. Been asked by the broker to connect to a peer
							  that's since gone offline. */
						}
					} else if (onError) {
						onError(error);
					} else {
						throw error;
					}
				});

				peer.on('connection', function (connection) {
					connection.on('open', function () {
						if (connection.metadata.sessionID === sessionID) {
							var newUserID = connection.label;
							var peerName = connection.peer;

							//An existing peer might change it's user ID.
							var existingUserID = peersToUsers.get(peerName);
							if (existingUserID !== undefined) {
								usersToPeers.delete(existingUserID);
							}

							//Respond to the connection request.
							peersToUsers.set(peerName, newUserID);
							usersToPeers.set(escapeHTML(newUserID), peerName);

							connections.set(peerName, connection);
							sendIdentity(connection);
							connection.on('data', dataReceived);
							connection.on('error', onError);
							connection.on('close', connectionClosed);

							var event = new jQuery.Event('userpresent', {
								sessionID: sessionID,
								userID: escapeHTML(newUserID)
							});
							$(me).triggerHandler(event);
						} else {
							connection.close();
						}
					});
				});
			}

			firstConnection = peer.connect(sessionID, {
				label: userID,
				reliable: true
			});

			firstConnection.on('data', dataReceived);
			firstConnection.on('error', onError);
			firstConnection.on('close', connectionClosed);

			firstConnection.on('open', function () {
				connections.set(sessionID, this);
				connected(sessionID);
			});

		} else {

			createSession();

		}

	} // end of connect method.

	this.disconnect = function () {
		disconnect();
	};

	this.acceptUser = function(newUserID) {
		var peerName = usersToPeers.get(newUserID);
		var connection = pending.get(peerName);
		pending.delete(peerName);

		connections.set(peerName, connection);
		connection.on('data', dataReceived);
		connection.on('close', connectionClosed);

		acceptedUsers.add(newUserID);
		connection.send({
			type: MsgType.PEER_LIST,
			data: Array.from(connections.keys())
		});
		sendIdentity(connection);

		var event = new jQuery.Event('userpresent', {
			sessionID: sessionID,
			userID: newUserID
		});
		$(me).triggerHandler(event);
	}

	this.rejectUser = function(newUserID) {
		var peerName = usersToPeers.get(newUserID);
		var connection = pending.get(peerName);
		if (connection === undefined) {
			connection = connections.get(peerName);
		}
		rejectedUsers.add(newUserID);
		peersToUsers.delete(peerName);
		usersToPeers.delete(newUserID);
		rejectConnection(
			connection,
			ErrorType.PROHIBITED,
			'You are banned from this conversation.'
		);
	}

	this.send = function(data) {
		send({
			type: MsgType.DATA,
			data: data
		});
	}

	this.sendPrivate = function(destUser, data) {
		var destPeerName = usersToPeers.get(destUser);
		if (destPeerName === undefined) {
			var error = new Error(`No such user ${destUser}`);
			if (onError) {
				onError(error);
			} else {
				throw error;
			}
		} else {
			var connection = connections.get(destPeerName);
			if (connection === undefined) {
				connection = pending.get(destPeerName);
			}
			connection.send({
				type: MsgType.PRIVATE_MSG,
				data: data
			});
		}
	}

	/**
	 * connected
	 * joined
	 * userpresent
	 * userleft
	 * message
	 * joinrequest
	 * ejected
	 */
	this.on = function(eventType, handler) {
		$(this).on(eventType, handler);
	}

}; // End of P2P function.
