var pc;
var offerSender;
var cid;
var startRecTime;

function startUX(){
    cid = getUrlParam("id");
    $("#role").text("Guest");
    $("#status").text("Waiting for connection");
    $("#them").hide();
    $("#accept").modal('show');
    setupRTC();
}
// called when webRTC presents us with a fresh remote audio/video stream
function gotStreamFromRemote(stream,kind) {
    if (!kind) {
        kind = "audio/video";
    }
    $("#status").text("Call connected. Tap video to enlarge");

    console.log("got new stream" + stream + " kind =" + kind);
    var them = document.getElementById("them");
    them.srcObject = stream;
    them.onloadedmetadata = function(e) {
        them.play();
        them.muted = false;
    };
    if (kind ==="video") {
        startRecTime = Date.now();
    }
}
function setupAV() {
    var promise = new Promise(function (resolve, reject) {
        navigator.mediaDevices.getUserMedia(gumConstraints)
            .then((stream) => {
                console.log("add local stream");
                stream.getTracks().forEach(track => {
                    var them = document.getElementById("them");
                    them.srcObject = stream;
                    pc.addTrack(track, stream);
                    console.log("added local track ", track.id, track.kind);
                    if (track.kind === "video") {
//                        setCodecOrder(pc, track);
                        $("#them").show();
                    }
                });
                resolve(false);
            })
            .catch((e) => {
                console.log('getUserMedia() error:' + e);
                reject(e);
            });
    });
    return promise;
}

// configure local peerconnection and handlers
function setupRTC(){
    pc = new RTCPeerConnection(properties.configuration, null);
    console.log("created peer connection");

    pc.onicecandidate = (e) => {
        console.log("local ice candidate", e.candidate);
        if (e.candidate != null) {
            if (pc.signalingState == 'stable') {
                sendMessage(fid, mid, "candidate", e.candidate.candidate);
            } else {
                console.log("stashing ice candidate");
                lcandyStash.push(e.candidate);
            }
        }
    };
    pc.oniceconnectionstatechange = (e) => {
        console.log("ice state is changed", pc.iceConnectionState);
        $("#status").text(pc.iceConnectionState+" connection.");

        /*
         "new"	The ICE agent is gathering addresses or is waiting to be given remote candidates through calls to RTCPeerConnection.addIceCandidate() (or both).
         "checking"	The ICE agent has been given one or more remote candidates and is checking pairs of local and remote candidates against one another to try to find a compatible match, but has not yet found a pair which will allow the peer connection to be made. It's possible that gathering of candidates is also still underway.
         "connected"	A usable pairing of local and remote candidates has been found for all components of the connection, and the connection has been established. It's possible that gathering is still underway, and it's also possible that the ICE agent is still checking candidates against one another looking for a better connection to use.
         "completed"	The ICE agent has finished gathering candidates, has checked all pairs against one another, and has found a connection for all components.
         "failed"	The ICE candidate has checked all candidates pairs against one another and has failed to find compatible matches for all components of the connection. It is, however, possible that the ICE agent did find compatible connections for some components.
         "disconnected"	Checks to ensure that components are still connected failed for at least one component of the RTCPeerConnection. This is a less stringent test than "failed" and may trigger intermittently and resolve just as spontaneously on less reliable networks, or during temporary disconnections. When the problem resolves, the connection may return to the "connected" state.
         "closed"
         */
        if (pc.iceConnectionState === "failed"){
            stopCall();
        }
        if (pc.iceConnectionState === "connected"){
            socket.close();
        }
    };
    // specification of WEBRTC is in flux - so we test to see if ontrack callback exists
        // if so we use it
        pc.ontrack = (event) => {
            var stream = event.streams[0];
            console.log("got remote track ", event.track.kind);
            gotStreamFromRemote(stream,event.track.kind);
        };


    // use this to determine the state of the 'hangup' button and send any candidates we found quickly
    pc.onsignalingstatechange = (evt) => {
        console.log("signalling state is ", pc.signalingState);
        if (pc.signalingState == 'stable') {
            var can;
            while (can = lcandyStash.pop()) {
                console.log("popping candidate off stash")
                sendMessage(fid, mid, "candidate", can.candidate);
            }
            var act = document.getElementById("stopCall");
            act.onclick =  stopCall ;
            window.onbeforeunload = function() {
                return pc.iceConnectionState=="connected" ? "If you leave this page you will end the call." : null;
            }
        }
    };
}

function messageDeal(event){
    //console.log("message is ", event.data);
    var data = JSON.parse(event.data);
    console.log("message data is ", data);
    if (data.to != mid){
        alert("message mixup");
    }
    switch (data.type) {
        case "answer":
            if (pc.signalingState == 'have-local-offer') {
                pc.setRemoteDescription(data)
                    .then(_ => {
                        if (offerSender) {
                            window.clearInterval(offerSender);
                        }
                        $("#status").text("Trying to connect call");
                        $("#action").text("hangup");
                    })
                    .catch(e => console.log("set Remote answer error", e));
            } else {
                $("#status").text("Peerconnection state is wrong "+pc.signalingState);
            }
            break;
        case "candidate":
            var jc = {
                sdpMLineIndex: 0,
                candidate: data.sdp
            };
            console.log("adding candidate ", jc);
            var nc = new RTCIceCandidate(jc);
            pc.addIceCandidate(nc)
                .then( _ => console.log("added remote candidate"))
                .catch((e) => console.log("couldn't add candidate ", e));
            break;
    }
}
function accepted() {
    setupAV().then(_ => {
        console.log("ready to offer");
        $("#status").text("Mic + Camera are available");
        startCall(cid)
    });
}

function startCall(cid){
    lcandyStash = [];
    rcandyStash = [];
    fid = cid;
    pc.createOffer(peerConnectionOfferAnswerCriteria)
        .then(desc => {
            console.log("offer created",);
            pc.setLocalDescription(desc).then( d => {
                offerSender = sendAndRetryMessage(fid, mid, desc.type, desc.sdp, "Trying to connect call")
            });
        })
        .catch(e => console.log("offer not created due to ", e) );
}

function stopCall() {
    var dur = Date.now() - startRecTime;
    localStream.getAudioTracks()[0].stop();
    clearInterval(statsTick);
    $("#status").text("Call ended.");
    window.location = "thanks.html?dur=" + dur;
}
