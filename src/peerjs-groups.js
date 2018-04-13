/* TODO
 *	* Add function to get admin's user ID.
 *	* Buffer messages when not connected to any other peers.
 *	* Optionally replay the entire session history to late entrants?
 *	* Disconnect peers who send malformed messages.
 *	* Add method to get the userIDs present in the session.
 *	* Document code.
 *	* Handle peer getting disconnected from peer server.
 *  * Handle when the peer named after the session goes down.
 *	* Mask sessionID with one time password.
 *	* Verify users' identities somehow. 
 *  * Anonymize connection labels.
 *	* Add voice and video.
 */

/**	Mappings between characters that need to be escaped in HTML code (to prevent cross-site
	scripting attacks) and their corresponding escape sequences, i.e. HTML character entities.
	@readonly
*/
const ESCAPE_MAP = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
};

/**	Escapes a string so that any HTML code contained within it is converted into plain
	text.
	@param {(string|undefined)} input The text to make safe.
*/
function escapeHTML(input) {
	'use strict';
	if (input !== undefined) {
		return String(input).replace(/[&<>"']/g, function (match) {
			return ESCAPE_MAP[match];
		});
	} else {
		return input;
	}
}

/**Describes an event fired by a {@link PeerGroup} object.
@property {string} sessionID The name of the peer group that the event relates to.
@property {string} userID The user ID of the peer whose action triggered the event.
@property {boolean} administrator <code>true</code> if the peer described by the <code>userID</code>
property is the peer group leader.
@property {boolean} isPrivate <code>true</code> if the cause of the event is known
only to this peer and the peer that caused the event (e.g. receiving a private message),
or <code>false</code> if all members of the peer group are likely aware of the state change.
@property {any} [message] Additional details that vary according to the type
of event. Contains application specific data for a <code>message</code> event and
a textual description (<code>string</code>) for other events.
*/
class PeerGroupEvent extends Event {
	/**	Creates a PeerGroupEvent.
		@param {string} type The name of the event type.
		@param {boolean} isAdmin <code>true</code> if the peer identified by the <code>userID</code>
		property is the peer group leader, and false otherwise.
		all members of the peer group are aware of the state change.
		@param {object} properties A dictionary of additional properties to add to
		the object. As a minimum this should include the sessionID, userID and isPrivate properties.
		@package
	*/
	constructor(type, isAdmin, properties) {
		super(type);
		Object.assign(this, properties);
		this.administrator = isAdmin;
	}
}

/**	PeerGroup (project name [Peer.js Groups]{@link https://github.com/ElizabethHudnott/peerjs-groups})
	is an abstraction layer over the [Peer.js]{@link https://github.com/peers} library
	that allows peers to easily find and communicate with other peers that share
	an interest in a common group ID tag (e.g. a chat room name or a gaming session name).
	@see [Peer constructor in the Peer.js documentation]{@link https://elizabethhudnott.github.io/peerjs-groups/lib/doc/peer.html#peer}
*/
class PeerGroup extends EventTarget {
	/**	@event PeerGroup~connected
		@description Fired when a peer establishes a connection with the peer
		group leader (which may be itself). The event is fired on the peer that initiated
		the connection. The peer doesn't receive any messages addressed to the peer group
		until after the {@link PeerGroup~event:joined} event has been fired.
		@type {PeerGroupEvent}
	*/

	/**	@event PeerGroup~joined
		@description Fired when the local peer becomes a member of a peer group.
		@type {PeerGroupEvent}
	*/

	/**	@event PeerGroup~userpresent
		@description Fired when another peer joins the peer group, or when the local peer
		joins the peer group and discovers existing members.
		@type {PeerGroupEvent}
	*/

	/**	@event PeerGroup~userleft
		@description Fired when the connection to another peer is severed.
		@type {PeerGroupEvent}
	*/

	/**	@event PeerGroup~message
		@description Fired when this peer receives a message (either addressed to the peer
		group or private).
		@type {PeerGroupEvent}
	*/

