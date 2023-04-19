async function showDevices(div,as,vs,me){

    var cam  = vs.getVideoTracks()[0];
    var mic = as.getAudioTracks()[0];
    let q= '"';

    var toHtml = (mdi,target) => {
        return "<li did="+q+mdi.deviceId +q+" class="+q+"deviceChoice "+mdi.kind+(( target === mdi.label)?" inuse":"")+q+">"+ mdi.label+"</li>"
    }

    console.log("mic is  "+mic.label);
    console.log("cam is  "+cam.label);
    console.log("output is "+me.sinkId)

    await navigator.mediaDevices.enumerateDevices().then((mdis)=>{
        var ais =  "<ul> Audio In \n"+(mdis.filter((mdi) => mdi.kind == "audioinput").map((mdi) => {
            return toHtml(mdi,mic.label);
        }).join("\n"))+"\n</ul>";
        var vis =  "<ul> Video In \n"+(mdis.filter((mdi) => mdi.kind == "videoinput").map((mdi) => {
            return toHtml(mdi,cam.label);
        }).join("\n"))+"\n</ul>";
        var aos =  "<ul> Audio out \n"+(mdis.filter((mdi) => mdi.kind == "audiooutput").map((mdi) => {
            return "<li did="+q+mdi.deviceId +q+" class="+q+"deviceChoice "+mdi.kind+(( me.sinkId === mdi.deviceId)?" inuse":"")+q+">"+ mdi.label+"</li>"
        }).join("\n"))+"\n</ul>";
        console.log("Audio in \n"+ais)
        console.log("Video in \n"+vis)
        console.log("Audio out \n"+aos)
        if (div){
            div.innerHTML = ais + vis + aos
        }
    });
}

function startUX(){
    $("#role").text("Guest");
    $("#status").text("Waiting for connection");
    $("#them").hide();
    $("#accept").modal('show');
    remoteStream = new MediaStream();
}