// buildUI.js
// this constructs the UI in jQuery

var make_base_auth = function (username, password) {
  var tok = username + ':' + password;
  var hash = btoa(tok);
  return "Basic " + hash;
};

var tidepoolHosts = {
    local: { host: "http://localhost:8009", jellyfish: "http://localhost:9122" },
    devel: { host: "https://devel-api.tidepool.io", jellyfish: "https://devel-uploads.tidepool.io" },
    staging: { host: "https://staging-api.tidepool.io", jellyfish: "https://staging-uploads.tidepool.io" },
    prod: { host: "https://api.tidepool.io", jellyfish: "https://uploads.tidepool.io" }
};

var tidepoolServerData = {
    host: '',
    jellyfish: '',
    usertoken: '',
    userdata: null,
    isLoggedIn: false,
};

var storageDeviceInfo = {};

var tidepoolServer = {
    get: function(url, happycb, sadcb) {
        var jqxhr = $.ajax({
            type: 'GET',
            url: url,
            headers: { 'x-tidepool-session-token': tidepoolServerData.usertoken }
        }).success(function(data, status, jqxhr) {
            var tok = jqxhr.getResponseHeader('x-tidepool-session-token');
            if (tok && tok != tidepoolServerData.usertoken) {
                tidepoolServerData.usertoken = tok;
            }
            happycb(data, status, jqxhr);
        }).error(function(jqxhr, status, err) {
            sadcb(jqxhr, status, err);
        });
    },
    post: function(url, data, happycb, sadcb) {
        var jqxhr = $.ajax({
            type: 'POST',
            url: url,
            contentType: 'application/json',
            data: JSON.stringify(data),
            headers: { 'x-tidepool-session-token': tidepoolServerData.usertoken }
        }).success(function(data, status, jqxhr) {
            var tok = jqxhr.getResponseHeader('x-tidepool-session-token');
            if (tok && tok != tidepoolServerData.usertoken) {
                tidepoolServerData.usertoken = tok;
            }
            happycb(data, status, jqxhr);
        }).error(function(jqxhr, status, err) {
            sadcb(jqxhr, status, err);
        });
    },
    login: function(username, password, happycb, sadcb) {
        var url = tidepoolServerData.host + "/auth/login";
        jqxhr = $.ajax({
            type: 'POST',
            url: url,
            headers: { "Authorization": make_base_auth(username, password) }, 
        }).success(function(data, status, jqxhr) {
            tidepoolServerData.usertoken = jqxhr.getResponseHeader('x-tidepool-session-token');
            tidepoolServerData.userdata = data;
            happycb(data, status, jqxhr);
        }).error(function(jqxhr, status, err) {
            sadcb(jqxhr, status, err);
        });
    },
    getProfile: function(happycb, sadcb) {
        var url = tidepoolServerData.host + "/metadata/" + tidepoolServerData.userdata.userid + "/profile";
        this.get(url, happycb, sadcb);
    },
    postToJellyfish: function(data, happycb, sadcb) {
        var url = tidepoolServerData.jellyfish + "/data";
        this.post(url, data, happycb, sadcb);
    }
};

var serialDevice = {
    connected: false,
    connection: null,
    port: null,
    buffer: [],
    portprefix: "/dev/cu.usb",
    setup: function(portprefix) {
        if (portprefix) {
            serialDevice.portprefix = portprefix;
        }
    },
    connect: function(connectedCB) {
        chrome.serial.getDevices(function(ports) {
            var connected = function(conn) {
                serialDevice.connection = conn;
                serialDevice.connected = true;
                console.log("connected to " + serialDevice.port.path);
                connectedCB();
            };
            for (var i=0; i<ports.length; i++) {
                console.log(ports[i].path);
                if (ports[i].path.slice(0, serialDevice.portprefix.length) == serialDevice.portprefix) {
                    serialDevice.port = ports[i];
                    chrome.serial.connect(serialDevice.port.path, { bitrate: 9600 }, connected);
                }
            }
        });

        chrome.serial.onReceive.addListener(function(info) {
            if (serialDevice.connected && info.connectionId == serialDevice.connection.connectionId && info.data) {
                var bufView=new Uint8Array(info.data);
                for (var i=0; i<bufView.byteLength; i++) {
                    serialDevice.buffer.push(bufView[i]);
                }
            }
        });
    },
    discardBytes: function(discardCount) {
        serialDevice.buffer = serialDevice.buffer.slice(discardCount);
    },
    readSerial: function(bytes, timeout, callback) {
        var packet;
        if (serialDevice.buffer.length >= bytes) {
            packet = serialDevice.buffer.slice(0,bytes);
            serialDevice.buffer = serialDevice.buffer.slice(0 - bytes);
            callback(packet);
        } else if (timeout === 0) {
            packet = serialDevice.buffer;
            serialDevice.buffer = [];
            callback(packet);
        } else {
            setTimeout(function() {
                serialDevice.readSerial(bytes, 0, callback);
            }, timeout);
        }
    },
    writeSerial: function(bytes, callback) {
        var l = new Uint8Array(bytes).length;
        var sendcheck = function(info) {
            console.log("Sent %d bytes", info.bytesSent);
            if (l != info.bytesSent) {
                console.log("Only " + info.bytesSent + " bytes sent out of " + l);
            }
            else if (info.error) {
                console.log("Serial send returned " + info.error);
            }
            callback(info);
        };
        chrome.serial.send(serialDevice.connection.connectionId, bytes, sendcheck);
    }
};

