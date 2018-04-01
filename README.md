# peerjs-groups
Peer.js Groups is a thin layer of abstraction over the (Peer.js)[https://github.com/peers/peerjs] library that allows peers to easily find and communicate with other peers that share an interest in a common group ID tag (e.g. a chat room name or a gaming session name).

## Where Peeer.js Groups Differs from [EasyRTC](https://easyrtc.com), [SimpleRTC](https://github.com/andyet/SimpleWebRTC), [RTCMultiConnection](https://github.com/muaz-khan/RTCMultiConnection), etc.
Great projects though the others are, I decided to roll my own. This was initially primarily for the benefit of my own learning. But as this project develops I'd like it to stick to a few principles that I've developed, and these principles perhaps distinguish this project from the competition (aside from this project being in the very early experimental stages!)

1. I focus on data connections as the first priority rather than audio or video.
1. Minimalistic - no extra bells or whistles.
1. The API is kept as simple as possible.
1. Minimal assumptions about what you want to do with the library.

An example of the last principle is that you are able to implement whatever logic you wish in response to a `joinrequest` event.