	/**	@event PeerGroup~joinrequest
		@description Fired when this peer is the peer group leader and another peer asks to
		join the peer group. If no event listeners have been added to listen for this event
		then any peer that connects to the group will automatically be accepted as a new
		member. If you add a listener and later remove it then no new peers will able to
		join the group until you add another listener (or invoke acceptUser in another context).
		@type {PeerGroupEvent}
	*/

	/**	@event PeerGroup~ejected
		@description Fired when this peer is refused permission to join the requested peer
		group or when it's forcibly removed from the peer group.
		@type {PeerGroupEvent}
	*/

	/**@callback PeerGroup~ErrorCallback
		@param {Error} error The error that occurred.
	 */

	/**	Constructs a PeerGroup object.
		@param {PeerGroup~ErrorCallback} onError A function that will be invoked if a
		networking error occurs that Peer.js Groups cannot handle internally.
		@param {object} options The options passed to the Peer.js server.
	*/
	constructor(onError, options) {
		super();

		/**	An identifier chosen to identify this peer.
			@type {string}
		*/
		var userID;

		/**	Maps from randomized peer names to [DataConnection]{@linkcode https://elizabethhudnott.github.io/peerjs-groups/lib/doc/peer.html#dataconnection} objects.
			Records peers that are connected to this peer and belong to the peer group.
		*/
		var connections = new Map();

		/**	Maps from randomized peer names to [DataConnection]{@linkcode https://elizabethhudnott.github.io/peerjs-groups/lib/doc/peer.html#dataconnection} objects.
			Records peers that are waiting for approval to join the peer group.
			Only used on the leading peer.
		*/
		var pending = new Map();

		/**	Set of peer IDs we're in process of trying to connect to. */
		var tryingToConnect = new Set();

		/**	Maps from random peer name to chosen identities (unescaped). */
		var peersToUsers = new Map();

		/**	Maps from chosen identities (HTML escaped) to randomized peer names.  */
		var usersToPeers = new Map();

		/**	Records the user identities that have been allowed to join the peer group. */
		var acceptedUsers = new Set();

		/**	Records the user identities that have been prohibited from joining (or rejoining) the peer group. */
		var rejectedUsers = new Set();

		/**	The [Peer]{@linkcode https://elizabethhudnott.github.io/peerjs-groups/lib/doc/peer.html#peer}
			object for this machine.
		*/
		var peer;

		/**	The name of the peer group to which this peer currently belongs.
			@type {string}
		*/
		var sessionID;

		/**	True if we've been accepted into the group and have tried to open connections
			each of the other peers and have waited for a response.
		*/
		var joined = false;

		/**	True if a joinrequest event listener has ever been added to this PeerGroup. */
		var hasJoinRequestListenerAdded = false;

		const me = this;

		/**	Describes the type of content contained in a message sent between peers.
			@enum
		*/
		const MsgType = {
			/**	Data message. The meaning of the message is defined by your application.
				The data is forwarded to the application via a {@link PeerGroup~event:message} event.
			*/
			DATA: 1,
			/**	A message informing the receiving peer of the sending peer's user ID. */
			IDENTIFY: 2,
			/** A message informing the receiving peer of the peer IDs of the other peers
				that belong to the peer group.
			*/
			PEER_LIST: 3,
			/**	Similar to a data message but sent to a single peer rather than to all
				peers belonging to the peer group.
			*/
			PRIVATE_MSG: 4,
			/**	Sent when a peer is forcefully denied membership of the peer group. */
			CONNECT_ERROR: 5,
		};

		/**	@typedef Message
			@description Members of this type are sent from one peer to another.
			@private
		*/

		/**	Describes the kinds of errors that can occur which need to be sent from one peer to another.
			@enum
		*/
		const ErrorType = {
			/**	A peer attempted to join a peer group with the same user ID as another
				peer that already belongs to the peer group.
			*/
			DUPLICATE_USER_ID: 1,
			/**	A peer was prevented from joining the peer group because of a human decision
				to reject it.
			*/
			PROHIBITED: 2
		};

		/**	Constructs a Message.
			N.B. Do not convert this to a class. Peer.js doesn't support sending class instances.
			@param {MsgType} type Identifies the kind of message being sent.
			@param {any} data The message payload. For MsgType.DATA the data
			property contains the application level data.
			@return {Message} The constructed message.
		*/
		function makeMessage(type, data) {
			return {
				type: type,
				data: data
			};
		}

		/**	Creates a PeerGroupEvent. */
		function createEvent(type, properties) {
			var isAdmin = peer.id === sessionID && sessionID !== undefined;
			return new PeerGroupEvent(type, isAdmin, properties);
		}

		/**	Raises an error.
			@param {Error} error The error that has occurred.
		*/
		function throwError(error) {
			if (onError) {
				onError(error);
			} else {
				throw error;
			}
		}

		/**	Called when a peer initially establishes a network connection with the peer group leader.
			This method is called on the peer that initiated the connection.
			The new peer does not become a member of the peer group until application
			accepts the new peer.
			@param {string} id The name of the peer group.
			@fires PeerGroup#connected
		*/
		function connected(id) {
			sessionID = id;
			var event = createEvent('connected', {
				sessionID: id,
				userID: escapeHTML(userID),
				isPrivate: true
			});
			me.dispatchEvent(event);
		}

		/**	Called when the local peer becomes part of a peer group.
			@fires PeerGroup#joined
		*/
		function sessionEntered() {
			joined = true;
			var event = createEvent('joined', {
				sessionID: sessionID,
				userID: escapeHTML(userID),
				isPrivate: false
			});
			me.dispatchEvent(event);
		}

		/**	Finds the user ID of the peer at the other end of a connection.
			@param {DataConnection} connection The connection to analyse.
			@return {string} The user ID of the peer at the other end of a connection
			identified by the connection parameter.
		*/
		function getUserID(connection) {
			var label = connection.label;
			if (label === userID) {
				return peersToUsers.get(connection.peer);
			} else {
				return label;
			}
		}

		/**	Sends a message to every member of the peer group.
			@param {Message} The message to send.
		*/
		function send(message) {
			for (const connection of connections.values()) {
				connection.send(message);
			}
		}

		/**	Sends this peer's user ID to another peer.
			@param {DataConnection} connection A connection to the peer that should
			receive this peer's user ID.
		*/
		function sendIdentity(connection) {
			connection.send(makeMessage(
				MsgType.IDENTIFY,
				userID
			));
		}

		/**	Called when this peer receives a message from another peer.
			@param {Message} message The message received.
			@fires PeerGroup#userpresent
			@fires PeerGroup#ejected
			@fires PeerGroup#message
		*/
		function dataReceived(message) {
			//jshint validthis: true
			var event;
			switch (message.type) {
			case MsgType.PEER_LIST:
				//Connect to the other peers in the peer group.
				if (this.peer === sessionID) {
					for (const peerName of message.data) {
						if (peerName !== peer.id) {
							connectTo(peerName);
						}
					}
				}
				break;
			case MsgType.IDENTIFY:
				//Record the user ID of another peer.
				var remoteUserID = message.data;
				var escapedUserID = escapeHTML(remoteUserID);
				peersToUsers.set(this.peer, remoteUserID);
				usersToPeers.set(escapedUserID, this.peer);
				tryingToConnect.delete(this.peer);
				event = createEvent('userpresent', {
					sessionID: sessionID,
					userID: escapedUserID,
					isPrivate: false
				});
				me.dispatchEvent(event);
				if (!joined && tryingToConnect.size === 0) {
					sessionEntered();
				}
				break;
			case MsgType.CONNECT_ERROR:
				//We were either refused permission to join the peer group or kicked out.
				event = createEvent('ejected', {
					sessionID: sessionID,
					userID: userID,
					errorType: message.errorType,
					message: message.data,
					isPrivate: message.errorType === ErrorType.PROHIBITED? undefined : false
				});
				me.dispatchEvent(event);
				break;
			case MsgType.DATA:
			case MsgType.PRIVATE_MSG:
				//Forward the application level message to the application.
				event = createEvent('message', {
					sessionID: sessionID,
					userID: escapeHTML(getUserID(this)),
					message: message.data,
					isPrivate: message.type === MsgType.PRIVATE_MSG
				});
				me.dispatchEvent(event);
			}
		}

		/**	Called when this peer's connection to another member of the peer group is
			lost. Not called if this peer isn't a member of a peer group or if the
			disconnect() function has been invoked.
		*/
		function connectionClosed() {
			//jshint validthis: true
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
				event = createEvent('userleft', {
					sessionID: sessionID,
					userID: escapeHTML(disconnectedUser),
					isPrivate: false
				});
				me.dispatchEvent(event);
			}
		}