function statusManager(config) {
    var progress = function(msg, pctg) {
        console.log("Progress: %s -- %d", msg, pctg);
    };

    var cfg = config;
    if (config.progress) {
        progress = config.progress;
    }
    var statuses = config.steps;

    var setStatus = function(stage, pct) {
        var msg = statuses[stage].name;
        var range = statuses[stage].max - statuses[stage].min;
        var displayPctg = statuses[stage].min + Math.floor(range * pct / 100.0);
        progress(msg, displayPctg);
    };

    return {
        bind: function(stage) {
            return setStatus.bind(this, stage);
        }
    };
}

/* Here's what we want to do:
    call init() on every driver
    do forever:
        call detect() on every driver in a loop or when notified by an insertion
        when a device is detected:
            setup
            connect
            getConfigInfo
            fetchData
            processData
            uploadData
            disconnect
            cleanup
*/

function driverManager(driverObjects, config) {
    var cfg = config;
    var drivers = {};
    var required = [
            "detect",
            "setup",
            "connect",
            "getConfigInfo",
            "fetchData",
            "processData",
            "uploadData",
            "disconnect",
            "cleanup",
        ];

    for (var d in driverObjects) {
        drivers[d] = driverObjects[d](config[d]);
        for (var i=0; i<required.length; ++i) {
            if (typeof(drivers[d][required[i]]) != "function") {
                console.log("!!!! Driver %s must implement %s", d, required[i]);
            }
        }
    }

    var stat = statusManager({progress: null, steps: [
        { name: "setting up", min: 0, max: 5 },
        { name: "connecting", min: 5, max: 10 },
        { name: "getting configuration data", min: 10, max: 15 },
        { name: "fetching data", min: 15, max: 40 },
        { name: "processing data", min: 40, max: 50 },
        { name: "uploading data", min: 50, max: 90 },
        { name: "disconnecting", min: 90, max: 95 },
        { name: "cleaning up", min: 95, max: 100 }
    ]});

    return {
        // iterates the driver list and calls detect; first one to return
        // true gets returned from detect
        detect: function () {
            for (var d in drivers) {
                if (drivers[d].detect()) {
                    return d;
                }
            }
        },

        process: function (driver, cb) {
            drvr = drivers[driver];
            async.series([
                    drvr.setup.bind(drvr, stat.bind(0)),
                    drvr.connect.bind(drvr, stat.bind(1)),
                    drvr.getConfigInfo.bind(drvr, stat.bind(2)),
                    drvr.fetchData.bind(drvr, stat.bind(3)),
                    drvr.processData.bind(drvr, stat.bind(4)),
                    drvr.uploadData.bind(drvr, stat.bind(5)),
                    drvr.disconnect.bind(drvr, stat.bind(6)),
                    drvr.cleanup.bind(drvr, stat.bind(7))
                ], cb);
        }
    };
}

