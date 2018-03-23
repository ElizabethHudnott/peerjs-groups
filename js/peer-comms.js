"use strict";
/* TODO
 *	* Buffer messages when not connected to any other peers.
 *	* Detect connection refused.
 *	* Permit users 
 *	* Check user IDs are unique.
 *	* Disconnect peers who send malformed messages.
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
	var pending = new Map();
	var peersToUsers = new Map();
	var usersToPeers = new Map();
	var acceptedUsers = new Set();
	var rejectedUsers = new Set();
	var peer, sessionID;

	const me = this;

	const MsgType = {
		'DATA': 1,
		'IDENTIFY': 2,
		'PEER_LIST': 3,
		'PRIVATE_MSG': 4,
		'ERROR': 5,
	};

	const ErrorType = {
		DUPLICATE_USER_ID: 1,
	};

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
				this.on('close', connectionClosed);
				for (let peerName of message.data) {
					connectTo(peerName);
				}
				sessionEntered(sessionID);
			}
			break;
		case MsgType.IDENTIFY:
			peersToUsers.set(this.peer, message.data);
			usersToPeers.set(message.data, this.peer);
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
		var peerName = this.peer;
		var disconnectedUser;
		if (label === userID) {
			disconnectedUser = peersToUsers.get(peerName);
		} else {
			disconnectedUser = label;
		}
		connections.delete(peerName);

		var event = new jQuery.Event('userleft', {
			sessionID: sessionID,
			userID: disconnectedUser
		});
		$(me).triggerHandler(event);
	}

	function disconnect() {
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
				var newUserID = connection.label;
				if (rejectedUsers.has(newUserID)) {
					connection.close();
					return;
				}
				var existingPeerName = peersToUsers.get(newUserID);
				if (connections.has(existingPeerName)) {
					connection.send({
						type: MsgType.ERROR,
						data: ErrorType.DUPLICATE_USER_ID
					});
					connection.close();
					return;
				}

				var peerName = connection.peer;
				var existingUserID = peersToUsers.get(peerName);
				if (existingUserID !== undefined) {
					usersToPeers.delete(existingUserID);
				}
				peersToUsers.set(peerName, newUserID);
				usersToPeers.set(newUserID, peerName);

				pending.set(peerName, connection);
				connection.on('error', onError);

				if (acceptedUsers.has(newUserID)) {
					me.acceptUser(newUserID);
				} else {
					connection.on('close', function () {
						pending.delete(this.peer);
						peersToUsers.delete(this.label);
						usersToPeers.delete(this.peer);
					});

					if (existingUserID === undefined) {
						var event = new jQuery.Event('joinrequest', {
							sessionID: sessionID,
							userID: connection.label
						});
						$(me).triggerHandler(event);
					}
				}
			});
		});
	}

	this.connect = function(sessionIDToJoin) {
		var firstConnection;
		sessionID = sessionIDToJoin;
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
							var peerName = connection.peer;
							var newUserID = connection.label;
							connections.set(peerName, connection);
							peersToUsers.set(peerName, newUserID);
							usersToPeers.set(newUserID, peerName);
							sendIdentity(connection);

							connection.on('data', dataReceived);
							connection.on('error', onError);
							connection.on('close', connectionClosed);

							var event = new jQuery.Event('userjoined', {
								sessionID: sessionID,
								userID: newUserID
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

		var event = new jQuery.Event('userjoined', {
			sessionID: sessionID,
			userID: newUserID
		});
		$(me).triggerHandler(event);
	}

	this.rejectUser = function(newUserID) {
		var peerName = usersToPeers.get(newUserID);
		var connection = pending.get(peerName);
		rejectedUsers.add(newUserID);
		peersToUsers.delete(peerName);
		usersToPeers.delete(newUserID);
		connection.close();
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

	this.on = function(eventType, handler) {
		$(this).on(eventType, handler);
	}

}; // End of P2P function.
