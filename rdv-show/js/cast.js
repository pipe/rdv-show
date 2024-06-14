
var whipSettings;
var streaming = false;
var whip = {empty:""};

function populateSettings(){
    whipSettings = (localStorage.whipSettings) ?JSON.parse(localStorage.whipSettings):{empty:""};
    if (!whipSettings[mid]) {
        whipSettings[mid] = {
            whipURL: "https://director.millicast.com/api/whip/" + mid.substring(48),
            bitrate: "10",
            token: "560a2a906486406be858c0a169d92249dd419933e37283581cda0886126d2dd5",
            viewURL: "https://viewer.millicast.com?streamId=Mrn8aU/"+mid.substring(48)
        };
    }// populate dialog here.
    document.getElementById("whipURL").value = whipSettings[mid].whipURL;
    document.getElementById("whipToken").value = whipSettings[mid].token;
    var br =  whipSettings[mid].bitrate;
    document.getElementById("whipBitrate").childNodes.forEach( (c,n,p) => {
        var s = c.textContent === br;
        c.selected = s;
    })
    document.getElementById("viewURL").value = whipSettings[mid].viewURL;
}
async function setOutboundTracks(bitratebps) {
    // audio
    // outbound
    // for now just add the localpanned stream

    whip.dcomp = myac.createDynamicsCompressor();
    if (localpanned) {
        localpanned.connect(whip.dcomp);
        console.log("connect local stream to dcomp");
    }

    whip.peerout = myac.createMediaStreamDestination();
    whip.dcomp.connect(whip.peerout);
    var pstream = whip.peerout.stream;

    pstream.getTracks().forEach(track => {
        var t = whip.pc.addTransceiver(track, {
            'direction': 'sendonly'
        });
        console.log("added panned outbound track ", track.id, track.kind, track.label);
    });

    Object.entries(sessions).forEach(sessionkva => {
        var session = sessionkva[1];
        if (whip.dcomp && session.panned) {
            session.panned.connect(whip.dcomp); // I hear them
        }
    });

    // and video
    if (mcu) {
        for (const track of mcu.getTracks()) {
            if (track.kind === 'video') {
                var t = whip.pc.addTransceiver(track, {
                    'direction': 'sendonly'
                });
                //setCodecOrder(t);
                const paras = t.sender.getParameters();
                console.log("initial video encoder params");
                console.log(paras);
                if ((paras) && (paras.encodings)) {
                    paras.encodings[0].maxBitrate = bitratebps;
                    paras.degradationPreference = "maintain-framerate";
                    await t.sender.setParameters(paras);
                    console.log(paras);
                }
                console.log("added mcu outbound track to whip ", track.id, track.kind, track.label);
            } else {
                console.log("Non muc track not added to whip?!?" + track.kind)
            }
        };
    }
};
async function castMe() {
    import("./whip.js").then((module) => {
        // Do something with the module.
        if (!whip.client) {
            whip.client = new module.WHIPClient();
        }

    if (!whipSettings || !whipSettings[mid]) {
        populateSettings();
        $("#whipDialog").modal('show');
    } else {
        var bitratebps = 1000000 * parseInt(whipSettings[mid].bitrate);
        var whipURL = whipSettings[mid].whipURL;
        var viewURL = whipSettings[mid].viewURL;
        var whiptoken = whipSettings[mid].token;
        var castb = document.getElementById("cast");
        if (!streaming) {
            console.log("starting publish stream ");
            //Create peerconnection
            const config = {bundlePolicy: "max-bundle", iceServers: properties.configuration.iceServers};
            whip.pc = new RTCPeerConnection(config);

            //Send all tracks
            setOutboundTracks(bitratebps);

            //Create whip client
            //Start publishing
            whip.client.publish(whip.pc, whipURL, whiptoken)
                .then(() => {
                    streaming = true;
                    console.log("Broadcast has begun.");
                    castb.innerText = "Stop Casting";
                    $("#openCast").show();
                    $("#openCast").click(  function () {
                        window.open(viewURL, "whipcast")
                    });
                })
                .catch((e) => {
                    console.error("Failed to begin broadcast: ", e);
                });
        } else {
            console.log("stop publishing stream ");
            whip.client.stop();
            whip.client = null;
            $("#openCast").hide();
            streaming = false;
            castb.innerText = "Restart Casting";
        }
    }
    });
}