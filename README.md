# Peer.js Groups
Using Peer.js Groups, a web browser on one machine can send encrypted data to (and receive encryped data from) other web browsers spread across the internet without needing to send the data via an intermediate server. The data sent and received can be any JavaScript objects.

Peer.js Groups is a thin layer of abstraction over the [Peer.js](https://github.com/peers/peerjs) library that allows peers to easily find and communicate with other peers that share an interest in a common group ID tag (e.g. a chat room name or a gaming session name).

## Where Peeer.js Groups Differs from [EasyRTC](https://easyrtc.com), [SimpleRTC](https://github.com/andyet/SimpleWebRTC), [RTCMultiConnection](https://github.com/muaz-khan/RTCMultiConnection), etc.
Great projects though the others are, I decided to roll my own. This was initially primarily for the benefit of my own learning. But as this project develops I'd like it to stick to a few principles that I've developed, and these principles perhaps distinguish this project from the competition (aside from this project being in the very early experimental stages!).

1. A focus on data connections as the first priority rather than audio or video.
1. Minimalistic - no extra bells or whistles.
1. The API is kept as simple as possible.
1. Minimal assumptions about what you want to do with the library.

An example of the last principle is that you are able to implement whatever logic you wish in response to a `joinrequest` event.

## How it Works
* WebRTC is an API built into modern browsers that allows encrypted, peer-to-peer communication directly between browsers.
* Before a peer can start sending data to another peer, the peers need a way of finding each other and negotiating the creation of a peer-to-peer connection. These are called *discovery and signalling* respectively. WebRTC doesn't come with built-in discovery or signalling protocol implementations. These usually require a server, but only to set up the initial connection. Once the connection is established then the signalling phase is finished. The server doesn't receive any of the actual messages of the conversation because it's all sent peer-to-peer.
* Peer.js Groups uses a JavaScript library called Peer.js, which provides the signalling protocol. (SIP is another popular alternative.)
* Peer.js enables *one peer* to instantiate a *point-to-point connection* with *one other peer,* provided that it knows the other peer's *peer ID* in advance. The Peer.js documentation strongly recommends allowing Peer.js to assign each peer an ID randomly (although it does also let JavaScript programmers go against that advice and choose their own peer IDs instead).
* Peer.js Groups uses Peer.js to create a "three-way" (or "four way"...) connection between peers. A "three-way" connection between peers, say A, B and C, is actually implemented as 3 two-way connections (A<->B, A<->C, B<->C). These details are all handled automatically, behind the scenes. From the perspective of someone using Peer.js Groups it works like a group chat (except the messages are JavaScript objects).

## Software Required
* A modern web browser with support for WebRTC.
* The [Peer.js client-side](https://github.com/peers/peerjs) library.
* Peer.js Groups (also client-side).
* Access to a server running the [Peer.js server-side](https://github.com/peers/peerjs-server) code (Node.js). The authors used to provide free access to their own server in the cloud but the website is now down (as of April 2018).
* If you have two peers trying to connect to each other and both are behind a separate NATs then you may encounter connection problems, in which case you'll need access to a TURN server. A TURN server enables a peer A to send an encrypted message to a peer B by first sending the message to the TURN server, and then the TURN server sends it B. The TURN server cannot decrypt the content of the messages. However, many people behind NATs can still communicate with each other without an intermediate TURN server by using something called STUN, which is an extra step at the connection set-up stage, which Peer.js handles automatically.
