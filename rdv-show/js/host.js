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
var urltxt;

function shareURL(){
    let shareData = {
        title:"Podcast guest invite",
        text:"Please click this link to join our scheduled call.",
        url:urltxt,
    }
    if (!navigator.canShare) {
        console.log("navigator.canShare() not supported.");
    } else if (navigator.canShare(shareData)) {
        console.log("navigator.canShare() supported. We can use navigator.share() to send the data.");
        navigator.share(shareData).catch( (err) =>{console.log("cant share because "+err)});
    } else {
        console.log("Specified data cannot be shared.");
    }
}
async function startUX(){
    cid = mid;
    $("#role").text("Host");
    $("#status").text("Connected");
    document.getElementById("shareDone").onclick = shared;
    var remotes = document.getElementById("mcu");
    cropVideo = await CropTarget.fromElement(remotes);
    console.log("got crop Target");
    urltxt = window.location.href.replace("host.html","guest.html")+ "?id="+mid;
    let p1 = document.getElementById("shareP1");
    if (!navigator.canShare) {
        console.log("navigator.canShare() not supported.");
        p1.innerText = "Share this link with your guests. "+urltxt
    } else {
        p1.innerHTML = "Click <button onclick='shareURL()' id='shareURL' class='btn btn-danger'>Share</button> to send link to guests. "
    }
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
    var castb = document.getElementById("cast");
    castb.addEventListener("click", castMe)
    $('#cast').removeClass("disabled");
    populateSettings();
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
    const lines = event.data.split("\n");
    var data = JSON.parse(lines[0]);
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
    let thema = document.getElementById("them");
   // thema.srcObject = dests.stream;
    if (localStorage["sinkId"]){
        thema.setSinkId(localStorage["sinkId"])
            .then(() => { console.log("Set sinkId ok");})
            .catch((err)=> {console.log("set sinkId failed "+err);})
            .finally(() => { thema.play();});
    } else {
        thema.play();
    }

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
                $("#devices").click(_ => {
                        let target = document.getElementById("deviceList");
                        let me = document.getElementById("me");
                        showDevices(target,localStream,me.srcObject,thema);
                        $("#deviceConfig").modal('show');
                    }
                );
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