function constructUI() {
    //$('body').append('This is a test.');

    var loggedIn = function (isLoggedIn) {
        if (isLoggedIn) {
            $(".showWhenNotLoggedIn").fadeOut(400, function() {
                $(".showWhenLoggedIn").fadeIn();
            });
        } else {
            $(".showWhenLoggedIn").fadeOut(400, function() {
                $(".showWhenNotLoggedIn").fadeIn();
            });
        }
    };

    loggedIn(false);

    var connected = function (isConnected) {
        if (isConnected) {
            $(".showWhenNotConnected").fadeOut(400, function() {
                $(".showWhenConnected").fadeIn();
            });
        } else {
            $(".showWhenConnected").fadeOut(400, function() {
                $(".showWhenNotConnected").fadeIn();
            });
        }
    };

    connected(true);

    // displays text on the connect log
    var connectLog = function(s) {
        if (s[s.length-1] !== '\n') {
            s += '\n';
        }
        var all = $("#connectionLog").val();
        $("#connectionLog").val(all + s);
    };

    $("#loginButton").click(function() {
        var username = $('#username').val();
        var password = $('#password').val();
        var serverIndex = $('#serverURL').val();
        console.log(username, password, serverIndex);
        tidepoolServerData.host = tidepoolHosts[serverIndex].host;
        tidepoolServerData.jellyfish = tidepoolHosts[serverIndex].jellyfish;

        var goodLogin = function(data, status, jqxhr) {
            console.log(data);
            connectLog(status);
            getProfile();
            loggedIn(true);
        };

        var failLogin = function(jqxhr, status, error) {
            connectLog("Login FAILED!", status, error);
            loggedIn(false);
        };

        var goodProfile = function(data, status, jqxhr) {
            connectLog(status);
            connectLog(data.toString());
            $(".loginname").text(data.fullName);
        };

        var failProfile = function(jqxhr, status, error) {
            connectLog("FAILED!", status, error);
        };

        var getProfile = function() {
            connectLog("Fetching profile.");
            tidepoolServer.getProfile(goodProfile, failProfile);
        };

        tidepoolServer.login(username, password, goodLogin, failLogin);
    });

    $("#logoutButton").click(function() {
        loggedIn(false);
    });

    var processOneDevice = function(devname, deviceArray) {
        for (var d=0; d<deviceArray.length; ++d) {
            dev = deviceArray[d];
            connectLog(devname);
            connectLog(dev.device);
            connectLog(dev.vendorId);
            connectLog(dev.productId);
        }
    };

    var getUSBDevices = function() {
        manifest = chrome.runtime.getManifest();
        for (var p = 0; p < manifest.permissions.length; ++p) {
            var perm = manifest.permissions[p];
            if (perm.usbDevices) {
                for (d = 0; d < perm.usbDevices.length; ++d) {
                    console.log(perm.usbDevices[d]);
                    var f = processOneDevice.bind(this, perm.usbDevices[d].deviceName);
                    chrome.usb.getDevices({
                        vendorId: perm.usbDevices[d].vendorId,
                        productId: perm.usbDevices[d].productId
                    }, f);
                }
            }
        }
    };

    chrome.system.storage.onAttached.addListener(function (info){
        connectLog("attached: " + info.name);
        storageDeviceInfo[info.id] = {
            id: info.id,
            name: info.name,
            type: info.type
        };
        console.log(storageDeviceInfo[info.id]);
    });

    chrome.system.storage.onDetached.addListener(function (id){
        connectLog("detached: " + storageDeviceInfo[id].name);
        delete(storageDeviceInfo[id]);
    });

    var openFile = function() {
        console.log("OpenFile");
        chrome.fileSystem.chooseEntry({type: 'openFile'}, function(readOnlyEntry) {
            console.log(readOnlyEntry);
            readOnlyEntry.file(function(file) {
                console.log(file);
                var reader = new FileReader();

                reader.onerror = function() {
                    connectLog("Error reading file!");
                };
                reader.onloadend = function(e) {
                    // e.target.result contains the contents of the file
                    // console.log(e.target.result);
                    console.log(e.target.result);
                };

                reader.readAsText(file);
            });
        });
    };

    // $("#testButton").click(findAsante);
    // $("#testButton1").click(getUSBDevices);
    var deviceComms = serialDevice;
    var asanteDevice = asanteDriver({deviceComms: deviceComms});

    deviceComms.connect(function() {connectLog("connected");});
    var testSerial = function() {
        var buf = new ArrayBuffer(1);
        var bytes = new Uint8Array(buf);
        bytes[0] = 97;
        deviceComms.writeSerial(buf, function() {connectLog("'a' sent");});
    };

    var getSerial = function(timeout) {
        deviceComms.readSerial(200, timeout, function(packet) {
            connectLog("received " + packet.length + " bytes");
            var s = "";
            for (var c in packet) {
                s += String.fromCharCode(packet[c]);
            }
            connectLog(s);
        });
    };

    var watchSerial = function() {
        setTimeout(function () {
            getSerial(0);
            setTimeout(watchSerial, 1000);
        }, 1000);
    };

    var deviceInfo = null;
    var counter=0;
    var prevTimestamp = null;
    var postJellyfish = function (egvpage, callback) {
        console.log("poster");
        console.log(deviceInfo);
        var datapt = {
          "type": "cbg",
          "units": "mg/dL",
          "value": 0,
          "time": "",
          "deviceTime": "",
          "deviceId": deviceInfo.ProductName + "/12345",
          "source": "device"
        };

        var localtime = function(t) {
            var s = t.toISOString();
            return s.substring(0, s.length - 1);
        };
        var data = [];
        var recCount = 0;
        for (var i = egvpage.header.nrecs - 1; i>=0; --i) {
            datapt.value = egvpage.data[i].glucose;
            datapt.time = egvpage.data[i].displayTime.toISOString();
            datapt.deviceTime = localtime(egvpage.data[i].displayTime);
            if (datapt.value < 15) {    // it's a "special" (error) value
                console.log("Skipping datapoint with special bg.");
                console.log(datapt);
                continue;
            }
	    if (prevTimestamp == null || datapt.time !== prevTimestamp) {
              data.push($.extend({}, datapt));
              prevTimestamp = datapt.time;
            }
            recCount++;
        }
        console.log(data);
        var happy = function(resp, status, jqxhr) {
            console.log("Jellyfish post succeeded.");
            console.log(status);
            console.log(resp);
            callback(null, recCount);
        };
        var sad = function(jqxhr, status, err) {
            if (jqxhr.responseJSON.errorCode && jqxhr.responseJSON.errorCode == "duplicate") {
                callback("STOP", jqxhr.responseJSON.index);
            } else {
                console.log("Jellyfish post failed.");
                console.log(status);
                console.log(err);
                callback(err, 0);
            }
        };
        tidepoolServer.postToJellyfish(data, happy, sad);
    };

    var testPack = function() {
        buf = new Uint8Array(30);
        len = util.pack(buf, 0, "IIbsIb", 254, 65534, 55, 1023, 256, 7);
        console.log(buf);
        result = util.unpack(buf, 0, "IIbsIb", ['a', 'b', 'c', 'd', 'e', 'f']);
        console.log(result);
        buf[0] = 0xff;
        buf[1] = 0xff;
        buf[2] = 0xff;
        buf[3] = 0xff;
        result = util.unpack(buf, 0, "I", ['x']);
        console.log(result);
    };

    // $("#testButton").click(testSerial);

    var testJellyfish = function() {
        var datapt = {
          "type": "cbg",
          "units": "mg/dL",
          "value": 0,
          "time": "",
          "deviceTime": "",
          "deviceId": "KentTest123",
          "source": "device"
        };

        var data = [];
        var starttime = new Date(2014, 1, 23, 6);
        var increment = 10 * 60 * 1000;  // 10 minutes
        var duration = 30 * 60 * 60 * 1000; // 30 hours
        var EDT_offset = -4 * 60 * 60 * 1000; // 4 hours
        var startbg = 150;
        for (var dt = 0; dt < duration; dt += increment) {
            datapt.value = (startbg + 105 * Math.sin(dt/(10 * increment)));
            var t = starttime.valueOf() + dt;
            datapt.time = new Date(t).toISOString();
            var devtime = new Date(t + EDT_offset).toISOString();
            datapt.deviceTime = devtime.substring(0, devtime.length-1);
            data.push($.extend({}, datapt));
        }
        console.log(data);
        postJellyfish(data);
    };

    var test1 = function() {
        var get = function(url, happycb, sadcb) {
            var jqxhr = $.ajax({
                type: 'GET',
                url: url
            }).success(function(data, status, jqxhr) {
                // happycb(data, status, jqxhr);
                console.log("success!");
                console.log(data);
            }).error(function(jqxhr, status, err) {
                // sadcb(jqxhr, status, err);
                console.log("FAIL");
            });
        };

        var url = "http://localhost:8888/foo.txt";
        get(url);
    };

    var search = function(cb) {
        var driverObjects = {
            // "AsanteSNAP": asanteDriver,
            // "InsuletOmniPod": insuletDriver,
            "Test": testDriver
        };

        var dm = driverManager(driverObjects, {});
        var drv = dm.detect();
        if (drv) {
            dm.process(drv, function(err, results){
                if (err) {
                    console.log("Fail");
                    console.log(err);
                } else {
                    console.log("Success!");
                }
                if (cb) {
                    cb(err, results);
                }
            });
        }

    };

    var searchOnce = function() {
        search();
    };

    var searching = null;
    var processing = false;
    var searchRepeatedly = function() {
        searching = setInterval(function () {
            if (processing) {
                console.log("skipping");
                return;
            }
            processing = true;
            search(function(err, results){
                processing = false;
            });
        }, 5000);
    };

    var cancelSearch = function() {
        if (searching) {
            clearInterval(searching);
            searching = null;
        }
    };

    $("#testButton1").click(searchOnce);
    $("#testButton2").click(searchRepeatedly);
    $("#testButton3").click(cancelSearch);

}

$(constructUI);



