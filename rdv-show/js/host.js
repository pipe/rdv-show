var cid;
var startRecTime;
var localStream;
var sessions = {};
var myac;
var initiator;
var localdcomp;
var localpanned;
var mcu;
var cropVideo;


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
            console.log("audio level is " +level+" "+video.id);
        });
        slideTo(selected);
    },1000);
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
                localStream = stream;
                stream.getTracks().forEach(track => {
                    if (track.kind === "video") {
                        var me = document.getElementById("me");
                        me.srcObject = stream;
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
    console.log("slide to" + v);
    if (v){
        let citem = v.parentElement;
        if (!citem.classList.contains("active")){
            var sibs = citem.parentElement.childNodes;
            for (sib of sibs){
                var cl = sib.classList;
                if (cl){
                    cl.remove("active");
                }
            }
            citem.classList.add("active");
            console.log("selecting "+v.id);
        }
    }
}


