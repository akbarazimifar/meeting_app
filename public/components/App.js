import NavBar from './NavBar.js';
import VideoGrid from './VideoGrid.js';
import BottomBar from './BottomBar.js';
import ShareArea from './ShareArea.js';
import SidePanel from './SidePanel.js';

function playSound(url) {
  try {
    const myAudioElement = new Audio(url);
    myAudioElement.addEventListener('canplaythrough', (event) => {
      myAudioElement.play();
    });
  } catch (err) {
    console.log(err);
  }
}

function playSound_JoinMeeting() {
  const url = './components/sounds/join1.mp3';
  playSound(url);
}

function playSound_LeaveMeeting() {
  const url = './components/sounds/leave1.mp3';
  playSound(url);
}

export default {
  name: 'App',
  components: {
    NavBar,
    ShareArea,
    VideoGrid,
    BottomBar,
    SidePanel,
  },
  template: `
<div style="background-color:#f0f0f0;">

    <div class="w3-container w3-blue">
      <h1 align="center"><b>{{ product }}</b></h1>
      <p align="center"><b>{{ description }}</b></p>
    </div>
    <NavBar></NavBar>

    <div class="w3-row">
      <div class="w3-col m10">
         <ShareArea></ShareArea>
         <VideoGrid></VideoGrid>
      </div>

      <div class="w3-col m2">
        <SidePanel></SidePanel>
      </div>
     </div>

    <BottomBar></BottomBar>
    
</div>`,

  data: function () {
    return {
      myPeer: undefined,
      myConnection: {
        id: undefined,
        userName: undefined,
        roomId: undefined,
        stream: undefined,
        isMe: false,
        audioEnabled: false,
        videoEnabled: false,
        sharing: false,
        call: undefined,
      },
    };
  },
  mounted() {
    // needed for function below
    const component_this = this;

    /**
     * This function helps to connect to users who joined the room
     * but spent too much time dealing with browser's 'Allow camera and mic'
     * dialog, that they missed my call which passes my stream.
     * So find these people and send them my stream :)
     */
    function whoNeedsACallFromMe() {
      const peersWithNoStreamMap =
        component_this.$store.getters.peersWithNoStream;
      for (let [key, value] of peersWithNoStreamMap) {
        console.log(
          `whoNeedsACallFromMe => id: ${value.id}, user name: ${value.userName} in room: ${value.roomId} with my stream`
        );
        // TODO check if I need to send shareStream instead here.
        component_this.sendMyStreamToNewUserAndAcceptUserStream(
          value.id,
          value.userName
        );
      }
    }

    // every 8 seconds, call the function above
    setInterval(whoNeedsACallFromMe, 8000);

    this.myPeer = new Peer(undefined, peerConfig);

    socket.on('user-disconnected', (userId, userName) => {
      console.log(`User disconnected: id ${userId}, user name ${userName} `);

      // let's keep track of connected users to help keep track of
      // whether or not they received our stream.
      // Sometimes there's too much of a delay when other user
      // is dealing with the browser's 'Allow Camera and Microphone'
      this.removePeerWithoutStreamActionInStore({
        id: userId,
        roomId: this.myConnection.roomId,
      });

      playSound_LeaveMeeting();
      this.deleteConnectedItemInStore(userId);
    });

    socket.on('user-name', (userId, userName) => {
      console.log(`User ${userId} has user name ${userName}`);
      this.updateUserNameInStore({ id: userId, userName: userName });
    });

    socket.on('user-muted-audio', (userId) => {
      console.log(`User ${userId} muted audio`);
      this.updateAudioMutedInStore({ id: userId, enabled: false });
    });

    socket.on('user-unmuted-audio', (userId) => {
      console.log(`User ${userId} unmuted audio`);
      this.updateAudioMutedInStore({ id: userId, enabled: true });
    });

    socket.on('user-muted-video', (userId) => {
      console.log(`User ${userId} muted video`);
      this.updateVideoMutedInStore({ id: userId, enabled: false });
    });

    socket.on('user-unmuted-video', (userId) => {
      console.log(`User ${userId} unmuted video`);
      this.updateVideoMutedInStore({ id: userId, enabled: true });
    });

    socket.on('user-starting-share', (userId) => {
      console.log(`User ${userId} sharing screen`);
      this.updateWhoIsSharingInStore({ id: userId, enabled: true });
    });

    socket.on('user-stopping-share', (userId) => {
      console.log(`User ${userId} stopped sharing screen`);
      this.updateWhoIsSharingInStore({ id: userId, enabled: false });
    });

    this.myPeer.on('open', (id) => {
      console.log(
        `myPeer.on: user ${id}, user name '${USER_NAME}' joining room ${ROOM_ID}`
      );
      this.myConnection.id = id;
      this.myConnection.userName = USER_NAME;
      this.myConnection.roomId = ROOM_ID;
      socket.emit('join-room', ROOM_ID, id, USER_NAME);

      // START MEDIA
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          this.myConnection.stream = stream;
          this.myConnection.isMe = true; // mutes my video; even though muted=true doesn't show in video HTML element ;)
          this.myConnection.audioEnabled = true;
          this.myConnection.videoEnabled = true;
          this.addConnectedItemToStore(this.myConnection);

          this.myPeer.on('call', (call) => {
            // IF THIS FUNCTION IS NOT HERE, THE CODE IN sendMyStreamToNewUserAndAcceptUserStream NEVER GETS A STREAM.
            // ALSO THESE console.log() LINES NEVER PRINT OUT, AND DO NOT TRIGGER BREAKPOINTS
            console.log(`${call.peer} calling me. Answering call`);
            call.answer(stream);

            call.on('stream', (userVideoStream) => {
              setTimeout(() => {
                console.log(
                  `this.Peer.on:call:event:stream:event ${call.peer}`
                );
                this.acceptNewUserStream(call, userVideoStream);
              }, 2000);
            });
          });

          socket.on('user-connected', (userId, userName) => {
            // let's keep track of connected users to help keep track of
            // whether or not they received our stream.
            // Sometimes there's too much of a delay when other user
            // is dealing with the browser's 'Allow Camera and Microphone'
            this.addPeerWithoutStreamActionInStore({
              id: userId,
              roomId: this.myConnection.roomId,
              userName: userName,
            });

            playSound_JoinMeeting();
            setTimeout(() => {
              console.log(
                `app.js"socket.on:user-connected:event: Send my stream to user ${userId}, user name ${userName}`
              );
              // user joined
              this.sendMyStreamToNewUserAndAcceptUserStream(userId, userName);
            }, 2000);
          });
        });
      // END MEDIA
    });
  },
  computed: {
    product() {
      return this.$store.state.product;
    },
    description() {
      return this.$store.state.description;
    },
  },
  methods: {
    broadcastMyStatusAttributes() {
      const myConnection = this.$store.getters.myConnectedItem;

      // my audio status
      if (myConnection.audioEnabled) {
        console.log(`broadcasting I am unmuted...`);
        socket.emit('unmuted-audio', myConnection.roomId, myConnection.id);
      } else {
        console.log(`broadcasting I am muted...`);
        socket.emit('muted-audio', myConnection.roomId, myConnection.id);
      }

      // my video status
      if (myConnection.videoEnabled) {
        console.log(`broadcasting my video is unmuted...`);
        socket.emit('unmuted-video', myConnection.roomId, myConnection.id);
      } else {
        console.log(`broadcasting my video is muted...`);
        socket.emit('muted-video', myConnection.roomId, myConnection.id);
      }

      // my share status
      if (myConnection.sharing) {
        console.log(`broadcasting i am sharing...`);
        socket.emit('starting-share', myConnection.roomId, myConnection.id);
      } else {
        console.log(`broadcasting i am not sharing...`);
        socket.emit('stopping-share', myConnection.roomId, myConnection.id);
      }

      // my user name
      if (myConnection.userName) {
        socket.emit(
          'broadcast-username',
          myConnection.roomId,
          myConnection.id,
          myConnection.userName
        );
      }
    },
    increment() {
      this.$store.dispatch('incrementAsync');
    },
    addPeerWithoutStreamActionInStore(userData) {
      this.$store.dispatch('addPeerWithoutStreamAction', userData);
    },
    removePeerWithoutStreamActionInStore(userData) {
      this.$store.dispatch('removePeerWithoutStreamAction', userData);
    },
    addConnectedItemToStore(userData) {
      this.$store.dispatch('addConnection', userData);
    },
    updateConnectedItemInStore(userData) {
      this.$store.dispatch('updateConnection', userData);
    },
    updateUserNameInStore(data) {
      this.$store.dispatch('updateTheUserName', data);
    },
    updateAudioMutedInStore(data) {
      this.$store.dispatch('updateAudioMuted', data);
    },
    updateVideoMutedInStore(data) {
      this.$store.dispatch('updateVideoMuted', data);
    },
    updateWhoIsSharingInStore(data) {
      this.$store.dispatch('updateWhoIsSharing', data);
    },
    deleteConnectedItemInStore(userId) {
      this.$store.dispatch('deleteConnection', userId);
    },

    acceptNewUserStream(call, userStream) {
      // need to accept call as a parameter since we need to store the actual call
      // in order to help with screen sharing. In this case, we need to replace
      // webcam/microphone stream with sharing stream to all connected users.
      const userId = call.peer;
      console.log(`acceptNewUserStream ${userId}, userName=...`);
      // until user broadcast the user name, we will give it empty string.
      const userConnection = {
        id: userId,
        userName: '...',
        roomId: this.myConnection.roomId,
        stream: userStream,
        isMe: false,
        audioEnabled: true,
        videoEnabled: true,
        sharing: false,
        call: call,
      };
      if (!this.$store.getters.connectedContainsId(userId)) {
        this.addConnectedItemToStore(userConnection);
      } else {
        this.updateConnectedItemInStore(userConnection);
      }
    },
    sendMyStreamToNewUserAndAcceptUserStream(userId, userName) {
      console.log(
        `sendMyStreamToNewUserAndAcceptUserStream ${userId}, ${userName}`
      );

      // obtain my current stream (video/audio, or share stream)
      const myCurrentStream = this.$store.getters.myCurrentStream;

      // sending my stream to a user through a call
      const call = this.myPeer.call(userId, myCurrentStream);

      // preparing most of user connection data here; but don't yet have stream
      const userConnection = {
        id: userId,
        userName: userName,
        roomId: this.myConnection.roomId,
        stream: undefined,
        isMe: false,
        audioEnabled: true,
        videoEnabled: true,
        sharing: false,
        call: call,
      };

      let broadcastedMyStatusToThisUser = false;

      call.on('stream', (userVideoStream) => {
        // let's keep track of connected users to help keep track of
        // whether or not they received our stream.
        // Sometimes there's too much of a delay when other user
        // is dealing with the browser's 'Allow Camera and Microphone'
        this.removePeerWithoutStreamActionInStore({
          id: userId,
          roomId: this.myConnection.roomId,
        });

        // have the user's stream now, so can finally add user connection data to the store.
        userConnection.stream = userVideoStream;

        if (!this.$store.getters.connectedContainsId(userId)) {
          this.addConnectedItemToStore(userConnection);
        } else {
          this.updateConnectedItemInStore(userConnection);
        }

        // only broadcast once to this user
        if (!broadcastedMyStatusToThisUser) {
          // let this user know of my different status attributes
          // a delay is required
          setTimeout(() => {
            this.broadcastMyStatusAttributes();
          }, 5000);

          broadcastedMyStatusToThisUser = true;
        } else {
          console.log(`Already broadcasted my status to user id ${userId}`);
        }
      });

      call.on('close', () => {
        console.log(`User closed call: id ${userId}, user name ${userName} `);
        this.deleteConnectedItemInStore(userId);
      });
    },
  },
};
