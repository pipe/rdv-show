
var pots = [ {pan:-0.3,id:"them0"}, {pan:0.3, id:"them1"} ];

function Session(id) {
    this.lastLoss = 0;
    this.lastRecv = 0;
    this.fid = id;
    this.panned = null;
    this.dcomp = null;
    this.peerout = null;
    this.peerin = null;
    this.statusChannel = null;
    this.audio = null;
    this.audioLevel = 0.0;
    this.lcandyStash = [];
    this.pot = null;
    console.log("created session for " + id);
};
Session.prototype.setMediaElement = function () {
    this.pot =  pots.pop();
    if (this.pot) {
        this.pan = this.pot.pan;
    }
    if (!this.pan) {
        console.log("pan audio to center ...");
        this.pan = 0.0;
    }
    console.log("pan is " + this.pan);
    if (this.pot) {
        this.video = document.getElementById(this.pot.id);
        console.log("using carousel video id "+this.video.id);
    } else {
        this.video = document.createElement("video");
        this.video.muted = true;
        this.video.setAttribute("autoplay", "true");
        console.log("not using carousel video - making a fresh one ");
    }
}
Session.prototype.offerDeal = function (data) {
    this.setupRTC();
    this.pc.setRemoteDescription(data).then(_ =>{
        this.setOutboundTracks();
        this.pc.createAnswer(peerConnectionOfferAnswerCriteria).then(ans => {
            //ans.sdp = tweakSDP(ans.sdp);
            this.pc.setLocalDescription(ans).then(_ =>
                sendMessage(this.fid, mid, "answer", ans.sdp)
            )
        });}
    ).catch((e) => console.log("set Remote offer error", e));
};
Session.prototype.candidateDeal = function (data) {
    var jc = {
        sdpMLineIndex: 0,
        candidate: data.sdp
    };
    console.log("adding candidate ", jc);
    var nc = new RTCIceCandidate(jc);
    this.pc.addIceCandidate(nc)
        .then(_ => console.log("added remote candidate"))
        .catch((e) => console.log("couldn't add candidate ", e));
};
Session.prototype.stopSession = function () {
    console.log("removing " + this.fid);
    delete sessions[this.fid];

    var that = this;

    Object.entries(sessions).forEach(sessionkva => {
        var session = sessionkva[1];
        if (that.dcomp && session.panned) {
            try {
                session.panned.disconnect(that.dcomp);
            } catch (e) {
                console.log("session not connected to dcomp...")
            }
        }
        if (that.panned && session.dcomp) {
            try {
                that.panned.disconnect(session.dcomp);
            } catch (e) {
                console.log("panned not connected to dcomp...")
            }
        }
        if (session.statusChannel && (session.statusChannel.readyState == 'open')) {
            session.statusChannel.send(JSON.stringify({act: 'del', fid: that.fid})); // I hear them
        }
    });

    if (localpanned) {
        try {
            localpanned.disconnect(this.dcomp);
        } catch (e) {
            console.log("local not connected to dcomp...")
        }
    }
    if (this.panned != null) {
        try {
            this.panned.disconnect(localdcomp);
        } catch (e) {
            console.log("panned not connected to localdcomp...")
        }
        this.panned = null;
    }
    if (this.pot) {
        pots.push(this.pot);
        this.pot = null;
    }
    try {
        if (this.dcomp != null) {
            this.dcomp.disconnect();
            this.dcomp = null;
        }
        if (this.peerout != null) {
            this.peerout.disconnect();
            this.peerout = null;
        }
        if (this.peerin != null) {
            this.peerin.disconnect();
            this.peerin = null;
        }
    } catch (e) {
        console.log("mixup in disconnects")
    }


    if (this.pc != null) {
        var mpc = this.pc;
        window.setTimeout(function () {
            mpc.close();
        }, 5000);
        this.pc = null;
    }
    if (this.video) {
        this.video.srcObject = null;
        this.video.pause();
        this.video = null;
    }
    $("#status").text("Call connected to " + Object.keys(sessions).length + " member(s).");
};
Session.prototype.setupRTC = function () {
    console.log("setting up webRTC for " + this.fid);
    this.pc = new RTCPeerConnection(properties.configuration, null);
    this.pc.onicecandidate = (e) => {
        console.log("local ice candidate", e.candidate);
        if (e.candidate != null) {
            if (this.pc.signalingState == 'stable') {
                sendMessage(this.fid, mid, "candidate", e.candidate.candidate);
            } else {
                console.log("stashing ice candidate");
                this.lcandyStash.push(e.candidate);
            }
        }
    };
    this.pc.onnegotiationneeded = (e) =>{
        console.log("negotiation needed, state is ", this.pc.signalingState);
    };
    this.pc.oniceconnectionstatechange = (e) => {
        console.log("ice state is changed", this.pc.iceConnectionState);
        if (this.pc.iceConnectionState === "connected") {
            console.log(this.pc.getTransceivers());
            var sendtr = this.pc.getTransceivers().find((tr) => tr && tr.sender && tr.sender.track && tr.sender.track.kind === "audio");
            if (sendtr) {
                tweakOpus(sendtr.sender);
            }
        }
        /*
         "new"	The ICE agent is gathering addresses or is waiting to be given remote candidates through calls to RTCPeerConnection.addIceCandidate() (or both).
         "checking"	The ICE agent has been given one or more remote candidates and is checking pairs of local and remote candidates against one another to try to find a compatible match, but has not yet found a pair which will allow the peer connection to be made. It's possible that gathering of candidates is also still underway.
         "connected"	A usable pairing of local and remote candidates has been found for all components of the connection, and the connection has been established. It's possible that gathering is still underway, and it's also possible that the ICE agent is still checking candidates against one another looking for a better connection to use.
         "completed"	The ICE agent has finished gathering candidates, has checked all pairs against one another, and has found a connection for all components.
         "failed"	The ICE candidate has checked all candidates pairs against one another and has failed to find compatible matches for all components of the connection. It is, however, possible that the ICE agent did find compatible connections for some components.
         "disconnected"	Checks to ensure that components are still connected failed for at least one component of the RTCPeerConnection. This is a less stringent test than "failed" and may trigger intermittently and resolve just as spontaneously on less reliable networks, or during temporary disconnections. When the problem resolves, the connection may return to the "connected" state.
         "closed"
         */
        if (this.pc.iceConnectionState === "failed") {
            console.log("ice failed");
            this.stopSession();
        }
        if (this.pc.iceConnectionState === "closed") {
            console.log("ice closed");
            this.stopSession();
        }
        if (this.pc.iceConnectionState === "disconnected") {
            console.log("ice disconnected");
            setTimeout(() => {
                if (this.pc.iceConnectionState != "connected") {
                    this.stopSession();
                }
            }, 5000);
        }
    };

    this.pc.ontrack = (event) => {
        var stream = event.streams[0];
        console.log("got remote track ", event.track.kind);
        this.addRemoteStream(stream, event.track.kind);
    };

    // use this to determine the state of the 'hangup' button and send any candidates we found quickly
    this.pc.onsignalingstatechange = (evt) => {
        if (this.pc != null) {
            console.log("signalling state is ", this.pc.signalingState);
            if (this.pc.signalingState == 'stable') {
                var can;
                while (can = this.lcandyStash.pop()) {
                    console.log("popping candidate off stash");
                    sendMessage(this.fid, mid, "candidate", can.candidate);
                }
                var act = $("#stopCall");
                act.click(_ => stopCall());
                window.onbeforeunload = function () {
                    return this.pc != null ? "If you leave this page you will end the connection." : null;
                }
            }
        }
    };
};
Session.prototype.setOutboundTracks = function () {
    // audio
    // outbound
    // for now just add the localpanned stream

    this.dcomp = myac.createDynamicsCompressor();
    if (localpanned) {
        localpanned.connect(this.dcomp);
        console.log("connect local stream to dcomp");
    }

    this.peerout = myac.createMediaStreamDestination();
    this.dcomp.connect(this.peerout);
    var pc = this.pc;
    var pstream = this.peerout.stream;

    pstream.getTracks().forEach(track => {
        pc.addTrack(track, pstream);
        console.log("added panned outbound track ", track.id, track.kind, track.label);
    });

    var that = this;
    Object.entries(sessions).forEach(sessionkva => {
        var id = sessionkva[0];
        if (id != this.fid) {
            var session = sessionkva[1];
            if (that.dcomp && session.panned) {
                session.panned.connect(that.dcomp); // I hear them
            }
        }
    });

    // and video
    if (mcu) {
        mcu.getTracks().forEach(track => {
            if (track.kind === 'video') {
                pc.addTrack(track);
                console.log("added mcu outbound track ", track.id, track.kind, track.label);
            } else {
                console.log ("Non muc track not added ?!?"+track.kind)
            }
        });
    }

};
Session.prototype.addRemoteStream = function (stream, kind) {

    // deal with an inbound stream
    if (!kind) {
        kind = "audio/video";
    }
    $("#status").text("Call connected to " + Object.keys(sessions).length + " member(s).");
    console.log("got new stream" + stream + " kind =" + kind);
    if (!this.video){
        console.log("get a media element/pan etc");
        this.setMediaElement();
    }
    if (kind.indexOf("audio") != -1) {
        // inbound....
        this.peerin = myac.createMediaStreamSource(stream);
        // volume measurement
        this.analyserNode = myac.createAnalyser();
        this.peerin.connect(this.analyserNode);
        this.pcmData = new Float32Array(this.analyserNode.fftSize);


        this.panned = myac.createStereoPanner();
        this.panned.pan.value = this.pan;
        console.log("panned to " + this.pan);
        this.peerin.connect(this.panned);

        // now connect panned to :
        // local destination...

        // plug the panned output into our dcomp so we get the stereo effect as host.
        if (localdcomp != null) {
            this.panned.connect(localdcomp);
        } else {
            console.log("nowhere to plug " + this.fid);
        }

        var that = this;
        Object.entries(sessions).forEach(sessionkva => {
            var id = sessionkva[0];
            if (id != this.fid) {
                var session = sessionkva[1];
                if (that.panned && session.dcomp) {
                    that.panned.connect(session.dcomp); // they hear me
                }
            }
        });
        $("#chosenAction").show();
        $("#statsZone").show();
    }
    this.addVstream(stream, kind);
};

Session.prototype.calcAudioLevel = function () {
    if (this.analyserNode) {
        this.analyserNode.getFloatTimeDomainData(this.pcmData);
        let sumSquares = 0.0;
        for (const amplitude of this.pcmData) {
            sumSquares += amplitude * amplitude;
        }
        let na = Math.sqrt(sumSquares / this.pcmData.length);
        this.audioLevel = (this.audioLevel / 2) + na;
    }
};

Session.prototype.getAudioLevel = function(){
    return this.audioLevel;
};

Session.prototype.getVideo = function(){
    return this.video;
};

Session.prototype.addVstream = function (stream) {
    this.video.srcObject = stream;
    this.video.play();
    console.log("added stream to local media object");
};

