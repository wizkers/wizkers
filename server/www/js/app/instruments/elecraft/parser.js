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
        
        this.socket = socket;
        
        this.portSettings = function() {
            return  {
                baudRate: 38400,
                dataBits: 8,
                parity: 'none',
                stopBits: 1,
                flowControl: false,
                // We get non-printable characters on some outputs, so
                // we have to make sure we use "binary" encoding below,
                // otherwise the parser will assume Unicode and mess up the
                // values.
                parser: Serialport.parsers.readline(';','binary'),
            }
        };

        // Called when the HTML app needs a unique identifier.
        // this is a standardized call across all drivers.
        // 
        // Returns the Radio serial number.
        this.sendUniqueID = function() {
            this.uidrequested = true;
            try {
                this.port.write("MN026;ds;MN255;");
            } catch (err) {
                console.log("Error on serial port while requesting Elecraft UID : " + err);
            }
        };

        
        // Format returns an ASCII string - or a buffer ? Radio replies with
        // non-ASCII values on some important commands (VFO A text, Icons, etc)
        this.format = function(data, recording) {

            if (this.uidrequested && data.substr(0,5) == "DS@@@") {
                // We have a Unique ID
                console.log("Sending uniqueID message");
                this.socket.trigger('uniqueID','' + data.substr(5,5));
                this.uidrequested = false;
                return;
            }

            var cmd = data.substr(0,2);
            switch(cmd) {
                    case "FA":
                        this.vfoa_frequency = parseInt(data.substr(2));
                        break;
                    case "BW":
                        this.vfoa_bandwidth = parseInt(data.substr(2));
                        break;
            }

            this.socket.trigger('serialEvent',data);
            
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
            return { tcpserverconnect: this.serverconnected };
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