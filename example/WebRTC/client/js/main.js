/*
 * @Author: gongluck 
 * @Date: 2021-11-25 10:03:48 
 * @Last Modified by: gongluck
 * @Last Modified time: 2021-11-25 10:06:47
 */
/*
 * @Author: gongluck 
 * @Date: 2021-11-25 10:03:37 
 * @Last Modified by:   gongluck 
 * @Last Modified time: 2021-11-25 10:03:37 
 */
/*
 * @Author: gongluck 
 * @Date: 2021-11-24 16:52:12 
 * @Last Modified by: gongluck
 * @Last Modified time: 2021-11-24 18:10:06
 */
// 信令
const SIGNAL_TYPE_JOIN = "join";
const SIGNAL_TYPE_RESP_JOIN = "resp-join";
const SIGNAL_TYPE_NEW_PEER = "new-peer";
const SIGNAL_TYPE_LEAVE = "leave";
const SIGNAL_TYPE_RESP_LEAVE = "resp-leave";
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave";
const SIGNAL_TYPE_OFFER = "offer";
const SIGNAL_TYPE_ANSWER = "answer";
const SIGNAL_TYPE_CANDIDATE = "candidate";

var RoomID = "";
var LocalID = Math.random().toString(16).substr(2);
var RemoteID = "";

//控件
var localVideo = document.querySelector("#localVideo");
var remoteVideo = document.querySelector("#remoteVideo");

//新建一个websocket
//var websocket = new WebSocket("ws://122.9.72.254:10384");
var websocket = new WebSocket("ws://127.0.0.1:8001");

// 创建RTC连接
var iceip = "127.0.0.1";
var config = {
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    iceTransportPolicy: "relay",//relay all
    iceServers: [
        {
            "urls": ["turn:" + iceip + ":3478"],
            "username": "gongluck",
            "credential": "123456",
        },
        {
            "urls": ["stun:" + iceip + ":3478"],
        }
    ]
};

var peerconn = null;

function doCreatePeerconnection() {
    //peerconn = new RTCPeerConnection(config);
    peerconn = new RTCPeerConnection();
    // 获取到打洞信息(candidate)
    peerconn.onicecandidate = function (event) {
        if (event.candidate) {
            console.info("got candidate: " + JSON.stringify(event.candidate));
            var before = event.candidate.candidate.split(" ");
            var mycandidate = event.candidate;
            var arr = [];
            for (var i = 0; i < before.length; i++) {
                // if (i == 4) {
                //     arr.push("555.555.555.555");//特殊IP
                // }
                // else {
                    arr.push(before[i]);
                //}
                mycandidate.candidate = arr.join(" ");
            }
            var jsonMsg = {
                cmd: SIGNAL_TYPE_CANDIDATE,
                roomid: RoomID,
                uid: LocalID,
                remoteid: RemoteID,
                //sdp: JSON.stringify(event.candidate),
                sdp: JSON.stringify(mycandidate),
            };
            console.info("use candidate: " + JSON.stringify(jsonMsg.sdp));
            var message = JSON.stringify(jsonMsg);
            websocket.send(message);
        } else {
            console.info("end of icecandidate");
        }
    };
    // 获取到对方码流的对象句柄
    peerconn.ontrack = function (event) {
        remoteVideo.srcObject = event.streams[0];
    };
    peerconn.onconnectionstatechange = function (event) {
        console.info("connection state : " + peerconn.connectionState);
        switch (peerconn.connectionState) {
            case "disconnected":
            case "failed":
            case "closed":
                {
                    peerconn.removeStream(localVideo.srcObject);
                    peerconn.removeStream(remoteVideo.srcObject);
                    remoteVideo.srcObject = null;
                }
                break;
        }
    };
    peerconn.oniceconnectionstatechange = function (event) {
        console.info("ice connection state : " + peerconn.connectionState);
    };
}

