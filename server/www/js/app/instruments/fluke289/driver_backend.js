/*
 * Browser-side Parser for Fluke multimeters.
 *
 * NOT FUNCTIONAL
 *
 * Differences with server-side parser:
 *   - 'socket' uses "trigger" to emit events, not "emit"
 * 
 * (c) 2014 Edouard Lafargue, ed@lafargue.name
 * All rights reserved.
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
                baudRate: 115200,
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
                // TODO
            } catch (err) {
                console.log("Error on serial port while requesting Fluke28x UID : " + err);
            }
        };
        
        // period in seconds
        this.startLiveStream = function(period) {
            var self = this;
            if (!streaming) {
                console.log("[fluke28x] Starting live data stream");
                // livePoller = setInterval(this.queryRadio.bind(this), (period) ? period*1000: 1000);
                streaming = true;
            }
        };
        
        this.stopLiveStream = function(args) {
            if (streaming) {
                console.log("[fluke28x] Stopping live data stream");
                clearInterval(livePoller);
                streaming = false;
            }
        };
        
        
        // Format can act on incoming data from the radio, and then
        // forwards the data to the app through a 'serialEvent' event.
        this.format = function(data, recording) {
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
            console.log("[fluke28x] got a port open signal");
        };
    
        // Not used
        this.onClose = function(success) {
            console.log("[fluke28x] got a port close signal");
        };

    }
    
    return parser;
});