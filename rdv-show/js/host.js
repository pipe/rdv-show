var cid;
var startRecTime;
var sessions = {};
var myac;
var initiator;
var localdcomp;
var localpanned;
var mcu;
var cropVideo;
var nmap = {them0:0,me:1,them1:2};



async function startUX(){
    cid = mid;
    $("#role").text("Host");
    $("#status").text("Connected");
    document.getElementById("shareDone").onclick = shared;
    var remotes = document.getElementById("mcu");
    cropVideo = await CropTarget.fromElement(remotes);
    console.log("got crop Target");
    $("#share").modal('show');
    const me = document.getElementById("me");
    window.setInterval( ()=> {
        var max =0.01;
        var selected = me;

        Object.entries(sessions).forEach(sessionkva => {
            var session  = sessionkva[1];
            session.calcAudioLevel();
            var level =  session.getAudioLevel();
            var video = session.getVideo();
            if (level > max){
                selected = video;
                max = level;
            }
        });
        slideTo(selected);
    },500);
}

async function setupMCU() {
    // set mcu  somehow.
    mcu = await navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: true,
        preferCurrentTab: true
    });
    var mcuT = mcu.getVideoTracks()[0];
    if ((cropVideo) && (mcuT.cropTo)) {
        await mcuT.cropTo(cropVideo);
    } else {
        console.log("No cropTarget or cropTo")
    }
    var act = document.getElementById("stopCall");
    act.onclick =  stopCall;
    window.onbeforeunload = function() {
        return  "If you leave this page you will end the call.";
    }
}
async function shared() {
    await setupAV();
    await setupMCU();
    console.log("ready for offer");
    $("#status").text("Waiting for guests.");
}

function messageDeal(event){
    //console.log("message is ", event.data);
    var data = JSON.parse(event.data);
    console.log("message data is ", data);
    if (data.to != mid){
        alert("message mixup");
    }
    var session = sessions[data.from];
    switch (data.type) {
        case "offer":
            if (session == null) {
                session = new Session(data.from);
                sessions[data.from] = session;
            }
            session.offerDeal(data);
            break;
        case "answer":
            console.log("huh? Guests send offers");
            break;
        case "candidate":
            if (session) {
                session.candidateDeal(data);
            } else {
                console.log("should stash candidate for "+data.from);
            }
            break;
    }
}
function setupAV() {
    myac = new AudioContext();

    localdcomp = myac.createDynamicsCompressor();
    var dests = myac.createMediaStreamDestination();
    localdcomp.connect(dests);
    // set up play....
    document.getElementById("them").srcObject = dests.stream;
    document.getElementById("them").play();

    var promise = new Promise(function (resolve, reject) {
        navigator.mediaDevices.getUserMedia(gumConstraints)
            .then((stream) => {
                console.log("add local stream");
                stream.getTracks().forEach(track => {
                    if (track.kind === "video") {
                        var me = document.getElementById("me");
                        me.srcObject = stream;
                    }
                    if (track.kind === "audio") {
                        localStream = stream;
                        localpanned = myac.createMediaStreamSource(stream);
                        // not actually panned...
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
function slideTo(v){
    if (v){
        var slideNo = nmap[v.id];
        $('#mcu').carousel(slideNo);
        console.log("selecting "+v.id);
    }
}


