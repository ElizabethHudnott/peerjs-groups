"use strict";
/* TODO
 *	* Disconnect peers who send malformed messages.
 *  * Ask for permission before accepting new peers.
 *	* Defer connected event until all connections to all peers in the group have been attempted.
 *	* Add method to get the userIDs present in the session.
 *	* Document code.
 *	* Add method to disconnect from a session.
 *	* Add method to disconnect from a particular peer. (Decide individually? Vote?)
 *	* Handle calling connect twice.
 *	* When to disconnect (or destroy?) the peer.
 *	* Handle peer getting disconnected from peer server.
 *  * Handle when the peer named after the session goes down.
 *	* Mask sessionID with one time password.
 *	* Verify users' identities somehow. 
 *  * Anonymize connection labels.
 */

function P2P(userID, onError, options) {
	var connections = new Map();
	var peersToUsers = new Map();
	var peer, sessionID;

	const me = this;

	const MsgType = {
		'DATA': 1,
		'IDENTIFY': 2,
		'PEER_LIST': 3,
		'PRIVATE_MSG': 4,
	}

	function sessionEntered(id) {
		sessionID = id;
		var event = new jQuery.Event('connected', {
			sessionID: id,
			userID: userID
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
		switch (message.type) {
		case MsgType.PEER_LIST:
			if (this.peer === sessionID) {
				for (let peerName of message.data) {
					connectTo(peerName);
				}
			}
			break;
		case MsgType.IDENTIFY:
			peersToUsers.set(this.peer, message.data);
			break;
		default:
			var event = new jQuery.Event('message', {
				sessionID: sessionID,
				userID: getUserID(this),
				isPrivate: message.type === MsgType.PRIVATE_MSG,
				message: message.data
			});
			$(me).triggerHandler(event);			
		}
	}

	function connectionClosed() {
		var label = this.label;
		var peerName, disconnectedUser;
		if (label === userID) {
			peerName = this.peer;
			disconnectedUser = peersToUsers.get(peerName);
		} else {
			peerName = label;
			disconnectedUser = label;
		}
		peersToUsers.delete(peerName);
		connections.delete(peerName);

		var event = new jQuery.Event('userleft', {
			sessionID: sessionID,
			userID: disconnectedUser
		});
		$(me).triggerHandler(event);
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
				// Do nothing.
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

	function connectionAccepted(connection) {
		var newUserID = connection.label;
		peersToUsers.set(connection.peer, connection.label);
		sendIdentity(connection);

		connection.on('data', dataReceived);
		connection.on('error', onError);
		connection.on('close', connectionClosed);
		connections.set(connection.peer, connection);

		var event = new jQuery.Event('userjoined', {
			sessionID: sessionID,
			userID: newUserID
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
			} else {
				throw error;
			}
		});

		peer.on('open', sessionEntered);

		peer.on('connection', function (connection) {
			connection.on('open', function () {
				connection.send({
					type: MsgType.PEER_LIST,
					data: Array.from(connections.keys())
				});
				connectionAccepted(connection);
			});
		});
	}

	this.connect = function(sessionIDToJoin) {
		var firstConnection;
		sessionID = sessionIDToJoin;

		if (sessionID) {

			if (peer === undefined || peer.disconnected) {
				peer = new Peer(options);
				peer.on('error', function (error) {
					if (error.type == 'peer-unavailable') {
						createSession(sessionID, onError);
					} else if (onError) {
						onError(error);
					} else {
						throw error;
					}
				});

				peer.on('connection', function (connection) {
					connection.on('open', function () {
						if (connection.metadata.sessionID === sessionID) {
							connectionAccepted(connection);
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

			firstConnection.on('open', function () {
				connections.set(sessionID, firstConnection);
				sessionEntered(sessionID);
			});

		} else {

			createSession();

		}

	} // end of connect method.

	this.send = function(data) {
		send({
			type: MsgType.DATA,
			data: data
		});
	}

	this.sendPrivate = function(destUser, data) {
		var destPeerName;
		for (let [peerName, userID] of peersToUsers.entries()) {
			if (userID === destUser) {
				connections.get(peerName).send({
					type: MsgType.PRIVATE_MSG,
					data: data
				})
				return;
			}
		}
		var error = new Error(`No such user ${destUser}`);
		if (onError) {
			onError(error);
		} else {
			throw error;
		}
	}

	this.on = function(eventType, handler) {
		$(this).on(eventType, handler);
	}

}; // End of P2P function.
