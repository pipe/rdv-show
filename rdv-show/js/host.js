var cid;
var startRecTime;
var myac;
var localdcomp = null;
var localpanned;
var mcu;
var cropVideo;
var urltxt;
var me;
var lastn = -1;

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
    console.log("share url is "+urltxt);
}
async function startUX(){
    cid = mid;
    $("#role").text("Host");
    $("#status").text("Connected");
    document.getElementById("shareDone").onclick = shared;
    var remotes = document.getElementById("vscreen");
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
    window.setInterval( ()=> {
        var s= loudestSession();
        var n=0 ; // me.
        if (s){
            n = s.pot.n;
        }
        if ( n != lastn) {
            if (n != 0) {
                console.log("selecting " + s.fid + " at " + s.pot.n);
            } else {
                console.log("selecting me");
            }
            slideTo(n);
            lastn = n;
        }
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

    $("#setSave").click(  function () {
        saveSettings();
    });
    $("#setCancel").click(  function () {
        cancelSettings();
    });
    $('#cast').removeClass("disabled");

    populateSettings();
    var whipSettings = document.getElementById("whipSettings");
    whipSettings.onclick = (e) => {
        populateSettings();
        $("#whipDialog").modal('show');
    }
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
    var session = getSessionById(data.from);
    switch (data.type) {
        case "offer":
            if (session == null) {
                session = new Session(data.from);
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
function playThem(){
    let thema = document.getElementById("them");
    if (localStorage["sinkId"]){
        thema.setSinkId(localStorage["sinkId"])
            .then(() => { console.log("Set sinkId ok");})
            .catch((err)=> {console.log("set sinkId failed "+err);})
            .finally(() => { thema.play();});
    } else {
        thema.play();
    }
}
function setupAV() {
    let thema = document.getElementById("them");

    myac = new AudioContext();
    localdcomp = myac.createDynamicsCompressor();
    var dests = myac.createMediaStreamDestination();
    localdcomp.connect(dests);
    // set up play....
    thema.srcObject = dests.stream;
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
                        var pot = {n:pots.length,pan:0.0,id:"me"};
                        pots.push(pot);
                        var me =  document.createElement("video");
                        me.muted = true;
                        me.setAttribute("autoplay", "true");
                        me.setAttribute("playsinline","true");
                        me.setAttribute("class","d-block w-100");
                        me.setAttribute("id","me");
                        me.srcObject = stream;
                        wrapVideo(me);
                        var pc = me.parentElement.getAttribute("class");
                        me.parentElement.setAttribute("class",pc+" active");

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
function slideTo(n){
    console.log("sliding to "+n);
    $('#mcu').carousel(n);
}
wrapVideo = (video) =>{
    var parent =document.getElementById("videoHolder");
    var div = document.createElement("div");
    div.setAttribute("class", "carousel-item");
    video.setAttribute("class", "d-block w-100");
    div.appendChild(video);
    parent.appendChild(div);
}