		/**	Closes all existing connections and resets the state of the PeerGroup object. */
		function disconnect() {
			for (const connection of connections.values()) {
				connection.off('close', connectionClosed);
				connection.close();
			}
			if (peer !== undefined) {
				peer.destroy();
			}
			peersToUsers.clear();
			usersToPeers.clear();
			tryingToConnect.clear();
			acceptedUsers.clear();
			rejectedUsers.clear();
		}

		/**	Opens a connection to another member of the peer group
			(a connection between two peers, neither or whom is the peer group leader).
			@param {string} peerName The peer ID of the peer to connect to.
		*/
		function connectTo(peerName) {
			tryingToConnect.add(peerName);
			var connection = peer.connect(peerName, {
				label: userID,
				metadata: {sessionID: sessionID},
				reliable: true
			});
			connection.on('data', dataReceived);
			connection.on('error', function (error) {
				tryingToConnect.delete(this.peer);
				throwError(error);
			});
			connection.on('open', function () {
				connections.set(peerName, connection);
			});
			connection.on('close', connectionClosed);
		}

		/**	Sends an error message to another peer and then closes the connection.
			@param {DataConnection} connection The connection to the peer to disconnect from.
			@param {ErrorType} reason A code stating the reason for terminating the connection.
			@param {string} errorMessage A string explaining the reason for terminating the connection.
		*/
		function rejectConnection(connection, reason, errorMessage) {
			var message = makeMessage(MsgType.CONNECT_ERROR, errorMessage);
			message.errorType = reason;
			connection.send(message);
			setTimeout(function () {
				connection.close();
			}, 2000);
		}

