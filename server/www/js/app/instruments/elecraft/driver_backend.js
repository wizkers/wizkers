/*
 * Browser-side Parser for Elecraft radios.
 *
 * This parser implements elecraft serial commands for:
 *    - KXPA100
 *    - KX3
 *
 * The Browser-side parser is used when running as a Chrome or Cordova app.
 *
 * Differences with server-side parser:
 *
 *   - 'socket' uses "trigger" to emit events, not "emit"
 * 
 *  (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
 */

define(function(require) {
    "use strict";

    var Serialport = require('serialport'),
        Rigctld = require('app/instruments/elecraft/tcp_server');
    
    var parser = function(socket) {
        
        var socket = socket;
        var serialport = null;
        var livePoller = null; // Reference to the live streaming poller
        var streaming = false;
        
        var rigserver = null;
        
        // A few driver variables: we keep track of a few things
        // here for our bare-bones rigctld implementation.
        //
        // Note: we do not poll for those values ourselves, we
        // count on the UI to do this - to be reviewed later if
        // necessary...
        var vfoa_frequency = 0;
        var vfob_frequency = 0;
        var vfoa_bandwidth = 0;
        
        // Standard Driver API below

        this.isStreaming = function() {
            return streaming;
        }
        
        this.portSettings = function() {
            return  {
                baudRate: 38400,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                dtr: false,
                flowControl: false,
                // We get non-printable characters on some outputs, so
                // we have to make sure we use "binary" encoding below,
                // otherwise the parser will assume Unicode and mess up the
                // values.
                parser: Serialport.parsers.readline(';','binary'),
            }
        };

        // Called when the app needs a unique identifier.
        // this is a standardized call across all drivers.
        //
        // Returns the Radio serial number.
        this.sendUniqueID = function() {
            this.uidrequested = true;
            try {
                socket.emit('controllerCommand', "MN026;ds;MN255;");
            } catch (err) {
                console.log("Error on serial port while requesting Elecraft UID : " + err);
            }
        };
        
        // period in seconds
        this.startLiveStream = function(period) {
            var self = this;
            if (!streaming) {
                console.log("[Elecraft] Starting live data stream");
                // The radio can do live streaming to an extent, so we definitely will
                // take advantage:
                // K31 enables extended values such as proper BPF reporting
                // AI2 does not send an initial report, so we ask for the initial data
                // before...
                socket.emit('controllerCommand','K31;IF;FA;FB;RG;FW;MG;IS;BN;MD;AI2;');
                livePoller = setInterval(queryRadio, (period) ? period*1000: 1000);
                streaming = true;
            }
        };
        
        this.stopLiveStream = function(args) {
            if (streaming) {
                console.log("[Elecraft] Stopping live data stream");
                // Stop live streaming from the radio:
                socket.emit('controllerCommand','AI0;');
                clearInterval(livePoller);
                streaming = false;
            }
        };
        
        function queryRadio() {
            // TODO: follow radio state over here, so that we only query power
            // when the radio transmits, makes much more sense

            // This is queried every second - we stage our queries in order
            // to avoid overloading the radio, not sure that is totally necessary, but
            // it won't hurt

            // Query displays and band (does not update by itself)
            socket.emit('controllerCommand','DB;DS;BN;'); // Query VFO B and VFOA Display

            // Then ask the radio for current figures:
            socket.emit('controllerCommand','PO;'); // Query actual power output

            // And if we have an amp, then we can get a lot more data:
            socket.emit('controllerCommand','^PI;^PF;^PV;^TM;');
            socket.emit('controllerCommand','^PC;^SV;'); // Query voltage & current
        };
        
        // Format can act on incoming data from the radio, and then
        // forwards the data to the app through a 'serialEvent' event.
        this.format = function(data, recording) {

            if (this.uidrequested && data.substr(0,5) == "DS@@@") {
                // We have a Unique ID
                console.log("Sending uniqueID message");
                socket.trigger('uniqueID','' + data.substr(5,5));
                this.uidrequested = false;
                return;
            }
            var cmd = data.substr(0,2);
            switch(cmd) {
                    case "FA":
                        vfoa_frequency = parseInt(data.substr(2));
                        break;
                    case "BW":
                        vfoa_bandwidth = parseInt(data.substr(2));
                        break;
            }

            socket.trigger('serialEvent',data);
            
        };
    
        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function(data) {
            return data;
        };
        
        // Status returns an object that is concatenated with the
        // global server status
        this.status = function() {
            return { tcpserverconnect: false };
        };
    
        // Spins up a Rigctl emulation server once the radio is connected
        this.onOpen =  function(port) {
            console.log("Elecraft Driver: got a port open signal");
            serialport = port;
            if (rigserver) {
                rigserver.disconnect();
            }
            rigserver = new Rigctld.server();
            rigserver.listen(onAcceptCallback);
        };
    
        var onAcceptCallback = function (tcpConnection, socketInfo) {
            var info="["+socketInfo.peerAddress+":"+socketInfo.peerPort+"] Connection accepted!";
            if (socket)
                socket.trigger('status',{ tcpserverconnect: true });                

            console.log(info);
            // We are going to use a small line parser
            var parserCreator = function (callback) {
                var delimiter = "\n";
                var encoding  = "utf8";
                // Delimiter buffer saved in closure
                var data = "";
                return function (buffer) {
                    // Collect data
                    data += buffer;
                    // Split collected data by delimiter
                    var parts = data.split(delimiter);
                    data = parts.pop();
                    parts.forEach(function (part, i, array) {
                        callback(part,tcpConnection);
                    });
                };
            };
            var parser = parserCreator(rigctl_command).bind(this);
          
            tcpConnection.addDataReceivedListener(function(data) {
                parser(data);
            });          
        };
        
        // Not used
        this.onClose = function(success) {
            console.log("Elecraft driver: got a port close signal");
            if (rigserver) {
                rigserver.disconnect();
                if (socket)
                    socket.trigger('status',{ tcpserverconnect: true });                
            }
        };

        // RIGCTLD Emulation - super light, but does the trick for fldigi...
        var rigctl_command = function(data,c) {
            // console.log("[rigctl_command] " + data);
            var cmd = data.substr(0,2);
            switch (cmd) {
                    case "\\d": // "mp_state":
                        // No f**king idea what this means, but it makes hamlib happy.
                        c.sendMessage(hamlib_init);
                        break;                
                    case "f":
                        c.sendMessage(vfoa_frequency + "\n");
                        break;
                    case "F ": // Set Frequency (VFOA):  F 14069582.000000
                        var freq = ("00000000000" + parseFloat(data.substr(2)).toString()).slice(-11); // Nifty, eh ?

                        console.log("Rigctld emulation: set frequency to " + freq);
                        if (serialport != null)
                            serialport.emit('controllerCommand', "FA" + freq + ";");
                        c.sendMessage("RPRT 0\n");
                        break;
                    case "m":
                         c.sendMessage("PKTUSB\n");
                         c.sendMessage(vfoa_bandwidth + "\n");
                        break;
                    case "q":
                        // TODO: we should close the socket here ?
                        console.log("Rigctld emulation: quit");
                        c.disconnect();
                        break;
                    case "v": // Which VFO ?
                        c.sendMessage("VFOA\n");
                        break;
                    case "T ":
                        if (data.substr(2) == "1") {
                            if (serialport != null)
                                serialport.emit('controllerCommand', 'TX;');
                            // The radio does not echo this command, so we do it
                            // ourselves, so that the UI reacts
                            if (socket != null)
                                socket.trigger('serialEvent','TX;');

                        } else {
                            if (serialport != null)
                                serialport.emit('controllerCommand', "RX;");
                            if (socket != null)
                                socket.trigger('serialEvent','RX;');
                        }
                        c.sendMessage("RPRT 0\n");
                        break;
                    default:
                        console.log("Unknown command: " + data);

            }

        };
    
    var hamlib_init = "0\n\
229\n\
2\n\
500000.000000 30000000.000000 0xdbf -1 -1 0x3 0x3\n\
48000000.000000 54000000.000000 0xdbf -1 -1 0x3 0x3\n\
0 0 0 0 0 0 0\n\
1800000.000000 2000000.000000 0xdbf 10 10000 0x3 0x3\n\
3500000.000000 4000000.000000 0xdbf 10 10000 0x3 0x3\n\
7000000.000000 7300000.000000 0xdbf 10 10000 0x3 0x3\n\
10100000.000000 10150000.000000 0xdbf 10 10000 0x3 0x3\n\
14000000.000000 14350000.000000 0xdbf 10 10000 0x3 0x3\n\
18068000.000000 18168000.000000 0xdbf 10 10000 0x3 0x3\n\
21000000.000000 21450000.000000 0xdbf 10 10000 0x3 0x3\n\
24890000.000000 24990000.000000 0xdbf 10 10000 0x3 0x3\n\
28000000.000000 29700000.000000 0xdbf 10 10000 0x3 0x3\n\
50000000.000000 54000000.000000 0xdbf 10 10000 0x3 0x3\n\
0 0 0 0 0 0 0\n\
0xdbf 1\n\
0 0\n\
0xc 2700\n\
0xc 2800\n\
0xc 1800\n\
0xc 0\n\
0x82 1000\n\
0x82 2800\n\
0x82 50\n\
0x82 0\n\
0x110 2000\n\
0x110 2700\n\
0x110 500\n\
0x110 0\n\
0xc00 2700\n\
0xc00 2800\n\
0xc00 50\n\
0xc00 0\n\
0x1 6000\n\
0x1 13000\n\
0x1 2700\n\
0x1 0\n\
0x20 13000\n\
0 0\n\
9990\n\
9990\n\
0\n\
0\n\
14 \n\
10 \n\
0x81010002\n\
0x81010002\n\
0x4402703b\n\
0x2703b\n\
0x0\n\
0x0\n";

    
    
    }
    
    return parser;
});