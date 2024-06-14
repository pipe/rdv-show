var mid;
var properties;
var socket;
var localStream;
var mute = false;
var peerConnectionOfferAnswerCriteria =  {offerToReceiveAudio: true, offerToReceiveVideo: true };
var gumConstraints = localStorage["GUM"] ? JSON.parse(localStorage["GUM"]):{audio: true, video: { facingMode: "user" }};
function setAspectRatio() {
    const supported = navigator.mediaDevices.getSupportedConstraints().aspectRatio;
    if (supported) {
        console.log("attempting portrait constraint");
        if (window.orientation) {
            if ((window.orientation === -90) || (window.orientation === 90)) {
                gumConstraints.video.aspectRatio = (16.0 / 9.0);
            } else {
                gumConstraints.video.aspectRatio = (9.0 / 16.0);
            }
        } else {
            gumConstraints.video.aspectRatio = (9.0 / 16.0);
        }
    } else {
        console.log("failed to set portrait constraint");
    }
}
function isFacebookApp() {
    var ua = navigator.userAgent || navigator.vendor || window.opera;
    return (ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf('Instagram') > -1) ;
}
// some housekeeping

function isWebrtcSupported() {
    // tip of the hat to Janus for this test :
    // https://groups.google.com/forum/#!topic/meetecho-janus/lRjYn0C9BYU
    // it should detect the horrible mess that is chrome on ios
    // and various other ugly captives....

    return ('RTCPeerConnection' in window) && ("mediaDevices" in navigator) && ("getUserMedia" in navigator.mediaDevices);
};

function getUrlParam(name){
    const queryString = window.location.search;
    console.log(queryString);
    const urlParams = new URLSearchParams(queryString);
    return urlParams.get(name);
}

function sendMessage(to,from,type,data){
    var messageJ = {
        to:to,
        from:from,
        type:type,
        sdp:data
    };

    var message = JSON.stringify(messageJ);
    if (socket.readyState == 1 ){
        console.log("sending ", message);
        socket.send(message);
    } else {
        console.log("not sending \n"+ message+ "\n because websocket readyState ="+socket.readyState);
        $("#status").text("Server Problem?");
    }
}

function stopCall() {
    var dur = Date.now() - startRecTime;
    $("#status").text("Call ended.");
    window.location = "thanks.html?dur=" + dur;
}

function setMute(m){
    var mi = $("#muteIcon");
    mute = m;
    if (m){
        mi.removeClass("fa-microphone");
        mi.addClass("fa-microphone-slash");
    } else {
        mi.removeClass("fa-microphone-slash");
        mi.addClass("fa-microphone");
    }
    var audioTracks = localStream.getAudioTracks();
    if (audioTracks[0]) {
        audioTracks[0].enabled = !m;
    }
}

function sendAndRetryMessage(to,from,type,data, statusText ){
    var count = 0;
    sendMessage(to,from,type,data);
    $("#status").text(statusText);
    return window.setInterval( () => {
        count++;
        sendMessage(to,from,type,data);
        var lstatusText = statusText + " - retry "+count+".";
        $("#status").text(lstatusText);
    },5000);
}
function codecPriority(codecMime){
    var ret = 2;
    if (codecMime.includes("h264") || codecMime.includes("H264")){
        ret = 1;
    } else if (codecMime.includes("h265") || codecMime.includes("H265")){
        ret =0;
    }
    return ret;
}

function tweakOpus(send) {
        const paras = send.getParameters();
        console.log("initial audio encoder params");
        console.log(paras);
        if ((paras) && (paras.encodings)) {
            paras.encodings[0].maxBitrate = 64000;
            paras.encodings[0].ptime = 60;
            send.setParameters(paras);
            console.log(paras);
        }

}

function setCodecOrder(trans){
    if (RTCRtpSender.getCapabilities) {
        var codecs = RTCRtpSender.getCapabilities("video").codecs;
        console.log("default video codecs ");
        codecs.forEach((v) => {
            console.log(v.mimeType);
        })
        //codecs.sort((a, b) => codecPriority(a.mimeType) - codecPriority(b.mimeType));
        console.log("ordered video codecs ")
        codecs.forEach((v) => {
            console.log(v.mimeType);
        })
        trans.setCodecPreferences(codecs);
        console.log('Flipped  video codec');
    } else {
        console.log('Default  video codecs');
    }
}
function loadProps() {
    var that = {configUrl: "pipeconfig.json"};
    var promise = new Promise(function (resolve, reject) {
        var xobj = new XMLHttpRequest();
        xobj.overrideMimeType("application/json");
        xobj.open('GET', that.configUrl, true);
        xobj.onreadystatechange = function () {
            if (xobj.readyState == 4 && xobj.status == "200") {
                var pipeconfig = JSON.parse(xobj.responseText);
                console.log("Config is " + xobj.responseText);
                if (pipeconfig.ice) {
                    that.configuration = pipeconfig.ice;
                    console.log("Set ICE params " + JSON.stringify(that.configuration));
                }
                if (pipeconfig.wsurl) {
                    that.wsurl = pipeconfig.wsurl;
                    console.log("Set wsurl " + JSON.stringify(that.wsurl));
                }
                resolve(that);
            }
        };
        xobj.send(null);
    });
    return promise;
}

async function startPipe(){
    mid = localStorage['showId'];
    //var act = $("#action");
    if (!mid) {
        var array = new Uint32Array(8);
        window.crypto.getRandomValues(array);
        var hexCodes = [];
        for (var i = 0; i < array.length; i ++ ){
            // Using getUint32 reduces the number of iterations needed (we process 4 bytes each time)
            var value = array[i];
            // toString(16) will give the hex representation of the number without padding
            var stringValue = value.toString(16);
            // We use concatenation and slice for padding
            var padding = '00000000';
            var paddedValue = (padding + stringValue).slice(-padding.length)
            hexCodes.push(paddedValue);
        }
        mid = hexCodes.join("").toUpperCase();
        console.log("mid =", mid);
        localStorage['showId'] = mid;
    }
    properties = await loadProps();
    socket = new WebSocket( properties.wsurl + mid);
    socket.onmessage = messageDeal;
    socket.onopen = (_) => {
        startUX();
    }
}
$(document).ready(function () {
    if (isFacebookApp()) {
        $("#status").text("Facebook apps block webrtc in their 'browser' ");
        $("#facebookapp").show();
        console.log("UGH, facebook. !");
    } else {
        if (isWebrtcSupported()) {
            console.log("I see webRTC !");
            setAspectRatio();
            $("#status").text("Waiting for server connection");
            startPipe();
            $("#mute").click(_ => setMute(!mute));
        } else {
            console.log("I don't see webRTC !");
            $("#status").text("Dont have webRTC available ");
            $('#nowebrtc').modal('show');
        }
    }
});
