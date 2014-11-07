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
        Bitmap = require('app/lib/bitmap');
                          
    
    var parser = function(socket) {
        
        var socket = socket;
        var serialport = null;
        var livePoller = null; // Reference to the live streaming poller
        var streaming = false;
                
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
            socket.sendDataToFrontend(data);
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
    
        this.onOpen =  function(port) {
            console.log("Elecraft Driver: got a port open signal");
            serialport = port;
        };
            
    
        this.onClose = function(success) {
            console.log("Elecraft driver: got a port close signal");
        };

        
        this.on('data', onDataReady); // when second_parser sends a 'data' message;

    }

   // Add event management to our parser, from the Backbone.Events class:
    _.extend(parser.prototype, Backbone.Events);    
    
    return parser;
});