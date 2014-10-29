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
        Rigctld = require('app/instruments/elecraft/tcp_server'),
        Bitmap = require('app/lib/bitmap');
                          
    
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
        var radio_mode = "RTTY";
        
        // Because Elecraft radios are not 100% consistent with their protocols,
        // we need to use a pure raw parser for data input, and most of the time,
        // forward that data to a readline parser. But sometimes, we will need the
        // raw input, for instance for Bitmap requests
        var second_parser =  Serialport.parsers.readline(';','binary');
        
        // Flag to indicate we are receiving a bitmap
        var waiting_for_bmp = false;
        var bitmap = new Uint8Array(131768);
        var bitmap_index = 0;
        var oldpercent = 0;
        
        // Private functions:
        function onDataReady(data) {
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
        }
        
        // Send the bitmap back to the front-end
        function sendBitmap() {
                    var bm = new Bitmap(bitmap);
                    bm.init();
                    var data = bm.getData();
                    socket.trigger('serialEvent', {screenshot: data, width:bm.getWidth(), height: bm.getHeight()});
        };
                

        
        
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
                //parser: Serialport.parsers.readline(';','binary'),
                parser: Serialport.parsers.raw,
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
        //
        // data is an ArrayBuffer;
        this.format = function(data, recording) {
            
            if (!waiting_for_bmp) {
                second_parser(this,data);
                return;
            }
            
            // We are receiving a Bitmap: we know it is 131638 bytes plus a checksum
            // Copy the data we received into our bitmap array buffer:
            var tmpArray = new Uint8Array(data);
            bitmap.set(tmpArray,bitmap_index);
            bitmap_index += data.byteLength;
            var percent = Math.floor(bitmap_index/1000/132*100);
            if (percent != oldpercent) {
                socket.trigger('serialEvent', {downloading: percent});
                oldpercent = percent;
            }
            if (bitmap_index > 131638) {
                waiting_for_bmp = false;
                console.log('[elecraft driver] Got the bitmap!');
                sendBitmap();
            }
            
        };
    
        // output should return a string, and is used to format
        // the data that is sent on the serial port, coming from the
        // HTML interface.
        this.output = function(data) {
            
            // We want to catch the '#BMP' command to the P3/PX3, because
            // the data returned if not semicolon-terminated at all..
            if (data.indexOf('#BMP') != -1) {
                waiting_for_bmp = true;
                bitmap_index = 0;
                console.log('Got a bitmap request, need to switch parsers for a while!');
            }
            
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
            //console.log("[rigctl_command] " + data);
            var tmpstr = [];
            var cmd = (data.substr(0,1) == "\\") ? data.substr(0,2) : data.substr(0,1);
            switch (cmd) {
                    case "\\d": // "mp_state":
                        // No f**king idea what this means, but it makes hamlib happy.
                        c.sendMessage(hamlib_init);
                        break;                
                    case "f":
                        c.sendMessage(vfoa_frequency + "\n");
                        break;
                    case "F": // Set Frequency (VFOA):  F 14069582.000000
                        var freq = ("00000000000" + parseFloat(data.substr(2)).toString()).slice(-11); // Nifty, eh ?

                        console.log("Rigctld emulation: set frequency to " + freq);
                        if (serialport != null)
                            serialport.emit('controllerCommand', "FA" + freq + ";");
                        c.sendMessage("RPRT 0\n");
                        break;
                    case "m":
                         c.sendMessage("NONE\n2500\n");
                        break;
                    case "M": // Set mode
                         // Not implemented yet
                         tmpstr = data.split(' ');
                         radio_mode = tmpstr[1];
                         c.sendMessage("RPRT 0\n");
                         break;
                    case "q":
                        // TODO: we should close the socket here ?
                        console.log("Rigctld emulation: quit");
                        c.close();
                        break;
                    case "v": // Which VFO ?
                        c.sendMessage("VFOA\n");
                        break;
                    case "T":
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
            
        var hamlib_init =   "0\n" +
                            "2\n" +
                            "2\n" +
                            "150000.000000 30000000.000000  0x900af -1 -1 0x10 000003 0x3\n" +
                            "0 0 0 0 0 0 0\n" +
                            "150000.000000 30000000.000000  0x900af -1 -1 0x10 000003 0x3\n" +
                            "0 0 0 0 0 0 0\n" +
                            "0 0\n" +
                            "0 0\n" +
                            "0\n" +
                            "0\n" +
                            "0\n" +
                            "0\n" +
                            "\n" +
                            "\n" +
                            "0x0\n" +
                            "0x0\n" +
                            "0x0\n" +
                            "0x0\n" +
                            "0x0\n" +
                            "0\n";
        var hamlib_init_2 = "0\n" +
                            "229\n" +
                           "2\n" +
                           "500000.000000 30000000.000000 0x1bf -1 -1 0x3 0x3\n" +
                           "48000000.000000 54000000.000000 0x1bf -1 -1 0x3 0x3\n" +
                           "0 0 0 0 0 0 0\n" +
                           "1800000.000000 2000000.000000 0x1bf 10 10000 0x3 0x3\n" +
                           "3500000.000000 4000000.000000 0x1bf 10 10000 0x3 0x3\n" +
                           "7000000.000000 7300000.000000 0x1bf 10 10000 0x3 0x3\n" +
                           "10100000.000000 10150000.000000 0x1bf 10 10000 0x3 0x3\n" +
                           "14000000.000000 14350000.000000 0x1bf 10 10000 0x3 0x3\n" +
                           "18068000.000000 18168000.000000 0x1bf 10 10000 0x3 0x3\n" +
                           "21000000.000000 21450000.000000 0x1bf 10 10000 0x3 0x3\n" +
                           "24890000.000000 24990000.000000 0x1bf 10 10000 0x3 0x3\n" +
                           "28000000.000000 29700000.000000 0x1bf 10 10000 0x3 0x3\n" +
                           "50000000.000000 54000000.000000 0x1bf 10 10000 0x3 0x3\n" +
                           "0 0 0 0 0 0 0\n" +
                           "0x1bf 1\n" +
                           "0 0\n" +
                           "0xc 2500\n" +
                           "0x82 500\n" +
                           "0x110 500\n" +
                           "0x1 6000\n" +
                           "0x20 6000\n" +
                           "0 0\n" +
                           "9990\n" +
                           "9990\n" +
                           "0\n" +
                           "0\n" +
                           "14 \n" +
                           "10 \n" +
                           "0x10002\n" +
                           "0x10002\n" +
                           "0x4002703b\n" +
                           "0x2703b\n" +
                           "0x0\n" +
                           "0x0";
        
        
        this.on('data', onDataReady); // when second_parser sends a 'data' message;

    }

   // Add event management to our parser, from the Backbone.Events class:
    _.extend(parser.prototype, Backbone.Events);    
    
    return parser;
});