//打开websocket连接
websocket.onopen = function (ev) {
    console.info("websocket open");
};
//关闭连接
websocket.onclose = function (ev) {
    console.info("websocket close, code : " + ev.code + ", data : " + ev.data);
};
//接收服务器返回的数据
websocket.onmessage = function (ev) {
    console.info("websocket message : " + ev.data);

    jsonMsg = JSON.parse(ev.data);
    var roomid = jsonMsg.roomid;
    var uid = jsonMsg.uid;
    var remoteuid = jsonMsg.remoteuid;
    var sdp = jsonMsg.sdp;

    switch (jsonMsg.cmd) {
        case SIGNAL_TYPE_RESP_JOIN://加入房间结果
            {
                if (roomid == RoomID && uid == LocalID) {
                    RemoteID = remoteuid;
                }
            }
            break;
        case SIGNAL_TYPE_NEW_PEER://新节点进入房间
            {
                if (roomid == RoomID && uid == LocalID) {
                    RemoteID = remoteuid;

                    if(peerconn == null){
                        doCreatePeerconnection();
                    }

                    // 将本地流加入到RTC连接
                    // localVideo.srcObject.getTracks().forEach(function (track) {
                    //     peerconn.addTrack(track, localVideo.srcObject);
                    // }
                    // );
                    peerconn.addStream(localVideo.srcObject);

                    // 发送RTC的offer
                    peerconn.createOffer()
                        .then(function (localsdp) {
                            console.info("got sdp: " + JSON.stringify(localsdp));
                            // 设置本地SDP
                            peerconn.setLocalDescription(localsdp)
                                .then(function () {
                                    var jsonMsg = {
                                        cmd: SIGNAL_TYPE_OFFER,
                                        roomid: RoomID,
                                        uid: LocalID,
                                        remoteid: RemoteID,
                                        sdp: JSON.stringify(localsdp),
                                    };
                                    var message = JSON.stringify(jsonMsg);
                                    websocket.send(message);
                                })
                                .catch(function (error) {
                                    console.error("offer setLocalDescription failed: " + error);
                                });
                        })
                        .catch(function (error) {
                            console.error("create offer failed: " + error);
                        });
                }
            }
            break;
        case SIGNAL_TYPE_OFFER:
            {
                if(peerconn == null){
                    doCreatePeerconnection();
                }

                // 将本地流加入到RTC连接
                // localVideo.srcObject.getTracks().forEach(function (track) {
                //     peerconn.addTrack(track, localVideo.srcObject);
                // }
                // );
                peerconn.addStream(localVideo.srcObject);

                var desc = JSON.parse(sdp);
                // 设置对端SDP
                peerconn.setRemoteDescription(desc);
                // 发送RTC的answer
                peerconn
                    .createAnswer()
                    .then(function (localsdp) {
                        peerconn
                            .setLocalDescription(localsdp)
                            .then(function () {
                                var jsonMsg = {
                                    cmd: SIGNAL_TYPE_ANSWER,
                                    roomid: RoomID,
                                    uid: LocalID,
                                    remoteid: RemoteID,
                                    sdp: JSON.stringify(localsdp),
                                };
                                var message = JSON.stringify(jsonMsg);
                                websocket.send(message);
                                console.info("send answer message: " + message);
                            })
                            .catch(function (error) {
                                console.error("answer setLocalDescription failed: " + error);
                            });
                    })
                    .catch(function (error) {
                        console.error("create answer failed: " + error);
                    });
            }
            break;
        case SIGNAL_TYPE_ANSWER:
            {
                var desc = JSON.parse(sdp);
                peerconn.setRemoteDescription(desc);
            }
            break;
        case SIGNAL_TYPE_CANDIDATE:
            {
                var candidate = JSON.parse(sdp);
                // 添加网络协商信息
                peerconn.addIceCandidate(candidate).catch(function (e) {
                    console.error("addIceCandidate failed:" + e);
                });
            }
            break;
        case SIGNAL_TYPE_RESP_LEAVE:
            {
                if (roomid == RoomID && uid == LocalID) {
                    // 将流移除出RTC连接
                    //peerconn.removeStream(localVideo.srcObject);
                    //peerconn.removeStream(remoteVideo.srcObject);
                    remoteVideo.srcObject = null;
                    //localVideo.srcObject = null;
                    peerconn.close();
                    peerconn = null;
                }
            }
            break;
        case SIGNAL_TYPE_PEER_LEAVE:
            {
                if (roomid == RoomID && uid == LocalID) {
                    // 将流移除出RTC连接
                    //peerconn.removeStream(localVideo.srcObject);
                    //peerconn.removeStream(remoteVideo.srcObject);
                    remoteVideo.srcObject = null;
                    //localVideo.srcObject = null;
                    peerconn.close();
                    peerconn = null;
                }
            }
            break;
    }
};
//错误
websocket.onerror = function (ev) {
    console.error("websocket error, code : " + ev.code + ", data : " + ev.data);
};

//加入按钮
document.getElementById("joinBtn")
    .onclick = function () {
        console.log("joinBtn onclick");

        RoomID = document.getElementById("roomId").value;
        if (RoomID == "" || RoomID == "请输入房间ID") {
            alert("请输入房间ID");
            return;
        }

        //先打开本地设备，等待P2P连接
        //navigator.mediaDevices.getUserMedia({
        //屏幕共享
        navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true
        })
            .then(function (stream) {
                localVideo.srcObject = stream;
                console.info("set stream");
                var jsonMsg = {
                    cmd: SIGNAL_TYPE_JOIN,
                    roomid: RoomID,
                    uid: LocalID,
                };
                var message = JSON.stringify(jsonMsg);
                websocket.send(message);
            })
            .catch(function (e) {
                alert("getUserMedia error : " + e);
            });
    }

//离开按钮
document.getElementById("leaveBtn")
    .onclick = function () {
        console.log("leaveBtn onclick");

        RoomID = document.getElementById("roomId").value;
        if (RoomID == "" || RoomID == "请输入房间ID") {
            alert("请输入房间ID");
            return;
        }

        var jsonMsg = {
            cmd: SIGNAL_TYPE_LEAVE,
            roomid: RoomID,
            uid: LocalID,
        };
        var message = JSON.stringify(jsonMsg);
        websocket.send(message);
    }