		/**	Configures this peer to act as the peer group leader. */
		function createSession () {
			if (peer !== undefined) {
				peer.destroy();
			}
			peer = new Peer(sessionID, options);
			peer.on('error', function (error) {
				if (error.type === 'unavailable-id') {
					me.connect(sessionID);
				} else {
					throwError(error);
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
							`You\'ve been banned from the session "${sessionID}".`
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
							`User ID "${newUserID}" is already taken.`
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

					if (acceptedUsers.has(newUserID) || !hasJoinRequestListenerAdded) {
						me.acceptUser(newUserID);
					} else {
						connection.on('close', function () {
							pending.delete(this.peer);
							peersToUsers.delete(this.peer);
							usersToPeers.delete(escapeHTML(this.label));
						});

						var event = createEvent('joinrequest', {
							sessionID: sessionID,
							userID: escapeHTML(connection.label),
							isPrivate: true
						});
						me.dispatchEvent(event);
					}
				});
			});
		}

		/**	Attempts to connect to a peer group, or creates the group if it doesn't exist yet.
			@param {string} sessionIDToJoin The name of the peer group to try to join.
			@param {string} myUserID The identifier this peer would like to be known by.
		*/
		this.connect = function(sessionIDToJoin, myUserID) {
			var firstConnection;

			disconnect();
			sessionID = sessionIDToJoin;
			userID = myUserID;
			joined = false;

			if (sessionID === undefined) {
				createSession();
			} else if (!PeerGroup.validSessionID.test(sessionIDToJoin)) {
				throwError(new Error('Invalid session ID.'));
			} else {

				peer = new Peer(options);
				peer.on('error', function (error) {
					if (error.type === 'peer-unavailable') {
						if (error.message.slice(-sessionID.length) === sessionID) {
							createSession(sessionID, onError);
						} else {
							/*Ignore. Been asked by the broker to connect to a peer
							  that's since gone offline. */
						}
					} else {
						throwError(error);
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

							var event = createEvent('userpresent', {
								sessionID: sessionID,
								userID: escapeHTML(newUserID),
								isPrivate: false
							});
							me.dispatchEvent(event);
						} else {
							connection.close();
						}
					});
				});

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
			} // end if sessionID is defined.
		}; // end of connect method.

		/**	Disconnects from the peer group (if connected to one) or cancels any pending
			application to join a peer group.
		*/
		this.disconnect = function () {
			disconnect();
		};

		/**	Authorizes a peer to join the peer group.
			@param {string} newUserID The user ID of a peer (typically one that is waiting
			to join the peer group).
		*/
		this.acceptUser = function(newUserID) {
			acceptedUsers.add(newUserID);
			var peerName = usersToPeers.get(newUserID);
			var connection = pending.get(peerName);
			if (connection === undefined) {
				return;
			}

			pending.delete(peerName);
			connections.set(peerName, connection);
			connection.on('data', dataReceived);
			connection.on('close', connectionClosed);

			connection.send(makeMessage(
				MsgType.PEER_LIST,
				Array.from(connections.keys())
			));
			sendIdentity(connection);

			var event = createEvent('userpresent', {
				sessionID: sessionID,
				userID: newUserID,
				isPrivate: false
			});
			me.dispatchEvent(event);
		};

		/**	Prevents a peer with a given user ID from joining the peer group or removes
			an existing member from the peer group.
			@param {string} remoteUserID The user ID of a peer belonging to the
			peer group or the user ID of a peer waiting to join the peer group.
		*/
		this.rejectUser = function(remoteUserID) {
			rejectedUsers.add(remoteUserID);
			var peerName = usersToPeers.get(remoteUserID);
			peersToUsers.delete(peerName);
			usersToPeers.delete(remoteUserID);

			var connection = pending.get(peerName);
			if (connection === undefined) {
				connection = connections.get(peerName);
			}
			if (connection !== undefined) {
				rejectConnection(
					connection,
					ErrorType.PROHIBITED,
					`You've been banned from the session "${sessionID}".`
				);
			}
		};

		/**	Sends a message to all members of the peer group.
			@param {any} data The data to send.
		*/
		this.send = function(data) {
			send(makeMessage(
				MsgType.DATA,
				data
			));
		};

		/**	Sends a message to a particular user.
			@param {string} destUser The user ID to send the data to.
			@param {any} data The data to send.
		*/
		this.sendPrivate = function(destUser, data) {
			var destPeerName = usersToPeers.get(destUser);
			if (destPeerName === undefined) {
				var error = new Error(`No such user ${destUser}`);
				throwError(error);
			} else {
				var connection = connections.get(destPeerName);
				if (connection === undefined) {
					connection = pending.get(destPeerName);
				}
				connection.send(makeMessage(
					MsgType.PRIVATE_MSG,
					data
				));
			}
		};

		/**	The set of all user IDs belonging to peers currently in the peer group.
		*/
		Object.defineProperty(this, 'userIDs', {
			enumerable: true,
			get() {
				let userIDs = new Set();
				userIDs.add(escapeHTML(userID));
				for (let peerID of connections.keys()) {
					userIDs.add(escapeHTML(peersToUsers.get(peerID)));
				}
				return userIDs;
			}
		});

		this.addEventListener = function (type, listener, options) {
			if (type === 'joinrequest') {
				hasJoinRequestListenerAdded = true;
			}
			PeerGroup.prototype.addEventListener.call(this, type, listener, options);
		};

	} // End of PeerGroup constructor.

	/**	Specifies what string are valid session IDs.
		@return {string} A regular expression that matches valid session IDs.
	*/
	static get validSessionID() {
		return /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/;
	}
}
