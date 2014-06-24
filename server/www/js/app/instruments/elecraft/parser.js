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
 *   - No TCP server.
 *   - 'socket' uses "trigger" to emit events, not "emit"
 * 
 */

define(function(require) {
    "use strict";

    var Serialport = require('serialport');
    
    var parser = function(socket) {
        
        var socket = socket;
        var livePoller = null; // Reference to the live streaming poller
        var streaming = false;

        
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
    
        // Not used
        this.onOpen =  function(success) {
            console.log("Elecraft Driver: got a port open signal");
        };
    
        // Not used
        this.onClose = function(success) {
            console.log("Elecraft driver: got a port close signal");
        };

    }
    
    return parser;
});